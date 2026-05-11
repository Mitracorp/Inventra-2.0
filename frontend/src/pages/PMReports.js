import React, { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  ArrowLeft,
  Loader
} from 'lucide-react';
import { API_URL } from '../config/api';
import apiService from '../services/apiService';
import toast from '../utils/toast';
import './PMReports.css';

const apiBaseUrl = (API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL);

const getAuthHeaders = () => {
  const token = apiService.getToken ? apiService.getToken() : localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || errorData?.error || `Request failed with status ${response.status}`);
  }

  return response;
};

const PMReports = () => {
  usePageTitle('PM Reports');
  const navigate = useNavigate();

  // State for filters
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedContract, setSelectedContract] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const reportType = 'detailed';
  const [bulkDownloadPmScope, setBulkDownloadPmScope] = useState('pm1');
  const [bulkDownloadSignatureScope, setBulkDownloadSignatureScope] = useState('signedOnly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const dateRange = 'contractToDate';

  // State for data
  const [customers, setCustomers] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Fetch customers and contracts on load
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [customersResponse, projectsResponse] = await Promise.all([
          fetchJson(`${apiBaseUrl}/pm/customers`),
          apiService.getAllProjects(1, 1000)
        ]);

        const customersData = await customersResponse.json();
        const projectsData = projectsResponse?.data || [];

        setCustomers(Array.isArray(customersData) ? customersData : []);
        setContracts(Array.isArray(projectsData) ? projectsData : []);
        // fetch categories for report filter
        try {
          const catResp = await fetchJson(`${apiBaseUrl}/pm/categories`);
          const catData = await catResp.json();
          setCategories(Array.isArray(catData) ? catData : []);
        } catch (err) {
          console.warn('Failed to load categories', err);
        }
      } catch (error) {
        console.error('Error fetching customers and contracts:', error);
        toast.error('Failed to load customers');
      }
    };

    loadFilters();
  }, []);

  const getFilteredContracts = () => {
    if (!selectedCustomer) {
      return contracts;
    }

    return contracts.filter((contract) => {
      const customerId = String(contract.Customer_ID || contract.customer_id || '');
      const customerName = String(contract.Customer_Name || contract.customer_name || '');
      return customerId === String(selectedCustomer) || customerName === String(selectedCustomer);
    });
  };

  const handleCustomerChange = (e) => {
    const customerId = e.target.value;
    setSelectedCustomer(customerId);
    setSelectedContract('');
  };

  const handleBulkDownloadForms = async () => {
    try {
      setGenerating(true);
      const filters = {
        reportType,
        customerId: selectedCustomer || null,
        projectId: selectedContract || null,
        category: selectedCategory || null,
        startDate: startDate || null,
        endDate: endDate || null,
        dateRange,
        completedOnly: bulkDownloadSignatureScope === 'signedOnly'
      };

      const idsResponse = await fetchJson(`${apiBaseUrl}/pm-reports/generate`, {
        method: 'POST',
        body: JSON.stringify(filters)
      });

      const idsPayload = await idsResponse.json();
      setReportData(idsPayload);
      setMetrics(idsPayload.metrics);
      const allPmRecords = Array.isArray(idsPayload?.allPmRecords) ? idsPayload.allPmRecords : [];

      const normalizeStatus = (status) => String(status || '').trim().toLowerCase();
      const isSigned = (record) => normalizeStatus(record.Status) === 'completed' && !!record.signature_path;
      const isUnsigned = (record) => {
        const status = normalizeStatus(record.Status);
        return !!record.file_path_acknowledgement || status === 'marked as completed' || (status === 'completed' && !record.signature_path);
      };

      const pmIds = allPmRecords
        .filter((record) => {
          const sequence = Number(record.PM_Sequence) || 1;

          if (bulkDownloadPmScope === 'pm1' && sequence !== 1) return false;
          if (bulkDownloadPmScope === 'pm2plus' && sequence < 2) return false;

          if (bulkDownloadSignatureScope === 'signedOnly') return isSigned(record);
          if (bulkDownloadSignatureScope === 'unsignedOnly') return isUnsigned(record);
          return isSigned(record) || isUnsigned(record);
        })
        .map((record) => record.PM_ID);

      if (pmIds.length === 0) {
        const scopeLabel = bulkDownloadPmScope === 'pm1'
          ? 'PM1'
          : bulkDownloadPmScope === 'pm2plus'
            ? 'PM2 and above'
            : 'PM forms';
        const signatureLabel = bulkDownloadSignatureScope === 'signedOnly'
          ? 'signed'
          : bulkDownloadSignatureScope === 'unsignedOnly'
            ? 'unsigned'
            : 'downloadable';
        const scopeMessage = `No ${signatureLabel} ${scopeLabel} available for the selected filters.`;
        toast.info(scopeMessage);
        return;
      }

      const response = await fetch(`${apiBaseUrl}/pm/bulk-download`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ pmIds, blankAssetIds: [] })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const pmLabel = bulkDownloadPmScope === 'pm1' ? 'PM1' : bulkDownloadPmScope === 'pm2plus' ? 'PM2 and above' : 'PM forms';
        const signatureLabel = bulkDownloadSignatureScope === 'signedOnly'
          ? 'signed'
          : bulkDownloadSignatureScope === 'unsignedOnly'
            ? 'unsigned'
            : 'downloadable';
        throw new Error(errorData?.message || errorData?.error || `Failed to bulk download ${signatureLabel} ${pmLabel}`);
      }

      const contentDisposition = response.headers.get('content-disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const contentType = response.headers.get('content-type') || '';
      const defaultExt = contentType.includes('zip') ? 'zip' : 'pdf';
      const fileName = filenameMatch?.[1] || `PM-Forms-Bulk-${Date.now()}.${defaultExt}`;

      const url = window.URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      const pmLabel = bulkDownloadPmScope === 'pm1' ? 'PM1' : bulkDownloadPmScope === 'pm2plus' ? 'PM2 and above' : 'PM forms';
      const signatureLabel = bulkDownloadSignatureScope === 'signedOnly'
        ? 'signed'
        : bulkDownloadSignatureScope === 'unsignedOnly'
          ? 'unsigned'
          : 'downloadable';
      toast.success(`Downloaded ${pmIds.length} ${signatureLabel} ${pmLabel}`);
    } catch (error) {
      console.error('Error bulk downloading PM forms:', error);
      toast.error(error.message || 'Failed to bulk download PM forms');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="pm-reports-container">
      {/* Header */}
      <div className="pm-reports-header">
        <div className="header-top">
          <button
            className="back-button"
            onClick={() => navigate('/maintenance')}
            title="Back to Preventive Maintenance"
          >
            <ArrowLeft size={20} />
            <span>Back</span>
          </button>
          <h1>PM Reports</h1>
          <p className="subtitle">Generate and manage PM reports for monitoring and compliance</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="pm-reports-content">
        {/* Left Panel - Filters */}
        <div className="reports-filters-panel">
          <h2>Report Filters</h2>

          {/* Customer Filter */}
          <div className="filter-group">
            <label>Customer (Optional)</label>
            <select
              value={selectedCustomer}
              onChange={handleCustomerChange}
              className="filter-select"
            >
              <option value="">All Customers</option>
              {customers.map((customer) => (
                <option key={customer.Customer_ID} value={customer.Customer_ID}>
                  {customer.Customer_Name}
                </option>
              ))}
            </select>
          </div>

          {/* Contract/Project Filter */}
          {selectedCustomer && getFilteredContracts().length > 0 && (
            <div className="filter-group">
              <label>Contract/Project (Optional)</label>
              <select
                value={selectedContract}
                onChange={(e) => setSelectedContract(e.target.value)}
                className="filter-select"
              >
                <option value="">All Contracts</option>
                {getFilteredContracts().map((contract) => (
                  <option key={contract.Project_ID} value={contract.Project_ID}>
                    {contract.Project_Ref_Number} - {contract.Project_Title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category Filter */}
          <div className="filter-group">
            <label>Category (Optional)</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="filter-select"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.Category_ID || c.Category} value={c.Category || c.Category}>
                  {c.Category || c.Category}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Bulk Download PM Scope</label>
            <select
              value={bulkDownloadPmScope}
              onChange={(e) => setBulkDownloadPmScope(e.target.value)}
              className="filter-select"
            >
              <option value="pm1">PM1 only</option>
              <option value="pm2plus">PM2 and above</option>
              <option value="all">All PMs</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Bulk Download Signature Scope</label>
            <select
              value={bulkDownloadSignatureScope}
              onChange={(e) => setBulkDownloadSignatureScope(e.target.value)}
              className="filter-select"
            >
              <option value="signedOnly">Signed only</option>
              <option value="unsignedOnly">Unsigned only</option>
              <option value="all">Signed and unsigned</option>
            </select>
          </div>

          {/* Custom Date Range */}
          {dateRange === 'range' && (
            <>
              <div className="filter-group">
                <label>Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="filter-input"
                />
              </div>
              <div className="filter-group">
                <label>End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="filter-input"
                />
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="filter-actions">
            <button
              className="btn btn-secondary btn-download"
              onClick={handleBulkDownloadForms}
              disabled={generating}
              style={{
                background: '#d5f5d5',
                color: '#1f7a46',
                border: '1px solid #93d3a2',
                fontWeight: 700
              }}
            >
              {generating ? <Loader size={18} className="spin" /> : <Download size={18} />}
              {generating ? 'Downloading...' : 'Download'}
            </button>
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="reports-results-panel">
          {!reportData ? (
            <div className="empty-state">
              <FileText size={48} />
              <h3>Ready to Download</h3>
              <p>Select the filters and download scope on the left, then click Download.</p>
            </div>
          ) : (
            <>
              {/* Report Type: Management Summary */}
              {reportType === 'summary' && (
                <div className="report-view">
                  <h2>Management Summary</h2>
                  <div className="metrics-grid">
                    <MetricCard
                      icon={<CheckCircle size={24} />}
                      title="Completed PMs"
                      value={metrics?.completed || 0}
                      color="#10b981"
                    />
                    <MetricCard
                      icon={<AlertTriangle size={24} />}
                      title="Unsigned PMs"
                      value={metrics?.unsigned || 0}
                      color="#f59e0b"
                    />
                    <MetricCard
                      icon={<Clock size={24} />}
                      title="Incomplete PMs"
                      value={metrics?.incomplete || 0}
                      color="#ef4444"
                    />
                    <MetricCard
                      icon={<TrendingUp size={24} />}
                      title="Completion Rate"
                      value={
                        metrics?.total > 0
                          ? `${Math.round(
                              (metrics?.completed / metrics?.total) * 100
                            )}%`
                          : '0%'
                      }
                      color="#667eea"
                    />
                  </div>

                  {/* Summary Details */}
                  <div className="summary-section">
                    <h3>Overview</h3>
                    <div className="summary-table">
                      <div className="summary-row">
                        <span>Total PM Records:</span>
                        <strong>{metrics?.total || 0}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Period:</span>
                        <strong>
                          {reportData.period || `${startDate || 'N/A'} to ${endDate || 'N/A'}`}
                        </strong>
                      </div>
                      {selectedCustomer && (
                        <div className="summary-row">
                          <span>Customer:</span>
                          <strong>{reportData.customerName || 'N/A'}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Report Type: Completion Metrics */}
              {reportType === 'metrics' && (
                <div className="report-view">
                  <h2>PM Completion Metrics</h2>
                  <div className="metrics-breakdown">
                    <div className="metric-item">
                      <div className="metric-header">
                        <CheckCircle size={20} color="#10b981" />
                        <span>Successfully Completed</span>
                      </div>
                      <div className="metric-details">
                        <div className="metric-number">{metrics?.completed || 0}</div>
                        <div className="metric-percentage">
                          {metrics?.total > 0
                            ? `${Math.round((metrics?.completed / metrics?.total) * 100)}%`
                            : '0%'}
                        </div>
                      </div>
                    </div>

                    <div className="metric-item">
                      <div className="metric-header">
                        <AlertTriangle size={20} color="#f59e0b" />
                        <span>Unsigned (Pending Signature)</span>
                      </div>
                      <div className="metric-details">
                        <div className="metric-number">{metrics?.unsigned || 0}</div>
                        <div className="metric-percentage">
                          {metrics?.total > 0
                            ? `${Math.round((metrics?.unsigned / metrics?.total) * 100)}%`
                            : '0%'}
                        </div>
                      </div>
                    </div>

                    <div className="metric-item">
                      <div className="metric-header">
                        <Clock size={20} color="#ef4444" />
                        <span>Incomplete/In Progress</span>
                      </div>
                      <div className="metric-details">
                        <div className="metric-number">{metrics?.incomplete || 0}</div>
                        <div className="metric-percentage">
                          {metrics?.total > 0
                            ? `${Math.round((metrics?.incomplete / metrics?.total) * 100)}%`
                            : '0%'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Report Type: Detailed */}
              {reportType === 'detailed' && (
                <div className="report-view">
                  <h2>Detailed PM Records</h2>
                  <div className="detailed-records">
                    {reportData.records && reportData.records.length > 0 ? (
                      <div className="records-table">
                        <table>
                          <thead>
                            <tr>
                              <th>PM ID</th>
                              <th>Asset</th>
                              <th>Date</th>
                              <th>Status</th>
                              <th>Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.records.map((record) => (
                              <tr key={record.PM_ID}>
                                <td>{record.PM_ID}</td>
                                <td>{record.Item_Name}</td>
                                <td>{new Date(record.PM_Date).toLocaleDateString()}</td>
                                <td>
                                  <span
                                    className={`status-badge status-${record.Status?.toLowerCase()}`}
                                  >
                                    {record.Status}
                                  </span>
                                </td>
                                <td>{record.Remarks || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="no-records">No PM records found for selected filters</p>
                    )}
                  </div>
                </div>
              )}

              {/* Report Type: Customer-Specific */}
              {reportType === 'customer' && (
                <div className="report-view">
                  <h2>Customer-Specific PM Report</h2>
                  {selectedCustomer ? (
                    <div className="customer-report">
                      <div className="customer-info">
                        <h3>{reportData.customerName || 'Customer Name'}</h3>
                        <p>Period: {reportData.period || 'N/A'}</p>
                      </div>
                      <div className="customer-metrics">
                        <div className="metric-box">
                          <span className="label">Total Assets Under Contract</span>
                          <span className="value">{metrics?.totalAssets || 0}</span>
                        </div>
                        <div className="metric-box">
                          <span className="label">PM Records</span>
                          <span className="value">{metrics?.total || 0}</span>
                        </div>
                        <div className="metric-box">
                          <span className="label">Completion Status</span>
                          <span className="value">
                            {metrics?.total > 0
                              ? `${Math.round((metrics?.completed / metrics?.total) * 100)}%`
                              : '0%'}
                          </span>
                        </div>
                      </div>
                      {reportData.records && (
                        <div className="records-section">
                          <h4>Recent PM Activities</h4>
                          {reportData.records.length > 0 ? (
                            <ul className="activity-list">
                              {reportData.records.slice(0, 10).map((record) => (
                                <li key={record.PM_ID}>
                                  <div className="activity-item">
                                    <span className="asset-name">{record.Item_Name}</span>
                                    <span className="pm-date">
                                      {new Date(record.PM_Date).toLocaleDateString()}
                                    </span>
                                    <span className={`pm-status status-${record.Status?.toLowerCase()}`}>
                                      {record.Status}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p>No PM records found</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="placeholder-text">
                      Please select a customer to view customer-specific report
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ icon, title, value, color }) => {
  return (
    <div className="metric-card">
      <div className="metric-icon" style={{ color }}>
        {icon}
      </div>
      <div className="metric-content">
        <p className="metric-title">{title}</p>
        <p className="metric-value">{value}</p>
      </div>
    </div>
  );
};

export default PMReports;
