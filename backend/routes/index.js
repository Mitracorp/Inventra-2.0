const express = require('express');
const router = express.Router();

// Import route modules
const assetRoutes = require('./assets');
const projectRoutes = require('./projects');
const inventoryRoutes = require('./inventory');
const categoryRoutes = require('./categories');
const modelRoutes = require('./models');
const peripheralRoutes = require('./peripherals');
const pmRoutes = require('./pm');
const pmScheduleRoutes = require('./pmSchedule');
const authRoutes = require('./auth');
const registerRoutes = require('./register');
const profileRoutes = require('./profile');
const optionsRoutes = require('./options');
const historyLogRoutes = require('./historyLog');
const recipientRoutes = require('./recipients');
const solutionPrincipalRoutes = require('./solutionPrincipal');
const activityRoutes = require('./activity');
const pmReportRoutes = require('./pmReports');
// Maintenance routes moved to lazy load to avoid circular dependency
// const maintenanceRoutes = require('./maintenance');

// Mount routes
router.use('/assets', assetRoutes);
router.use('/projects', projectRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/categories', categoryRoutes);
router.use('/models', modelRoutes);
router.use('/peripherals', peripheralRoutes);
router.use('/pm', pmRoutes);
router.use('/pm-schedule', pmScheduleRoutes);
router.use('/auth', authRoutes);
router.use('/register', registerRoutes);
router.use('/profile', profileRoutes);
router.use('/options', optionsRoutes);
router.use('/history-logs', historyLogRoutes);
router.use('/recipients', recipientRoutes);
router.use('/solution-principals', solutionPrincipalRoutes);
router.use('/activity', activityRoutes);
router.use('/pm-reports', pmReportRoutes);
// Maintenance route will be mounted after database initialization
// router.use('/maintenance', maintenanceRoutes);

module.exports = router;
