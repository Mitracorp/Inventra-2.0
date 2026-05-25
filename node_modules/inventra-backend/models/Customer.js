const { pool } = require('../config/database');

class Customer {
  constructor(customer) {
    this.Customer_ID = customer.Customer_ID;
    this.Customer_Ref_Number = customer.Customer_Ref_Number;
    this.Customer_Name = customer.Customer_Name;
    this.Branch = customer.Branch;
  }

  /**
   * Create multiple customer records (one for each branch)
   * NOTE: In new database, CUSTOMER table no longer has Project_ID
   * Project relationship is maintained through INVENTORY table
   * @param {string} customerRefNumber - Customer reference number
   * @param {string} customerName - Customer name
   * @param {string[]} branches - Array of branch names
   * @returns {Promise<number[]>} - Array of created Customer_IDs
   */
  static async createMultipleBranches(customerRefNumber, customerName, branches) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      const customerIds = [];
      
      // Create a customer record for each branch
      for (const branch of branches) {
        const [result] = await connection.execute(
          `INSERT INTO CUSTOMER (Customer_Ref_Number, Customer_Name, Branch) 
           VALUES (?, ?, ?)`,
          [customerRefNumber, customerName, branch]
        );
        
        customerIds.push(result.insertId);
        console.log(`Created customer record: ID ${result.insertId}, Branch: ${branch}`);
      }
      
      await connection.commit();
      return customerIds;
    } catch (error) {
      await connection.rollback();
      console.error('Error in Customer.createMultipleBranches:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get all customers
   */
  static async findAll() {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          Customer_ID,
          Customer_Ref_Number,
          Customer_Name,
          Branch
        FROM CUSTOMER
        ORDER BY Customer_Ref_Number, Branch
      `);
      return rows.map(row => new Customer(row));
    } catch (error) {
      console.error('Error in Customer.findAll:', error);
      throw error;
    }
  }

  /**
   * Get customer by ID
   */
  static async findById(id) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          Customer_ID,
          Customer_Ref_Number,
          Customer_Name,
          Branch
        FROM CUSTOMER
        WHERE Customer_ID = ?
      `, [id]);
      
      if (rows.length > 0) {
        return new Customer(rows[0]);
      }
      return null;
    } catch (error) {
      console.error('Error in Customer.findById:', error);
      throw error;
    }
  }

  /**
   * Get all branches for a customer reference number
   */
  static async getBranchesByRefNumber(refNumber) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          Customer_ID,
          Customer_Ref_Number,
          Customer_Name,
          Branch
        FROM CUSTOMER
        WHERE Customer_Ref_Number = ?
        ORDER BY Branch
      `, [refNumber]);
      
      return rows.map(row => new Customer(row));
    } catch (error) {
      console.error('Error in Customer.getBranchesByRefNumber:', error);
      throw error;
    }
  }

  /**
   * Get all branches for a customer name
   */
  static async findBranchesByCustomerName(customerName) {
    try {
      console.log('🔍 Customer.findBranchesByCustomerName called with:', customerName);
      
      const [rows] = await pool.execute(`
        SELECT DISTINCT
          Customer_ID,
          Customer_Ref_Number,
          Customer_Name,
          Branch
        FROM CUSTOMER
        WHERE Customer_Name = ?
        ORDER BY Branch
      `, [customerName]);
      
      console.log(`📊 Found ${rows.length} branches for customer "${customerName}":`, rows);
      
      return rows.map(row => ({
        Customer_ID: row.Customer_ID,
        Customer_Ref_Number: row.Customer_Ref_Number,
        Customer_Name: row.Customer_Name,
        Branch: row.Branch
      }));
    } catch (error) {
      console.error('Error in Customer.findBranchesByCustomerName:', error);
      throw error;
    }
  }

  /**
   * Get branches by Customer Reference Number
   */
  static async findBranchesByCustomerRef(customerRefNumber) {
    try {
      console.log('🔍 Customer.findBranchesByCustomerRef called with:', customerRefNumber);
      
      const [rows] = await pool.execute(`
        SELECT DISTINCT
          Customer_ID,
          Customer_Ref_Number,
          Customer_Name,
          Branch
        FROM CUSTOMER
        WHERE Customer_Ref_Number = ?
        ORDER BY Branch
      `, [customerRefNumber]);
      
      console.log(`📊 Found ${rows.length} branches for customer ref "${customerRefNumber}":`, rows);
      
      return rows.map(row => ({
        Customer_ID: row.Customer_ID,
        Customer_Ref_Number: row.Customer_Ref_Number,
        Customer_Name: row.Customer_Name,
        Branch: row.Branch
      }));
    } catch (error) {
      console.error('Error in Customer.findBranchesByCustomerRef:', error);
      throw error;
    }
  }

  /**
   * Get branches for a specific project by project reference number
   */
  static async findBranchesByProjectRef(projectRefNumber) {
    try {
      console.log('🔍 Customer.findBranchesByProjectRef called with:', projectRefNumber);
      
      const [rows] = await pool.execute(`
        SELECT DISTINCT
          c.Customer_ID,
          c.Customer_Ref_Number,
          c.Customer_Name,
          c.Branch
        FROM CUSTOMER c
        INNER JOIN INVENTORY i ON c.Customer_ID = i.Customer_ID
        INNER JOIN PROJECT p ON i.Project_ID = p.Project_ID
        WHERE p.Project_Ref_Number = ?
        ORDER BY c.Branch
      `, [projectRefNumber]);
      
      console.log(`📊 Found ${rows.length} branches for project "${projectRefNumber}":`, rows);
      
      return rows.map(row => ({
        Customer_ID: row.Customer_ID,
        Customer_Ref_Number: row.Customer_Ref_Number,
        Customer_Name: row.Customer_Name,
        Branch: row.Branch
      }));
    } catch (error) {
      console.error('Error in Customer.findBranchesByProjectRef:', error);
      throw error;
    }
  }

  /**
   * Delete customer by ID
   */
  static async delete(id) {
    try {
      const [result] = await pool.execute('DELETE FROM CUSTOMER WHERE Customer_ID = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in Customer.delete:', error);
      throw error;
    }
  }
}

module.exports = Customer;
