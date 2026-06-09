const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const safeQuery = async (sql, params = []) => {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    logger.warn('Inventory route query failed:', error.message || error);
    return [];
  }
};

router.get('/project/:projectId', authenticateToken, async (req, res) => {
  const projectId = req.params.projectId;
  const rows = await safeQuery(
    `SELECT i.Inventory_ID, i.Project_ID, i.Customer_ID, i.Asset_ID,
            c.Customer_Name, c.Customer_Ref_Number, c.Branch,
            a.Asset_Serial_Number, a.Asset_Tag_ID, a.Item_Name, a.Status,
            a.Recipients_ID, r.Recipient_Name, r.Department
     FROM INVENTORY i
     LEFT JOIN CUSTOMER c ON c.Customer_ID = i.Customer_ID
     LEFT JOIN ASSET a ON a.Asset_ID = i.Asset_ID
     LEFT JOIN RECIPIENTS r ON r.Recipients_ID = a.Recipients_ID
     WHERE i.Project_ID = ?
     ORDER BY i.Inventory_ID DESC`,
    [projectId]
  );

  return res.status(200).json(rows);
});

router.post('/update-asset', authenticateToken, async (req, res) => {
  const { projectId, customerId, assetId } = req.body || {};
  if (!assetId) {
    return res.status(400).json({ success: false, message: 'assetId is required' });
  }

  const result = await safeQuery(
    'UPDATE INVENTORY SET Project_ID = COALESCE(?, Project_ID), Customer_ID = COALESCE(?, Customer_ID), Asset_ID = COALESCE(?, Asset_ID) WHERE Asset_ID = ?',
    [projectId || null, customerId || null, assetId, assetId]
  );

  return res.status(200).json({ success: true, affectedRows: result.affectedRows || 0 });
});

module.exports = router;
