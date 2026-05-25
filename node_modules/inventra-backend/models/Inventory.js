const { pool } = require('../config/database');

class Inventory {
  constructor(inventory) {
    this.Inventory_ID = inventory.Inventory_ID;
    this.Project_ID = inventory.Project_ID;
    this.Customer_ID = inventory.Customer_ID;
    this.Asset_ID = inventory.Asset_ID;
  }

  /**
   * Create inventory records for a project (with NULL Asset_ID initially)
   * @param {number} projectId - Project ID
   * @param {number[]} customerIds - Array of Customer IDs (one per branch)
   * @returns {Promise<number[]>} - Array of created Inventory_IDs
   */
  static async createForProject(projectId, customerIds) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      const inventoryIds = [];
      
      // Create an inventory record for each customer (branch)
      // Asset_ID is NULL initially, will be filled when assets are added
      for (const customerId of customerIds) {
        const [result] = await connection.execute(
          `INSERT INTO INVENTORY (Project_ID, Customer_ID, Asset_ID) 
           VALUES (?, ?, NULL)`,
          [projectId, customerId]
        );
        
        inventoryIds.push(result.insertId);
        console.log(`Created inventory record: ID ${result.insertId}, Project ${projectId}, Customer ${customerId}, Asset NULL`);
      }
      
      await connection.commit();
      return inventoryIds;
    } catch (error) {
      await connection.rollback();
      console.error('Error in Inventory.createForProject:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Update inventory record with Asset_ID
   * @param {number} projectId - Project ID
   * @param {number} customerId - Customer ID
   * @param {number} assetId - Asset ID to add
   * @returns {Promise<boolean>} - True if updated successfully
   */
  static async updateWithAsset(projectId, customerId, assetId) {
    try {
      // Find inventory record with NULL Asset_ID for this project and customer
      const [rows] = await pool.execute(
        `SELECT Inventory_ID FROM INVENTORY 
         WHERE Project_ID = ? AND Customer_ID = ? AND Asset_ID IS NULL 
         LIMIT 1`,
        [projectId, customerId]
      );

      if (rows.length > 0) {
        // Update existing NULL record
        await pool.execute(
          `UPDATE INVENTORY SET Asset_ID = ? WHERE Inventory_ID = ?`,
          [assetId, rows[0].Inventory_ID]
        );
        console.log(`Updated inventory ID ${rows[0].Inventory_ID} with Asset ${assetId}`);
        return true;
      } else {
        // No NULL record found, create new one (multiple assets per branch scenario)
        const [result] = await pool.execute(
          `INSERT INTO INVENTORY (Project_ID, Customer_ID, Asset_ID) 
           VALUES (?, ?, ?)`,
          [projectId, customerId, assetId]
        );
        console.log(`Created new inventory record: ID ${result.insertId} for additional asset`);
        return true;
      }
    } catch (error) {
      console.error('Error in Inventory.updateWithAsset:', error);
      throw error;
    }
  }

  /**
   * Get all inventory records
   */
  static async findAll() {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          i.Inventory_ID,
          i.Project_ID,
          i.Customer_ID,
          i.Asset_ID,
          p.Project_Ref_Number,
          p.Project_Title,
          c.Customer_Ref_Number,
          c.Customer_Name,
          c.Branch,
          a.Asset_Serial_Number,
          a.Asset_Tag_ID,
          a.Item_Name
        FROM INVENTORY i
        LEFT JOIN PROJECT p ON i.Project_ID = p.Project_ID
        LEFT JOIN CUSTOMER c ON i.Customer_ID = c.Customer_ID
        LEFT JOIN ASSET a ON i.Asset_ID = a.Asset_ID
        ORDER BY i.Inventory_ID DESC
      `);
      return rows;
    } catch (error) {
      console.error('Error in Inventory.findAll:', error);
      throw error;
    }
  }

  /**
   * Get inventory records by project
   */
  static async findByProject(projectId) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          i.Inventory_ID,
          i.Project_ID,
          i.Customer_ID,
          i.Asset_ID,
          c.Customer_Ref_Number,
          c.Customer_Name,
          c.Branch,
          a.Asset_Serial_Number,
          a.Asset_Tag_ID,
          a.Item_Name,
          a.Status,
          cat.Category,
          m.Model_Name as Model,
          r.Recipient_Name,
          r.Department
        FROM INVENTORY i
        LEFT JOIN CUSTOMER c ON i.Customer_ID = c.Customer_ID
        LEFT JOIN ASSET a ON i.Asset_ID = a.Asset_ID
        LEFT JOIN CATEGORY cat ON a.Category_ID = cat.Category_ID
        LEFT JOIN MODEL m ON a.Model_ID = m.Model_ID
        LEFT JOIN RECIPIENTS r ON a.Recipients_ID = r.Recipients_ID
        WHERE i.Project_ID = ?
        ORDER BY c.Branch
      `, [projectId]);
      return rows;
    } catch (error) {
      console.error('Error in Inventory.findByProject:', error);
      throw error;
    }
  }

  /**
   * Delete inventory record
   */
  static async delete(id) {
    try {
      const [result] = await pool.execute('DELETE FROM INVENTORY WHERE Inventory_ID = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in Inventory.delete:', error);
      throw error;
    }
  }
}

module.exports = Inventory;
