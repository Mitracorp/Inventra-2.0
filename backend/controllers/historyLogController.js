const HistoryLog = require('../models/HistoryLog');

/**
 * Get history logs with pagination and filters
 */
exports.getHistoryLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const tableName = req.query.tableName || null;
    const actionType = req.query.actionType || null;
    const userId = req.query.userId ? parseInt(req.query.userId) : null;
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    const searchTerm = req.query.searchTerm || null;

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100.'
      });
    }

    const options = {
      page,
      limit,
      tableName,
      actionType,
      userId,
      startDate,
      endDate,
      searchTerm
    };

    // Fetch logs and total count
    const [logs, totalCount] = await Promise.all([
      HistoryLog.getHistoryLogs(options),
      HistoryLog.getTotalCount(options)
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    res.json({
      success: true,
      data: {
        logs: logs || [],
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords: totalCount,
          recordsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching history logs:', error);
    res.status(200).json({
      success: true,
      data: {
        logs: [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalRecords: 0,
          recordsPerPage: 100,
          hasNextPage: false,
          hasPrevPage: false
        }
      },
      message: 'No audit logs found or table does not exist yet'
    });
  }
};

/**
 * Create a new history log entry (for internal use or testing)
 */
exports.createHistoryLog = async (req, res) => {
  try {
    const { userId, tableName, recordId, actionType, actionDesc, changes } = req.body;

    // Validation
    if (!userId || !tableName || !recordId || !actionType || !actionDesc) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, tableName, recordId, actionType, actionDesc'
      });
    }

    // Validate action type
    const validActionTypes = ['INSERT', 'UPDATE', 'DELETE'];
    if (!validActionTypes.includes(actionType.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action type. Must be INSERT, UPDATE, or DELETE.'
      });
    }

    // Create log entry
    const logId = await HistoryLog.createLog({
      userId,
      tableName,
      recordId,
      actionType: actionType.toUpperCase(),
      actionDesc
    });

    // Create changes if provided
    if (changes && Array.isArray(changes) && changes.length > 0) {
      await HistoryLog.createChanges(logId, changes);
    }

    res.status(201).json({
      success: true,
      message: 'History log created successfully',
      data: { logId }
    });
  } catch (error) {
    console.error('Error creating history log:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating history log'
    });
  }
};

/**
 * Get audit summary statistics
 */
exports.getAuditSummary = async (req, res) => {
  try {
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    const tableName = req.query.tableName || null;
    const actionType = req.query.actionType || null;
    const userId = req.query.userId || null;
    const searchTerm = req.query.searchTerm || null;
    
    const summary = await HistoryLog.getAuditSummary({ 
      startDate, 
      endDate, 
      tableName, 
      actionType, 
      userId, 
      searchTerm 
    });
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching audit summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching audit summary'
    });
  }
};

/**
 * Get audit logs grouped by table
 */
exports.getAuditByTable = async (req, res) => {
  try {
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const data = await HistoryLog.getAuditByTable({ startDate, endDate });
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching audit by table:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching audit by table'
    });
  }
};

/**
 * Get audit logs grouped by user
 */
exports.getAuditByUser = async (req, res) => {
  try {
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const data = await HistoryLog.getAuditByUser({ startDate, endDate });
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching audit by user:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching audit by user'
    });
  }
};

/**
 * Get audit logs grouped by sessions
 */
exports.getAuditSessions = async (req, res) => {
  try {
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const data = await HistoryLog.getAuditSessions({ startDate, endDate });
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching audit sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching audit sessions'
    });
  }
};

/**
 * Get audit logs grouped by action type
 */
exports.getAuditByAction = async (req, res) => {
  try {
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    const data = await HistoryLog.getAuditByAction({ startDate, endDate });
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching audit by action:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching audit by action'
    });
  }
};

/**
 * Export audit logs as CSV
 */
exports.exportAuditLogs = async (req, res) => {
  try {
    const tableName = req.query.tableName || null;
    const actionType = req.query.actionType || null;
    const userId = req.query.userId ? parseInt(req.query.userId) : null;
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    const searchTerm = req.query.searchTerm || null;
    
    const options = {
      page: 1,
      limit: 10000, // Export up to 10,000 records
      tableName,
      actionType,
      userId,
      startDate,
      endDate,
      searchTerm
    };
    
    const logs = await HistoryLog.getHistoryLogs(options);
    
    // Build CSV
    const csvHeaders = [
      'Log ID',
      'Timestamp',
      'User',
      'Full Name',
      'Table',
      'Record ID',
      'Action',
      'Description',
      'Changes'
    ];
    
    const csvRows = logs.map(log => {
      const changes = log.Changes.map(c => 
        `${c.fieldName}: ${c.oldValue || '(empty)'} → ${c.newValue || '(empty)'}`
      ).join('; ');
      
      return [
        log.Log_ID,
        log.Timestamp,
        log.Username,
        log.User_Full_Name,
        log.Table_Name,
        log.Record_ID,
        log.Action_Type,
        `"${log.Action_Desc.replace(/"/g, '""')}"`, // Escape quotes
        `"${changes.replace(/"/g, '""')}"`
      ].join(',');
    });
    
    const csv = [csvHeaders.join(','), ...csvRows].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting audit logs'
    });
  }
};

/**
 * Get filter options (users and tables)
 */
exports.getFilterOptions = async (req, res) => {
  try {
    const [users, tables] = await Promise.all([
      HistoryLog.getActiveUsers(),
      HistoryLog.getTableNames()
    ]);
    
    res.json({
      success: true,
      data: {
        users,
        tables,
        actionTypes: ['INSERT', 'UPDATE', 'DELETE']
      }
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching filter options'
    });
  }
};

/**
 * Undo a history log action by Log_ID
 */
exports.undoHistoryLog = async (req, res) => {
  try {
    const logId = Number(req.params.id);
    if (!logId) return res.status(400).json({ success: false, message: 'Invalid log id' });

    const performedBy = req.user?.User_ID || req.user?.userId || null;
    const dry = req.query.dry === 'true' || req.query.dry === '1';
    const result = await HistoryLog.undoLog(logId, performedBy, { dryRun: dry });

    res.status(200).json({ success: true, data: result, message: 'Undo operation executed' });
  } catch (error) {
    console.error('Error undoing history log:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
