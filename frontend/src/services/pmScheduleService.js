import { API_URL } from '../config/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

const pmScheduleService = {
  // Get custom schedules for a project
  getProjectSchedules: async (projectId, year = null) => {
    try {
      const url = year 
        ? `${API_URL}/pm-schedule/projects/${projectId}/schedules?year=${year}`
        : `${API_URL}/pm-schedule/projects/${projectId}/schedules`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch schedules');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching project schedules:', error);
      throw error;
    }
  },

  // Create a new schedule
  createSchedule: async (projectId, scheduledDate, notes = '') => {
    try {
      const response = await fetch(`${API_URL}/pm-schedule/projects/${projectId}/schedules`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          scheduledDate,
          notes
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create schedule');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error creating schedule:', error);
      throw error;
    }
  },

  // Create or update a schedule
  upsertSchedule: async (projectId, scheduledDate, notes = '') => {
    try {
      const response = await fetch(`${API_URL}/pm-schedule/schedules`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          projectId,
          scheduledDate,
          notes
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save schedule');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error upserting schedule:', error);
      throw error;
    }
  },

  // Delete a schedule
  deleteSchedule: async (scheduleId) => {
    try {
      const response = await fetch(`${API_URL}/pm-schedule/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete schedule');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      throw error;
    }
  },

  // Auto-reschedule with new settings
  autoReschedule: async (projectId, startDate, frequency) => {
    try {
      const response = await fetch(`${API_URL}/pm-schedule/projects/${projectId}/reschedule`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          projectId,
          startDate,
          frequency
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reschedule');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error auto-rescheduling:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      throw error;
    }
  },

  // Reset to calculated schedule
  resetToCalculated: async (projectId) => {
    try {
      const response = await fetch(`${API_URL}/pm-schedule/projects/${projectId}/schedules`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reset schedule');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error resetting schedule:', error);
      throw error;
    }
  }
};

export default pmScheduleService;
