const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const winston = require('winston');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bcinv',
  user: process.env.DB_USER || 'bcinv_user',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ============================================
// PRODUCTS API
// ============================================

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR sku ILIKE $${params.length})`;
    }

    query += ' ORDER BY name ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error fetching product:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Create product
app.post('/api/products', async (req, res) => {
  try {
    const { name, sku, category, unit, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const result = await pool.query(
      'INSERT INTO products (name, sku, category, unit, description) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, sku || null, category || null, unit || 'units', description || null]
    );

    logger.info(`Product created: ${name}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Error creating product:', err);
    if (err.code === '23505') {
      res.status(400).json({ error: 'SKU already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create product' });
    }
  }
});

// Update product
app.put('/api/products/:id', async (req, res) => {
  try {
    const { name, sku, category, unit, description } = req.body;
    const result = await pool.query(
      'UPDATE products SET name = $1, sku = $2, category = $3, unit = $4, description = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
      [name, sku, category, unit, description, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    logger.info(`Product updated: ${name}`);
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error updating product:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING name', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    logger.info(`Product deleted: ${result.rows[0].name}`);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    logger.error('Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ============================================
// STOCK API
// ============================================

// Get all stock (active only)
app.get('/api/stock', async (req, res) => {
  try {
    const { location, status } = req.query;
    let query = 'SELECT * FROM active_stock WHERE 1=1';
    const params = [];

    if (location) {
      params.push(location);
      query += ` AND location = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY expiry_date ASC NULLS LAST, product_name ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching stock:', err);
    res.status(500).json({ error: 'Failed to fetch stock' });
  }
});

// Add stock batch
app.post('/api/stock/add', async (req, res) => {
  try {
    const { product_id, quantity, expiry_date, location, notes } = req.body;

    if (!product_id || !quantity) {
      return res.status(400).json({ error: 'Product ID and quantity are required' });
    }

    const result = await pool.query(
      'INSERT INTO stock_batches (product_id, quantity, expiry_date, location, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [product_id, quantity, expiry_date || null, location || null, notes || null]
    );

    logger.info(`Stock added: Product ${product_id}, Quantity ${quantity}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Error adding stock:', err);
    res.status(500).json({ error: 'Failed to add stock' });
  }
});

// Update stock quantity
app.put('/api/stock/update/:id', async (req, res) => {
  try {
    const { quantity, location, notes } = req.body;

    if (quantity === undefined) {
      return res.status(400).json({ error: 'Quantity is required' });
    }

    const result = await pool.query(
      'UPDATE stock_batches SET quantity = $1, location = COALESCE($2, location), notes = COALESCE($3, notes), updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND discarded = FALSE RETURNING *',
      [quantity, location, notes, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stock batch not found' });
    }

    logger.info(`Stock updated: Batch ${req.params.id}, Quantity ${quantity}`);
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error updating stock:', err);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// Mark stock as damaged
app.put('/api/stock/damage/:id', async (req, res) => {
  try {
    const { damage_reason } = req.body;

    const result = await pool.query(
      'UPDATE stock_batches SET damaged = TRUE, damage_reason = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND discarded = FALSE RETURNING *',
      [damage_reason || 'Not specified', req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stock batch not found' });
    }

    logger.info(`Stock marked as damaged: Batch ${req.params.id}`);
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error marking stock as damaged:', err);
    res.status(500).json({ error: 'Failed to mark stock as damaged' });
  }
});

// Discard stock batch
app.post('/api/stock/discard/:id', async (req, res) => {
  try {
    const { discard_reason } = req.body;

    const result = await pool.query(
      'UPDATE stock_batches SET discarded = TRUE, discarded_at = CURRENT_TIMESTAMP, discard_reason = $1 WHERE id = $2 AND discarded = FALSE RETURNING *',
      [discard_reason || 'Manual discard', req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stock batch not found or already discarded' });
    }

    logger.info(`Stock discarded: Batch ${req.params.id}`);
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error discarding stock:', err);
    res.status(500).json({ error: 'Failed to discard stock' });
  }
});

// Get expiring items (within 7 days)
app.get('/api/stock/expiring', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM expiring_items ORDER BY expiry_date ASC');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching expiring items:', err);
    res.status(500).json({ error: 'Failed to fetch expiring items' });
  }
});

// Get expired items
app.get('/api/stock/expired', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM expired_items ORDER BY expiry_date ASC');
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching expired items:', err);
    res.status(500).json({ error: 'Failed to fetch expired items' });
  }
});

// ============================================
// DASHBOARD API
// ============================================

app.get('/api/dashboard', async (req, res) => {
  try {
    const stats = {};

    // Total products
    const productsResult = await pool.query('SELECT COUNT(*) as count FROM products');
    stats.total_products = parseInt(productsResult.rows[0].count);

    // Total active stock batches
    const stockResult = await pool.query('SELECT COUNT(*) as count FROM stock_batches WHERE discarded = FALSE');
    stats.total_stock_batches = parseInt(stockResult.rows[0].count);

    // Expiring soon (7 days)
    const expiringResult = await pool.query('SELECT COUNT(*) as count FROM expiring_items');
    stats.expiring_soon = parseInt(expiringResult.rows[0].count);

    // Already expired
    const expiredResult = await pool.query('SELECT COUNT(*) as count FROM expired_items');
    stats.expired = parseInt(expiredResult.rows[0].count);

    // Damaged items
    const damagedResult = await pool.query('SELECT COUNT(*) as count FROM stock_batches WHERE damaged = TRUE AND discarded = FALSE');
    stats.damaged = parseInt(damagedResult.rows[0].count);

    // Categories count
    const categoriesResult = await pool.query('SELECT COUNT(DISTINCT category) as count FROM products WHERE category IS NOT NULL');
    stats.categories = parseInt(categoriesResult.rows[0].count);

    // Locations count
    const locationsResult = await pool.query('SELECT COUNT(DISTINCT location) as count FROM stock_batches WHERE location IS NOT NULL AND discarded = FALSE');
    stats.locations = parseInt(locationsResult.rows[0].count);

    res.json(stats);
  } catch (err) {
    logger.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`BCInv API Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing server...');
  await pool.end();
  process.exit(0);
});
