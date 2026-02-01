require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { pool, logger } = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for simple frontend
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Static files
app.use(express.static('public'));

// Helper function to convert empty strings to null
const emptyToNull = (value) => (value === '' || value === undefined) ? null : value;

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date() });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// Dashboard stats
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

// Products endpoints
app.get('/api/products', async (req, res) => {
  try {
    const { search, category, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR sku ILIKE $${params.length})`;
    }
    
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    
    query += ` ORDER BY name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    // Get total count
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

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Get stock info
    const stockResult = await pool.query(`
      SELECT 
        sb.*,
        l.name as location_name
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

app.post('/api/products', async (req, res) => {
  const { name, category, sku, unit, description, cost_price } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Product name is required' });
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO products (name, category, sku, unit, description, cost_price)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name, 
        emptyToNull(category), 
        emptyToNull(sku), 
        unit || 'units', 
        emptyToNull(description), 
        emptyToNull(cost_price)
      ]
    );
    
    logger.info(`Product created: ${name} (ID: ${result.rows[0].id})`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Product creation error:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'SKU already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create product' });
    }
  }
});

app.put('/api/products/:id', async (req, res) => {
  const { name, category, sku, unit, description, cost_price } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE products 
       SET name = COALESCE($1, name),
           category = COALESCE($2, category),
           sku = COALESCE($3, sku),
           unit = COALESCE($4, unit),
           description = COALESCE($5, description),
           cost_price = COALESCE($6, cost_price),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        emptyToNull(name), 
        emptyToNull(category), 
        emptyToNull(sku), 
        emptyToNull(unit), 
        emptyToNull(description), 
        emptyToNull(cost_price), 
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

// Stock endpoints
app.get('/api/stock', async (req, res) => {
  try {
    const { location_id, expiring, status = 'active' } = req.query;
    
    let query = `
      SELECT 
        sb.*,
        p.name as product_name,
        p.sku,
        p.unit,
        l.name as location_name
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
    
    // Add stock batch
    const batchResult = await client.query(
      `INSERT INTO stock_batches (product_id, location_id, quantity, expiry_date, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        product_id, 
        emptyToNull(location_id), 
        quantity, 
        emptyToNull(expiry_date), 
        emptyToNull(notes)
      ]
    );
    
    // Log audit
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
    
    // Update batch
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
    
    // Log audit
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
    
    // Get batch info
    const batchResult = await client.query(
      'SELECT * FROM stock_batches WHERE id = $1',
      [batch_id]
    );
    
    if (batchResult.rows.length === 0) {
      throw new Error('Batch not found');
    }
    
    const batch = batchResult.rows[0];
    
    // Record discard
    await client.query(
      `INSERT INTO discarded_items (batch_id, product_id, quantity, reason, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [batch_id, batch.product_id, quantity, reason, emptyToNull(notes)]
    );
    
    // Update or remove batch
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
    
    // Log audit
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

// Expiring items
app.get('/api/expiring', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM v_expiring_items');
    res.json(result.rows);
  } catch (error) {
    logger.error('Expiring items fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch expiring items' });
  }
});

// Audit log
app.get('/api/audit', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    const result = await pool.query(
      `SELECT 
         al.*,
         p.name as product_name,
         p.sku
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

// Categories (distinct from products)
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

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`BC Inventory API running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
