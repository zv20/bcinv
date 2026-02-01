require('dotenv').config();
const cron = require('node-cron');
const { pool, logger } = require('./lib/db');

logger.info('BC Inventory Worker started');

// Check for expired items daily at midnight
cron.schedule('0 0 * * *', async () => {
  logger.info('Running daily expiry check...');
  
  try {
    // Find expired items
    const expiredResult = await pool.query(`
      SELECT 
        sb.id as batch_id,
        sb.product_id,
        sb.quantity,
        sb.expiry_date,
        p.name as product_name,
        p.sku,
        l.name as location_name
      FROM stock_batches sb
      JOIN products p ON sb.product_id = p.id
      LEFT JOIN locations l ON sb.location_id = l.id
      WHERE sb.status = 'active' 
        AND sb.expiry_date <= CURRENT_DATE
    `);
    
    if (expiredResult.rows.length > 0) {
      logger.warn(`Found ${expiredResult.rows.length} expired batches`);
      
      // Log each expired item
      for (const item of expiredResult.rows) {
        logger.warn(
          `Expired: ${item.product_name} (SKU: ${item.sku}), ` +
          `Quantity: ${item.quantity}, ` +
          `Location: ${item.location_name || 'N/A'}, ` +
          `Expiry: ${item.expiry_date}`
        );
      }
      
      // Optional: Auto-mark as expired status (but keep for manual discard)
      // await pool.query(`
      //   UPDATE stock_batches 
      //   SET status = 'expired'
      //   WHERE status = 'active' AND expiry_date <= CURRENT_DATE
      // `);
    } else {
      logger.info('No expired items found');
    }
    
    // Check items expiring soon (within warning period)
    const warningDays = parseInt(process.env.EXPIRY_WARNING_DAYS) || 7;
    const expiringResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM stock_batches
      WHERE status = 'active'
        AND expiry_date > CURRENT_DATE
        AND expiry_date <= CURRENT_DATE + INTERVAL '${warningDays} days'
    `);
    
    const expiringCount = parseInt(expiringResult.rows[0].count);
    if (expiringCount > 0) {
      logger.warn(`${expiringCount} items expiring within ${warningDays} days`);
    }
    
    logger.info('Daily expiry check completed');
  } catch (error) {
    logger.error('Expiry check error:', error);
  }
});

// Health check every hour
cron.schedule('0 * * * *', async () => {
  try {
    await pool.query('SELECT 1');
    logger.info('Database connection healthy');
  } catch (error) {
    logger.error('Database connection check failed:', error);
  }
});

// Cleanup old audit logs (keep 90 days)
cron.schedule('0 2 * * *', async () => {
  logger.info('Running audit log cleanup...');
  
  try {
    const result = await pool.query(`
      DELETE FROM audit_log
      WHERE created_at < CURRENT_DATE - INTERVAL '90 days'
    `);
    
    if (result.rowCount > 0) {
      logger.info(`Cleaned up ${result.rowCount} old audit log entries`);
    } else {
      logger.info('No old audit logs to clean up');
    }
  } catch (error) {
    logger.error('Audit log cleanup error:', error);
  }
});

logger.info('Worker cron jobs scheduled:');
logger.info('  - Daily expiry check: 00:00');
logger.info('  - Health check: Every hour');
logger.info('  - Audit cleanup: 02:00');

// Keep process alive
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down worker');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down worker');
  process.exit(0);
});
