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
    logger.warn('Projects route query failed:', error.message || error);
    return [];
  }
};

const mapProjectRow = (row) => ({
  ...row,
  projectId: row.Project_ID,
  projectRefNumber: row.Project_Ref_Number,
  projectTitle: row.Project_Title,
  companyFullName: row.Customer_Name || null,
  startDate: row.Start_Date,
  endDate: row.End_Date
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const rows = await safeQuery(
      `SELECT
         p.Project_ID,
         p.Project_Ref_Number,
         p.Project_Title,
         p.Warranty,
         p.Preventive_Maintenance,
         p.PM_Frequency,
         p.Start_Date,
         p.End_Date,
         p.Antivirus,
         p.file_path_logo,
         c.Customer_Ref_Number,
         c.Customer_Name,
         c.Branch
       FROM PROJECT p
       LEFT JOIN (
         SELECT
           i.Project_ID,
           MIN(c.Customer_Ref_Number) AS Customer_Ref_Number,
           MIN(c.Customer_Name) AS Customer_Name,
           MIN(c.Branch) AS Branch
         FROM INVENTORY i
         LEFT JOIN CUSTOMER c ON c.Customer_ID = i.Customer_ID
         GROUP BY i.Project_ID
       ) c ON c.Project_ID = p.Project_ID
       ORDER BY p.Project_ID DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const totalRows = await safeQuery('SELECT COUNT(*) AS cnt FROM PROJECT');
    const total = totalRows[0]?.cnt || 0;

    return res.status(200).json({
      success: true,
      data: rows.map(mapProjectRow),
      pagination: {
        currentPage: page,
        total,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Failed to load projects:', error);
    return res.status(200).json({ success: true, data: [], pagination: { currentPage: 1, total: 0, itemsPerPage: 0, totalPages: 0 } });
  }
});

router.get('/reference/:refNum', authenticateToken, async (req, res) => {
  const rows = await safeQuery(
    'SELECT Project_ID, Project_Ref_Number, Project_Title, Warranty, Preventive_Maintenance, PM_Frequency, Start_Date, End_Date, Antivirus, file_path_logo FROM PROJECT WHERE Project_Ref_Number = ? LIMIT 1',
    [req.params.refNum]
  );
  if (!rows[0]) return res.status(404).json({ success: false, message: 'Project not found' });
  return res.status(200).json(mapProjectRow(rows[0]));
});

router.get('/branches/:customerName', authenticateToken, async (req, res) => {
  const rows = await safeQuery('SELECT DISTINCT Branch FROM CUSTOMER WHERE Customer_Name = ? ORDER BY Branch ASC', [req.params.customerName]);
  return res.status(200).json(rows.map((row) => row.Branch).filter(Boolean));
});

router.get('/branches-by-ref/:customerRefNumber', authenticateToken, async (req, res) => {
  const rows = await safeQuery('SELECT DISTINCT Branch FROM CUSTOMER WHERE Customer_Ref_Number = ? ORDER BY Branch ASC', [req.params.customerRefNumber]);
  return res.status(200).json(rows.map((row) => row.Branch).filter(Boolean));
});

router.get('/:id/deletion-preview', authenticateToken, async (req, res) => {
  const projectId = req.params.id;
  const assets = await safeQuery('SELECT COUNT(*) AS cnt FROM INVENTORY WHERE Project_ID = ?', [projectId]);
  const pmRecords = await safeQuery('SELECT COUNT(*) AS cnt FROM PM_RESULT WHERE Project_ID = ?', [projectId]);
  const peripherals = await safeQuery(
    'SELECT COUNT(*) AS cnt FROM PERIPHERAL p INNER JOIN ASSET a ON a.Asset_ID = p.Asset_ID INNER JOIN INVENTORY i ON i.Asset_ID = a.Asset_ID WHERE i.Project_ID = ?',
    [projectId]
  );

  return res.status(200).json({
    success: true,
    projectId,
    deletedAssets: assets[0]?.cnt || 0,
    deletedPMRecords: pmRecords[0]?.cnt || 0,
    deletedPeripherals: peripherals[0]?.cnt || 0
  });
});

router.get('/:id', authenticateToken, async (req, res) => {
  const rows = await safeQuery(
    `SELECT
       p.Project_ID,
       p.Project_Ref_Number,
       p.Project_Title,
       p.Warranty,
       p.Preventive_Maintenance,
       p.PM_Frequency,
       p.Start_Date,
       p.End_Date,
       p.Antivirus,
       p.file_path_logo,
       c.Customer_Ref_Number,
       c.Customer_Name,
       c.Branch
     FROM PROJECT p
     LEFT JOIN (
       SELECT
         i.Project_ID,
         MIN(c.Customer_Ref_Number) AS Customer_Ref_Number,
         MIN(c.Customer_Name) AS Customer_Name,
         MIN(c.Branch) AS Branch
       FROM INVENTORY i
       LEFT JOIN CUSTOMER c ON c.Customer_ID = i.Customer_ID
       GROUP BY i.Project_ID
     ) c ON c.Project_ID = p.Project_ID
     WHERE p.Project_ID = ?
     LIMIT 1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ success: false, message: 'Project not found' });
  return res.status(200).json(mapProjectRow(rows[0]));
});

router.get('/:id/solution-principals', authenticateToken, async (req, res) => {
  const rows = await safeQuery(
    `SELECT sp.SP_ID, sp.SP_Name
     FROM PROJECT_SP_BRIDGE psb
     INNER JOIN SOLUTION_PRINCIPAL sp ON sp.SP_ID = psb.SP_ID
     WHERE psb.Project_ID = ?
     ORDER BY sp.SP_Name ASC`,
    [req.params.id]
  );
  return res.status(200).json(rows || []);
});

router.put('/:id/solution-principals', authenticateToken, async (req, res) => {
  const projectId = Number(req.params.id);
  const list = Array.isArray(req.body?.solution_principals) ? req.body.solution_principals : [];

  await safeQuery('DELETE FROM PROJECT_SP_BRIDGE WHERE Project_ID = ?', [projectId]);

  for (const spId of list) {
    const numericSpId = Number(spId);
    if (!numericSpId) continue;
    await safeQuery(
      'INSERT INTO PROJECT_SP_BRIDGE (Project_ID, SP_ID, `Support Type`) VALUES (?, ?, NULL)',
      [projectId, numericSpId]
    );
  }

  return res.status(200).json({ success: true, message: 'Solution principals updated' });
});

router.put('/:id/branches', authenticateToken, async (req, res) => {
  const projectId = Number(req.params.id);
  const branches = Array.isArray(req.body?.branches)
    ? req.body.branches.map((b) => String(b || '').trim()).filter(Boolean)
    : [];

  if (branches.length === 0) {
    return res.status(400).json({ success: false, error: 'At least one branch is required' });
  }

  const customerRows = await safeQuery(
    `SELECT DISTINCT c.Customer_Ref_Number, c.Customer_Name
     FROM INVENTORY i
     INNER JOIN CUSTOMER c ON c.Customer_ID = i.Customer_ID
     WHERE i.Project_ID = ?`,
    [projectId]
  );

  for (const customer of customerRows) {
    for (const branch of branches) {
      await safeQuery(
        `INSERT INTO CUSTOMER (Customer_Ref_Number, Customer_Name, Branch)
         SELECT ?, ?, ?
         FROM DUAL
         WHERE NOT EXISTS (
           SELECT 1 FROM CUSTOMER
           WHERE Customer_Ref_Number = ? AND Customer_Name = ? AND Branch = ?
         )`,
        [
          customer.Customer_Ref_Number,
          customer.Customer_Name,
          branch,
          customer.Customer_Ref_Number,
          customer.Customer_Name,
          branch
        ]
      );
    }
  }

  return res.status(200).json({ success: true, message: 'Branches updated' });
});

router.delete('/:id', authenticateToken, async (req, res) => {
  const projectId = req.params.id;
  const deleted = await safeQuery('DELETE FROM PROJECT WHERE Project_ID = ?', [projectId]);
  return res.status(200).json({ success: true, deletedProjectId: projectId, affectedRows: deleted.affectedRows || 0, deletedAssets: 0, deletedPMRecords: 0, deletedPeripherals: 0 });
});

router.post('/', authenticateToken, async (req, res) => {
  const incomingProject = req.body?.project || req.body || {};
  const incomingCustomer = req.body?.customer || null;
  const incomingSolutionPrincipals = Array.isArray(req.body?.solution_principals) ? req.body.solution_principals : [];

  const { Project_Ref_Number, Project_Title, Warranty, Preventive_Maintenance, PM_Frequency, Start_Date, End_Date, Antivirus } = incomingProject;
  if (!Project_Ref_Number || !Project_Title) {
    return res.status(400).json({ success: false, message: 'Project_Ref_Number and Project_Title are required' });
  }

  const result = await safeQuery(
    'INSERT INTO PROJECT (Project_Ref_Number, Project_Title, Warranty, Preventive_Maintenance, PM_Frequency, Start_Date, End_Date, Antivirus) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [Project_Ref_Number, Project_Title, Warranty || null, Preventive_Maintenance || null, PM_Frequency || 2, Start_Date || null, End_Date || null, Antivirus || null]
  );

  const projectId = result?.insertId;

  if (projectId && incomingCustomer?.Customer_Ref_Number && incomingCustomer?.Customer_Name) {
    const branches = Array.isArray(incomingCustomer.branches)
      ? incomingCustomer.branches.map((b) => String(b || '').trim()).filter(Boolean)
      : [];

    for (const branch of branches) {
      await safeQuery(
        `INSERT INTO CUSTOMER (Customer_Ref_Number, Customer_Name, Branch)
         SELECT ?, ?, ?
         FROM DUAL
         WHERE NOT EXISTS (
           SELECT 1 FROM CUSTOMER
           WHERE Customer_Ref_Number = ? AND Customer_Name = ? AND Branch = ?
         )`,
        [
          incomingCustomer.Customer_Ref_Number,
          incomingCustomer.Customer_Name,
          branch,
          incomingCustomer.Customer_Ref_Number,
          incomingCustomer.Customer_Name,
          branch
        ]
      );
    }
  }

  if (projectId) {
    for (const spId of incomingSolutionPrincipals) {
      const numericSpId = Number(spId);
      if (!numericSpId) continue;
      await safeQuery(
        'INSERT INTO PROJECT_SP_BRIDGE (Project_ID, SP_ID, `Support Type`) VALUES (?, ?, NULL)',
        [projectId, numericSpId]
      );
    }
  }

  return res.status(201).json({ success: true, message: 'Project created successfully', projectId });
});

router.put('/:id', authenticateToken, async (req, res) => {
  const { Project_Ref_Number, Project_Title, Warranty, Preventive_Maintenance, PM_Frequency, Start_Date, End_Date, Antivirus } = req.body || {};
  await safeQuery(
    'UPDATE PROJECT SET Project_Ref_Number = COALESCE(?, Project_Ref_Number), Project_Title = COALESCE(?, Project_Title), Warranty = COALESCE(?, Warranty), Preventive_Maintenance = COALESCE(?, Preventive_Maintenance), PM_Frequency = COALESCE(?, PM_Frequency), Start_Date = COALESCE(?, Start_Date), End_Date = COALESCE(?, End_Date), Antivirus = COALESCE(?, Antivirus) WHERE Project_ID = ?',
    [Project_Ref_Number || null, Project_Title || null, Warranty || null, Preventive_Maintenance || null, PM_Frequency || null, Start_Date || null, End_Date || null, Antivirus || null, req.params.id]
  );

  return res.status(200).json({ success: true, message: 'Project updated successfully' });
});

module.exports = router;
