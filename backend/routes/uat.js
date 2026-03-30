const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');
const uatPdfGenerator = require('../utils/uatPdfGenerator');
const User = require('../models/User');

const router = express.Router();

const sanitizePdfName = (value) => {
  const base = String(value || '')
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .replace(/\.+/g, '.')
    .trim();

  const withoutPath = base.split('/').pop().split('\\').pop();
  if (!withoutPath) return 'UAT_Report.pdf';
  return withoutPath.toLowerCase().endsWith('.pdf') ? withoutPath : `${withoutPath}.pdf`;
};

const verifyAccessForReport = (req) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (bearerToken) {
    jwt.verify(bearerToken, process.env.JWT_SECRET);
    return true;
  }

  const viewToken = String(req.query.vt || '');
  if (!viewToken) return false;

  const decoded = jwt.verify(viewToken, process.env.JWT_SECRET);
  if (decoded?.type !== 'uat-report-view') return false;
  if (String(decoded?.fileName || '') !== String(req.params.fileName || '')) return false;
  return true;
};

router.get('/history-summary', authenticateToken, async (req, res) => {
  try {
    const data = await uatPdfGenerator.getHistorySummary({
      customerName: req.query.customerName,
      branch: req.query.branch,
      assetType: req.query.assetType
    });

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to load UAT history summary',
      message: error.message
    });
  }
});

router.get('/report-link/:fileName', authenticateToken, async (req, res) => {
  try {
    const token = jwt.sign(
      {
        type: 'uat-report-view',
        fileName: req.params.fileName,
        userId: req.user?.userId
      },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    return res.json({
      success: true,
      token
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to create report view token',
      message: error.message
    });
  }
});

router.get('/report/:fileName', async (req, res) => {
  try {
    const isAuthorized = verifyAccessForReport(req);
    if (!isAuthorized) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized to access UAT report file'
      });
    }

    const filePath = uatPdfGenerator.getStoredReportPath(req.params.fileName);

    if (!filePath) {
      return res.status(404).json({
        success: false,
        error: 'UAT report file not found'
      });
    }

    const preferredName = sanitizePdfName(req.query.downloadName || req.params.fileName);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${preferredName}"`);
    return res.sendFile(filePath);
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized to access UAT report file'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to load UAT report file',
      message: error.message
    });
  }
});

router.get('/verify/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const record = await uatPdfGenerator.verifyDocument(documentId);

    if (!record) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: 'Document ID not found'
      });
    }

    return res.json({
      success: true,
      valid: true,
      message: 'Document verified successfully',
      data: record
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      valid: false,
      error: 'Failed to verify document',
      message: error.message
    });
  }
});

router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const payload = req.body || {};

    if (!payload.signature || !String(payload.signature).startsWith('data:image/png;base64,')) {
      return res.status(400).json({
        success: false,
        error: 'Recipient signature is required'
      });
    }

    if (!payload.asset || !payload.asset.Asset_ID) {
      return res.status(400).json({
        success: false,
        error: 'Asset selection is required'
      });
    }

    if (!Array.isArray(payload.checklistSections) || payload.checklistSections.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Checklist data is required'
      });
    }

    const currentUser = await User.findById(req.user?.userId);
    const staffFullName = [currentUser?.firstName, currentUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    const generated = await uatPdfGenerator.generate({
      ...payload,
      submittedBy: staffFullName || currentUser?.username || req.user?.username || req.user?.Username || payload.submittedBy || 'System User',
      submittedByDepartment: currentUser?.department || '',
      submittedBySignPath: currentUser?.signPath || ''
    });

    res.download(generated.absolutePath, generated.filename, async (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to stream UAT PDF',
          message: err.message
        });
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate UAT PDF',
      message: error.message
    });
  }
});

module.exports = router;
