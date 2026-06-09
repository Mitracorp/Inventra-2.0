const logger = require('../utils/logger');
const { executeQuery } = require('../config/database');

// Simple scheduled cleanup placeholder - runs every hour
const start = () => {
  try {
    logger.info('Audit log cleanup scheduler starting (stub)');
    setInterval(async () => {
      try {
        // Placeholder: delete audit logs older than 365 days (no-op if table missing)
        await executeQuery('DELETE FROM audit_log WHERE created_at < DATE_SUB(NOW(), INTERVAL 365 DAY)');
        logger.info('Audit log cleanup executed (stub)');
      } catch (e) {
        // Log but don't crash
        logger.warn('Audit log cleanup failed (likely missing table):', e.message || e);
      }
    }, 1000 * 60 * 60); // hourly
  } catch (e) {
    logger.error('Failed to start audit log cleanup scheduler:', e);
  }
};

// Start automatically when required
start();

module.exports = { start };
