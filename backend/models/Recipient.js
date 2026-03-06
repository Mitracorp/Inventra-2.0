const { pool } = require('../config/database');

class Recipient {
  static async findAll() {
    const query = `
      SELECT 
        Recipients_ID,
        Recipient_Name,
        Department,
        Position
      FROM RECIPIENTS
      ORDER BY Recipient_Name ASC
    `;
    
    const [rows] = await pool.query(query);
    return rows;
  }

  static async findById(id) {
    const query = `
      SELECT 
        Recipients_ID,
        Recipient_Name,
        Department,
        Position
      FROM RECIPIENTS
      WHERE Recipients_ID = ?
    `;
    
    const [rows] = await pool.query(query, [id]);
    return rows[0];
  }

  static async create(data) {
    const query = `
      INSERT INTO RECIPIENTS (Recipient_Name, Department, Position)
      VALUES (?, ?, ?)
    `;
    
    const [result] = await pool.query(query, [
      data.recipient_name,
      data.department,
      data.position
    ]);
    
    return result.insertId;
  }

  static async update(id, data) {
    const query = `
      UPDATE RECIPIENTS
      SET 
        Recipient_Name = ?,
        Department = ?,
        Position = ?
      WHERE Recipients_ID = ?
    `;
    
    const [result] = await pool.query(query, [
      data.recipient_name,
      data.department,
      data.position,
      id
    ]);
    
    return result.affectedRows;
  }

  static async delete(id) {
    const query = 'DELETE FROM RECIPIENTS WHERE Recipients_ID = ?';
    const [result] = await pool.query(query, [id]);
    return result.affectedRows;
  }
}

module.exports = Recipient;
