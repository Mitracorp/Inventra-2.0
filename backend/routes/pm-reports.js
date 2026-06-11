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
    logger.warn('PM reports query failed:', error.message || error);
    return [];
  }
};

const normalizeStatus = (status) => String(status || '').trim().toLowerCase().replace(/\.$/, '');

const isCompleted = (status) => {
  const normalized = normalizeStatus(status);
  return normalized === 'completed' || normalized === 'marked as completed';
};

const buildChecklistMap = async (pmIds) => {
  if (!pmIds.length) return {};

  const placeholders = pmIds.map(() => '?').join(',');
  const rows = await safeQuery(
    `SELECT
       pr.PM_ID,
       pr.PM_Result_ID,
       pr.Checklist_ID,
       pr.Is_OK_bool,
       pr.Remarks,
       pc.Check_item_Long
     FROM PM_RESULT pr
     LEFT JOIN PM_CHECKLIST pc ON pc.Checklist_ID = pr.Checklist_ID
     WHERE pr.PM_ID IN (${placeholders})
     ORDER BY pr.PM_ID ASC, pr.PM_Result_ID ASC`,
    pmIds
  );

  return rows.reduce((acc, row) => {
    if (!acc[row.PM_ID]) acc[row.PM_ID] = [];
    acc[row.PM_ID].push({
      PM_Result_ID: row.PM_Result_ID,
      PM_ID: row.PM_ID,
      Checklist_ID: row.Checklist_ID,
      Is_OK_bool: row.Is_OK_bool,
      Remarks: row.Remarks,
      Check_item_Long: row.Check_item_Long
    });
    return acc;
  }, {});
};

const buildWhereClause = (filters) => {
  const whereParts = ['1=1'];
  const params = [];

  if (filters.customerId) {
    whereParts.push('(c.Customer_ID = ? OR c.Customer_Name = ?)');
    params.push(filters.customerId, filters.customerName || filters.customerId);
  }

  if (filters.branchId) {
    whereParts.push('c.Branch = ?');
    params.push(filters.branchId);
  }

  if (filters.projectId) {
    whereParts.push('p.Project_ID = ?');
    params.push(filters.projectId);
  }

  if (filters.category) {
    whereParts.push('cat.Category = ?');
    params.push(filters.category);
  }

  if (filters.startDate) {
    whereParts.push('p.PM_Date >= ?');
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    whereParts.push('p.PM_Date <= ?');
    params.push(filters.endDate);
  }

  return { whereClause: whereParts.join(' AND '), params };
};

const loadReportRows = async (filters = {}) => {
  const { whereClause, params } = buildWhereClause(filters);
  const rows = await safeQuery(
    `SELECT DISTINCT
       p.PM_ID,
       p.Asset_ID,
       p.PM_Date,
       p.Status,
       p.file_path,
       p.file_path_acknowledgement,
       p.signature_path,
       p.signed_at,
       p.Remarks,
       a.Asset_Tag_ID,
       a.Item_Name,
       a.Asset_Serial_Number,
       c.Customer_ID,
       c.Customer_Name,
       c.Customer_Ref_Number,
       c.Branch,
       cat.Category
     FROM PMAINTENANCE p
     LEFT JOIN ASSET a ON a.Asset_ID = p.Asset_ID
     LEFT JOIN INVENTORY i ON i.Asset_ID = p.Asset_ID
     LEFT JOIN CUSTOMER c ON c.Customer_ID = i.Customer_ID
     LEFT JOIN CATEGORY cat ON cat.Category_ID = a.Category_ID
     WHERE ${whereClause}
     ORDER BY p.PM_Date DESC, p.PM_ID DESC`,
    params
  );

  const pmIds = rows.map((row) => row.PM_ID).filter(Boolean);
  const checklistMap = await buildChecklistMap(pmIds);

  return rows.map((row) => ({
    ...row,
    PM_Status: row.Status,
    checklist_results: checklistMap[row.PM_ID] || []
  }));
};

// Redirect report download requests to the main PM router dynamically
const redirectReport = (req, res) => {
  const pmPath = req.baseUrl.replace(/\/pm-reports\/?$/, '/pm');
  const pmId = req.params.pmId || req.query.pmId || req.body?.pmId || req.body?.id || req.body?.PM_ID || req.body?.pm_id;
  if (req.method === 'POST') {
    res.redirect(307, `${pmPath}/${pmId}/report`);
  } else {
    res.redirect(`${pmPath}/${pmId}/report`);
  }
};

const redirectEndpoints = [
  '/:pmId/report', '/report/:pmId', '/:pmId/download', '/download/:pmId',
  '/:pmId/pdf', '/pdf/:pmId', '/:pmId/generate', '/generate/:pmId',
  '/:pmId/generate-pdf', '/generate-pdf/:pmId', '/:pmId/generate-report', '/generate-report/:pmId',
  '/:pmId/generate-form', '/generate-form/:pmId'
];
redirectEndpoints.forEach(ep => {
  router.get(ep, redirectReport);
  router.post(ep, redirectReport);
});

// Aggressive catch-alls for single report endpoints
[/.*generate.*/i, /.*report.*/i, /.*download.*/i].forEach(pattern => {
  router.post(pattern, (req, res, next) => {
    if (req.url === '/generate' || req.url === '/generate/' || req.url.includes('bulk-download')) return next();
    return redirectReport(req, res);
  });
  router.get(pattern, (req, res, next) => {
    if (req.url === '/generate' || req.url === '/generate/' || req.url.includes('bulk-download')) return next();
    return redirectReport(req, res);
  });
});

router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const {
      customerId = null,
      branchId = null,
      projectId = null,
      category = null,
      startDate = null,
      endDate = null,
    } = req.body || {};

    let resolvedCustomerName = customerId;
    if (customerId) {
      try {
        const [custRows] = await pool.execute('SELECT Customer_Name FROM CUSTOMER WHERE Customer_ID = ? LIMIT 1', [customerId]);
        if (custRows && custRows.length > 0) resolvedCustomerName = custRows[0].Customer_Name;
      } catch(e) {}
    }

    const allPmRecords = await loadReportRows({ customerId, customerName: resolvedCustomerName, branchId, projectId, category, startDate, endDate });
    const completed = allPmRecords.filter((record) => isCompleted(record.Status)).length;
    const unsigned = allPmRecords.filter((record) => !isCompleted(record.Status)).length;
    const incomplete = unsigned;
    const totalAssets = new Set(allPmRecords.map((record) => record.Asset_ID).filter(Boolean)).size;

    const metrics = {
      total: allPmRecords.length,
      completed,
      unsigned,
      incomplete,
      totalAssets
    };

    const customerName = allPmRecords[0]?.Customer_Name || '';
    const period = startDate || endDate ? `${startDate || 'N/A'} to ${endDate || 'N/A'}` : 'All time';

    return res.status(200).json({
      metrics,
      allPmRecords,
      records: allPmRecords,
      customerName,
      period
    });
  } catch (error) {
    logger.error('Failed to generate PM report:', error);
    return res.status(200).json({
      metrics: { total: 0, completed: 0, unsigned: 0, incomplete: 0, totalAssets: 0 },
      allPmRecords: [],
      records: [],
      customerName: '',
      period: 'All time'
    });
  }
});

module.exports = router;
