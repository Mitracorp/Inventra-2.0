const PMSchedule = require('../models/PMSchedule');
const { formatResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

// Get custom schedules for a project
const getProjectSchedules = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { year } = req.query;
    
    const schedules = await PMSchedule.getCustomSchedules(projectId, year);
    res.status(200).json(formatResponse(true, schedules, 'Schedules retrieved successfully'));
  } catch (error) {
    logger.error('Error in getProjectSchedules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch schedules',
      message: error.message
    });
  }
};

// Create a new schedule
const createSchedule = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { scheduledDate, notes } = req.body;
    
    if (!scheduledDate) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled date is required'
      });
    }
    
    const result = await PMSchedule.createSchedule(projectId, scheduledDate, notes);
    res.status(201).json(formatResponse(true, { id: result }, 'Schedule created successfully'));
  } catch (error) {
    logger.error('Error in createSchedule:', error);
    
    // Handle duplicate entry error
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: 'A schedule already exists for this date',
        message: 'This project already has a schedule for the selected date'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create schedule',
      message: error.message
    });
  }
};

// Create or update a schedule
const upsertSchedule = async (req, res) => {
  try {
    const { projectId, scheduledDate, notes } = req.body;
    
    if (!projectId || !scheduledDate) {
      return res.status(400).json({
        success: false,
        error: 'Project ID and scheduled date are required'
      });
    }
    
    const result = await PMSchedule.upsertSchedule(projectId, scheduledDate, notes);
    res.status(200).json(formatResponse(true, { id: result }, 'Schedule saved successfully'));
  } catch (error) {
    logger.error('Error in upsertSchedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save schedule',
      message: error.message
    });
  }
};

// Delete a schedule
const deleteSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    
    const result = await PMSchedule.deleteSchedule(scheduleId);
    
    if (result === 0) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found'
      });
    }
    
    res.status(200).json(formatResponse(true, null, 'Schedule deleted successfully'));
  } catch (error) {
    logger.error('Error in deleteSchedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete schedule',
      message: error.message
    });
  }
};

// Auto-reschedule - generate new dates based on project settings
const autoReschedule = async (req, res) => {
  try {
    const { projectId, startDate, frequency } = req.body;
    
    if (!projectId || !startDate || !frequency) {
      return res.status(400).json({
        success: false,
        error: 'Project ID, start date, and frequency are required'
      });
    }
    
    // Get project details to find end date
    const { pool } = require('../config/database');
    const [projects] = await pool.execute(
      'SELECT Project_ID, Start_Date, End_Date FROM PROJECT WHERE Project_ID = ?',
      [projectId]
    );
    
    if (projects.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    const project = projects[0];
    const start = new Date(startDate);
    const projectEnd = project.End_Date ? new Date(project.End_Date) : null;
    const monthInterval = Math.floor(12 / frequency);
    
    // Calculate new PM dates from start date until project end (or 10 years if no end date)
    const dates = [];
    let pmIndex = 0; // Start from 0 so first PM is on the start date
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 10); // Maximum 10 years ahead
    
    while (true) {
      const pmDate = new Date(start);
      pmDate.setMonth(start.getMonth() + (pmIndex * monthInterval));
      
      // Stop if we've gone past the project end date
      if (projectEnd && pmDate > projectEnd) {
        break;
      }
      
      // Stop if we've gone too far into the future (safety limit)
      if (pmDate > maxDate) {
        break;
      }
      
      dates.push(pmDate.toISOString().split('T')[0]);
      pmIndex++;
    }
    
    const result = await PMSchedule.bulkCreateSchedules(projectId, dates);
    res.status(200).json(formatResponse(true, { count: result, dates }, 'Project rescheduled successfully'));
  } catch (error) {
    logger.error('Error in autoReschedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reschedule project',
      message: error.message
    });
  }
};

// Reset to calculated schedule (delete all custom schedules)
const resetToCalculated = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const result = await PMSchedule.deleteAllProjectSchedules(projectId);
    res.status(200).json(formatResponse(true, { deletedCount: result }, 'Schedule reset to calculated dates'));
  } catch (error) {
    logger.error('Error in resetToCalculated:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset schedule',
      message: error.message
    });
  }
};

module.exports = {
  getProjectSchedules,
  createSchedule,
  upsertSchedule,
  deleteSchedule,
  autoReschedule,
  resetToCalculated
};
