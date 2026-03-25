import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, RefreshCw } from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';
import ConfirmationModal from '../components/ConfirmationModal';
import './AuditLog.css';
import toast from '../utils/toast';
import {
  getAuditLogs,
  getFilterOptions,
  getAuditSummary,
  getAuditByTable,
  getAuditByUser,
  getAuditByAction,
  getAuditSessions,
  exportAuditLogs
} from '../services/auditLogService';
import { API_URL } from '../config/api';

const AuditLog = () => {
  usePageTitle('Audit Log');
  
  const [activeTab, setActiveTab] = useState('logs');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Audit logs data
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    recordsPerPage: 25
  });

  // Filter options
  const [filterOptions, setFilterOptions] = useState({
    users: [],
    tables: [],
    actionTypes: []
  });

  // Filter values
  const [filters, setFilters] = useState({
    tableName: '',
    actionType: '',
    userId: '',
    startDate: '',
    endDate: '',
    searchTerm: ''
  });

  // Summary data
  const [summary, setSummary] = useState(null);
  const [byTable, setByTable] = useState([]);
  const [byUser, setByUser] = useState([]);
  const [byAction, setByAction] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [revertConfirm, setRevertConfirm] = useState({
    isOpen: false,
    label: '',
    recordId: null,
    endpoint: ''
  });
  const [reverting, setReverting] = useState(false);

  const fetchFilterOptions = async () => {
    try {
      const data = await getFilterOptions();
      setFilterOptions(data);
    } catch (err) {
      console.error('Error fetching filter options:', err);
      toast.error(err.message || 'Failed to fetch filter options');
      setError(err.message || 'Failed to fetch filter options');
    }
  };

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: pagination.currentPage,
        limit: pagination.recordsPerPage,
        ...filters
      };

      const data = await getAuditLogs(params);
      setLogs(data.logs || []);
      setPagination(prev => ({
        ...prev,
        ...data.pagination
      }));
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      const errorMessage = err.message || 'Failed to load audit logs';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, pagination.recordsPerPage, filters]);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await getAuditSummary(filters);
      setSummary(data);
    } catch (err) {
      console.error('Error fetching summary:', err);
      toast.error(err.message || 'Failed to fetch summary');
    }
  }, [filters]);

  const fetchByTable = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAuditByTable(filters.startDate, filters.endDate);
      setByTable(data);
    } catch (err) {
      console.error('Error fetching by table:', err);
      const errorMessage = err.message || 'Failed to load table report';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, filters.endDate]);

  const fetchByUser = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAuditByUser(filters.startDate, filters.endDate);
      setByUser(data);
    } catch (err) {
      console.error('Error fetching by user:', err);
      const errorMessage = err.message || 'Failed to load user report';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, filters.endDate]);

  const fetchByAction = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAuditByAction(filters.startDate, filters.endDate);
      setByAction(data);
    } catch (err) {
      console.error('Error fetching by action:', err);
      const errorMessage = err.message || 'Failed to load action report';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, filters.endDate]);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAuditSessions(filters.startDate, filters.endDate);
      setSessions(data);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      const errorMessage = err.message || 'Failed to load sessions';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, filters.endDate]);

  // Fetch filter options on mount
  useEffect(() => {
    fetchFilterOptions();
    // Initial summary will be fetched by the filters useEffect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch logs when filters or pagination change
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab, fetchLogs]);

  // Fetch summary whenever filters change (handles both initial and filter updates)
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchSummary();
    }
  }, [activeTab, fetchSummary]);

  // Fetch report data when tab changes
  useEffect(() => {
    if (activeTab === 'byTable') {
      fetchByTable();
    } else if (activeTab === 'byUser') {
      fetchByUser();
    } else if (activeTab === 'byAction') {
      fetchByAction();
    } else if (activeTab === 'sessions') {
      fetchSessions();
    }
  }, [activeTab, fetchByTable, fetchByUser, fetchByAction, fetchSessions]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleApplyFilters = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    // fetchSummary will be called automatically by useEffect when filters change
  };

  const handleResetFilters = () => {
    setFilters({
      tableName: '',
      actionType: '',
      userId: '',
      startDate: '',
      endDate: '',
      searchTerm: ''
    });
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handleExport = async () => {
    try {
      await exportAuditLogs(filters);
    } catch (err) {
      console.error('Error exporting logs:', err);
      toast.error('Failed to export audit logs');
    }
  };

  const handleRefresh = () => {
    fetchFilterOptions();
    fetchSummary();
    if (activeTab === 'logs') {
      fetchLogs();
    } else if (activeTab === 'byTable') {
      fetchByTable();
    } else if (activeTab === 'byUser') {
      fetchByUser();
    } else if (activeTab === 'byAction') {
      fetchByAction();
    } else if (activeTab === 'sessions') {
      fetchSessions();
    }
  };

  const handleViewSessionLogs = async (session) => {
    // MySQL stores timestamps in local timezone (+8 from UTC)
    // Session times from DB are in UTC, but MySQL compares in local time
    const sessionStart = new Date(session.Session_Start);
    const sessionEnd = new Date(session.Session_End);
    
    // Convert UTC to local time (+8 hours) to match MySQL storage
    const localOffset = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
    sessionStart.setTime(sessionStart.getTime() + localOffset);
    sessionEnd.setTime(sessionEnd.getTime() + localOffset);
    
    // Set to start of hour and end of hour
    sessionStart.setMinutes(0, 0, 0);
    sessionEnd.setMinutes(59, 59, 999);
    
    // Format as ISO string without timezone indicator (MySQL expects this)
    const startDateStr = sessionStart.toISOString().slice(0, 19);
    const endDateStr = sessionEnd.toISOString().slice(0, 19);
    
    // Set filters to show only logs from this session
    const newFilters = {
      tableName: session.Table_Name,
      actionType: '',
      userId: session.User_ID.toString(),
      startDate: startDateStr,
      endDate: endDateStr,
      searchTerm: ''
    };
    
    // Update all states
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, currentPage: 1, recordsPerPage: 25 }));
    setActiveTab('logs');
    
    // Fetch logs directly with new filters
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: 1,
        limit: 25,
        ...newFilters
      };

      const data = await getAuditLogs(params);
      
      setLogs(data.logs || []);
      setPagination(prev => ({
        ...prev,
        ...data.pagination
      }));
      
      // Summary will be fetched automatically by useEffect when filters change
    } catch (err) {
      console.error('Error fetching session logs:', err);
      setError('Failed to load session logs');
    } finally {
      setLoading(false);
    }
  };

  // --- FUNGSI BARU UNTUK REVERT SOFT DELETE ---
  const handleRevert = (recordId, tableName) => {
    const revertConfigByTable = {
      PROJECT: {
        label: 'Project',
        endpoint: `${API_URL}/projects/revert/${recordId}`
      },
      ASSET: {
        label: 'Asset',
        endpoint: `${API_URL}/assets/revert/${recordId}`
      },
      PM: {
        label: 'PM record',
        endpoint: `${API_URL}/pm/revert/${recordId}`
      },
      PMAINTENANCE: {
        label: 'PM record',
        endpoint: `${API_URL}/pm/revert/${recordId}`
      },
      SOLUTION_PRINCIPAL: {
        label: 'Solution Principal',
        endpoint: `${API_URL}/solution-principals/revert/${recordId}`
      }
    };

    const config = revertConfigByTable[tableName];
    if (!config) {
      toast.error(`Revert is not supported for ${tableName}.`);
      return;
    }

    setRevertConfirm({
      isOpen: true,
      label: config.label,
      recordId,
      endpoint: config.endpoint
    });
  };

  const handleConfirmRevert = async () => {
    if (!revertConfirm.recordId || !revertConfirm.endpoint) {
      return;
    }

    try {
      setReverting(true);
      const token = localStorage.getItem('authToken');

      const response = await fetch(revertConfirm.endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to revert action');
      }

      toast.success(data.message || `${revertConfirm.label} successfully restored!`);
      setRevertConfirm({ isOpen: false, label: '', recordId: null, endpoint: '' });
      
      // Refresh jadual lepas berjaya revert
      handleRefresh(); 
    } catch (err) {
      console.error('Error reverting record:', err);
      toast.error(err.message);
    } finally {
      setReverting(false);
    }
  };
  // ---------------------------------------------

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionBadgeClass = (actionType) => {
    return `action-badge ${actionType.toLowerCase()}`;
  };

  const canShowUndoButton = (log) => {
    const supportedTables = ['PROJECT', 'ASSET', 'PM', 'PMAINTENANCE', 'SOLUTION_PRINCIPAL'];
    if (!supportedTables.includes(log.Table_Name)) return false;

    // Standard explicit DELETE log.
    if (log.Action_Type === 'DELETE') return true;

    // Fallback for soft-delete entries that are logged as UPDATE (common with DB triggers).
    if (log.Table_Name !== 'PM' && log.Table_Name !== 'PMAINTENANCE') return false;
    if (log.Action_Type !== 'UPDATE') return false;

    return Array.isArray(log.Changes) && log.Changes.some((change) => {
      const field = (change.fieldName || '').toLowerCase();
      const oldVal = `${change.oldValue ?? ''}`.trim();
      const newVal = `${change.newValue ?? ''}`.trim();
      return field === 'deleted_at' && oldVal === '' && newVal !== '';
    });
  };

  return (
    <div className="audit-log-container">
      {/* Normalized Header - matching Assets page style */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '20px',
        marginBottom: '30px',
        paddingBottom: '15px',
        borderBottom: '3px solid #667eea',
        padding: '0 20px 15px 20px',
        flexWrap: 'wrap',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 auto', minWidth: '250px', maxWidth: '100%' }}>
          <FileText size={28} color="#667eea" style={{ flexShrink: 0 }} />
          <div style={{ overflow: 'hidden' }}>
            <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.4rem' }}>
              Audit Log
            </h2>
            <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
              Track and monitor all system activities and changes
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flex: '0 0 auto', justifyContent: 'flex-end' }}>
          <button
            onClick={handleExport}
            disabled={loading}
            style={{
              background: 'white',
              color: '#667eea',
              border: 'none',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '600',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
              transition: 'all 0.3s ease',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.25)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
            }}
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            style={{
              background: 'white',
              color: '#667eea',
              border: 'none',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '600',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
              transition: 'all 0.3s ease',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.25)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="audit-summary-cards">
          <div className="summary-card">
            <h3>Total Logs</h3>
            <div className="value">{summary.totalLogs || 0}</div>
          </div>
          <div className="summary-card create">
            <h3>Creates</h3>
            <div className="value">{summary.createCount || 0}</div>
          </div>
          <div className="summary-card update">
            <h3>Updates</h3>
            <div className="value">{summary.updateCount || 0}</div>
          </div>
          <div className="summary-card delete">
            <h3>Deletes</h3>
            <div className="value">{summary.deleteCount || 0}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="audit-tabs">
        <button
          className={`audit-tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          All Logs
        </button>
        <button
          className={`audit-tab ${activeTab === 'byTable' ? 'active' : ''}`}
          onClick={() => setActiveTab('byTable')}
        >
          By Table
        </button>
        <button
          className={`audit-tab ${activeTab === 'byUser' ? 'active' : ''}`}
          onClick={() => setActiveTab('byUser')}
        >
          By User
        </button>
        <button
          className={`audit-tab ${activeTab === 'byAction' ? 'active' : ''}`}
          onClick={() => setActiveTab('byAction')}
        >
          By Action
        </button>
        <button
          className={`audit-tab ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          Sessions
        </button>
      </div>

      {/* Filters */}
      <div className="audit-filters">
        <div className="filters-row">
          <div className="filter-group">
            <label>Table</label>
            <select
              value={filters.tableName}
              onChange={(e) => handleFilterChange('tableName', e.target.value)}
            >
              <option value="">All Tables</option>
              {filterOptions.tables.map((table) => (
                <option key={table} value={table}>{table}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Action Type</label>
            <select
              value={filters.actionType}
              onChange={(e) => handleFilterChange('actionType', e.target.value)}
            >
              <option value="">All Actions</option>
              {filterOptions.actionTypes.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>User</label>
            <select
              value={filters.userId}
              onChange={(e) => handleFilterChange('userId', e.target.value)}
            >
              <option value="">All Users</option>
              {filterOptions.users.map((user) => (
                <option key={user.User_ID} value={user.User_ID}>
                  {user.Username} ({user.Full_Name})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="datetime-local"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>End Date</label>
            <input
              type="datetime-local"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search description or user..."
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
            />
          </div>
        </div>

        <div className="filter-actions">
          <button className="reset-btn" onClick={handleResetFilters}>
            <RefreshCw size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Reset
          </button>
          <button className="apply-btn" onClick={handleApplyFilters}>
            Apply Filters
          </button>
          <button className="export-btn" onClick={handleExport}>
            <Download size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="audit-table-container">
        {loading && <div className="loading-state">Loading...</div>}
        {error && <div className="error-state">{error}</div>}

        {!loading && !error && activeTab === 'logs' && (
          <>
            {logs.length === 0 ? (
              <div className="empty-state">No audit logs found</div>
            ) : (
              <>
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Table</th>
                      <th>Record ID</th>
                      <th>Action</th>
                      <th>Description</th>
                      <th>Changes</th>
                      <th>Revert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.Log_ID}>
                        <td>{formatTimestamp(log.Timestamp)}</td>
                        <td>
                          {log.Username}
                          {log.User_Full_Name && (
                            <div style={{ fontSize: '12px', color: '#666' }}>
                              {log.User_Full_Name}
                            </div>
                          )}
                        </td>
                        <td>{log.Table_Name}</td>
                        <td>{log.Record_ID}</td>
                        <td>
                          <span className={getActionBadgeClass(log.Action_Type)}>
                            {log.Action_Type}
                          </span>
                        </td>
                        <td>{log.Action_Desc}</td>
                        <td>
                          {log.Changes && log.Changes.length > 0 ? (
                            <div>
                              {log.Changes.length} field{log.Changes.length !== 1 ? 's' : ''} changed
                              <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                                {log.Changes.map((change, idx) => (
                                  <div key={idx}>
                                    <strong>{change.fieldName}:</strong>{' '}
                                    <span className="old-value">{change.oldValue || '(empty)'}</span>
                                    {' → '}
                                    <span className="new-value">{change.newValue || '(empty)'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>
                          {/* --- INI YANG KITA UBAH --- */}
                          {canShowUndoButton(log) && (
                            <button 
                              onClick={() => handleRevert(log.Record_ID, log.Table_Name)}
                              style={{
                                background: '#10b981', 
                                color: 'white', 
                                border: 'none', 
                                padding: '6px 12px', 
                                borderRadius: '4px', 
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
                            >
                              <RefreshCw size={12} /> Undo
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="pagination-container">
                  <div className="pagination-info">
                    Showing {logs.length === 0 ? 0 : ((pagination.currentPage - 1) * pagination.recordsPerPage) + 1} to{' '}
                    {Math.min(pagination.currentPage * pagination.recordsPerPage, pagination.totalRecords)}{' '}
                    of {pagination.totalRecords} logs
                  </div>
                  <div className="pagination-controls">
                    <button
                      className="pagination-btn"
                      onClick={() => setPagination(prev => ({ ...prev, currentPage: 1 }))}
                      disabled={pagination.currentPage === 1}
                      title="First page"
                    >
                      ««
                    </button>
                    <button
                      className="pagination-btn"
                      onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                      disabled={!pagination.hasPrevPage}
                    >
                      Previous
                    </button>
                    <div className="page-number-input">
                      <span>Page</span>
                      <input
                        type="number"
                        min="1"
                        max={pagination.totalPages}
                        value={pagination.currentPage}
                        onChange={(e) => {
                          const page = parseInt(e.target.value);
                          if (page >= 1 && page <= pagination.totalPages) {
                            setPagination(prev => ({ ...prev, currentPage: page }));
                          }
                        }}
                      />
                      <span>of {pagination.totalPages}</span>
                    </div>
                    <button
                      className="pagination-btn"
                      onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                      disabled={!pagination.hasNextPage}
                    >
                      Next
                    </button>
                    <button
                      className="pagination-btn"
                      onClick={() => setPagination(prev => ({ ...prev, currentPage: pagination.totalPages }))}
                      disabled={pagination.currentPage === pagination.totalPages}
                      title="Last page"
                    >
                      »»
                    </button>
                  </div>
                  <div className="pagination-size">
                    <label>Show:</label>
                    <select
                      value={pagination.recordsPerPage}
                      onChange={(e) => setPagination(prev => ({ ...prev, recordsPerPage: parseInt(e.target.value), currentPage: 1 }))}
                    >
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                    <span>per page</span>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {!loading && !error && activeTab === 'byTable' && (
          <>
            {byTable.length === 0 ? (
              <div className="empty-state">No data available</div>
            ) : (
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Table Name</th>
                    <th>Total Logs</th>
                    <th>Creates</th>
                    <th>Updates</th>
                    <th>Deletes</th>
                    <th>Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {byTable.map((row, idx) => (
                    <tr key={idx}>
                      <td><strong>{row.Table_Name}</strong></td>
                      <td>{row.totalLogs}</td>
                      <td>{row.createCount}</td>
                      <td>{row.updateCount}</td>
                      <td>{row.deleteCount}</td>
                      <td>{formatTimestamp(row.lastActivity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {!loading && !error && activeTab === 'byUser' && (
          <>
            {byUser.length === 0 ? (
              <div className="empty-state">No data available</div>
            ) : (
              <table className="report-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Total Logs</th>
                    <th>Creates</th>
                    <th>Updates</th>
                    <th>Deletes</th>
                    <th>Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {byUser.map((row, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{row.Username}</strong>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {row.User_Full_Name}
                        </div>
                      </td>
                      <td>{row.Role}</td>
                      <td>{row.totalLogs}</td>
                      <td>{row.createCount}</td>
                      <td>{row.updateCount}</td>
                      <td>{row.deleteCount}</td>
                      <td>{formatTimestamp(row.lastActivity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {!loading && !error && activeTab === 'byAction' && (
          <>
            {byAction.length === 0 ? (
              <div className="empty-state">No data available</div>
            ) : (
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Action Type</th>
                    <th>Table</th>
                    <th>Count</th>
                    <th>Last Occurrence</th>
                  </tr>
                </thead>
                <tbody>
                  {byAction.map((row, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className={getActionBadgeClass(row.Action_Type)}>
                          {row.Action_Type}
                        </span>
                      </td>
                      <td>{row.Table_Name}</td>
                      <td>{row.count}</td>
                      <td>{formatTimestamp(row.lastOccurrence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {!loading && !error && activeTab === 'sessions' && (
          <>
            {sessions.length === 0 ? (
              <div className="empty-state">No sessions found</div>
            ) : (
              <table className="report-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Table</th>
                    <th>Session Start</th>
                    <th>Session End</th>
                    <th>Duration</th>
                    <th>Total Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session, idx) => (
                    <tr 
                      key={idx}
                      onClick={() => handleViewSessionLogs(session)}
                      style={{ cursor: 'pointer' }}
                      title="Click to view logs from this session"
                      className="clickable-row"
                    >
                      <td>
                        <strong>{session.Username}</strong>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {session.User_Full_Name}
                        </div>
                      </td>
                      <td><strong>{session.Table_Name}</strong></td>
                      <td>{formatTimestamp(session.Session_Start)}</td>
                      <td>{formatTimestamp(session.Session_End)}</td>
                      <td>
                        {Math.round((new Date(session.Session_End) - new Date(session.Session_Start)) / 60000)} min
                      </td>
                      <td>{session.Total_Actions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      <ConfirmationModal
        isOpen={revertConfirm.isOpen}
        onClose={() => {
          if (!reverting) {
            setRevertConfirm({ isOpen: false, label: '', recordId: null, endpoint: '' });
          }
        }}
        onConfirm={handleConfirmRevert}
        title={`Restore ${revertConfirm.label}`}
        message={`Are you sure you want to restore ${revertConfirm.label} ID: ${revertConfirm.recordId}?`}
        confirmText="Restore"
        cancelText="Cancel"
        type="success"
        loading={reverting}
      />
    </div>
  );
};

export default AuditLog;
