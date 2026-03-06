const express = require('express');
const router = express.Router();
const pmScheduleController = require('../controllers/pmScheduleController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get custom schedules for a project
router.get('/projects/:projectId/schedules', pmScheduleController.getProjectSchedules);

// Create a new schedule
router.post('/projects/:projectId/schedules', pmScheduleController.createSchedule);

// Create or update a schedule
router.post('/schedules', pmScheduleController.upsertSchedule);

// Delete a schedule
router.delete('/schedules/:scheduleId', pmScheduleController.deleteSchedule);

// Auto-reschedule with new settings
router.post('/projects/:projectId/reschedule', pmScheduleController.autoReschedule);

// Reset to calculated schedule
router.delete('/projects/:projectId/schedules', pmScheduleController.resetToCalculated);

module.exports = router;
