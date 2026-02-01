const { Pool } = require('pg');
const cron = require('node-cron');
const winston = require('winston');
require('dotenv').config();

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bcinv',
  user: process.env.DB_USER || 'bcinv_user',
  password: process.env.DB_PASSWORD,
  max: 5,
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
    new winston.transports.File({ filename: 'logs/worker.log' }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' })
  ]
});

// ============================================
// EXPIRY CHECK TASK
// ============================================

async function checkExpiredItems() {
  try {
    logger.info('Running expiry check...');

    // Get expired items that haven't been discarded
    const result = await pool.query(`
      SELECT 
        sb.id,
        sb.product_id,
        p.name as product_name,
        p.sku,
        sb.quantity,
        sb.expiry_date,
        sb.location,
        CURRENT_DATE - sb.expiry_date as days_expired
      FROM stock_batches sb
      JOIN products p ON sb.product_id = p.id
      WHERE sb.discarded = FALSE
        AND sb.expiry_date IS NOT NULL
        AND sb.expiry_date < CURRENT_DATE
      ORDER BY sb.expiry_date ASC
    `);

    const expiredCount = result.rows.length;

    if (expiredCount > 0) {
      logger.warn(`Found ${expiredCount} expired item(s):`);
      
      result.rows.forEach(item => {
        logger.warn(`  - ${item.product_name} (${item.sku || 'No SKU'}) at ${item.location || 'unknown location'}: ${item.quantity} ${item.unit || 'units'}, expired ${item.days_expired} day(s) ago`);
      });

      // You can add email notifications here in the future
      // await sendExpiryAlertEmail(result.rows);
    } else {
      logger.info('No expired items found');
    }

    // Check items expiring soon (within 3 days)
    const soonResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM stock_batches
      WHERE discarded = FALSE
        AND expiry_date IS NOT NULL
        AND expiry_date >= CURRENT_DATE
        AND expiry_date <= CURRENT_DATE + INTERVAL '3 days'
    `);

    const expiringSoon = parseInt(soonResult.rows[0].count);
    if (expiringSoon > 0) {
      logger.warn(`${expiringSoon} item(s) expiring within 3 days`);
    }

    logger.info('Expiry check completed');

  } catch (err) {
    logger.error('Error during expiry check:', err);
  }
}

// ============================================
// CLEANUP OLD DISCARDED ITEMS
// ============================================

async function cleanupOldDiscarded() {
  try {
    logger.info('Running cleanup of old discarded items...');

    // Delete discarded items older than 90 days
    const result = await pool.query(`
      DELETE FROM stock_batches
      WHERE discarded = TRUE
        AND discarded_at < CURRENT_DATE - INTERVAL '90 days'
      RETURNING id
    `);

    const deletedCount = result.rowCount;

    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} old discarded item(s)`);
    } else {
      logger.info('No old discarded items to clean up');
    }

  } catch (err) {
    logger.error('Error during cleanup:', err);
  }
}

// ============================================
// SCHEDULE TASKS
// ============================================

logger.info('BCInv Worker started');
logger.info('Scheduling tasks...');

// Run expiry check daily at 6 AM
cron.schedule('0 6 * * *', () => {
  logger.info('Triggering scheduled expiry check (6 AM)');
  checkExpiredItems();
});

// Run cleanup weekly on Sundays at 2 AM
cron.schedule('0 2 * * 0', () => {
  logger.info('Triggering scheduled cleanup (Sunday 2 AM)');
  cleanupOldDiscarded();
});

// Run expiry check on startup (for testing)
logger.info('Running initial expiry check...');
checkExpiredItems();

logger.info('Worker is running. Scheduled tasks:');
logger.info('  - Expiry check: Daily at 6 AM');
logger.info('  - Cleanup: Sundays at 2 AM');

// Keep process alive
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing worker...');
  await pool.end();
  process.exit(0);
});
