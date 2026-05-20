const db = require('../config/database');

class HistoryLog {
  /**
   * Get history logs with pagination, user info, and changes
   * @param {Object} options - Query options
   * @param {number} options.page - Page number (starting from 1)
   * @param {number} options.limit - Number of records per page
   * @param {string} options.tableName - Filter by table name
   * @param {string} options.actionType - Filter by action type
   * @param {number} options.userId - Filter by user ID
   * @param {string} options.startDate - Filter by start date
   * @param {string} options.endDate - Filter by end date
   * @param {string} options.searchTerm - Search in action description
   * @returns {Promise<Array>} Array of history log records with changes
   */
  static async getHistoryLogs(options = {}) {
    const {
      page = 1,
      limit = 100,
      tableName = null,
      actionType = null,
      userId = null,
      startDate = null,
      endDate = null,
      searchTerm = null
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (tableName) {
      whereConditions.push('hl.Table_Name = ?');
      queryParams.push(tableName);
    }
    
    if (actionType) {
      whereConditions.push('hl.Action_Type = ?');
      queryParams.push(actionType);
    }
    
    if (userId) {
      whereConditions.push('hl.User_ID = ?');
      queryParams.push(userId);
    }
    
    if (startDate) {
      whereConditions.push('hl.Timestamp >= ?');
      // Convert ISO format to MySQL datetime format if needed
      const formattedStart = startDate.includes('T') ? startDate.replace('T', ' ') : startDate;
      queryParams.push(formattedStart);
      console.log('Start date filter:', formattedStart);
    }
    
    if (endDate) {
      whereConditions.push('hl.Timestamp <= ?');
      // Convert ISO format to MySQL datetime format if needed
      const formattedEnd = endDate.includes('T') ? endDate.replace('T', ' ') : endDate;
      queryParams.push(formattedEnd);
      console.log('End date filter:', formattedEnd);
    }
    
    if (searchTerm) {
      whereConditions.push('(hl.Action_Desc LIKE ? OR u.Username LIKE ?)');
      queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    const query = `
      SELECT 
        hl.Log_ID,
        hl.User_ID,
        COALESCE(u.Username, 'Unknown') as Username,
        COALESCE(CONCAT(u.First_Name, ' ', u.Last_Name), u.Username, 'Unknown User') as User_Full_Name,
        hl.Table_Name,
        hl.Record_ID,
        hl.Action_Type,
        hl.Action_Desc,
        hl.Timestamp,
        GROUP_CONCAT(
          CONCAT(hlc.Field_Name, ':', COALESCE(hlc.Old_Value, ''), '→', COALESCE(hlc.New_Value, ''))
          SEPARATOR '|'
        ) as Changes
      FROM HISTORY_LOG hl
      LEFT JOIN USER u ON hl.User_ID = u.User_ID
      LEFT JOIN HISTORY_LOG_CHANGES hlc ON hl.Log_ID = hlc.Log_ID
      ${whereClause}
      GROUP BY hl.Log_ID
      ORDER BY hl.Timestamp DESC
      LIMIT ? OFFSET ?
    `;
    
    queryParams.push(limit, offset);
    
    console.log('HistoryLog query WHERE:', whereClause);
    console.log('HistoryLog query params:', queryParams);
    console.log('Full query:', query.replace(/\s+/g, ' '));
    
    try {
      const [rows] = await db.pool.execute(query, queryParams);
      console.log('Query returned', rows.length, 'rows');
      
      // Parse changes into array for easier frontend handling
      const logs = rows.map(log => ({
        ...log,
        Changes: log.Changes ? log.Changes.split('|').map(change => {
          const [fieldName, values] = change.split(':');
          const [oldValue, newValue] = values ? values.split('→') : ['', ''];
          return { fieldName, oldValue, newValue };
        }) : []
      }));
      
      return logs;
    } catch (error) {
      console.error('Error fetching history logs:', error);
      return [];
    }
  }

  /**
   * Attempt to undo a log action (INSERT => soft-delete, DELETE => restore, UPDATE => revert fields)
   * Creates a new history log entry recording the undo action.
   * @param {number} logId
   * @param {number} performedBy (optional) user id performing the undo
   */
  static async undoLog(logId, performedBy = null, options = { dryRun: false }) {
    try {
      const [rows] = await db.pool.execute('SELECT * FROM HISTORY_LOG WHERE Log_ID = ?', [logId]);
      const log = rows[0];

      if (!log) throw new Error('History log not found');

      // Get changes
      const [changes] = await db.pool.execute('SELECT Field_Name, Old_Value, New_Value FROM HISTORY_LOG_CHANGES WHERE Log_ID = ? ORDER BY History_Log_Change_ID ASC', [logId]);

      const table = log.Table_Name;
      const recordId = log.Record_ID;
      const action = String(log.Action_Type || '').toUpperCase();

      if (!table || !recordId) throw new Error('Cannot undo log without Table_Name or Record_ID');

      // Build basic primary key column name guesses
      const idColumns = ['id', 'ID', `${table}_ID`, `${table.slice(0, -1)}_ID`, 'Record_ID'];

      // Try common id column names to use in WHERE clause
      let pkColumn = null;
      for (const col of idColumns) {
        try {
          const [c] = await db.pool.execute(`SELECT ${col} FROM ${table} WHERE ${col} = ? LIMIT 1`, [recordId]);
          if (c && c.length > 0) { pkColumn = col; break; }
        } catch (err) {
          // ignore
        }
      }

      // Fallback to using primary key column as 'id = recordId' if none found
      const whereClause = pkColumn ? `${pkColumn} = ?` : `?`;
      const whereParams = pkColumn ? [recordId] : [recordId];

      // Build dry-run payloads (SQL + params) when requested
      const dry = options && options.dryRun;

      if (action === 'INSERT') {
        const sql = `UPDATE ${table} SET deleted_at = CURRENT_TIMESTAMP WHERE ${whereClause}`;
        if (dry) return { dry: true, sql, params: whereParams, note: 'Soft-delete the inserted record' };
        try {
          await db.pool.execute(sql, whereParams);
        } catch (err) {
          throw new Error(`Failed to soft-delete inserted record: ${err.message}`);
        }
        const undoDesc = `UNDO INSERT for ${table} id=${recordId}`;
        const [res] = await db.pool.execute(`INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp) VALUES (?, ?, ?, ?, ?, NOW())`, [performedBy, table, recordId, 'UNDO_INSERT', undoDesc]);
        return { success: true, undoLogId: res.insertId };
      } else if (action === 'DELETE') {
        const sql = `UPDATE ${table} SET deleted_at = NULL WHERE ${whereClause}`;
        if (dry) return { dry: true, sql, params: whereParams, note: 'Restore the soft-deleted record' };
        try {
          await db.pool.execute(sql, whereParams);
        } catch (err) {
          throw new Error(`Failed to restore deleted record: ${err.message}`);
        }
        const undoDesc = `UNDO DELETE for ${table} id=${recordId}`;
        const [res] = await db.pool.execute(`INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp) VALUES (?, ?, ?, ?, ?, NOW())`, [performedBy, table, recordId, 'UNDO_DELETE', undoDesc]);
        return { success: true, undoLogId: res.insertId };
      } else if (action === 'UPDATE') {
        if (!changes || changes.length === 0) throw new Error('No change records to revert');

        const assignments = [];
        const params = [];
        for (const ch of changes) {
          assignments.push(`\`${ch.Field_Name}\` = ?`);
          params.push(ch.Old_Value);
        }
        params.push(...whereParams);

        const sql = `UPDATE ${table} SET ${assignments.join(', ')} WHERE ${whereClause}`;
        if (dry) return { dry: true, sql, params, note: 'Revert updated fields to Old_Value' };

        try {
          await db.pool.execute(sql, params);
        } catch (err) {
          throw new Error(`Failed to revert update: ${err.message}`);
        }

        const undoDesc = `UNDO UPDATE for ${table} id=${recordId}`;
        const [res] = await db.pool.execute(`INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp) VALUES (?, ?, ?, ?, ?, NOW())`, [performedBy, table, recordId, 'UNDO_UPDATE', undoDesc]);
        try {
          const undoLogId = res.insertId;
          const undoValues = changes.map(ch => [undoLogId, ch.Field_Name, ch.New_Value || '', ch.Old_Value || '']);
          if (undoValues.length > 0) {
            await db.pool.query(`INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value) VALUES ?`, [undoValues]);
          }
        } catch (err) {
          console.warn('Failed to write undo change rows:', err.message);
        }

        return { success: true, undoLogId: res.insertId };
      }

      throw new Error(`Unsupported Action_Type for undo: ${action}`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get total count of history logs with filters
   * @param {Object} options - Query options (same as getHistoryLogs)
   * @returns {Promise<number>} Total count
   */
  static async getTotalCount(options = {}) {
    const {
      tableName = null,
      actionType = null,
      userId = null,
      startDate = null,
      endDate = null,
      searchTerm = null
    } = options;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (tableName) {
      whereConditions.push('hl.Table_Name = ?');
      queryParams.push(tableName);
    }
    
    if (actionType) {
      whereConditions.push('hl.Action_Type = ?');
      queryParams.push(actionType);
    }
    
    if (userId) {
      whereConditions.push('hl.User_ID = ?');
      queryParams.push(userId);
    }
    
    if (startDate) {
      whereConditions.push('hl.Timestamp >= ?');
      // Convert ISO format to MySQL datetime format if needed
      const formattedStart = startDate.includes('T') ? startDate.replace('T', ' ') : startDate;
      queryParams.push(formattedStart);
    }
    
    if (endDate) {
      whereConditions.push('hl.Timestamp <= ?');
      // Convert ISO format to MySQL datetime format if needed
      const formattedEnd = endDate.includes('T') ? endDate.replace('T', ' ') : endDate;
      queryParams.push(formattedEnd);
    }
    
    if (searchTerm) {
      whereConditions.push('(hl.Action_Desc LIKE ? OR u.Username LIKE ?)');
      queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    const query = `
      SELECT COUNT(DISTINCT hl.Log_ID) as total 
      FROM HISTORY_LOG hl
      LEFT JOIN USER u ON hl.User_ID = u.User_ID
      ${whereClause}
    `;
    
    try {
      const [rows] = await db.pool.execute(query, queryParams);
      return rows[0].total;
    } catch (error) {
      console.error('Error getting total count:', error);
      return 0;
    }
  }

  /**
   * Create a new history log entry
   * @param {Object} logData - Log data
   * @returns {Promise<number>} Inserted Log_ID
   */
  static async createLog(logData) {
    const { userId, tableName, recordId, actionType, actionDesc } = logData;
    
    const query = `
      INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;
    
    try {
      const [result] = await db.pool.execute(query, [userId, tableName, recordId, actionType, actionDesc]);
      return result.insertId;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create history log changes
   * @param {number} logId - Log ID
   * @param {Array} changes - Array of change objects {fieldName, oldValue, newValue}
   * @returns {Promise<void>}
   */
  static async createChanges(logId, changes) {
    if (!changes || changes.length === 0) return;
    
    const query = `
      INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
      VALUES ?
    `;
    
    const values = changes.map(change => [
      logId,
      change.fieldName,
      change.oldValue || '',
      change.newValue || ''
    ]);
    
    try {
      await db.pool.query(query, [values]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get audit summary statistics
   * @param {Object} options - Date range options
   * @returns {Promise<Object>} Summary statistics
   */
  static async getAuditSummary(options = {}) {
    const { startDate = null, endDate = null, tableName = null, actionType = null, userId = null, searchTerm = null } = options;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (startDate && endDate) {
      whereConditions.push('Timestamp BETWEEN ? AND ?');
      queryParams.push(startDate, endDate);
    }
    
    if (tableName) {
      whereConditions.push('Table_Name = ?');
      queryParams.push(tableName);
    }
    
    if (actionType) {
      whereConditions.push('Action_Type = ?');
      queryParams.push(actionType);
    }
    
    if (userId) {
      whereConditions.push('User_ID = ?');
      queryParams.push(userId);
    }
    
    if (searchTerm) {
      whereConditions.push('(Old_Value LIKE ? OR New_Value LIKE ? OR Details LIKE ?)');
      const searchPattern = `%${searchTerm}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const query = `
      SELECT 
        COUNT(*) as totalLogs,
        COUNT(DISTINCT Table_Name) as tablesAffected,
        COUNT(DISTINCT User_ID) as usersInvolved,
        SUM(CASE WHEN Action_Type = 'INSERT' THEN 1 ELSE 0 END) as createCount,
        SUM(CASE WHEN Action_Type = 'UPDATE' THEN 1 ELSE 0 END) as updateCount,
        SUM(CASE WHEN Action_Type = 'DELETE' THEN 1 ELSE 0 END) as deleteCount,
        MIN(Timestamp) as earliestLog,
        MAX(Timestamp) as latestLog
      FROM HISTORY_LOG
      ${whereClause}
    `;
    
    try {
      const [rows] = await db.pool.execute(query, queryParams);
      return rows[0];
    } catch (error) {
      console.error('Error getting audit summary:', error);
      throw error;
    }
  }

  /**
   * Get audit logs grouped by table
   * @param {Object} options - Date range options
   * @returns {Promise<Array>} Logs grouped by table
   */
  static async getAuditByTable(options = {}) {
    const { startDate = null, endDate = null } = options;
    
    let dateFilter = '';
    let queryParams = [];
    
    if (startDate && endDate) {
      dateFilter = 'WHERE Timestamp BETWEEN ? AND ?';
      queryParams = [startDate, endDate];
    }
    
    const query = `
      SELECT 
        Table_Name,
        COUNT(*) as totalLogs,
        SUM(CASE WHEN Action_Type = 'INSERT' THEN 1 ELSE 0 END) as createCount,
        SUM(CASE WHEN Action_Type = 'UPDATE' THEN 1 ELSE 0 END) as updateCount,
        SUM(CASE WHEN Action_Type = 'DELETE' THEN 1 ELSE 0 END) as deleteCount,
        MAX(Timestamp) as lastActivity
      FROM HISTORY_LOG
      ${dateFilter}
      GROUP BY Table_Name
      ORDER BY totalLogs DESC
    `;
    
    try {
      const [rows] = await db.pool.execute(query, queryParams);
      return rows;
    } catch (error) {
      console.error('Error getting audit by table:', error);
      throw error;
    }
  }

  /**
   * Get audit logs grouped by user
   * @param {Object} options - Date range options
   * @returns {Promise<Array>} Logs grouped by user
   */
  static async getAuditByUser(options = {}) {
    const { startDate = null, endDate = null } = options;
    
    let dateFilter = '';
    let queryParams = [];
    
    if (startDate && endDate) {
      dateFilter = 'WHERE hl.Timestamp BETWEEN ? AND ?';
      queryParams = [startDate, endDate];
    }
    
    const query = `
      SELECT 
        hl.User_ID,
        COALESCE(u.Username, 'Unknown') as Username,
        COALESCE(CONCAT(u.First_Name, ' ', u.Last_Name), u.Username, 'Unknown User') as User_Full_Name,
        u.User_Role as Role,
        COUNT(*) as totalLogs,
        SUM(CASE WHEN hl.Action_Type = 'INSERT' THEN 1 ELSE 0 END) as createCount,
        SUM(CASE WHEN hl.Action_Type = 'UPDATE' THEN 1 ELSE 0 END) as updateCount,
        SUM(CASE WHEN hl.Action_Type = 'DELETE' THEN 1 ELSE 0 END) as deleteCount,
        MAX(hl.Timestamp) as lastActivity
      FROM HISTORY_LOG hl
      LEFT JOIN USER u ON hl.User_ID = u.User_ID
      ${dateFilter}
      GROUP BY hl.User_ID, u.Username, User_Full_Name, u.User_Role
      ORDER BY totalLogs DESC
    `;
    
    try {
      const [rows] = await db.pool.execute(query, queryParams);
      return rows;
    } catch (error) {
      console.error('Error getting audit by user:', error);
      throw error;
    }
  }

  /**
   * Get audit logs grouped by sessions
   * Sessions are defined as groups of actions by the same user within 30 minutes
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Session statistics
   */
  static async getAuditSessions(options = {}) {
    const { startDate = null, endDate = null } = options;
    
    let whereClause = '';
    let queryParams = [];
    
    if (startDate && endDate) {
      whereClause = 'AND hl.Timestamp BETWEEN ? AND ?';
      queryParams = [startDate, endDate];
    }
    
    // Simplified query without complex window functions for MySQL compatibility
    const query = `
      SELECT 
        CONCAT(hl.User_ID, '-', hl.Table_Name, '-', DATE_FORMAT(hl.Timestamp, '%Y%m%d%H')) as Session_ID,
        hl.User_ID,
        COALESCE(u.Username, 'Unknown') as Username,
        COALESCE(CONCAT(u.First_Name, ' ', u.Last_Name), u.Username, 'Unknown User') as User_Full_Name,
        hl.Table_Name,
        MIN(hl.Timestamp) as Session_Start,
        MAX(hl.Timestamp) as Session_End,
        COUNT(*) as Total_Actions,
        SUM(CASE WHEN hl.Action_Type = 'INSERT' THEN 1 ELSE 0 END) as Insert_Count,
        SUM(CASE WHEN hl.Action_Type = 'UPDATE' THEN 1 ELSE 0 END) as Update_Count,
        SUM(CASE WHEN hl.Action_Type = 'DELETE' THEN 1 ELSE 0 END) as Delete_Count,
        GROUP_CONCAT(hl.Log_ID ORDER BY hl.Timestamp SEPARATOR ',') as Log_IDs,
        GROUP_CONCAT(hl.Action_Desc ORDER BY hl.Timestamp SEPARATOR ' | ') as Actions_Summary
      FROM HISTORY_LOG hl
      LEFT JOIN USER u ON hl.User_ID = u.User_ID
      WHERE 1=1 ${whereClause}
      GROUP BY 
        hl.User_ID,
        u.Username,
        u.First_Name,
        u.Last_Name,
        hl.Table_Name,
        DATE_FORMAT(hl.Timestamp, '%Y%m%d%H')
      HAVING TIMESTAMPDIFF(MINUTE, Session_Start, Session_End) <= 60
      ORDER BY Session_Start DESC
    `;
    
    try {
      const [rows] = await db.pool.execute(query, queryParams);
      return rows;
    } catch (error) {
      console.error('Error in getAuditSessions:', error);
      throw error;
    }
  }

  /**
   * Get audit logs grouped by action type
   * @param {Object} options - Date range options
   * @returns {Promise<Array>} Logs grouped by action type
   */
  static async getAuditByAction(options = {}) {
    const { startDate = null, endDate = null } = options;
    
    let dateFilter = '';
    let queryParams = [];
    
    if (startDate && endDate) {
      dateFilter = 'WHERE Timestamp BETWEEN ? AND ?';
      queryParams = [startDate, endDate];
    }
    
    const query = `
      SELECT 
        Action_Type,
        Table_Name,
        COUNT(*) as count,
        MAX(Timestamp) as lastOccurrence
      FROM HISTORY_LOG
      ${dateFilter}
      GROUP BY Action_Type, Table_Name
      ORDER BY Action_Type, count DESC
    `;
    
    try {
      const [rows] = await db.pool.execute(query, queryParams);
      return rows;
    } catch (error) {
      console.error('Error getting audit by action:', error);
      throw error;
    }
  }

  /**
   * Get all users who have made changes (for filter dropdown)
   * @returns {Promise<Array>} List of users
   */
  static async getActiveUsers() {
    const query = `
      SELECT DISTINCT 
        u.User_ID,
        u.Username,
        CONCAT(u.First_Name, ' ', u.Last_Name) as Full_Name,
        u.User_Role as Role
      FROM HISTORY_LOG hl
      JOIN USER u ON hl.User_ID = u.User_ID
      ORDER BY u.Username
    `;
    
    try {
      const [rows] = await db.pool.execute(query);
      return rows;
    } catch (error) {
      console.error('Error getting active users:', error);
      throw error;
    }
  }

  /**
   * Get distinct table names (for filter dropdown)
   * @returns {Promise<Array>} List of table names
   */
  static async getTableNames() {
    const query = `
      SELECT DISTINCT Table_Name
      FROM HISTORY_LOG
      ORDER BY Table_Name
    `;
    
    try {
      const [rows] = await db.pool.execute(query);
      return rows.map(row => row.Table_Name);
    } catch (error) {
      console.error('Error getting table names:', error);
      throw error;
    }
  }
}

module.exports = HistoryLog;
