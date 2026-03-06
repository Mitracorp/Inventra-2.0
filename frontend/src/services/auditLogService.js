import { API_URL } from '../config/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

/**
 * Get audit logs with pagination and filters
 */
export const getAuditLogs = async (params = {}) => {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', params.page);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.tableName) queryParams.append('tableName', params.tableName);
  if (params.actionType) queryParams.append('actionType', params.actionType);
  if (params.userId) queryParams.append('userId', params.userId);
  if (params.startDate) queryParams.append('startDate', params.startDate);
  if (params.endDate) queryParams.append('endDate', params.endDate);
  if (params.searchTerm) queryParams.append('searchTerm', params.searchTerm);
  
  const response = await fetch(`${API_URL}/history-logs?${queryParams.toString()}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session has expired. Please reload the page and log in again.');
    }
    throw new Error('Failed to fetch audit logs');
  }
  
  const data = await response.json();
  return data.data;
};

/**
 * Get filter options (users, tables, action types)
 */
export const getFilterOptions = async () => {
  const response = await fetch(`${API_URL}/history-logs/filter-options`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session has expired. Please reload the page and log in again.');
    }
    throw new Error('Failed to fetch filter options');
  }
  
  const data = await response.json();
  return data.data;
};

/**
 * Get audit summary statistics
 */
export const getAuditSummary = async (filters = {}) => {
  const queryParams = new URLSearchParams();
  if (filters.startDate) queryParams.append('startDate', filters.startDate);
  if (filters.endDate) queryParams.append('endDate', filters.endDate);
  if (filters.tableName) queryParams.append('tableName', filters.tableName);
  if (filters.actionType) queryParams.append('actionType', filters.actionType);
  if (filters.userId) queryParams.append('userId', filters.userId);
  if (filters.searchTerm) queryParams.append('searchTerm', filters.searchTerm);
  
  const response = await fetch(`${API_URL}/history-logs/report/summary?${queryParams.toString()}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session has expired. Please reload the page and log in again.');
    }
    throw new Error('Failed to fetch audit summary');
  }
  
  const data = await response.json();
  return data.data;
};

/**
 * Get audit logs grouped by table
 */
export const getAuditByTable = async (startDate = null, endDate = null) => {
  const queryParams = new URLSearchParams();
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  
  const response = await fetch(`${API_URL}/history-logs/report/by-table?${queryParams.toString()}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session has expired. Please reload the page and log in again.');
    }
    throw new Error('Failed to fetch audit by table');
  }
  
  const data = await response.json();
  return data.data;
};

/**
 * Get audit logs grouped by user
 */
export const getAuditByUser = async (startDate = null, endDate = null) => {
  const queryParams = new URLSearchParams();
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  
  const response = await fetch(`${API_URL}/history-logs/report/by-user?${queryParams.toString()}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session has expired. Please reload the page and log in again.');
    }
    throw new Error('Failed to fetch audit by user');
  }
  
  const data = await response.json();
  return data.data;
};

/**
 * Get audit logs grouped by sessions
 */
export const getAuditSessions = async (startDate = null, endDate = null) => {
  const queryParams = new URLSearchParams();
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  
  const response = await fetch(`${API_URL}/history-logs/sessions?${queryParams.toString()}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session has expired. Please reload the page and log in again.');
    }
    throw new Error('Failed to fetch audit sessions');
  }
  
  const data = await response.json();
  return data.data;
};

/**
 * Get audit logs grouped by action type
 */
export const getAuditByAction = async (startDate = null, endDate = null) => {
  const queryParams = new URLSearchParams();
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  
  const response = await fetch(`${API_URL}/history-logs/report/by-action?${queryParams.toString()}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session has expired. Please reload the page and log in again.');
    }
    throw new Error('Failed to fetch audit by action');
  }
  
  const data = await response.json();
  return data.data;
};

/**
 * Export audit logs as CSV
 */
export const exportAuditLogs = async (params = {}) => {
  const queryParams = new URLSearchParams();
  
  if (params.tableName) queryParams.append('tableName', params.tableName);
  if (params.actionType) queryParams.append('actionType', params.actionType);
  if (params.userId) queryParams.append('userId', params.userId);
  if (params.startDate) queryParams.append('startDate', params.startDate);
  if (params.endDate) queryParams.append('endDate', params.endDate);
  if (params.searchTerm) queryParams.append('searchTerm', params.searchTerm);
  
  const token = localStorage.getItem('authToken');
  const response = await fetch(`${API_URL}/history-logs/export?${queryParams.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your session has expired. Please reload the page and log in again.');
    }
    throw new Error('Failed to export audit logs');
  }
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};
