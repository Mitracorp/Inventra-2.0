const db = require('../config/database');

/**
 * Get recent activity from the HISTORY_LOG table
 * This aggregates various activities (asset changes, PM completions, etc.)
 * and formats them for the dashboard activity feed
 */
exports.getRecentActivity = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Validate limit parameter
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid limit parameter. Must be between 1 and 100.'
      });
    }

    // Query to get recent activities from HISTORY_LOG
    const query = `
      SELECT 
        hl.Log_ID,
        hl.User_ID,
        COALESCE(u.Username, 'System') as Username,
        hl.Table_Name,
        hl.Record_ID,
        hl.Action_Type,
        hl.Action_Desc,
        hl.Timestamp
      FROM HISTORY_LOG hl
      LEFT JOIN USER u ON hl.User_ID = u.User_ID
      ORDER BY hl.Timestamp DESC
      LIMIT ?
    `;

    const [rows] = await db.pool.execute(query, [limit]);

    // Transform the data to match the frontend activity feed format
    const activities = rows.map(log => {
      // Determine activity type based on table name and action
      let activityType = 'other';
      let entityType = log.Table_Name;
      let description = log.Action_Desc;
      
      // Map table names and actions to activity types
      if (log.Table_Name === 'ASSET') {
        if (log.Action_Type === 'INSERT') {
          activityType = 'asset_created';
          description = 'New asset added';
        } else if (log.Action_Type === 'UPDATE') {
          activityType = 'asset_updated';
          description = 'Asset information updated';
        } else if (log.Action_Type === 'DELETE') {
          activityType = 'asset_deleted';
          description = 'Asset removed';
        }
        entityType = 'Asset';
      } else if (log.Table_Name === 'PM_RECORD') {
        activityType = 'pm_completed';
        description = 'Preventive maintenance completed';
        entityType = 'PM Record';
      } else if (log.Table_Name === 'PROJECT') {
        if (log.Action_Type === 'INSERT') {
          activityType = 'project_created';
          description = 'New project created';
        } else if (log.Action_Type === 'UPDATE') {
          activityType = 'project_updated';
          description = 'Project information updated';
        }
        entityType = 'Project';
      } else if (log.Table_Name === 'ASSET_MODEL') {
        if (log.Action_Type === 'INSERT') {
          activityType = 'model_created';
          description = 'New model specifications added';
        }
        entityType = 'Model';
      }

      // Extract entity name from action description if available
      // Format is usually like "Created asset: [Serial Number]"
      let entityName = log.Record_ID ? `ID: ${log.Record_ID}` : 'Unknown';
      
      // Try to parse entity name from action description
      const matches = log.Action_Desc.match(/:\s*(.+?)(?:\s*\(|$)/);
      if (matches && matches[1]) {
        entityName = matches[1].trim();
      }

      return {
        activityType,
        entityType,
        entityName,
        description,
        userName: log.Username,
        userId: log.User_ID,
        timestamp: log.Timestamp,
        actionType: log.Action_Type
      };
    });

    res.status(200).json({
      success: true,
      data: activities,
      message: 'Recent activity retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activity',
      error: error.message,
      data: []
    });
  }
};
