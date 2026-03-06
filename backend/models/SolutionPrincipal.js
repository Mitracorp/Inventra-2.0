const { pool } = require('../config/database');

class SolutionPrincipal {
  constructor(solutionPrincipal) {
    this.SP_ID = solutionPrincipal.SP_ID;
    this.SP_Name = solutionPrincipal.SP_Name;
  }

  // Get all solution principals
  static async findAll() {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          SP_ID,
          SP_Name
        FROM SOLUTION_PRINCIPAL
        ORDER BY SP_ID ASC
      `);
      return rows;
    } catch (error) {
      console.error('Error in SolutionPrincipal.findAll:', error);
      throw error;
    }
  }

  // Get solution principal by ID
  static async findById(id) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          SP_ID,
          SP_Name
        FROM SOLUTION_PRINCIPAL
        WHERE SP_ID = ?
      `, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error in SolutionPrincipal.findById:', error);
      throw error;
    }
  }

  // Create new solution principal
  static async create(data) {
    try {
      const { SP_Name } = data;
      
      const [result] = await pool.execute(`
        INSERT INTO SOLUTION_PRINCIPAL 
        (SP_Name)
        VALUES (?)
      `, [SP_Name]);

      return {
        SP_ID: result.insertId,
        SP_Name
      };
    } catch (error) {
      console.error('Error in SolutionPrincipal.create:', error);
      throw error;
    }
  }

  // Update solution principal
  static async update(id, data) {
    try {
      const { SP_Name } = data;
      
      const [result] = await pool.execute(`
        UPDATE SOLUTION_PRINCIPAL
        SET 
          SP_Name = ?
        WHERE SP_ID = ?
      `, [SP_Name, id]);

      if (result.affectedRows === 0) {
        throw new Error('Solution Principal not found');
      }

      return { SP_ID: id, SP_Name };
    } catch (error) {
      console.error('Error in SolutionPrincipal.update:', error);
      throw error;
    }
  }

  // Delete solution principal
  static async delete(id) {
    try {
      const [result] = await pool.execute(`
        DELETE FROM SOLUTION_PRINCIPAL
        WHERE SP_ID = ?
      `, [id]);

      if (result.affectedRows === 0) {
        throw new Error('Solution Principal not found');
      }

      return { success: true, message: 'Solution Principal deleted successfully' };
    } catch (error) {
      console.error('Error in SolutionPrincipal.delete:', error);
      throw error;
    }
  }
}

module.exports = SolutionPrincipal;
