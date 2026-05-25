const HistoryLog = require('../models/HistoryLog');

/**
 * Audit Logger Utility
 * Logs all database changes to HISTORY_LOG and HISTORY_LOG_CHANGES tables
 */

/**
 * Log a database change
 * @param {Object} options - Logging options
 * @param {number} options.userId - ID of user making the change
 * @param {string} options.tableName - Name of the table being changed
 * @param {number} options.recordId - ID of the record being changed
 * @param {string} options.actionType - Type of action: INSERT, UPDATE, DELETE
 * @param {string} options.actionDesc - Human-readable description of the action
 * @param {Array} options.changes - Array of change objects: [{fieldName, oldValue, newValue}]
 * @returns {Promise<number>} Log ID
 */
async function logChange({ userId, tableName, recordId, actionType, actionDesc, changes = [] }) {
  try {
    // Validate required fields
    if (!userId || !tableName || !recordId || !actionType || !actionDesc) {
      console.warn('Audit log skipped - missing required fields:', { userId, tableName, recordId, actionType });
      return null;
    }

    // Create log entry
    const logId = await HistoryLog.createLog({
      userId,
      tableName: tableName.toUpperCase(),
      recordId,
      actionType: actionType.toUpperCase(),
      actionDesc
    });

    // Create change records if provided
    if (changes && changes.length > 0) {
      await HistoryLog.createChanges(logId, changes);
    }

    console.log(`✅ Audit log created: Log_ID=${logId}, User=${userId}, Action=${actionType}, Table=${tableName}`);
    return logId;
  } catch (error) {
    // Don't throw error - audit logging should not break the main operation
    console.error('❌ Failed to create audit log:', error.message);
    return null;
  }
}

/**
 * Log project changes
 */
async function logProjectChange(userId, projectId, actionType, actionDesc, changes = []) {
  return logChange({
    userId,
    tableName: 'PROJECT',
    recordId: projectId,
    actionType,
    actionDesc,
    changes
  });
}

/**
 * Log asset changes
 */
async function logAssetChange(userId, assetId, actionType, actionDesc, changes = []) {
  return logChange({
    userId,
    tableName: 'ASSET',
    recordId: assetId,
    actionType,
    actionDesc,
    changes
  });
}

/**
 * Log customer changes
 */
async function logCustomerChange(userId, customerId, actionType, actionDesc, changes = []) {
  return logChange({
    userId,
    tableName: 'CUSTOMER',
    recordId: customerId,
    actionType,
    actionDesc,
    changes
  });
}

/**
 * Log peripheral changes
 */
async function logPeripheralChange(userId, peripheralId, actionType, actionDesc, changes = []) {
  return logChange({
    userId,
    tableName: 'PERIPHERAL',
    recordId: peripheralId,
    actionType,
    actionDesc,
    changes
  });
}

/**
 * Log PM (Preventive Maintenance) changes
 */
async function logPMChange(userId, pmId, actionType, actionDesc, changes = []) {
  return logChange({
    userId,
    tableName: 'PM',
    recordId: pmId,
    actionType,
    actionDesc,
    changes
  });
}

/**
 * Log user/auth changes
 */
async function logUserChange(userId, targetUserId, actionType, actionDesc, changes = []) {
  return logChange({
    userId,
    tableName: 'USER',
    recordId: targetUserId,
    actionType,
    actionDesc,
    changes
  });
}

/**
 * Log solution principal changes
 */
async function logSolutionPrincipalChange(userId, solPrincId, actionType, actionDesc, changes = []) {
  return logChange({
    userId,
    tableName: 'SOLUTION_PRINCIPAL',
    recordId: solPrincId,
    actionType,
    actionDesc,
    changes
  });
}

/**
 * Compare two objects and return array of changes
 * @param {Object} oldData - Original data
 * @param {Object} newData - Updated data
 * @param {Array} fieldsToTrack - Array of field names to track (optional, tracks all if not provided)
 * @returns {Array} Array of change objects
 */
function detectChanges(oldData, newData, fieldsToTrack = null) {
  const changes = [];
  const fields = fieldsToTrack || Object.keys(newData);

  fields.forEach(field => {
    const oldValue = oldData[field];
    const newValue = newData[field];

    // Compare values (handle null/undefined)
    if (oldValue != newValue) {
      changes.push({
        fieldName: field,
        oldValue: oldValue !== null && oldValue !== undefined ? String(oldValue) : '',
        newValue: newValue !== null && newValue !== undefined ? String(newValue) : ''
      });
    }
  });

  return changes;
}

module.exports = {
  logChange,
  logProjectChange,
  logAssetChange,
  logCustomerChange,
  logPeripheralChange,
  logPMChange,
  logUserChange,
  logSolutionPrincipalChange,
  detectChanges
};
