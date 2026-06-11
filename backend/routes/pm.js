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

// Generate a report-style PM form PDF that mirrors the supplied template.
const generatePmPdf = async (pmRecord, outputPath) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 16,
        autoFirstPage: true,
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const contentWidth = right - left;
      let y = doc.page.margins.top;

      const safe = (value, fallback = '-') => {
        if (value === null || value === undefined || value === '') return fallback;
        return String(value);
      };

      const formatDate = (value) => {
        if (!value) return '-';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return safe(value);
        return parsed.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      };

      const repoRoot = path.join(__dirname, '..', '..');
      const leftLogoPath = path.join(repoRoot, 'frontend', 'public', 'logo.png');

      const box = (x, top, width, height, fill = '#ffffff', stroke = '#111111') => {
        doc.save();
        doc.rect(x, top, width, height).fillAndStroke(fill, stroke);
        doc.restore();
      };

      const line = (x1, y1, x2, y2, color = '#111111') => {
        doc.save();
        doc.strokeColor(color).moveTo(x1, y1).lineTo(x2, y2).stroke();
        doc.restore();
      };

      const sectionTitle = (title, rightLabel = '') => {
        const headerHeight = 14;
        box(left, y, contentWidth, headerHeight, '#efefef', '#111111');
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10)
          .text(title, left + 4, y + 3, { width: contentWidth - 8, align: 'left' });
        if (rightLabel) {
          doc.font('Helvetica-Bold').fontSize(9)
            .text(rightLabel, left, y + 3, { width: contentWidth - 4, align: 'right' });
        }
        y += headerHeight;
      };

      const cell = (x, top, width, height, label, value, labelWidth = Math.min(86, Math.floor(width * 0.38))) => {
        box(x, top, width, height, '#ffffff', '#111111');
        line(x + labelWidth, top, x + labelWidth, top + height);
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8.7)
          .text(`${label}:`, x + 4, top + 3, { width: labelWidth - 8, lineBreak: false });
        doc.font('Helvetica').fontSize(8.6)
          .text(safe(value), x + labelWidth + 4, top + 3, { width: width - labelWidth - 8, lineBreak: false });
      };

      const wrappedCell = (x, top, width, height, label, value, labelWidth = 92) => {
        box(x, top, width, height, '#ffffff', '#111111');
        line(x + labelWidth, top, x + labelWidth, top + height);
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8.7)
          .text(`${label}:`, x + 4, top + 3, { width: labelWidth - 8 });
        doc.font('Helvetica').fontSize(8.6)
          .text(safe(value), x + labelWidth + 4, top + 3, { width: width - labelWidth - 8 });
      };

      const drawLogoOrPlaceholder = () => {
        if (fs.existsSync(leftLogoPath)) {
          try {
            doc.image(leftLogoPath, left, y, { fit: [58, 34] });
          } catch (_) {
            doc.font('Helvetica-Bold').fontSize(18).text('M', left + 4, y + 4, { width: 42, align: 'center' });
          }
        } else {
          doc.font('Helvetica-Bold').fontSize(18).text('M', left + 4, y + 4, { width: 42, align: 'center' });
        }
      };

      const drawRightSeal = (x, top, width, height) => {
        box(x, top, width, height, '#ffffff', '#111111');
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(11)
          .text('IILIM', x, top + 4, { width, align: 'center' });
        doc.font('Helvetica').fontSize(5.8)
          .text('INSTITUT LATIHAN', x + 1, top + 15, { width: width - 2, align: 'center' })
          .text('ISLAM MALAYSIA', x + 1, top + 21, { width: width - 2, align: 'center' });
      };

      const tableText = (text, width) => doc.heightOfString(safe(text), { width, align: 'left' });

      const checklist = Array.isArray(pmRecord.checklist_results) ? pmRecord.checklist_results : [];
      const checklistRows = checklist.length > 0
        ? checklist
        : [{ Check_item_Long: 'No checklist items recorded', Is_OK_bool: false, Remarks: '-' }];

      const assetDisplay = safe(pmRecord.Item_Name || pmRecord.Asset_Serial_Number);
      const reportDate = formatDate(pmRecord.PM_Date);
      const generatedStamp = new Date().toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const technicianName = safe(pmRecord.Created_By, 'Inventra PM Automation Engine');
      const recipientName = safe(pmRecord.Recipient_Name);
      const positionName = safe(pmRecord.Position);
      const contractName = safe(pmRecord.Project_Title || pmRecord.Project_Ref_Number || pmRecord.Customer_Name);

      const pmNumber = `PM # ${safe(pmRecord.PM_ID)}`;

      // Top header area.
      drawLogoOrPlaceholder();
      drawRightSeal(right - 46, y, 40, 34);

      const headerX = left + 66;
      const headerW = contentWidth - 132;
      box(headerX, y + 2, headerW, 26, '#2b2b2b', '#111111');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12)
        .text('Preventive Maintenance Report', headerX, y + 4, { width: headerW - 42, align: 'center' });
      doc.font('Helvetica').fontSize(8.6)
        .text('- Asset Inspection & Maintenance Record -', headerX, y + 16, { width: headerW - 42, align: 'center' });
      box(headerX + headerW - 38, y + 4, 38, 18, '#3a3a3a', '#f5f5f5');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5)
        .text(pmNumber, headerX + headerW - 38, y + 8, { width: 38, align: 'center' });
      y += 38;

      // Keep declaration only at the bottom.
      sectionTitle('Document Details');
      cell(left, y, Math.floor(contentWidth / 2), 18, 'Document ID', safe(pmRecord.PM_ID ? `PM-${pmRecord.PM_ID}` : '-'));
      cell(left + Math.floor(contentWidth / 2), y, contentWidth - Math.floor(contentWidth / 2), 18, 'Verification Code', safe(pmRecord.Verification_Code || '-'));
      y += 18;
      cell(left, y, Math.floor(contentWidth / 2), 18, 'Generated Timestamp', generatedStamp);
      cell(left + Math.floor(contentWidth / 2), y, contentWidth - Math.floor(contentWidth / 2), 18, 'Generated By System', 'Inventra PM Automation Engine');
      y += 18;

      sectionTitle('Maintenance & Agency Details', `PM Date: ${reportDate}`);
      wrappedCell(left, y, contentWidth, 18, 'Recipient', recipientName);
      y += 18;
      wrappedCell(left, y, contentWidth, 18, 'Department', safe(pmRecord.Department));
      y += 18;
      wrappedCell(left, y, contentWidth, 18, 'Position', positionName);
      y += 18;
      wrappedCell(left, y, contentWidth, 18, 'Contract', contractName);
      y += 20;

      sectionTitle('Asset Information');
      const third = Math.floor(contentWidth / 3);
      const twoThird = contentWidth - third * 2;
      cell(left, y, third, 18, 'Serial Number', safe(pmRecord.Asset_Serial_Number));
      cell(left + third, y, third, 18, 'Asset Tag ID', safe(pmRecord.Asset_Tag_ID));
      cell(left + third * 2, y, twoThird, 18, 'Customer', safe(pmRecord.Customer_Name));
      y += 18;
      cell(left, y, third, 18, 'Item Name', assetDisplay);
      cell(left + third, y, third, 18, 'Category', safe(pmRecord.Category));
      cell(left + third * 2, y, twoThird, 18, 'Model', safe(pmRecord.Model));
      y += 18;
      wrappedCell(left, y, contentWidth, 18, 'Remarks', safe(pmRecord.Remarks));
      y += 18;
      wrappedCell(left, y, contentWidth, 18, 'Peripheral Assets', safe(pmRecord.Peripheral_Assets || pmRecord.peripheral_assets || 'Keyboard, Monitor, Mouse'));
      y += 18;
      wrappedCell(left, y, contentWidth, 18, 'Peripheral ID No.', safe(pmRecord.Peripheral_ID_No || pmRecord.peripheral_id_no || pmRecord.Peripheral_ID || '-'));
      y += 22;

      sectionTitle('Inspection Checklist');
      const columns = {
        no: 24,
        item: Math.floor(contentWidth * 0.54),
        yes: 30,
        noMark: 30,
        remarks: contentWidth - 24 - Math.floor(contentWidth * 0.54) - 30 - 30,
      };
      const tableX2 = left + columns.no;
      const tableX3 = tableX2 + columns.item;
      const tableX4 = tableX3 + columns.yes;
      const tableX5 = tableX4 + columns.noMark;

      box(left, y, contentWidth, 16, '#2c2c2c', '#111111');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.6)
        .text('No.', left, y + 4, { width: columns.no, align: 'center' })
        .text('Checklist Item', tableX2, y + 4, { width: columns.item, align: 'center' })
        .text('Yes', tableX3, y + 4, { width: columns.yes, align: 'center' })
        .text('No', tableX4, y + 4, { width: columns.noMark, align: 'center' })
        .text('Remarks', tableX5, y + 4, { width: columns.remarks, align: 'center' });
      doc.fillColor('#000000');
      y += 16;

      checklistRows.forEach((item, index) => {
        const checkText = safe(item.Check_item_Long || item.Checklist_ID);
        const remarksText = safe(item.Remarks, '-');
        const rowHeight = Math.max(
          17,
          tableText(checkText, columns.item - 6) + 6,
          tableText(remarksText, columns.remarks - 6) + 6
        );

        box(left, y, contentWidth, rowHeight, '#ffffff', '#111111');
        line(tableX2, y, tableX2, y + rowHeight);
        line(tableX3, y, tableX3, y + rowHeight);
        line(tableX4, y, tableX4, y + rowHeight);
        line(tableX5, y, tableX5, y + rowHeight);

        doc.font('Helvetica').fontSize(8.2)
          .text(String(index + 1), left + 1, y + 4, { width: columns.no - 2, align: 'center' })
          .text(checkText, tableX2 + 2, y + 3, { width: columns.item - 4, align: 'left' })
          .text(item.Is_OK_bool ? '✓' : '', tableX3, y + 4, { width: columns.yes, align: 'center' })
          .text(item.Is_OK_bool ? '' : '✓', tableX4, y + 4, { width: columns.noMark, align: 'center' })
          .text(remarksText, tableX5 + 2, y + 3, { width: columns.remarks - 4, align: 'left' });

        y += rowHeight;
      });

      y += 2;
      sectionTitle('Accessories');
      wrappedCell(left, y, contentWidth, 16, 'Keyboard', safe(pmRecord.Keyboard || 'CN-07W2PJ-PRC00-513-A0VP-A00'));
      y += 16;
      wrappedCell(left, y, contentWidth, 16, 'Monitor', safe(pmRecord.Monitor || '4R20N54'));
      y += 16;
      wrappedCell(left, y, contentWidth, 16, 'Mouse', safe(pmRecord.Mouse || 'CN-0DMV3P-CH400-518-010D-A01'));
      y += 16;
      wrappedCell(left, y, contentWidth, 18, 'Other Accessories', safe(pmRecord.Other_Accessories || '-'));
      y += 24;

      const bottomBoxHeight = 72;
      const half = Math.floor(contentWidth / 2);
      box(left, y, contentWidth, bottomBoxHeight, '#ffffff', '#111111');
      line(left + half, y, left + half, y + bottomBoxHeight);

      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9)
        .text('Technician Acknowledgment', left + 3, y + 2, { width: half - 6, align: 'left' })
        .text('Recipient Acknowledgment', left + half + 3, y + 2, { width: half - 6, align: 'left' });

      doc.font('Helvetica-Bold').fontSize(8.4)
        .text('Name:', left + 3, y + 17, { width: 34 })
        .text(safe(technicianName), left + 40, y + 17, { width: half - 45 })
        .text('Name:', left + half + 3, y + 17, { width: 34 })
        .text(recipientName, left + half + 40, y + 17, { width: half - 45 });

      doc.text('Signature:', left + 3, y + 28, { width: 50 });
      doc.text('Signature:', left + half + 3, y + 28, { width: 50 });

      // signature lines
      line(left + 54, y + 32, left + half - 8, y + 32);
      line(left + half + 54, y + 32, right - 8, y + 32);

      if (pmRecord.signature_path) {
        const sigPath = path.isAbsolute(pmRecord.signature_path)
          ? pmRecord.signature_path
          : path.join(repoRoot, pmRecord.signature_path.replace(/^\/+/, ''));
        if (fs.existsSync(sigPath)) {
          try {
            doc.image(sigPath, left + 58, y + 20, { fit: [72, 18] });
          } catch (imgErr) {
            logger.warn('Failed to embed signature image in PDF:', imgErr.message || imgErr);
          }
        }
      }

      doc.font('Helvetica-Bold').fontSize(8.4)
        .text('Date:', left + 3, y + 42, { width: 34 })
        .text(reportDate, left + 40, y + 42, { width: half - 45 })
        .text('Date:', left + half + 3, y + 42, { width: 34 })
        .text(reportDate, left + half + 40, y + 42, { width: half - 45 });

      doc.font('Helvetica-Bold').fontSize(8.4)
        .text('STAMP: MITRACORP RESOURCES SDN BHD', left + 3, y + 54, { width: half - 6 })
        .text('STAMP: INSTITUT LATIHAN ISLAM MALAYSIA (ILIM)', left + half + 3, y + 54, { width: half - 6 });

      y += bottomBoxHeight + 2;

      line(left, y, right, y, '#111111');
      doc.font('Helvetica-Bold').fontSize(8.4)
        .text('Inventra Asset Management System', left, y + 1, { width: contentWidth / 2, align: 'center' })
        .text(`Generated on: ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, left + contentWidth / 2, y + 1, { width: contentWidth / 2, align: 'center' });
      y += 12;

      doc.font('Helvetica-Bold').fontSize(9)
        .text('This is a computer-generated document and is valid without a handwritten signature.', left, y + 1, { width: contentWidth, align: 'center' });

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

const getPmRecords = async ({ customerId = null, branch = null, assetId = null, pmId = null, includeEmpty = false } = {}) => {
  const params = [];
  const whereParts = ['1=1'];

  if (customerId) {
    let custName = customerId;
    try {
      const [custRows] = await pool.execute('SELECT Customer_Name FROM CUSTOMER WHERE Customer_ID = ? LIMIT 1', [customerId]);
      if (custRows && custRows.length > 0) {
        custName = custRows[0].Customer_Name;
      }
    } catch (e) {}
    
    whereParts.push('(c.Customer_ID = ? OR c.Customer_Name = ?)');
    params.push(customerId, custName);
  }

  if (branch) {
    whereParts.push('c.Branch = ?');
    params.push(branch);
  }

  if (assetId) {
    whereParts.push(includeEmpty ? 'a.Asset_ID = ?' : 'p.Asset_ID = ?');
    params.push(assetId);
  }

  if (pmId) {
    whereParts.push('p.PM_ID = ?');
    params.push(pmId);
  }

  const baseTable = includeEmpty
    ? `INVENTORY i
       LEFT JOIN ASSET a ON a.Asset_ID = i.Asset_ID
       LEFT JOIN PMAINTENANCE p ON p.Asset_ID = a.Asset_ID`
    : `PMAINTENANCE p
       LEFT JOIN ASSET a ON a.Asset_ID = p.Asset_ID
       LEFT JOIN INVENTORY i ON i.Asset_ID = p.Asset_ID`;

  const records = await safeQuery(
    `SELECT DISTINCT
       p.PM_ID,
       ${includeEmpty ? 'a.Asset_ID' : 'p.Asset_ID'},
       p.PM_Date,
       p.Status,
       p.file_path,
       p.file_path_acknowledgement,
       p.signature_path,
       p.signed_at,
       p.Remarks,
       p.Created_By,
       p.Updated_By,
       r.Position,
       a.Asset_Serial_Number,
       a.Asset_Tag_ID,
       a.Item_Name,
       a.Model,
       a.Status AS Asset_Status,
       c.Customer_ID,
       c.Customer_Name,
       c.Customer_Ref_Number,
       c.Branch,
       prj.Project_Title,
       prj.Project_Ref_Number,
       r.Recipient_Name,
       r.Department,
       a.Category_ID,
       cat.Category
     FROM ${baseTable}
     LEFT JOIN CUSTOMER c ON c.Customer_ID = i.Customer_ID
     LEFT JOIN RECIPIENTS r ON r.Recipients_ID = a.Recipients_ID
     LEFT JOIN PROJECT prj ON prj.Project_ID = i.Project_ID
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

// --- PDF Report Serving Logic ---
const servePmReport = async (req, res) => {
  try {
    const rawId = req.params.pmId || req.params.id || req.query.pmId || req.query.id || req.body?.pmId || req.body?.id || req.body?.PM_ID || req.body?.pm_id || req.body?.assetId;
    const forceFlagRaw = req.query.forceRegenerate || req.query.regenerate || req.body?.forceRegenerate || req.body?.regenerate;
    const forceFlag = String(forceFlagRaw || '').toLowerCase();
    const forceRegenerate =
      ['1', 'true', 'yes', 'force', 'regenerate'].includes(forceFlag) ||
      /regenerate|force-regenerate/.test(String(req.path || '').toLowerCase());
    
    // Strip non-numeric characters in case the frontend passes something like "PM3215"
    const pmId = rawId ? rawId.toString().replace(/\D/g, '') : null;

    if (!pmId) {
      return res.status(400).json({ success: false, message: 'PM ID not provided' });
    }
    
    const records = await getPmRecords({ pmId });
    if (!records || records.length === 0) {
      return res.status(404).json({ success: false, message: 'PM record not found' });
    }
    
    const r = records[0];
    const root = path.join(__dirname, '..');
    
    // Check if a permanent file already exists
    let fileToDownload = null;
    if (r.file_path && !forceRegenerate) {
      const abs = path.isAbsolute(r.file_path) ? r.file_path : path.join(root, r.file_path.replace(/^\/+/, ''));
      try {
        if (fs.existsSync(abs)) fileToDownload = abs;
      } catch(e) {}
    }

    // Detect if the client explicitly wants a JSON response, even for a GET request.
    // This makes the backend resilient to frontend components that incorrectly use GET and expect JSON.
    const wantsJson = req.headers.accept && req.headers.accept.includes('application/json') && !req.headers.accept.includes('application/pdf');

    // If it's a POST request OR a GET request that incorrectly expects JSON,
    // we generate the file, save its path, and return a JSON response.
    if (req.method === 'POST' || wantsJson) {
      try {
        let finalRelativePath = r.file_path;
        // Only generate if it doesn't exist already
        if (!fileToDownload) {
          const permaDir = path.join(root, 'uploads', 'pm-reports');
          if (!fs.existsSync(permaDir)) fs.mkdirSync(permaDir, { recursive: true });
          const filename = `PM_Report_${r.PM_ID}_${Date.now()}.pdf`;
          const permaPath = path.join(permaDir, filename);
          
          await generatePmPdf(r, permaPath);
          finalRelativePath = `uploads/pm-reports/${filename}`;
          // Update the database with the new file path
          await pool.execute('UPDATE PMAINTENANCE SET file_path = ? WHERE PM_ID = ?', [finalRelativePath, r.PM_ID]);

          // Best-effort cleanup of old file when forcing regeneration
          if (forceRegenerate && r.file_path) {
            try {
              const oldAbs = path.isAbsolute(r.file_path) ? r.file_path : path.join(root, r.file_path.replace(/^\/+/, ''));
              if (fs.existsSync(oldAbs) && oldAbs !== permaPath) {
                fs.unlinkSync(oldAbs);
              }
            } catch (cleanupErr) {
              logger.warn('Failed to cleanup old PM report file:', cleanupErr.message || cleanupErr);
            }
          }
        } else {
          // If file already exists, use its path
          finalRelativePath = r.file_path;
        }
        
        return res.status(200).json({ 
          success: true, 
          message: 'Report is ready for download.', 
          url: `/api/v1/pm/${r.PM_ID}/download`, // Provide a consistent download URL
          file_path: finalRelativePath,
          regenerated: forceRegenerate
        });
      } catch (genErr) {
        logger.error('Failed to generate and save PDF for JSON response:', genErr);
        return res.status(500).json({ success: false, message: 'Failed to generate report' });
      }
    }
    
    // --- This part is for standard GET requests (e.g., browser opening a link) ---

    // If force regeneration is requested for direct GET downloads, rebuild and persist first.
    if (forceRegenerate) {
      try {
        const permaDir = path.join(root, 'uploads', 'pm-reports');
        if (!fs.existsSync(permaDir)) fs.mkdirSync(permaDir, { recursive: true });
        const filename = `PM_Report_${r.PM_ID}_${Date.now()}.pdf`;
        const permaPath = path.join(permaDir, filename);
        await generatePmPdf(r, permaPath);
        await pool.execute('UPDATE PMAINTENANCE SET file_path = ? WHERE PM_ID = ?', [`uploads/pm-reports/${filename}`, r.PM_ID]);

        if (r.file_path) {
          try {
            const oldAbs = path.isAbsolute(r.file_path) ? r.file_path : path.join(root, r.file_path.replace(/^\/+/, ''));
            if (fs.existsSync(oldAbs) && oldAbs !== permaPath) {
              fs.unlinkSync(oldAbs);
            }
          } catch (cleanupErr) {
            logger.warn('Failed to cleanup old PM report file:', cleanupErr.message || cleanupErr);
          }
        }

        fileToDownload = permaPath;
      } catch (regenErr) {
        logger.error('Failed to force regenerate PM report:', regenErr);
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
          return res.status(500).json({ success: false, message: 'Failed to force regenerate report' });
        }
      }
    }

    // If the file exists, stream it.
    if (fileToDownload) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="PM_Report_${r.PM_ID}.pdf"`);
      return fs.createReadStream(fileToDownload).pipe(res);
    }
    
    // If file doesn't exist, generate it on-the-fly for download.
    // This is a fallback for direct GET requests where the file hasn't been generated yet.
    const tmpDir = path.join(root, 'uploads', 'pm-reports-temp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tempPath = path.join(tmpDir, `pm-${r.PM_ID}-${Date.now()}.pdf`);
    
    await generatePmPdf(r, tempPath);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="pm-${r.PM_ID}.pdf"`);
    const stream = fs.createReadStream(tempPath);
    
    // Clean up the temp file after sending it
    stream.on('end', () => {
      try { fs.unlinkSync(tempPath); } catch (err) {}
    });

    return stream.pipe(res);
    
  } catch (error) {
    logger.error('Failed to serve PM report:', error);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(500).json({ success: false, message: 'Server error while preparing report.' });
    }
    return res.status(500).send('<h2>Server Error</h2><p>Failed to generate report.</p>');
  }
};

const reportEndpoints = [
  '/:pmId/report', '/report/:pmId', '/:pmId/download', '/download/:pmId',
  '/:pmId/pdf', '/pdf/:pmId', '/:pmId/view-form', '/view-form/:pmId',
  '/:pmId/generate-pdf', '/generate-pdf/:pmId', '/:pmId/generate', '/generate/:pmId',
  '/:pmId/generate-report', '/generate-report/:pmId', '/:pmId/generate-form', '/generate-form/:pmId',
  '/:pmId/regenerate', '/regenerate/:pmId', '/:pmId/force-regenerate', '/force-regenerate/:pmId',
  '/:pmId/report/regenerate', '/report/regenerate/:pmId',
  '/report', '/download', '/pdf', '/view-form', '/generate-pdf', '/generate', '/generate-report', '/generate-form'
];
reportEndpoints.forEach(ep => {
  router.get(ep, optionalAuth, servePmReport);
  router.post(ep, optionalAuth, servePmReport);
});

// Aggressive catch-alls using regex for any variation of report generation or downloading
[/.*generate.*/i, /.*report.*/i, /.*download.*/i].forEach(pattern => {
  router.post(pattern, optionalAuth, (req, res, next) => {
    if (req.url.includes('bulk-download') || req.url.includes('bulk-sign') || req.url.includes('statistics') || req.url.includes('checklist')) return next();
    return servePmReport(req, res);
  });
  router.get(pattern, optionalAuth, (req, res, next) => {
    if (req.url.includes('bulk-download') || req.url.includes('bulk-sign') || req.url.includes('statistics') || req.url.includes('checklist')) return next();
    return servePmReport(req, res);
  });
});

// Fallback for direct uploads path accessed via PM router (e.g., /uploads/pm-reports/...)
router.get('/uploads/*', optionalAuth, (req, res) => {
  const relPath = 'uploads/' + req.params[0];
  const absPath = path.join(__dirname, '..', relPath);
  if (fs.existsSync(absPath)) {
    res.setHeader('Content-Type', absPath.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(absPath)}"`);
    return fs.createReadStream(absPath).pipe(res);
  }
  return res.status(404).send('<h2>File not found</h2><p>The requested file does not exist locally.</p>');
});

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

    const custRows = await safeQuery('SELECT Customer_Name FROM CUSTOMER WHERE Customer_ID = ? LIMIT 1', [idOrName]);
    const customerName = custRows && custRows[0] ? custRows[0].Customer_Name : null;
    if (customerName) {
      branches = await getBranchesForCustomerName(customerName);
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
       a.Category_ID,
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

router.get('/filter', authenticateToken, async (req, res) => {
  try {
    const { customerId, branch } = req.query;
    const records = await getPmRecords({ customerId, branch, includeEmpty: true });
    return res.status(200).json(records);
  } catch (error) {
    logger.error('Failed to load filtered PM records:', error);
    return res.status(500).json({ success: false, message: 'Failed to load filtered PM records' });
  }
});

router.post('/bulk-download', authenticateToken, async (req, res) => {
  try {
    const { pmIds = [], blankAssetIds = [], format = 'pdf', customerId = null, branchId = null, projectId = null, category = null, startDate = null, endDate = null } = req.body || {};

    let rows = [];

    // If no explicit pmIds provided, load PM records using filters (supporting 'all customers/assets' and future PMs)
    if (!Array.isArray(pmIds) || pmIds.length === 0) {
      // Build where clause similar to pm-reports
      const whereParts = ['1=1'];
      const params = [];
      if (customerId) { 
        let custName = customerId;
        try {
          const [custRows] = await pool.execute('SELECT Customer_Name FROM CUSTOMER WHERE Customer_ID = ? LIMIT 1', [customerId]);
          if (custRows && custRows.length > 0) {
            custName = custRows[0].Customer_Name;
          }
        } catch (e) {}
        
        whereParts.push('(c.Customer_ID = ? OR c.Customer_Name = ?)'); 
        params.push(customerId, custName); 
      }
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
           a.Category_ID,
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
      const candidates = [r.file_path, r.file_path_acknowledgement];
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
            const generatedPath = path.join(tmpDir, `pm-${r.PM_ID}-${Date.now()}-${Math.floor(Math.random()*1000)}.pdf`);
          await generatePmPdf(pmRecord, generatedPath);
          if (fs.existsSync(generatedPath)) {
              filesToInclude.push({ abs: generatedPath, name: `pm-${r.PM_ID}.pdf`, meta: r, isTemp: true });
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
      stream.on('end', () => {
        if (file.isTemp) {
          try { fs.unlinkSync(file.abs); } catch(e) {}
        }
      });
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
          // remove temp generated PDFs
          for (const f of filesToInclude) {
            if (f.isTemp) {
              try { fs.unlinkSync(f.abs); } catch(e) {}
            }
          }
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
    const rows = await safeQuery('SELECT Category_ID, Category FROM CATEGORY ORDER BY Category ASC');
    return res.status(200).json(rows);
  } catch (error) {
    logger.error('Failed to load PM categories:', error);
    return res.status(200).json([]);
  }
});

router.get('/all-checklist/:categoryId', authenticateToken, async (req, res) => {
  try {
    let rows;
    try {
      [rows] = await pool.execute(
        'SELECT Checklist_ID, Category_ID, Check_item_Long, Display_Order FROM PM_CHECKLIST WHERE Category_ID = ? ORDER BY Display_Order ASC, Checklist_ID ASC',
        [req.params.categoryId]
      );
    } catch (e) {
      [rows] = await pool.execute(
        'SELECT Checklist_ID, Category_ID, Check_item_Long FROM PM_CHECKLIST WHERE Category_ID = ? ORDER BY Checklist_ID ASC',
        [req.params.categoryId]
      );
    }
    return res.status(200).json(rows);
  } catch (error) {
    logger.warn('PM checklist query failed:', error.message || error);
    return res.status(500).json({ error: 'Failed to fetch checklist items' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { assetId, pmDate, remarks, checklistResults, status } = req.body;

    const [pmResult] = await connection.execute(
      'INSERT INTO PMAINTENANCE (Asset_ID, PM_Date, Remarks, Status, Created_By) VALUES (?, ?, ?, ?, ?)',
      [assetId, pmDate, remarks, status, req.user?.id || req.user?.User_ID || null]
    );
    const pmId = pmResult.insertId;

    if (checklistResults && checklistResults.length > 0) {
      for (const result of checklistResults) {
        await connection.execute(
          'INSERT INTO PM_RESULT (PM_ID, Checklist_ID, Is_OK_bool, Remarks) VALUES (?, ?, ?, ?)',
          [pmId, result.Checklist_ID, result.Is_OK_bool, result.Remarks]
        );
      }
    }

    await connection.commit();
    return res.status(201).json({ success: true, pmId });
  } catch (error) {
    await connection.rollback();
    logger.error('Failed to create PM record:', error);
    return res.status(500).json({ error: 'Failed to create PM record' });
  } finally {
    connection.release();
  }
});

router.post('/checklist', authenticateToken, async (req, res) => {
  try {
    const { categoryId, checkItemLong } = req.body;
    let result;
    try {
      [result] = await pool.execute(
        'INSERT INTO PM_CHECKLIST (Category_ID, Check_item_Long, Display_Order) SELECT ?, ?, COALESCE(MAX(Display_Order), 0) + 1 FROM PM_CHECKLIST WHERE Category_ID = ?',
        [categoryId, checkItemLong, categoryId]
      );
    } catch (e) {
      [result] = await pool.execute(
        'INSERT INTO PM_CHECKLIST (Category_ID, Check_item_Long) VALUES (?, ?)',
        [categoryId, checkItemLong]
      );
    }
    return res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    logger.error('Failed to create checklist item:', error);
    return res.status(500).json({ error: 'Failed to create checklist item' });
  }
});

router.put('/checklist/:id', authenticateToken, async (req, res) => {
  try {
    const { checkItemLong } = req.body;
    await pool.execute(
      'UPDATE PM_CHECKLIST SET Check_item_Long = ? WHERE Checklist_ID = ?',
      [checkItemLong, req.params.id]
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Failed to update checklist item:', error);
    return res.status(500).json({ error: 'Failed to update checklist item' });
  }
});

router.delete('/checklist/:id', authenticateToken, async (req, res) => {
  try {
    const [usage] = await pool.execute('SELECT COUNT(*) as count FROM PM_RESULT WHERE Checklist_ID = ?', [req.params.id]);
    if (usage[0].count > 0) {
      return res.status(409).json({ error: 'Cannot delete: This checklist item is used in existing PM records' });
    }
    await pool.execute('DELETE FROM PM_CHECKLIST WHERE Checklist_ID = ?', [req.params.id]);
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Failed to delete checklist item:', error);
    return res.status(500).json({ error: 'Failed to delete checklist item' });
  }
});

router.put('/checklist-order', authenticateToken, async (req, res) => {
  try {
    const { orderUpdates } = req.body;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const update of orderUpdates) {
        await connection.execute(
          'UPDATE PM_CHECKLIST SET Display_Order = ? WHERE Checklist_ID = ?',
          [update.Display_Order, update.Checklist_ID]
        );
      }
      await connection.commit();
      return res.status(200).json({ success: true });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error('Failed to update checklist order:', error);
    return res.status(500).json({ error: 'Failed to update checklist order' });
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

router.post('/bulk-sign', authenticateToken, async (req, res) => {
  try {
    const { pmIds, signature, bagiPihak } = req.body;
    if (!pmIds || !Array.isArray(pmIds) || pmIds.length === 0) return res.status(400).json({ success: false, error: 'No PM IDs provided' });
    if (!signature) return res.status(400).json({ success: false, error: 'Signature is required' });
    const matches = signature.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return res.status(400).json({ success: false, error: 'Invalid signature format' });
    const type = matches[1];
    const data = Buffer.from(matches[2], 'base64');
    const ext = type.split('/')[1] || 'png';
    const filename = `signature_bulk_${Date.now()}.${ext}`;
    const uploadDir = path.join(__dirname, '..', 'uploads', 'signatures');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, data);
    const relativePath = `uploads/signatures/${filename}`;
    const placeholders = pmIds.map(() => '?').join(',');
    let updateQuery = 'UPDATE PMAINTENANCE SET signature_path = ?, signed_at = NOW(), Status = ?';
    let params = [relativePath, 'Completed'];
    if (bagiPihak) {
      updateQuery += ', Remarks = CONCAT(COALESCE(Remarks, ""), ?)';
      params.push(`\nSigned on behalf: ${bagiPihak}`);
    }
    updateQuery += ` WHERE PM_ID IN (${placeholders})`;
    params.push(...pmIds);
    const [result] = await pool.execute(updateQuery, params);
    return res.status(200).json({ success: true, message: 'Bulk sign completed', affectedRows: result.affectedRows });
  } catch (error) {
    logger.error('Failed to bulk sign PMs:', error);
    return res.status(500).json({ success: false, error: 'Failed to bulk sign PMs' });
  }
});

router.post('/:pmId/signature', authenticateToken, async (req, res) => {
  try {
    const { signature, bagiPihak } = req.body;
    const pmId = req.params.pmId;

    if (!signature) {
      return res.status(400).json({ success: false, error: 'Signature is required' });
    }

    const matches = signature.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, error: 'Invalid signature format' });
    }

    const type = matches[1];
    const data = Buffer.from(matches[2], 'base64');
    const ext = type.split('/')[1] || 'png';
    const filename = `signature_pm_${pmId}_${Date.now()}.${ext}`;
    
    const uploadDir = path.join(__dirname, '..', 'uploads', 'signatures');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, data);

    const relativePath = `uploads/signatures/${filename}`;

    let updateQuery = 'UPDATE PMAINTENANCE SET signature_path = ?, signed_at = NOW(), Status = ?';
    let params = [relativePath, 'Completed'];
    
    if (bagiPihak) {
      updateQuery += ', Remarks = CONCAT(COALESCE(Remarks, ""), ?)';
      params.push(`\nSigned on behalf: ${bagiPihak}`);
    }
    
    updateQuery += ' WHERE PM_ID = ?';
    params.push(pmId);

    const [result] = await pool.execute(updateQuery, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'PM record not found' });
    }

    return res.status(200).json({ success: true, message: 'Signature saved successfully', signature_path: relativePath });
  } catch (error) {
    logger.error('Failed to save signature:', error);
    return res.status(500).json({ success: false, error: 'Failed to save signature' });
  }
});

router.servePmReport = servePmReport;
module.exports = router;
