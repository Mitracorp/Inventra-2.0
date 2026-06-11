const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Basic root route for API
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Inventra API root' });
});

// Attempt to mount other route modules if they exist
try {
  const fs = require('fs');
  const path = require('path');
  const files = fs.readdirSync(__dirname);
  files.forEach((file) => {
    if (file === 'index.js') return;
    const modPath = path.join(__dirname, file);
    try {
      const mod = require(modPath);
      // Mount the module by filename (without extension). Many route files
      // export an express Router (callable) or an object — just attempt to mount
      const name = path.basename(file, path.extname(file));
      router.use(`/${name}`, mod);
    } catch (e) {
      logger.warn(`Failed to load route module ${file}: ${e.message}`);
    }
  });

      // Add aliases for PM report generation to catch any frontend variations
      try {
        const pmMod = require('./pm');
        router.use('/pm-report', pmMod);
        router.use('/report', pmMod);
        router.use('/generate', pmMod);
      } catch (aliasErr) {}
} catch (e) {
  logger.error(`Failed to initialize route modules: ${e.message}`);
}

    // Ultimate Catch-All for PM Report Generation
    // Catches ANY missing endpoints related to report/pdf generation and forces them to the PM controller
    router.all('*', (req, res, next) => {
      const url = (req.originalUrl || req.url).toLowerCase();
      
      if ((url.includes('generate') || url.includes('report') || url.includes('pdf') || url.includes('download') || url.includes('form')) && 
          !url.includes('bulk') && 
          !url.includes('history-log') && 
          !url.includes('statistics') &&
          !url.includes('/pm-reports/generate')) {
          
        const numbers = req.path.match(/\d+/g);
        const possibleId = numbers ? numbers[numbers.length - 1] : '';
        const pmId = req.query.pmId || req.body?.pmId || req.body?.id || req.body?.PM_ID || possibleId;
        
        if (pmId) {
          try {
            const pmMod = require('./pm');
            if (pmMod.servePmReport) {
              req.params.pmId = pmId;
              return pmMod.servePmReport(req, res);
            }
          } catch(e) {}
        }
      }
      next();
    });

module.exports = router;
