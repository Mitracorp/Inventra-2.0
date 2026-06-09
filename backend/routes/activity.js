const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

router.get('/recent', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);

    const [rows] = await pool.execute(
      `SELECT
         h.History_ID AS id,
         h.User_ID AS userId,
         u.username AS username,
         h.Table_Name AS tableName,
         h.Record_ID AS recordId,
         h.Action_Type AS actionType,
         h.Action_Desc AS actionDesc,
         h.Timestamp AS timestamp
       FROM HISTORY_LOG h
       LEFT JOIN USER u ON u.User_ID = h.User_ID
       ORDER BY h.Timestamp DESC
       LIMIT ?`,
      [limit]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    logger.warn('Recent activity unavailable, returning empty list:', error.message || error);
    return res.status(200).json({ success: true, data: [] });
  }
});

module.exports = router;
