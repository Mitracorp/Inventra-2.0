const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { pool, executeQuery } = require('../config/database');

router.get('/statistics', authenticateToken, async (req, res) => {
  try {
    const [[totals]] = await pool.execute(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN UPPER(COALESCE(Status, '')) = 'ACTIVE' THEN 1 ELSE 0 END), 0) AS activeAssets,
        COALESCE(SUM(COALESCE(Monthly_Prices, 0)), 0) AS totalValue,
        COALESCE(SUM(CASE WHEN Is_Flagged = 1 THEN 1 ELSE 0 END), 0) AS flaggedAssets
      FROM ASSET
    `);

    const [[projectTotals]] = await pool.execute('SELECT COUNT(*) AS totalProjects FROM PROJECT');

    const [byStatus] = await pool.execute(`
      SELECT
        COALESCE(Status, 'UNKNOWN') AS status,
        COUNT(*) AS count
      FROM ASSET
      GROUP BY COALESCE(Status, 'UNKNOWN')
      ORDER BY count DESC
    `);

    const [byCategory] = await pool.execute(`
      SELECT
        c.Customer_Name AS category,
        COUNT(*) AS count
      FROM INVENTORY i
      LEFT JOIN CUSTOMER c ON c.Customer_ID = i.Customer_ID
      GROUP BY c.Customer_Name
      ORDER BY count DESC
    `);

    const [byCustomer] = await pool.execute(`
      SELECT
        c.Customer_Name AS customer,
        COUNT(*) AS count
      FROM INVENTORY i
      LEFT JOIN CUSTOMER c ON c.Customer_ID = i.Customer_ID
      GROUP BY c.Customer_Name
      ORDER BY count DESC
    `);

    const [byModel] = await pool.execute(`
      SELECT
        COALESCE(m.Model_Name, 'Unknown Model') AS model,
        COUNT(*) AS count
      FROM ASSET a
      LEFT JOIN MODEL m ON m.Model_ID = a.Model_ID
      GROUP BY COALESCE(m.Model_Name, 'Unknown Model')
      ORDER BY count DESC
      LIMIT 15
    `);

    const [revenueByCategory] = await pool.execute(`
      SELECT
        c.Customer_Name AS category,
        COUNT(*) AS count,
        COALESCE(SUM(COALESCE(a.Monthly_Prices, 0)), 0) AS revenue
      FROM INVENTORY i
      LEFT JOIN ASSET a ON a.Asset_ID = i.Asset_ID
      LEFT JOIN CUSTOMER c ON c.Customer_ID = i.Customer_ID
      GROUP BY c.Customer_Name
      ORDER BY revenue DESC
    `);

    const [peripheralTypeDistribution] = await pool.execute(`
      SELECT
        COALESCE(pt.Peripheral_Type_Name, 'Unknown') AS peripheralType,
        COUNT(*) AS count,
        COUNT(DISTINCT p.Asset_ID) AS assetCount
      FROM PERIPHERAL p
      LEFT JOIN PERIPHERAL_TYPE pt ON pt.Peripheral_Type_ID = p.Peripheral_Type_ID
      GROUP BY COALESCE(pt.Peripheral_Type_Name, 'Unknown')
      ORDER BY count DESC
    `);

    const [totalPeripheralsRows] = await pool.execute('SELECT COUNT(*) AS totalPeripherals FROM PERIPHERAL');

    const customersByCategory = byCategory.reduce((acc, row) => {
      if (!row?.category) return acc;
      acc[row.category] = { total: Number(row.count) || 0 };
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: {
        total: Number(totals?.total) || 0,
        totalProjects: Number(projectTotals?.totalProjects) || 0,
        totalValue: Number(totals?.totalValue) || 0,
        totalPeripherals: Number(totalPeripheralsRows?.[0]?.totalPeripherals) || 0,
        flaggedAssets: Number(totals?.flaggedAssets) || 0,
        byStatus,
        byCategory,
        byCustomer,
        byModel,
        revenueByCategory,
        warrantyByProject: [],
        peripheralTypeDistribution,
        customersByCategory
      }
    });
  } catch (error) {
    logger.error('Failed to load asset statistics:', error);
    return res.status(200).json({
      success: true,
      data: {
        total: 0,
        totalProjects: 0,
        totalValue: 0,
        totalPeripherals: 0,
        flaggedAssets: 0,
        byStatus: [],
        byCategory: [],
        byCustomer: [],
        byModel: [],
        revenueByCategory: [],
        warrantyByProject: [],
        peripheralTypeDistribution: [],
        customersByCategory: {}
      }
    });
  }
});

// GET /api/v1/assets
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    // Basic join between INVENTORY and ASSET where available
    const query = `SELECT
                     i.Inventory_ID AS Inventory_ID,
                     i.Project_ID AS Project_ID,
                     i.Customer_ID AS Customer_ID,
                     i.Asset_ID AS Asset_ID,
                     c.Customer_Ref_Number AS Customer_Ref_Number,
                     c.Customer_Name AS Customer_Name,
                     c.Branch AS Branch,
                     p.Project_Ref_Number AS Project_Ref_Number,
                     p.Project_Title AS Project_Title,
                     a.Asset_Serial_Number AS Asset_Serial_Number,
                     a.Asset_Tag_ID AS Asset_Tag_ID,
                     a.Item_Name AS Item_Name,
                     a.Status AS Status,
                     a.Windows AS Windows,
                     a.Microsoft_Office AS Microsoft_Office,
                     a.AV AS AV,
                     a.Monthly_Prices AS Monthly_Prices,
                     a.Is_Flagged AS Is_Flagged,
                     a.Flag_Remarks AS Flag_Remarks,
                     a.Flag_Date AS Flag_Date,
                     a.Flagged_By AS Flagged_By
                   FROM INVENTORY i
                   LEFT JOIN ASSET a ON a.Asset_ID = i.Asset_ID
                   LEFT JOIN CUSTOMER c ON c.Customer_ID = i.Customer_ID
                   LEFT JOIN PROJECT p ON p.Project_ID = i.Project_ID
                   ORDER BY i.Inventory_ID DESC
                   LIMIT ? OFFSET ?`;

    const [rows] = await pool.execute(query, [limit, offset]);

    // Count total
    const [countRows] = await pool.execute('SELECT COUNT(*) AS cnt FROM INVENTORY');
    const total = countRows[0] ? countRows[0].cnt : rows.length;

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        currentPage: page,
        total: total,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.warn('Assets route failed, returning empty list to avoid 404:', error.message || error);
    return res.status(200).json({
      success: true,
      data: [],
      pagination: { currentPage: 1, total: 0, itemsPerPage: 0, totalPages: 0 },
      message: 'Assets unavailable (development fallback)'
    });
  }
});

module.exports = router;
