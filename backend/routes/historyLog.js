const express = require('express');
const router = express.Router();
const historyLogController = require('../controllers/historyLogController');
const { authenticateToken } = require('../middleware/auth');

// Get history logs with pagination and filtering (protected route)
router.get('/', authenticateToken, historyLogController.getHistoryLogs);

// Get filter options (users, tables, action types)
router.get('/filter-options', authenticateToken, historyLogController.getFilterOptions);

// Get audit report summary statistics
router.get('/report/summary', authenticateToken, historyLogController.getAuditSummary);

// Get audit report by table
router.get('/report/by-table', authenticateToken, historyLogController.getAuditByTable);

// Get audit report by user
router.get('/report/by-user', authenticateToken, historyLogController.getAuditByUser);

// Get audit report by action type
router.get('/report/by-action', authenticateToken, historyLogController.getAuditByAction);

// Get audit sessions
router.get('/sessions', authenticateToken, historyLogController.getAuditSessions);

// Export audit logs
router.get('/export', authenticateToken, historyLogController.exportAuditLogs);

// Create history log (for internal use/testing - protected route)
router.post('/', authenticateToken, historyLogController.createHistoryLog);

module.exports = router;
