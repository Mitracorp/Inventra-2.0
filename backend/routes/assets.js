const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { pool, executeQuery } = require('../config/database');

const getAssetDetailById = async (assetId) => {
  const [assetRows] = await pool.execute(
    `SELECT
       a.Asset_ID,
       a.Asset_Serial_Number,
       a.Asset_Tag_ID,
       a.Item_Name,
       a.Status,
       a.Windows,
       a.Microsoft_Office,
       a.AV,
       a.Monthly_Prices,
       a.Is_Flagged,
       a.Flag_Remarks,
       a.Flag_Date,
       a.Flagged_By,
       r.Recipient_Name,
       r.Department,
       r.Position,
       c.Category,
       m.Model_Name AS Model,
       i.Inventory_ID,
       i.Project_ID,
       i.Customer_ID,
       cust.Customer_Ref_Number,
       cust.Customer_Name,
       cust.Branch,
       p.Project_Ref_Number,
       p.Warranty,
       p.Start_Date,
       p.End_Date,
       p.Antivirus AS Project_Antivirus
     FROM ASSET a
     LEFT JOIN RECIPIENTS r ON r.Recipients_ID = a.Recipients_ID
     LEFT JOIN CATEGORY c ON c.Category_ID = a.Category_ID
     LEFT JOIN MODEL m ON m.Model_ID = a.Model_ID
     LEFT JOIN INVENTORY i ON i.Asset_ID = a.Asset_ID
     LEFT JOIN CUSTOMER cust ON cust.Customer_ID = i.Customer_ID
     LEFT JOIN PROJECT p ON p.Project_ID = i.Project_ID
     WHERE a.Asset_ID = ?
     ORDER BY i.Inventory_ID DESC
     LIMIT 1`,
    [assetId]
  );

  if (!assetRows.length) {
    return null;
  }

  const [peripheralRows] = await pool.execute(
    `SELECT
       p.Peripheral_ID,
       pt.Peripheral_Type_Name,
       p.Serial_Code,
       p.\`Condition\`,
       p.Remarks
     FROM PERIPHERAL p
     LEFT JOIN PERIPHERAL_TYPE pt ON pt.Peripheral_Type_ID = p.Peripheral_Type_ID
     WHERE p.Asset_ID = ?
     ORDER BY p.Peripheral_ID ASC`,
    [assetId]
  );

  const [softwareRows] = await pool.execute(
    `SELECT
       s.Software_ID,
       s.Software_Name,
       s.Price
     FROM ASSET_SOFTWARE_BRIDGE b
     LEFT JOIN SOFTWARE s ON s.Software_ID = b.Software_ID
     WHERE b.Asset_ID = ?
     ORDER BY s.Software_Name ASC`,
    [assetId]
  );

  const softwareNames = softwareRows
    .map((row) => row.Software_Name)
    .filter(Boolean)
    .join(', ');

  return {
    ...assetRows[0],
    Software: softwareNames,
    SoftwareList: softwareRows,
    Peripherals: peripheralRows
  };
};

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
                   WHERE i.Asset_ID IS NOT NULL
                   ORDER BY i.Inventory_ID DESC
                   LIMIT ? OFFSET ?`;

    const [rows] = await pool.execute(query, [limit, offset]);

    // Count total
    const [countRows] = await pool.execute('SELECT COUNT(*) AS cnt FROM INVENTORY WHERE Asset_ID IS NOT NULL');
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

// GET /api/v1/assets/detail/:id
router.get('/detail/:id', authenticateToken, async (req, res) => {
  try {
    const assetId = parseInt(req.params.id, 10);
    if (Number.isNaN(assetId)) {
      return res.status(400).json({ success: false, message: 'Invalid asset id' });
    }

    const detail = await getAssetDetailById(assetId);
    if (!detail) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    return res.status(200).json(detail);
  } catch (error) {
    logger.error('Failed to fetch asset detail:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch asset detail' });
  }
});

// GET /api/v1/assets/id/:id
router.get('/id/:id', authenticateToken, async (req, res) => {
  try {
    const assetId = parseInt(req.params.id, 10);
    if (Number.isNaN(assetId)) {
      return res.status(400).json({ success: false, message: 'Invalid asset id' });
    }

    const detail = await getAssetDetailById(assetId);
    if (!detail) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    return res.status(200).json(detail);
  } catch (error) {
    logger.error('Failed to fetch asset by id:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch asset' });
  }
});

module.exports = router;

// POST /api/v1/assets/create-with-details
router.post('/create-with-details', authenticateToken, async (req, res) => {
  const data = req.body || {};
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Simple helpers
    const toNull = (v) => (v === undefined || v === '' ? null : v);

    // 1) Create or find recipient
    let recipientId = null;
    if (data.recipient_name) {
      const [rrows] = await conn.execute('SELECT Recipients_ID FROM RECIPIENTS WHERE Recipient_Name = ? LIMIT 1', [data.recipient_name]);
      if (rrows.length > 0) recipientId = rrows[0].Recipients_ID;
      else {
        const [rres] = await conn.execute('INSERT INTO RECIPIENTS (Recipient_Name, Department, `Position`) VALUES (?, ?, ?)', [data.recipient_name, toNull(data.department_name), toNull(data.position)]);
        recipientId = rres.insertId;
      }
    }

    // 2) Category
    let categoryId = null;
    if (data.category) {
      const [crows] = await conn.execute('SELECT Category_ID FROM CATEGORY WHERE Category = ? LIMIT 1', [data.category]);
      if (crows.length > 0) categoryId = crows[0].Category_ID;
      else {
        const [cres] = await conn.execute('INSERT INTO CATEGORY (Category) VALUES (?)', [data.category]);
        categoryId = cres.insertId;
      }
    }

    // 3) Model
    let modelId = null;
    if (data.model) {
      const [mrows] = await conn.execute('SELECT Model_ID FROM MODEL WHERE Model_Name = ? LIMIT 1', [data.model]);
      if (mrows.length > 0) modelId = mrows[0].Model_ID;
      else {
        const [mres] = await conn.execute('INSERT INTO MODEL (Model_Name, Category_ID) VALUES (?, ?)', [data.model, categoryId]);
        modelId = mres.insertId;
      }
    }

    // 4) Insert asset
    const [assetRes] = await conn.execute(
      `INSERT INTO ASSET (Asset_Serial_Number, Asset_Tag_ID, Item_Name, Status, Recipients_ID, Category_ID, Model_ID, Windows, Microsoft_Office, Monthly_Prices, AV)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [toNull(data.serial_number), toNull(data.tag_id), toNull(data.item_name), toNull(data.status || 'Active'), recipientId, categoryId, modelId, toNull(data.windows), toNull(data.microsoft_office), toNull(data.monthly_prices), data.av === undefined ? null : data.av]
    );
    const assetId = assetRes.insertId;

    // 5) Peripherals (simple insert)
    if (Array.isArray(data.peripherals)) {
      for (const p of data.peripherals) {
        if (!p.peripheral_name) continue;
        await conn.execute('INSERT INTO PERIPHERAL (Peripheral_Type_ID, Asset_ID, Serial_Code, `Condition`, Remarks) VALUES (?, ?, ?, ?, ?)', [null, assetId, toNull(p.serial_code_name || p.serial_code), toNull(p.condition || 'Good'), toNull(p.remarks)]);
      }
    }

    // 6) Ensure customer exists
    let customerId = null;
    if (data.customer_reference_number && data.customer_name && data.branch) {
      const [custRows] = await conn.execute('SELECT Customer_ID FROM CUSTOMER WHERE Customer_Ref_Number = ? AND Customer_Name = ? AND Branch = ? LIMIT 1', [data.customer_reference_number, data.customer_name, data.branch]);
      if (custRows.length > 0) customerId = custRows[0].Customer_ID;
      else {
        const [cres] = await conn.execute('INSERT INTO CUSTOMER (Customer_Ref_Number, Customer_Name, Branch) VALUES (?, ?, ?)', [data.customer_reference_number, data.customer_name, data.branch]);
        customerId = cres.insertId;
      }
    } else if (data.customer_name) {
      // try to find any customer row with this name
      const [custRows] = await conn.execute('SELECT Customer_ID, Branch, Customer_Ref_Number FROM CUSTOMER WHERE Customer_Name = ? LIMIT 1', [data.customer_name]);
      if (custRows.length > 0) {
        customerId = custRows[0].Customer_ID;
      }
    }

    // 7) Find project id
    let projectId = null;
    if (data.project_reference_num) {
      const [prow] = await conn.execute('SELECT Project_ID FROM PROJECT WHERE Project_Ref_Number = ? LIMIT 1', [data.project_reference_num]);
      if (prow.length > 0) projectId = prow[0].Project_ID;
    }

    // 8) Insert into INVENTORY
    if (assetId) {
      await conn.execute('INSERT INTO INVENTORY (Project_ID, Customer_ID, Asset_ID) VALUES (?, ?, ?)', [projectId || null, customerId || null, assetId]);
    }

    await conn.commit();

    // Return basic success
    res.status(201).json({ success: true, message: 'Asset created (minimal)', data: { asset_id: assetId, inventory_project_id: projectId, customer_id: customerId } });
  } catch (err) {
    await conn.rollback();
    logger.error('Failed to create asset (minimal):', err.message || err);
    res.status(500).json({ success: false, error: 'Failed to create asset', message: err.message || String(err) });
  } finally {
    conn.release();
  }
});
