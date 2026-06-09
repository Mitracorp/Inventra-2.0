const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const safeQuery = async (sql, params = []) => {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    logger.warn('Options route query failed:', error.message || error);
    return [];
  }
};

router.get('/customers', optionalAuth, async (req, res) => {
  try {
    const rows = await safeQuery(
      'SELECT DISTINCT Customer_ID, Customer_Ref_Number, Customer_Name, Branch FROM CUSTOMER ORDER BY Customer_Name ASC, Branch ASC'
    );
    return res.status(200).json({ success: true, customers: rows });
  } catch (error) {
    logger.error('Failed to load option customers:', error);
    return res.status(200).json({ success: true, customers: [] });
  }
});

router.get('/customer-branches/:customerName', authenticateToken, async (req, res) => {
  try {
    const rows = await safeQuery(
      'SELECT DISTINCT Branch FROM CUSTOMER WHERE Customer_Name = ? ORDER BY Branch ASC',
      [req.params.customerName]
    );
    return res.status(200).json({ success: true, branches: rows.map((row) => row.Branch).filter(Boolean) });
  } catch (error) {
    logger.error('Failed to load option branches:', error);
    return res.status(200).json({ success: true, branches: [] });
  }
});

router.get('/asset-categories', authenticateToken, async (req, res) => {
  try {
    const { customer, branch } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (customer) {
      where += ' AND c.Customer_Name = ?';
      params.push(customer);
    }
    if (branch) {
      where += ' AND c.Branch = ?';
      params.push(branch);
    }

    const rows = await safeQuery(
      `SELECT DISTINCT cat.Category
       FROM INVENTORY i
       LEFT JOIN CUSTOMER c ON c.Customer_ID = i.Customer_ID
       LEFT JOIN ASSET a ON a.Asset_ID = i.Asset_ID
      LEFT JOIN CATEGORY cat ON cat.Category_ID = a.Category_ID
       ${where}
       AND cat.Category IS NOT NULL
       ORDER BY cat.Category ASC`,
      params
    );

    return res.status(200).json({ success: true, categories: rows.map((row) => row.Category).filter(Boolean) });
  } catch (error) {
    logger.error('Failed to load option categories:', error);
    return res.status(200).json({ success: true, categories: [] });
  }
});

module.exports = router;
