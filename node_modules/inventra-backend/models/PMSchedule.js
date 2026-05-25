const { pool } = require('../config/database');

class PMSchedule {
  // Get custom schedules for a project
  static async getCustomSchedules(projectId, year = null) {
    try {
      let query = `
        SELECT 
          Schedule_ID,
          Project_ID,
          Scheduled_Date,
          Is_Custom,
          Notes,
          Created_At,
          Updated_At
        FROM PM_SCHEDULE
        WHERE Project_ID = ?
      `;
      
      const params = [projectId];
      
      if (year) {
        query += ' AND YEAR(Scheduled_Date) = ?';
        params.push(year);
      }
      
      query += ' ORDER BY Scheduled_Date';
      
      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error in PMSchedule.getCustomSchedules:', error);
      throw error;
    }
  }

  // Create a new custom schedule
  static async createSchedule(projectId, scheduledDate, notes = null) {
    try {
      const [result] = await pool.execute(`
        INSERT INTO PM_SCHEDULE (Project_ID, Scheduled_Date, Is_Custom, Notes)
        VALUES (?, ?, TRUE, ?)
      `, [projectId, scheduledDate, notes]);
      
      return result.insertId;
    } catch (error) {
      console.error('Error in PMSchedule.createSchedule:', error);
      throw error;
    }
  }

  // Create or update a custom schedule
  static async upsertSchedule(projectId, scheduledDate, notes = null) {
    try {
      const [result] = await pool.execute(`
        INSERT INTO PM_SCHEDULE (Project_ID, Scheduled_Date, Is_Custom, Notes)
        VALUES (?, ?, TRUE, ?)
        ON DUPLICATE KEY UPDATE
          Notes = VALUES(Notes),
          Updated_At = CURRENT_TIMESTAMP
      `, [projectId, scheduledDate, notes]);
      
      return result.insertId || result.affectedRows;
    } catch (error) {
      console.error('Error in PMSchedule.upsertSchedule:', error);
      throw error;
    }
  }

  // Delete a custom schedule
  static async deleteSchedule(scheduleId) {
    try {
      const [result] = await pool.execute(`
        DELETE FROM PM_SCHEDULE WHERE Schedule_ID = ?
      `, [scheduleId]);
      
      return result.affectedRows;
    } catch (error) {
      console.error('Error in PMSchedule.deleteSchedule:', error);
      throw error;
    }
  }

  // Delete all custom schedules for a project
  static async deleteAllProjectSchedules(projectId) {
    try {
      const [result] = await pool.execute(`
        DELETE FROM PM_SCHEDULE WHERE Project_ID = ?
      `, [projectId]);
      
      return result.affectedRows;
    } catch (error) {
      console.error('Error in PMSchedule.deleteAllProjectSchedules:', error);
      throw error;
    }
  }

  // Bulk create schedules (for auto-reschedule)
  static async bulkCreateSchedules(projectId, dates) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Delete existing custom schedules for this project
      await connection.execute(`
        DELETE FROM PM_SCHEDULE WHERE Project_ID = ?
      `, [projectId]);

      // Insert new schedules
      for (const date of dates) {
        await connection.execute(`
          INSERT INTO PM_SCHEDULE (Project_ID, Scheduled_Date, Is_Custom)
          VALUES (?, ?, TRUE)
        `, [projectId, date]);
      }

      await connection.commit();
      return dates.length;
    } catch (error) {
      await connection.rollback();
      console.error('Error in PMSchedule.bulkCreateSchedules:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = PMSchedule;
