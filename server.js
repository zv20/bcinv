require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const cookieParser = require('cookie-parser');
const { pool, logger } = require('./lib/db');
const { deviceDetector, setDevicePreference } = require('./lib/device-detector');
const CSVExporter = require('./lib/exporters/csv-exporter');
const PDFExporter = require('./lib/exporters/pdf-exporter');
const ExcelExporter = require('./lib/exporters/excel-exporter');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Device detection middleware
app.use(deviceDetector);
app.use(setDevicePreference);

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} [${req.device.type}]`);
  next();
});

app.use(express.static('public'));

const emptyToNull = (value) => (value === '' || value === undefined) ? null : value;

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date() });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT COUNT(*) FROM locations) as total_locations,
        (SELECT COALESCE(SUM(quantity), 0) FROM stock_batches WHERE status = 'active') as total_stock,
        (SELECT COUNT(*) FROM stock_batches WHERE status = 'active' AND expiry_date <= CURRENT_DATE + INTERVAL '7 days' AND expiry_date > CURRENT_DATE) as expiring_soon,
        (SELECT COUNT(*) FROM stock_batches WHERE status = 'active' AND expiry_date <= CURRENT_DATE) as expired,
        (SELECT COUNT(*) FROM audit_log WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as recent_audits
    `);
    
    res.json(stats.rows[0]);
  } catch (error) {
    logger.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Device info endpoint
app.get('/api/device', (req, res) => {
  res.json(req.device);
});

// Products endpoints
app.get('/api/products', async (req, res) => {
  try {
    const { search, category, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT p.*, d.name as department_name, s.name as supplier_name 
      FROM products p
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`;
    }
    
    if (category) {
      params.push(category);
      query += ` AND p.category = $${params.length}`;
    }
    
    query += ` ORDER BY p.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM products');
    
    res.json({
      products: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Products fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Product search endpoint (enhanced for mobile)
app.get('/api/products/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json({ products: [], query: q });
    }
    
    const searchTerm = q.trim();
    
    // Search across name, SKU, barcode, and description
    const query = `
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.barcode,
        p.category,
        p.unit,
        d.name as department,
        l.name as location,
        COALESCE(SUM(sb.quantity), 0)::INTEGER as quantity,
        MIN(sb.expiry_date) as expiration_date,
        -- Relevance scoring
        CASE
          WHEN p.barcode = $1 THEN 100
          WHEN p.sku = $1 THEN 90
          WHEN p.name ILIKE $1 THEN 80
          WHEN p.name ILIKE $2 THEN 70
          WHEN p.sku ILIKE $2 THEN 60
          WHEN p.barcode ILIKE $2 THEN 50
          ELSE 40
        END as relevance
      FROM products p
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN stock_batches sb ON p.id = sb.product_id AND sb.status = 'active'
      LEFT JOIN locations l ON sb.location_id = l.id
      WHERE 
        p.name ILIKE $2 OR
        p.sku ILIKE $2 OR
        p.barcode ILIKE $2 OR
        p.description ILIKE $2 OR
        p.barcode = $1 OR
        p.sku = $1
      GROUP BY p.id, p.name, p.sku, p.barcode, p.category, p.unit, d.name, l.name
      ORDER BY relevance DESC, p.name ASC
      LIMIT $3
    `;
    
    const result = await pool.query(query, [searchTerm, `%${searchTerm}%`, parseInt(limit)]);
    
    res.json({
      products: result.rows,
      query: searchTerm,
      count: result.rows.length
    });
  } catch (error) {
    logger.error('Product search error:', error);
    res.status(500).json({ error: 'Search failed', products: [] });
  }
});

// Low stock products endpoint
app.get('/api/products/low-stock', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.unit,
        COALESCE(SUM(sb.quantity), 0)::INTEGER as quantity,
        p.min_stock_level,
        d.name as department,
        s.name as supplier
      FROM products p
      LEFT JOIN stock_batches sb ON p.id = sb.product_id AND sb.status = 'active'
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.min_stock_level IS NOT NULL
      GROUP BY p.id, p.name, p.sku, p.unit, p.min_stock_level, d.name, s.name
      HAVING COALESCE(SUM(sb.quantity), 0) < p.min_stock_level
      ORDER BY (p.min_stock_level - COALESCE(SUM(sb.quantity), 0)) DESC
    `;
    
    const result = await pool.query(query);
    res.json({ products: result.rows });
  } catch (error) {
    logger.error('Low stock fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch low stock items' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const stockResult = await pool.query(`
      SELECT sb.*, l.name as location_name
      FROM stock_batches sb
      LEFT JOIN locations l ON sb.location_id = l.id
      WHERE sb.product_id = $1 AND sb.status = 'active'
      ORDER BY sb.expiry_date ASC NULLS LAST
    `, [req.params.id]);
    
    res.json({
      product: result.rows[0],
      stock_batches: stockResult.rows
    });
  } catch (error) {
    logger.error('Product fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Product batch endpoints
app.get('/api/products/:id/batches', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        sb.id,
        sb.product_id,
        sb.location_id,
        sb.quantity,
        sb.expiry_date,
        sb.batch_number,
        sb.received_at as received_date,
        sb.status,
        l.name as location_name
      FROM stock_batches sb
      LEFT JOIN locations l ON sb.location_id = l.id
      WHERE sb.product_id = $1 AND sb.status = 'active'
      ORDER BY sb.expiry_date ASC NULLS LAST
    `, [req.params.id]);
    
    res.json({ batches: result.rows });
  } catch (error) {
    logger.error('Batches fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

app.post('/api/products/:id/batches', async (req, res) => {
  const { location_id, quantity, expiration_date, batch_number, notes, received_date } = req.body;
  const product_id = req.params.id;
  
  if (!quantity) {
    return res.status(400).json({ error: 'Quantity is required' });
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO stock_batches (product_id, location_id, quantity, expiry_date, batch_number, notes, received_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        product_id, 
        emptyToNull(location_id), 
        quantity, 
        emptyToNull(expiration_date), 
        emptyToNull(batch_number), 
        emptyToNull(notes),
        received_date || new Date().toISOString()
      ]
    );
    
    await pool.query(
      `INSERT INTO audit_log (product_id, batch_id, action, quantity_change, reason, notes)
       VALUES ($1, $2, 'add_batch', $3, 'new_batch', $4)`,
      [product_id, result.rows[0].id, quantity, emptyToNull(notes)]
    );
    
    logger.info(`Batch added: Product ${product_id}, Quantity ${quantity}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Batch add error:', error);
    res.status(500).json({ error: 'Failed to add batch' });
  }
});

app.post('/api/products/:id/batches/deduct', async (req, res) => {
  const { updates } = req.body;
  const product_id = req.params.id;
  
  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({ error: 'Updates array is required' });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const update of updates) {
      await client.query(
        'UPDATE stock_batches SET quantity = $1 WHERE id = $2',
        [update.new_quantity, update.batch_id]
      );
      
      // Delete batch if quantity is 0
      if (update.new_quantity <= 0) {
        await client.query(
          "UPDATE stock_batches SET status = 'depleted' WHERE id = $1",
          [update.batch_id]
        );
      }
    }
    
    await client.query('COMMIT');
    res.json({ message: 'Batches updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Batch deduct error:', error);
    res.status(500).json({ error: 'Failed to deduct from batches' });
  } finally {
    client.release();
  }
});

// Sync product quantity from batches
app.post('/api/products/:id/sync-quantity', async (req, res) => {
  const product_id = req.params.id;
  
  try {
    // This endpoint doesn't actually update a quantity column since we use calculated quantities
    // But we can use it to trigger a refresh or validation
    const result = await pool.query(`
      SELECT COALESCE(SUM(quantity), 0) as total
      FROM stock_batches
      WHERE product_id = $1 AND status = 'active'
    `, [product_id]);
    
    res.json({ 
      message: 'Quantity synced', 
      total_quantity: parseInt(result.rows[0].total)
    });
  } catch (error) {
    logger.error('Sync quantity error:', error);
    res.status(500).json({ error: 'Failed to sync quantity' });
  }
});

// Discard specific batch
app.post('/api/products/:id/batches/:batchId/discard', async (req, res) => {
  const { reason } = req.body;
  const product_id = req.params.id;
  const batch_id = req.params.batchId;
  
  if (!reason) {
    return res.status(400).json({ error: 'Reason is required' });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get batch info
    const batchResult = await client.query(
      'SELECT * FROM stock_batches WHERE id = $1 AND product_id = $2',
      [batch_id, product_id]
    );
    
    if (batchResult.rows.length === 0) {
      throw new Error('Batch not found');
    }
    
    const batch = batchResult.rows[0];
    
    // Mark batch as discarded
    await client.query(
      "UPDATE stock_batches SET status = 'discarded', quantity = 0 WHERE id = $1",
      [batch_id]
    );
    
    // Log the discard
    await client.query(
      `INSERT INTO audit_log (product_id, batch_id, action, quantity_change, reason, notes)
       VALUES ($1, $2, 'discard_batch', $3, $4, 'Batch discarded')`,
      [product_id, batch_id, -batch.quantity, reason]
    );
    
    await client.query('COMMIT');
    
    logger.info(`Batch ${batch_id} discarded: ${batch.quantity} units, reason: ${reason}`);
    res.json({ message: 'Batch discarded successfully', quantity_discarded: batch.quantity });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Batch discard error:', error);
    res.status(500).json({ error: 'Failed to discard batch' });
  } finally {
    client.release();
  }
});

// Product discard endpoint
app.post('/api/products/:id/discard', async (req, res) => {
  const { quantity, reason, notes } = req.body;
  const product_id = req.params.id;
  
  if (!quantity || !reason) {
    return res.status(400).json({ error: 'Quantity and reason are required' });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get oldest batch (FIFO)
    const batchResult = await client.query(
      `SELECT * FROM stock_batches 
       WHERE product_id = $1 AND status = 'active' AND quantity > 0
       ORDER BY expiry_date ASC NULLS LAST
       LIMIT 1`,
      [product_id]
    );
    
    if (batchResult.rows.length === 0) {
      throw new Error('No active batches found');
    }
    
    const batch = batchResult.rows[0];
    const discardQty = Math.min(quantity, batch.quantity);
    const newQuantity = batch.quantity - discardQty;
    
    // Update batch quantity
    await client.query(
      `UPDATE stock_batches SET quantity = $1, status = CASE WHEN $1 <= 0 THEN 'discarded' ELSE status END WHERE id = $2`,
      [newQuantity, batch.id]
    );
    
    // Log the discard
    await client.query(
      `INSERT INTO audit_log (product_id, batch_id, action, quantity_change, reason, notes)
       VALUES ($1, $2, 'discard', $3, $4, $5)`,
      [product_id, batch.id, -discardQty, reason, emptyToNull(notes)]
    );
    
    await client.query('COMMIT');
    
    logger.info(`Product ${product_id} discarded: ${discardQty} units, reason: ${reason}`);
    res.json({ message: 'Product discarded successfully', quantity_discarded: discardQty });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Product discard error:', error);
    res.status(500).json({ error: 'Failed to discard product' });
  } finally {
    client.release();
  }
});

// Product adjust endpoint
app.post('/api/products/:id/adjust', async (req, res) => {
  const { new_quantity, reason, notes } = req.body;
  const product_id = req.params.id;
  
  if (new_quantity === undefined || !reason) {
    return res.status(400).json({ error: 'New quantity and reason are required' });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get oldest batch (FIFO)
    const batchResult = await client.query(
      `SELECT * FROM stock_batches 
       WHERE product_id = $1 AND status = 'active'
       ORDER BY expiry_date ASC NULLS LAST
       LIMIT 1`,
      [product_id]
    );
    
    if (batchResult.rows.length === 0) {
      throw new Error('No active batches found');
    }
    
    const batch = batchResult.rows[0];
    const oldQuantity = batch.quantity;
    const quantityChange = new_quantity - oldQuantity;
    
    // Update batch quantity
    await client.query(
      'UPDATE stock_batches SET quantity = $1, last_audit_at = CURRENT_TIMESTAMP WHERE id = $2',
      [new_quantity, batch.id]
    );
    
    // Log the adjustment
    await client.query(
      `INSERT INTO audit_log (product_id, batch_id, action, quantity_change, reason, notes)
       VALUES ($1, $2, 'adjust', $3, $4, $5)`,
      [product_id, batch.id, quantityChange, reason, emptyToNull(notes)]
    );
    
    await client.query('COMMIT');
    
    logger.info(`Product ${product_id} adjusted: ${oldQuantity} -> ${new_quantity}, reason: ${reason}`);
    res.json({ message: 'Inventory adjusted successfully', old_quantity: oldQuantity, new_quantity });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Product adjust error:', error);
    res.status(500).json({ error: 'Failed to adjust inventory' });
  } finally {
    client.release();
  }
});

app.post('/api/products', async (req, res) => {
  const { name, category, sku, barcode, unit, description, cost_price, department_id, supplier_id, min_stock_level, storage_location_id, shelf_location_id } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Product name is required' });
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO products (name, category, sku, barcode, unit, description, cost_price, department_id, supplier_id, min_stock_level, storage_location_id, shelf_location_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        name, 
        emptyToNull(category), 
        emptyToNull(sku),
        emptyToNull(barcode),
        unit || 'units', 
        emptyToNull(description), 
        emptyToNull(cost_price),
        emptyToNull(department_id),
        emptyToNull(supplier_id),
        emptyToNull(min_stock_level) || 10,
        emptyToNull(storage_location_id),
        emptyToNull(shelf_location_id)
      ]
    );
    
    logger.info(`Product created: ${name} (ID: ${result.rows[0].id})`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Product creation error:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'SKU or barcode already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create product' });
    }
  }
});

app.put('/api/products/:id', async (req, res) => {
  const { name, category, sku, barcode, unit, description, cost_price, department_id, supplier_id, min_stock_level, storage_location_id, shelf_location_id } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE products 
       SET name = COALESCE($1, name),
           category = $2,
           sku = $3,
           barcode = $4,
           unit = $5,
           description = $6,
           cost_price = $7,
           department_id = $8,
           supplier_id = $9,
           min_stock_level = $10,
           storage_location_id = $11,
           shelf_location_id = $12,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $13
       RETURNING *`,
      [
        emptyToNull(name), 
        emptyToNull(category), 
        emptyToNull(sku),
        emptyToNull(barcode),
        emptyToNull(unit), 
        emptyToNull(description), 
        emptyToNull(cost_price),
        emptyToNull(department_id),
        emptyToNull(supplier_id),
        emptyToNull(min_stock_level),
        emptyToNull(storage_location_id),
        emptyToNull(shelf_location_id),
        req.params.id
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    logger.info(`Product updated: ${result.rows[0].name} (ID: ${req.params.id})`);
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Product update error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING name', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    logger.info(`Product deleted: ${result.rows[0].name} (ID: ${req.params.id})`);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    logger.error('Product deletion error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Export endpoints
app.get('/api/export/expiring-soon', async (req, res) => {
  try {
    const { days = 7, format = 'csv' } = req.query;
    
    if (format === 'csv') {
      const csvData = await CSVExporter.exportExpiringSoon(pool, parseInt(days));
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="expiring-soon-${days}days.csv"`);
      res.send(csvData);
    } else if (format === 'pdf') {
      const pdfBuffer = await PDFExporter.exportExpiringSoon(pool, parseInt(days));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="expiring-soon-${days}days.pdf"`);
      res.send(pdfBuffer);
    } else if (format === 'excel') {
      const excelBuffer = await ExcelExporter.exportExpiringSoon(pool, parseInt(days));
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="expiring-soon-${days}days.xlsx"`);
      res.send(excelBuffer);
    } else {
      res.status(400).json({ error: 'Invalid format. Use csv, pdf, or excel' });
    }
  } catch (error) {
    logger.error('Export expiring soon error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

app.get('/api/export/full-inventory', async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    
    if (format === 'csv') {
      const csvData = await CSVExporter.exportFullInventory(pool);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="full-inventory.csv"');
      res.send(csvData);
    } else if (format === 'pdf') {
      res.status(400).json({ error: 'PDF format not available for full inventory. Use CSV or Excel.' });
    } else if (format === 'excel') {
      const excelBuffer = await ExcelExporter.exportFullInventory(pool);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="full-inventory.xlsx"');
      res.send(excelBuffer);
    } else {
      res.status(400).json({ error: 'Invalid format. Use csv or excel' });
    }
  } catch (error) {
    logger.error('Export full inventory error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Departments endpoints
app.get('/api/departments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM departments ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    logger.error('Departments fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

app.post('/api/departments', async (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Department name is required' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO departments (name, description) VALUES ($1, $2) RETURNING *',
      [name, emptyToNull(description)]
    );
    
    logger.info(`Department created: ${name}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Department creation error:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Department name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create department' });
    }
  }
});

app.put('/api/departments/:id', async (req, res) => {
  const { name, description } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE departments SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, emptyToNull(description), req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Department update error:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

app.delete('/api/departments/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM departments WHERE id = $1 RETURNING name', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    logger.error('Department deletion error:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

// Suppliers endpoints
app.get('/api/suppliers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM suppliers ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    logger.error('Suppliers fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

app.post('/api/suppliers', async (req, res) => {
  const { name, contact_name, phone, email, address, notes } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Supplier name is required' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO suppliers (name, contact_name, phone, email, address, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, emptyToNull(contact_name), emptyToNull(phone), emptyToNull(email), emptyToNull(address), emptyToNull(notes)]
    );
    
    logger.info(`Supplier created: ${name}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Supplier creation error:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Supplier name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create supplier' });
    }
  }
});

app.put('/api/suppliers/:id', async (req, res) => {
  const { name, contact_name, phone, email, address, notes } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE suppliers SET name = $1, contact_name = $2, phone = $3, email = $4, address = $5, notes = $6 WHERE id = $7 RETURNING *',
      [name, emptyToNull(contact_name), emptyToNull(phone), emptyToNull(email), emptyToNull(address), emptyToNull(notes), req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Supplier update error:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

app.delete('/api/suppliers/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM suppliers WHERE id = $1 RETURNING name', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    logger.error('Supplier deletion error:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

// Locations endpoints
app.get('/api/locations', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM locations ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    logger.error('Locations fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

app.post('/api/locations', async (req, res) => {
  const { name, section, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Location name is required' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO locations (name, section, description) VALUES ($1, $2, $3) RETURNING *',
      [name, emptyToNull(section), emptyToNull(description)]
    );
    
    logger.info(`Location created: ${name}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Location creation error:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Location name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create location' });
    }
  }
});

app.put('/api/locations/:id', async (req, res) => {
  const { name, section, description } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE locations SET name = $1, section = $2, description = $3 WHERE id = $4 RETURNING *',
      [name, emptyToNull(section), emptyToNull(description), req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Location update error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

app.delete('/api/locations/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM locations WHERE id = $1 RETURNING name', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    logger.error('Location deletion error:', error);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

// Stock endpoints
app.get('/api/stock', async (req, res) => {
  try {
    const { location_id, expiring, status = 'active' } = req.query;
    
    let query = `
      SELECT sb.*, p.name as product_name, p.sku, p.unit, l.name as location_name
      FROM stock_batches sb
      JOIN products p ON sb.product_id = p.id
      LEFT JOIN locations l ON sb.location_id = l.id
      WHERE sb.status = $1
    `;
    const params = [status];
    
    if (location_id) {
      params.push(location_id);
      query += ` AND sb.location_id = $${params.length}`;
    }
    
    if (expiring === 'true') {
      query += ` AND sb.expiry_date <= CURRENT_DATE + INTERVAL '7 days' AND sb.expiry_date > CURRENT_DATE`;
    }
    
    query += ' ORDER BY sb.expiry_date ASC NULLS LAST, p.name';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    logger.error('Stock fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch stock' });
  }
});

app.post('/api/stock/add', async (req, res) => {
  const { product_id, location_id, quantity, expiry_date, notes } = req.body;
  
  if (!product_id || !quantity) {
    return res.status(400).json({ error: 'Product ID and quantity are required' });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const batchResult = await client.query(
      `INSERT INTO stock_batches (product_id, location_id, quantity, expiry_date, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [product_id, emptyToNull(location_id), quantity, emptyToNull(expiry_date), emptyToNull(notes)]
    );
    
    await client.query(
      `INSERT INTO audit_log (product_id, batch_id, action, quantity_change, reason, notes)
       VALUES ($1, $2, 'add_stock', $3, 'stock_added', $4)`,
      [product_id, batchResult.rows[0].id, quantity, emptyToNull(notes)]
    );
    
    await client.query('COMMIT');
    
    logger.info(`Stock added: Product ${product_id}, Quantity ${quantity}`);
    res.status(201).json(batchResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Stock add error:', error);
    res.status(500).json({ error: 'Failed to add stock' });
  } finally {
    client.release();
  }
});

app.post('/api/stock/adjust', async (req, res) => {
  const { batch_id, quantity, reason, notes } = req.body;
  
  if (!batch_id || quantity === undefined) {
    return res.status(400).json({ error: 'Batch ID and quantity are required' });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const result = await client.query(
      `UPDATE stock_batches 
       SET quantity = $1, last_audit_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [quantity, batch_id]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Batch not found');
    }
    
    await client.query(
      `INSERT INTO audit_log (product_id, batch_id, action, quantity_change, reason, notes)
       VALUES ($1, $2, 'adjust_stock', $3, $4, $5)`,
      [result.rows[0].product_id, batch_id, quantity, reason || 'manual_audit', emptyToNull(notes)]
    );
    
    await client.query('COMMIT');
    
    logger.info(`Stock adjusted: Batch ${batch_id}, New quantity ${quantity}`);
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Stock adjust error:', error);
    res.status(500).json({ error: 'Failed to adjust stock' });
  } finally {
    client.release();
  }
});

app.post('/api/stock/discard', async (req, res) => {
  const { batch_id, quantity, reason, notes } = req.body;
  
  if (!batch_id || !quantity || !reason) {
    return res.status(400).json({ error: 'Batch ID, quantity, and reason are required' });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const batchResult = await client.query(
      'SELECT * FROM stock_batches WHERE id = $1',
      [batch_id]
    );
    
    if (batchResult.rows.length === 0) {
      throw new Error('Batch not found');
    }
    
    const batch = batchResult.rows[0];
    
    // Removed INSERT INTO discarded_items - table doesn't exist
    
    const newQuantity = batch.quantity - quantity;
    if (newQuantity <= 0) {
      await client.query(
        `UPDATE stock_batches SET status = 'discarded', quantity = 0 WHERE id = $1`,
        [batch_id]
      );
    } else {
      await client.query(
        `UPDATE stock_batches SET quantity = $1 WHERE id = $2`,
        [newQuantity, batch_id]
      );
    }
    
    await client.query(
      `INSERT INTO audit_log (product_id, batch_id, action, quantity_change, reason, notes)
       VALUES ($1, $2, 'discard', $3, $4, $5)`,
      [batch.product_id, batch_id, -quantity, reason, emptyToNull(notes)]
    );
    
    await client.query('COMMIT');
    
    logger.info(`Stock discarded: Batch ${batch_id}, Quantity ${quantity}, Reason: ${reason}`);
    res.json({ message: 'Stock discarded successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Stock discard error:', error);
    res.status(500).json({ error: 'Failed to discard stock' });
  } finally {
    client.release();
  }
});

app.get('/api/expiring', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM v_expiring_items');
    res.json(result.rows);
  } catch (error) {
    logger.error('Expiring items fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch expiring items' });
  }
});

app.get('/api/audit', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    const result = await pool.query(
      `SELECT al.*, p.name as product_name, p.sku
       FROM audit_log al
       JOIN products p ON al.product_id = p.id
       ORDER BY al.created_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Audit log fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category'
    );
    res.json(result.rows.map(r => r.category));
  } catch (error) {
    logger.error('Categories fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`BC Inventory API running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
