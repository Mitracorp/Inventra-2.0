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
    logger.warn('PM route query failed:', error.message || error);
    return [];
  }
};

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const PDFDocument = require('pdfkit');

// Generate a simple PM form PDF for a PM record when no existing PDF is available
const generatePmPdf = async (pmRecord, outputPath) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ autoFirstPage: true });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      doc.fontSize(16).text('Preventive Maintenance Form', { align: 'center' });
      doc.moveDown();

      doc.fontSize(12).text(`PM ID: ${pmRecord.PM_ID || ''}`);
      doc.text(`Asset: ${pmRecord.Item_Name || pmRecord.Asset_Serial_Number || ''}`);
      doc.text(`Customer: ${pmRecord.Customer_Name || ''}`);
      doc.text(`Date: ${pmRecord.PM_Date || ''}`);
      doc.text(`Status: ${pmRecord.Status || ''}`);
      doc.moveDown();

      doc.fontSize(12).text('Checklist Results:', { underline: true });
      const checklist = pmRecord.checklist_results || [];
      if (checklist.length === 0) {
        doc.text('No checklist items recorded.');
      } else {
        checklist.forEach((c, idx) => {
          doc.text(`${idx + 1}. ${c.Check_item_Long || c.Checklist_ID || ''} — ${c.Is_OK_bool ? 'OK' : 'NOT OK'} ${c.Remarks ? `(${c.Remarks})` : ''}`);
        });
      }

      doc.moveDown();
      doc.text('Signature: ____________________', { continued: false });
      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
};

const buildChecklistMap = async (pmIds) => {
  if (!pmIds || pmIds.length === 0) {
    return {};
  }

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
    if (!acc[row.PM_ID]) {
      acc[row.PM_ID] = [];
    }

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

const getPmRecords = async ({ customerId = null, branch = null, assetId = null, pmId = null } = {}) => {
  const params = [];
  const whereParts = ['1=1'];

  if (customerId) {
    whereParts.push('c.Customer_ID = ?');
    params.push(customerId);
  }

  if (branch) {
    whereParts.push('c.Branch = ?');
    params.push(branch);
  }

  if (assetId) {
    whereParts.push('p.Asset_ID = ?');
    params.push(assetId);
  }

  if (pmId) {
    whereParts.push('p.PM_ID = ?');
    params.push(pmId);
  }

  const records = await safeQuery(
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
       p.Created_By,
       p.Updated_By,
       a.Asset_Serial_Number,
       a.Asset_Tag_ID,
       a.Item_Name,
       a.Status AS Asset_Status,
       c.Customer_ID,
       c.Customer_Name,
       c.Customer_Ref_Number,
       c.Branch,
       r.Recipient_Name,
       r.Department,
       cat.Category
     FROM PMAINTENANCE p
     LEFT JOIN ASSET a ON a.Asset_ID = p.Asset_ID
     LEFT JOIN INVENTORY i ON i.Asset_ID = p.Asset_ID
     LEFT JOIN CUSTOMER c ON c.Customer_ID = i.Customer_ID
     LEFT JOIN RECIPIENTS r ON r.Recipients_ID = a.Recipients_ID
     LEFT JOIN CATEGORY cat ON cat.Category_ID = a.Category_ID
     WHERE ${whereParts.join(' AND ')}
     ORDER BY p.PM_Date DESC, p.PM_ID DESC`,
    params
  );

  const checklistMap = await buildChecklistMap(records.map((record) => record.PM_ID).filter(Boolean));

  return records.map((record) => ({
    ...record,
    PM_Status: record.Status,
    checklist_results: checklistMap[record.PM_ID] || []
  }));
};

const getCustomers = async () => {
  const rows = await safeQuery(
    'SELECT DISTINCT Customer_ID, Customer_Ref_Number, Customer_Name, Branch FROM CUSTOMER ORDER BY Customer_Name ASC, Branch ASC'
  );
  return rows;
};

// Expose customers list for frontend routes that call /pm/customers
router.get('/customers', optionalAuth, async (req, res) => {
  try {
    const rows = await getCustomers();
    return res.status(200).json(rows);
  } catch (error) {
    logger.error('Failed to load PM customers:', error);
    return res.status(200).json([]);
  }
});

// Support frontend request for branches by customer id or name
router.get('/customers/:customerIdentifier/branches', optionalAuth, async (req, res) => {
  try {
    const idOrName = req.params.customerIdentifier;
    let branches = [];

    if (/^\d+$/.test(idOrName)) {
      branches = await getBranchesForCustomerId(idOrName);
    } else {
      const decoded = decodeURIComponent(idOrName);
      branches = await getBranchesForCustomerName(decoded);
    }

    return res.status(200).json(branches);
  } catch (error) {
    logger.error('Failed to load branches for customer:', error);
    return res.status(200).json([]);
  }
});

const getBranchesForCustomerId = async (customerId) => {
  const rows = await safeQuery(
    'SELECT DISTINCT Branch FROM CUSTOMER WHERE Customer_ID = ? ORDER BY Branch ASC',
    [customerId]
  );
  return rows.map((row) => row.Branch).filter(Boolean);
};

const getBranchesForCustomerName = async (customerName) => {
  const rows = await safeQuery(
    'SELECT DISTINCT Branch FROM CUSTOMER WHERE Customer_Name = ? ORDER BY Branch ASC',
    [customerName]
  );
  return rows.map((row) => row.Branch).filter(Boolean);
};

const getAssetsForCustomerBranchCategory = async ({ customer, branch, category }) => {
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
  if (category) {
    where += ' AND cat.Category = ?';
    params.push(category);
  }

  const rows = await safeQuery(
    `SELECT DISTINCT
       a.Asset_ID,
       a.Asset_Serial_Number,
       a.Asset_Tag_ID,
       a.Item_Name,
       a.Status,
       c.Customer_ID,
       c.Customer_Name,
       c.Customer_Ref_Number,
       c.Branch,
       cat.Category,
       r.Recipient_Name,
       r.Department
     FROM INVENTORY i
     LEFT JOIN ASSET a ON a.Asset_ID = i.Asset_ID
     LEFT JOIN CUSTOMER c ON c.Customer_ID = i.Customer_ID
     LEFT JOIN RECIPIENTS r ON r.Recipients_ID = a.Recipients_ID
     LEFT JOIN CATEGORY cat ON cat.Category_ID = a.Category_ID
     ${where}
     ORDER BY a.Asset_ID DESC`,
    params
  );

  return rows;
};

router.post('/bulk-download', authenticateToken, async (req, res) => {
  try {
    const { pmIds = [], blankAssetIds = [], format = 'pdf', customerId = null, branchId = null, projectId = null, category = null, startDate = null, endDate = null } = req.body || {};

    let rows = [];

    // If no explicit pmIds provided, load PM records using filters (supporting 'all customers/assets' and future PMs)
    if (!Array.isArray(pmIds) || pmIds.length === 0) {
      // Build where clause similar to pm-reports
      const whereParts = ['1=1'];
      const params = [];
      if (customerId) { whereParts.push('c.Customer_ID = ?'); params.push(customerId); }
      if (branchId) { whereParts.push('c.Branch = ?'); params.push(branchId); }
      if (projectId) { whereParts.push('p.Project_ID = ?'); params.push(projectId); }
      if (category) { whereParts.push('cat.Category = ?'); params.push(category); }
      if (startDate) { whereParts.push('p.PM_Date >= ?'); params.push(startDate); }
      if (endDate) { whereParts.push('p.PM_Date <= ?'); params.push(endDate); }

      rows = await safeQuery(
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
         WHERE ${whereParts.join(' AND ')}
         ORDER BY p.PM_Date DESC, p.PM_ID DESC`,
        params
      );

    } else {
      // Load PM records for given IDs
      const placeholders = pmIds.map(() => '?').join(',');
      rows = await safeQuery(
        `SELECT PM_ID, file_path, file_path_acknowledgement, signature_path, Item_Name, Asset_Serial_Number, Customer_Name
         FROM PMAINTENANCE p
         LEFT JOIN ASSET a ON a.Asset_ID = p.Asset_ID
         LEFT JOIN INVENTORY i ON i.Asset_ID = p.Asset_ID
         LEFT JOIN CUSTOMER c ON c.Customer_ID = i.Customer_ID
         WHERE p.PM_ID IN (${placeholders})`,
        pmIds
      );
    }

    // If CSV requested, build and return CSV directly
    if ((format || '').toLowerCase() === 'csv') {
      const header = [
        'PM_ID',
        'Asset_ID',
        'Item_Name',
        'Asset_Serial_Number',
        'PM_Date',
        'PM_Status',
        'file_path',
        'file_path_acknowledgement',
        'signature_path',
        'Customer_Name'
      ];

      const escapeCsv = (v) => {
        if (v === null || v === undefined) return '""';
        const s = String(v);
        return '"' + s.replace(/"/g, '""') + '"';
      };

      const csvLines = [header.join(',')];
      for (const r of rows) {
        const vals = [
          r.PM_ID,
          r.Asset_ID,
          r.Item_Name,
          r.Asset_Serial_Number,
          r.PM_Date,
          r.Status,
          r.file_path,
          r.file_path_acknowledgement,
          r.signature_path,
          r.Customer_Name
        ].map(escapeCsv);
        csvLines.push(vals.join(','));
      }

      const csv = csvLines.join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="PM-Forms-${Date.now()}.csv"`);
      return res.status(200).send(csv);
    }

    // Collect actual filesystem paths for files to include
    const root = path.join(__dirname, '..'); // backend root
    const filesToInclude = [];

    for (const r of rows) {
      const candidates = [r.file_path, r.file_path_acknowledgement, r.signature_path];
      let added = false;
      for (const rel of candidates) {
        if (!rel) continue;
        // Accept both leading 'uploads/...' and absolute paths
        const abs = path.isAbsolute(rel) ? rel : path.join(root, rel.replace(/^\/+/, ''));
        try {
          if (fs.existsSync(abs)) {
            filesToInclude.push({ abs, name: path.basename(abs), meta: r });
            added = true;
            break; // include first available file for this PM
          }
        } catch (e) {
          // ignore
        }
      }

      if (!added) {
        // No existing file found; try to generate a PDF for this PM record
        try {
          const pmRecords = await getPmRecords({ pmId: r.PM_ID });
          const pmRecord = pmRecords && pmRecords[0] ? pmRecords[0] : r;
          const tmpDir = path.join(root, 'uploads');
          if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
          const generatedPath = path.join(tmpDir, `pm-${r.PM_ID}.pdf`);
          await generatePmPdf(pmRecord, generatedPath);
          if (fs.existsSync(generatedPath)) {
            filesToInclude.push({ abs: generatedPath, name: path.basename(generatedPath), meta: r });
            added = true;
          }
        } catch (genErr) {
          logger.warn(`Failed to generate PDF for PM ${r.PM_ID}:`, genErr.message || genErr);
        }
      }
    }

    // If only one file, stream it directly
    if (filesToInclude.length === 1) {
      const file = filesToInclude[0];
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
      const stream = fs.createReadStream(file.abs);
      return stream.pipe(res);
    }

    // If multiple files, create a temporary ZIP using PowerShell Compress-Archive (Windows)
    if (filesToInclude.length > 1) {
      const timestamp = Date.now();
      const tmpDir = path.join(root, 'uploads');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const zipPath = path.join(tmpDir, `pm-bulk-${timestamp}.zip`);

      // Build PowerShell command to compress files
      const fileList = filesToInclude.map(f => `"${f.abs.replace(/"/g, '"\""')}"`).join(',');
      const cmd = `powershell -NoProfile -Command "Compress-Archive -Path ${fileList} -DestinationPath \"${zipPath}\" -Force"`;

      try {
        execSync(cmd, { stdio: 'ignore' });
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="PM-Forms-${timestamp}.zip"`);
        const stream = fs.createReadStream(zipPath);
        stream.on('end', () => {
          // remove temp zip after served
          try { fs.unlinkSync(zipPath); } catch (e) { /* ignore */ }
        });
        return stream.pipe(res);
      } catch (error) {
        logger.error('Failed to create ZIP via Compress-Archive:', error);
        // fallback: return a generated summary PDF placeholder
      }
    }

    // Fallback: return a simple PDF placeholder listing PM IDs
    const text = `PM Bulk Download\nIncluded PM IDs: ${pmIds.join(', ')}\n\nGenerated at: ${new Date().toISOString()}`;
    const pdf = Buffer.from(`%PDF-1.1\n%âãÏÓ\n1 0 obj<< /Type /Catalog /Pages 2 0 R>>endobj\n2 0 obj<< /Type /Pages /Count 1 /Kids [3 0 R] >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n4 0 obj<< /Length ${text.length} >>stream\n${text}\nendstream endobj\n5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000110 00000 n \n0000000200 00000 n \n0000000300 00000 n \ntrailer<< /Root 1 0 R /Size 6 >>\nstartxref\n400\n%%EOF`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PM-Forms-Placeholder-${Date.now()}.pdf"`);
    return res.status(200).send(pdf);

  } catch (error) {
    logger.error('Bulk download failed:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate bulk download' });
  }
});
router.get('/assets', authenticateToken, async (req, res) => {
  try {
    const { customer, branch, category } = req.query;
    const assets = await getAssetsForCustomerBranchCategory({ customer, branch, category });
    return res.status(200).json(assets);
  } catch (error) {
    logger.error('Failed to load PM assets:', error);
    return res.status(200).json([]);
  }
});

router.get('/asset/:assetId', authenticateToken, async (req, res) => {
  try {
    const records = await getPmRecords({ assetId: req.params.assetId });
    return res.status(200).json(records);
  } catch (error) {
    logger.error('Failed to load PM asset records:', error);
    return res.status(200).json([]);
  }
});

router.get('/detail/:pmId', authenticateToken, async (req, res) => {
  try {
    const records = await getPmRecords({ pmId: req.params.pmId });
    if (!records[0]) {
      return res.status(404).json({ success: false, message: 'PM record not found' });
    }
    return res.status(200).json(records[0]);
  } catch (error) {
    logger.error('Failed to load PM detail:', error);
    return res.status(500).json({ success: false, message: 'Failed to load PM detail' });
  }
});

router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const rows = await safeQuery('SELECT DISTINCT Category FROM CATEGORY ORDER BY Category ASC');
    return res.status(200).json(rows.map((row) => row.Category).filter(Boolean));
  } catch (error) {
    logger.error('Failed to load PM categories:', error);
    return res.status(200).json([]);
  }
});

router.get('/checklist-by-name/:category', authenticateToken, async (req, res) => {
  try {
    const rows = await safeQuery(
      'SELECT Checklist_ID, Checklist_Name, Remarks FROM PM_CHECKLIST WHERE Category = ? OR Category IS NULL ORDER BY Checklist_ID ASC',
      [req.params.category]
    );
    return res.status(200).json(rows);
  } catch (error) {
    logger.warn('PM checklist query failed or table missing:', error.message || error);
    return res.status(200).json([]);
  }
});

router.get('/statistics', authenticateToken, async (req, res) => {
  try {
    const totalCustomers = (await safeQuery('SELECT COUNT(*) AS cnt FROM CUSTOMER'))[0]?.cnt || 0;
    const totalAssets = (await safeQuery('SELECT COUNT(*) AS cnt FROM ASSET'))[0]?.cnt || 0;
    const totalPm = (await safeQuery('SELECT COUNT(*) AS cnt FROM PMAINTENANCE'))[0]?.cnt || 0;
    const thisMonth = (await safeQuery(`
      SELECT COUNT(*) AS cnt
      FROM PMAINTENANCE
      WHERE YEAR(PM_Date) = YEAR(CURDATE())
        AND MONTH(PM_Date) = MONTH(CURDATE())
    `))[0]?.cnt || 0;
    const unsignedPMs = (await safeQuery(`
      SELECT COUNT(*) AS cnt
      FROM PMAINTENANCE
      WHERE LOWER(COALESCE(Status, '')) NOT IN ('completed', 'completed.', 'marked as completed')
    `))[0]?.cnt || 0;
    return res.status(200).json({
      success: true,
      data: {
        totalCustomers,
        totalAssets,
        totalPm,
        thisMonth,
        unsignedPMs
      }
    });
  } catch (error) {
    logger.error('Failed to load PM statistics:', error);
    return res.status(200).json({ success: true, data: { totalCustomers: 0, totalAssets: 0, totalPm: 0, thisMonth: 0, unsignedPMs: 0 } });
  }
});

router.get('/:pmId', authenticateToken, async (req, res) => {
  try {
    const records = await getPmRecords({ pmId: req.params.pmId });
    if (!records[0]) {
      return res.status(404).json({ success: false, message: 'PM record not found' });
    }
    return res.status(200).json(records[0]);
  } catch (error) {
    logger.error('Failed to load PM record:', error);
    return res.status(500).json({ success: false, message: 'Failed to load PM record' });
  }
});

router.put('/:pmId/mark-completed', authenticateToken, async (req, res) => {
  try {
    const result = await safeQuery('UPDATE PMAINTENANCE SET Status = ? WHERE PM_ID = ?', ['Completed', req.params.pmId]);
    return res.status(200).json({ success: true, affectedRows: result?.affectedRows || 0 });
  } catch (error) {
    logger.error('Failed to mark PM as completed:', error);
    return res.status(500).json({ success: false, message: 'Failed to mark PM as completed' });
  }
});



module.exports = router;
