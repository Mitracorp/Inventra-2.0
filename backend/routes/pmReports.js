const express = require('express');
const {
  generatePMReport,
  downloadPMReport,
  getPMReportStatistics
} = require('../controllers/pmReportController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Routes for PM Reports
router.post('/generate', authenticateToken, generatePMReport);
router.post('/download', authenticateToken, downloadPMReport);
router.get('/statistics', authenticateToken, getPMReportStatistics);

module.exports = router;
