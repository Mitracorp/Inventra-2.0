const express = require('express');
const router = express.Router();
const cleanupAuditLogs = require('../../database/cleanup_audit_logs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * GET /api/maintenance/cleanup-audit-logs
 * Manually trigger audit log cleanup (Admin only)
 */
router.post('/cleanup-audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { retentionDays = 30 } = req.body;
    
    console.log(`🧹 Manual cleanup triggered by user: ${req.user.username} (ID: ${req.user.userId})`);
    
    const result = await cleanupAuditLogs(retentionDays);
    
    res.json({
      success: true,
      message: 'Audit log cleanup completed successfully',
      data: {
        deletedLogs: result.deleted_logs,
        deletedChanges: result.deleted_changes,
        retentionDays: retentionDays
      }
    });
    
  } catch (error) {
    console.error('Error in cleanup endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup audit logs',
      error: error.message
    });
  }
});

/**
 * GET /api/maintenance/audit-log-stats
 * Get audit log statistics
 */
router.get('/audit-log-stats', authenticateToken, async (req, res) => {
  try {
    const db = require('../config/database');
    
    const [stats] = await db.pool.query(`
      SELECT 
        COUNT(*) as total_logs,
        COUNT(CASE WHEN Timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as last_7_days,
        COUNT(CASE WHEN Timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as last_30_days,
        COUNT(CASE WHEN Timestamp < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as older_than_30_days,
        MIN(Timestamp) as oldest_log,
        MAX(Timestamp) as newest_log
      FROM HISTORY_LOG
    `);
    
    const [changeStats] = await db.pool.query(`
      SELECT COUNT(*) as total_changes FROM HISTORY_LOG_CHANGES
    `);
    
    res.json({
      success: true,
      data: {
        ...stats[0],
        total_changes: changeStats[0].total_changes
      }
    });
    
  } catch (error) {
    console.error('Error fetching audit log stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit log statistics',
      error: error.message
    });
  }
});

module.exports = router;
