import React, { useState, useEffect, useRef } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileUp, ArrowLeft, Upload, AlertCircle, Filter, Building2, MapPin, CheckCircle, ChevronDown, ChevronRight, Calendar, Download } from 'lucide-react';
import { API_URL } from '../config/api';
import toast from '../utils/toast';
import { isTokenExpired } from '../utils/authUtils';

const PMImport = () => {
  usePageTitle('PM Import');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isInitialMount = useRef(true);
  const savedBranch = useRef(null);
  
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(false);
  
  // Customer and Branch States
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  
  // Assets and Checklist States
  const [assets, setAssets] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  
  // PM Data States (store Y/N responses, dates, and files for each asset)
  const [pmData, setPmData] = useState({}); // { assetId: { date: '', checklistResults: { checklistId: 'Y'/'N' }, file: null } }
  const [showBulkDateOps, setShowBulkDateOps] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [validationResult, setValidationResult] = useState({ valid: [], invalid: [] });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successResults, setSuccessResults] = useState({ successful: [], failed: [], totalCount: 0 });
  
  // File preview states
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewAssetId, setPreviewAssetId] = useState(null);
  const [previewAssetInfo, setPreviewAssetInfo] = useState(null);

  // Initialize from URL parameters on mount
  useEffect(() => {
    const customer = searchParams.get('customer');
    const branch = searchParams.get('branch');
    
    if (customer) {
      setSelectedCustomer(customer);
      if (branch) {
        savedBranch.current = branch;
      }
    }
  }, [searchParams]);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      fetchBranches(selectedCustomer);
    } else {
      setBranches([]);
      setSelectedBranch('');
    }
  }, [selectedCustomer]);

  // Restore branch from URL after branches are fetched
  useEffect(() => {
    if (savedBranch.current && branches.length > 0) {
      setSelectedBranch(savedBranch.current);
      savedBranch.current = null;
    }
  }, [branches]);

  // Fetch categories when both customer and branch are selected
  useEffect(() => {
    if (selectedCustomer && selectedBranch) {
      fetchCategories(selectedCustomer, selectedBranch);
    } else {
      setCategories([]);
      setSelectedCategory('');
      setAssets([]);
      setChecklistItems([]);
    }
  }, [selectedCustomer, selectedBranch]);

  // Fetch assets and checklist when category is selected
  useEffect(() => {
    if (selectedCustomer && selectedBranch && selectedCategory) {
      fetchAssets(selectedCustomer, selectedBranch, selectedCategory);
      fetchChecklistItems(selectedCategory);
    } else {
      setAssets([]);
      setChecklistItems([]);
    }
  }, [selectedCategory]);

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/customers`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();
      // /pm/customers returns array directly with filtering for customer-type users
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchBranches = async (customerName) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/options/customer-branches/${encodeURIComponent(customerName)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch branches');
      const data = await response.json();
      setBranches(data.branches || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchCategories = async (customerName, branch) => {
    try {
      setLoadingCategories(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `${API_URL}/options/asset-categories?customer=${encodeURIComponent(customerName)}&branch=${encodeURIComponent(branch)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories. Please try again.');
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchAssets = async (customerName, branch, category) => {
    try {
      setLoadingAssets(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `${API_URL}/pm/assets?customer=${encodeURIComponent(customerName)}&branch=${encodeURIComponent(branch)}&category=${encodeURIComponent(category)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      if (!response.ok) throw new Error('Failed to fetch assets');
      const data = await response.json();
      
      // Fetch PM count for each asset
      const assetsWithPMCount = await Promise.all(
        data.map(async (asset) => {
          try {
            const token = localStorage.getItem('authToken');
            const pmResponse = await fetch(`${API_URL}/pm/asset/${asset.Asset_ID}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            if (pmResponse.ok) {
              const pmData = await pmResponse.json();
              return { ...asset, PM_Count: pmData.length || 0 };
            }
            return { ...asset, PM_Count: 0 };
          } catch (error) {
            console.error(`Error fetching PM count for asset ${asset.Asset_ID}:`, error);
            return { ...asset, PM_Count: 0 };
          }
        })
      );
      
      setAssets(assetsWithPMCount || []);
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast.error('Failed to load assets. Please try again.');
    } finally {
      setLoadingAssets(false);
    }
  };

  const fetchChecklistItems = async (category) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/checklist-by-name/${encodeURIComponent(category)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch checklist');
      const data = await response.json();
      setChecklistItems(data || []);
      console.log('Loaded checklist items:', data);
    } catch (error) {
      console.error('Error fetching checklist:', error);
      toast.error('Failed to load checklist items. Please try again.');
    }
  };

  const toggleRow = (assetId) => {
    setExpandedRows(prev => ({
      ...prev,
      [assetId]: !prev[assetId]
    }));
  };

  const handleChecklistChange = (assetId, checklistId, value) => {
    setPmData(prev => ({
      ...prev,
      [assetId]: {
        ...prev[assetId],
        checklistResults: {
          ...(prev[assetId]?.checklistResults || {}),
          [checklistId]: value
        }
      }
    }));
  };

  const handleChecklistRemarksChange = (assetId, checklistId, remarks) => {
    setPmData(prev => ({
      ...prev,
      [assetId]: {
        ...prev[assetId],
        checklistRemarks: {
          ...(prev[assetId]?.checklistRemarks || {}),
          [checklistId]: remarks
        }
      }
    }));
  };

  const handleDateChange = (assetId, date) => {
    setPmData(prev => ({
      ...prev,
      [assetId]: {
        ...prev[assetId],
        date: date
      }
    }));
  };

  const handleFileChange = (assetId, file, assetInfo) => {
    if (!file) {
      // Clear file if none selected
      setPmData(prev => ({
        ...prev,
        [assetId]: {
          ...prev[assetId],
          file: null
        }
      }));
      return;
    }
    
    // Show preview modal
    setPreviewFile(file);
    setPreviewAssetId(assetId);
    setPreviewAssetInfo(assetInfo);
    setShowFilePreview(true);
  };
  
  const confirmFileUpload = () => {
    if (previewFile && previewAssetId) {
      setPmData(prev => ({
        ...prev,
        [previewAssetId]: {
          ...prev[previewAssetId],
          file: previewFile
        }
      }));
    }
    setShowFilePreview(false);
    setPreviewFile(null);
    setPreviewAssetId(null);
    setPreviewAssetInfo(null);
  };
  
  const cancelFileUpload = () => {
    setShowFilePreview(false);
    setPreviewFile(null);
    setPreviewAssetId(null);
    setPreviewAssetInfo(null);
  };

  const handleRemarksChange = (assetId, remarks) => {
    setPmData(prev => ({
      ...prev,
      [assetId]: {
        ...prev[assetId],
        remarks: remarks
      }
    }));
  };

  const handleCustomerChange = (e) => {
    const newCustomer = e.target.value;
    
    // Clear branch and categories first to prevent showing old values
    setSelectedBranch('');
    setSelectedCategory('');
    setCategories([]);
    setSelectedCustomer(newCustomer);
    
    const params = new URLSearchParams();
    if (newCustomer) params.set('customer', newCustomer);
    // Explicitly ensure no branch parameter
    setSearchParams(params);
  };

  const handleBranchChange = (e) => {
    const newBranch = e.target.value;
    setSelectedBranch(newBranch);
    
    const params = new URLSearchParams();
    if (selectedCustomer) params.set('customer', selectedCustomer);
    if (newBranch) params.set('branch', newBranch);
    setSearchParams(params);
  };

  const validateAssets = () => {
    const valid = [];
    const invalid = [];

    assets.forEach(asset => {
      const data = pmData[asset.Asset_ID];
      const reasons = [];

      // Check PM Date
      if (!data?.date) {
        reasons.push('Missing PM Date');
      }

      // Check File Upload
      if (!data?.file) {
        reasons.push('Missing file upload');
      } else if (data.file && data.file.type !== 'application/pdf') {
        reasons.push('File must be PDF format');
      }

      // Check all checklist items are selected
      const allChecklistSelected = checklistItems.every(item => {
        const result = data?.checklistResults?.[item.Checklist_ID];
        return result === 'Y' || result === 'N';
      });

      if (!allChecklistSelected) {
        reasons.push('Not all checklist items selected');
      }

      if (reasons.length === 0) {
        valid.push({
          assetId: asset.Asset_ID,
          serialNumber: asset.Asset_Serial_Number,
          tagId: asset.Asset_Tag_ID,
          name: asset.Item_Name
        });
      } else {
        invalid.push({
          assetId: asset.Asset_ID,
          serialNumber: asset.Asset_Serial_Number,
          tagId: asset.Asset_Tag_ID,
          name: asset.Item_Name,
          reasons: reasons
        });
      }
    });

    return { valid, invalid };
  };

  const handleSubmitClick = () => {
    const result = validateAssets();
    
    if (result.valid.length === 0 && result.invalid.length === 0) {
      toast.error('No data has been filled. Please enter PM data for at least one asset.');
      return;
    }

    setValidationResult(result);
    setShowModal(true);
  };

  const handleConfirmSubmit = async () => {
    if (validationResult.valid.length === 0) {
      toast.error('No valid assets to submit.');
      setShowModal(false);
      return;
    }

    setSubmitting(true);
    setShowModal(false);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        toast.error('Not authenticated. Please log in again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }
      
      // Check if token is expired before submitting
      if (isTokenExpired(token)) {
        toast.warn('Your session has expired. Please log in again.');
        setTimeout(() => {
          localStorage.clear();
          window.location.href = '/login';
        }, 2000);
        return;
      }

      const formData = new FormData();
      
      // Prepare PM data for each valid asset
      const pmDataArray = validationResult.valid.map(assetInfo => {
        const asset = assets.find(a => a.Asset_ID === assetInfo.assetId);
        const data = pmData[assetInfo.assetId];
        
        // Prepare checklist results
        const checklistResults = checklistItems.map(item => ({
          checklistId: item.Checklist_ID,
          isOk: data.checklistResults[item.Checklist_ID] === 'Y' ? 1 : 0,
          remarks: data.checklistRemarks?.[item.Checklist_ID] || null
        }));

        return {
          assetId: asset.Asset_ID,
          serialNumber: asset.Asset_Serial_Number,
          pmDate: data.date,
          remarks: data.remarks || null,
          checklistResults: checklistResults
        };
      });

      // Add JSON data
      formData.append('pmData', JSON.stringify(pmDataArray));

      // Add files
      validationResult.valid.forEach(assetInfo => {
        const data = pmData[assetInfo.assetId];
        if (data.file) {
          formData.append(`file_${assetInfo.assetId}`, data.file);
        }
      });

      const response = await fetch(`${API_URL}/pm/bulk-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit PM data');
      }

      const result = await response.json();
      
      // Process results to include asset details and checklist data
      const successful = result.results
        .filter(r => r.success)
        .map(r => {
          const asset = assets.find(a => a.Asset_ID === r.assetId);
          const data = pmData[r.assetId];
          
          // Get checklist results for this asset
          const checklistResultsMap = {};
          checklistItems.forEach(item => {
            const value = data.checklistResults[item.Checklist_ID];
            checklistResultsMap[item.Checklist_ID] = value === 'Y' ? 1 : 0;
          });
          
          return {
            pmId: r.pmId,
            serialNumber: r.serialNumber,
            tagId: asset?.Asset_Tag_ID || 'N/A',
            assetName: asset?.Item_Name || 'Unknown',
            pmDate: data?.date || 'N/A',
            fileName: r.fileName || 'No file',
            checklistResults: checklistResultsMap
          };
        });

      const failed = result.results
        .filter(r => !r.success)
        .map(r => {
          const asset = assets.find(a => a.Asset_ID === r.assetId);
          return {
            serialNumber: r.serialNumber,
            tagId: asset?.Asset_Tag_ID || 'N/A',
            assetName: asset?.Item_Name || 'Unknown',
            error: r.error || 'Unknown error'
          };
        });

      setSuccessResults({
        successful,
        failed,
        totalCount: result.totalCount
      });
      
      setShowSuccessModal(true);
      
      // Clear form
      setPmData({});
      setExpandedRows({});
      
      // Optionally reload assets
      if (selectedCustomer && selectedBranch && selectedCategory) {
        await fetchAssets(selectedCustomer, selectedBranch, selectedCategory);
      }

    } catch (error) {
      console.error('Error submitting PM data:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadSummaryCSV = () => {
    // Build headers with checklist items
    const baseHeaders = ['PM ID', 'Serial Number', 'Tag ID', 'Asset Name', 'PM Date', 'File Name'];
    const checklistHeaders = checklistItems.map(item => item.Check_item_Long);
    const headers = [...baseHeaders, ...checklistHeaders];
    
    // Build rows with checklist results
    const rows = successResults.successful.map(item => {
      const baseData = [
        item.pmId,
        item.serialNumber,
        item.tagId,
        item.assetName,
        item.pmDate,
        item.fileName
      ];
      
      // Add checklist results in order
      const checklistData = checklistItems.map(chkItem => {
        const value = item.checklistResults[chkItem.Checklist_ID];
        return value === 1 ? 'Yes(1)' : 'No(0)';
      });
      
      return [...baseData, ...checklistData];
    });

    // Add failed section if any
    if (successResults.failed.length > 0) {
      rows.push([]);
      rows.push(['FAILED ASSETS']);
      rows.push(['Serial Number', 'Tag ID', 'Asset Name', 'Error']);
      successResults.failed.forEach(item => {
        rows.push([item.serialNumber, item.tagId, item.assetName, item.error]);
      });
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PM_Import_Summary_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '20px 30px', maxWidth: '100%', margin: '0' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '30px',
        paddingBottom: '15px',
        borderBottom: '3px solid #667eea'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FileUp size={32} color="#667eea" />
          <div>
            <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.8rem' }}>
              Import Preventive Maintenance Data
            </h2>
            <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '0.95rem' }}>
              Upload PM data for multiple assets at once
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            const customer = searchParams.get('customer');
            const branch = searchParams.get('branch');
            const params = new URLSearchParams();
            if (customer) params.set('customer', customer);
            if (branch) params.set('branch', branch);
            navigate(`/pm${params.toString() ? '?' + params.toString() : ''}`);
          }}
          style={{
            background: 'white',
            color: '#667eea',
            border: '2px solid #667eea',
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: '600',
            borderRadius: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#667eea';
            e.currentTarget.style.color = 'white';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.color = '#667eea';
          }}
        >
          <ArrowLeft size={18} />
          Back to PM
        </button>
      </div>

      {/* Main Content */}
      <div className="card" style={{ padding: '25px', marginBottom: '20px' }}>
        {/* Filter PM Records */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', paddingBottom: '10px', borderBottom: '2px solid #3498db' }}>
            <Filter size={22} color="#3498db" />
            <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.1rem' }}>Filter PM Records</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: '600', color: '#2c3e50', fontSize: '0.95rem' }}>
                <Building2 size={18} color="#3498db" />
                Step 1: Select Customer
              </label>
              <select value={selectedCustomer} onChange={handleCustomerChange} style={{ width: '100%', padding: '12px', border: '2px solid #ddd', borderRadius: '6px', fontSize: '1rem', backgroundColor: 'white', cursor: 'pointer', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor = '#3498db'} onBlur={(e) => e.target.style.borderColor = '#ddd'}>
                <option value="">-- Select Customer --</option>
                {customers.map((customer, index) => (
                  <option key={index} value={customer.Customer_Name}>
                    {customer.Customer_Name} ({customer.Customer_Ref_Number})
                  </option>
                ))}
              </select>
              <p style={{ 
                fontSize: '0.85rem', 
                color: '#7f8c8d', 
                marginTop: '5px', 
                fontStyle: 'italic', 
                minHeight: '20px',
                visibility: !selectedCustomer ? 'visible' : 'hidden'
              }}>
                Please select a customer first
              </p>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: '600', color: '#2c3e50', fontSize: '0.95rem' }}>
                <MapPin size={18} color="#e74c3c" />
                Step 2: Select Branch
              </label>
              <select value={selectedBranch} onChange={handleBranchChange} disabled={!selectedCustomer} style={{ width: '100%', padding: '12px', border: '2px solid #ddd', borderRadius: '6px', fontSize: '1rem', backgroundColor: selectedCustomer ? 'white' : '#f5f5f5', cursor: selectedCustomer ? 'pointer' : 'not-allowed', opacity: selectedCustomer ? 1 : 0.6, transition: 'border-color 0.2s' }} onFocus={(e) => selectedCustomer && (e.target.style.borderColor = '#e74c3c')} onBlur={(e) => e.target.style.borderColor = '#ddd'}>
                <option value="">-- Select Branch --</option>
                {branches.map((branch, index) => (
                  <option key={index} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
              <p style={{ 
                fontSize: '0.85rem', 
                color: '#7f8c8d', 
                marginTop: '5px', 
                fontStyle: 'italic', 
                minHeight: '20px',
                visibility: (selectedCustomer && !selectedBranch) ? 'visible' : 'hidden'
              }}>
                Select a branch to continue
              </p>
            </div>
          </div>

          {/* Always render the selected message container to maintain consistent height */}
          <div style={{ 
            marginTop: '8px', 
            padding: '12px 16px', 
            background: (selectedCustomer && selectedBranch && selectedBranch !== '' && branches.includes(selectedBranch)) ? '#e3f2fd' : 'transparent', 
            border: (selectedCustomer && selectedBranch && selectedBranch !== '' && branches.includes(selectedBranch)) ? '1px solid #90caf9' : '1px solid transparent', 
            borderRadius: '6px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            minHeight: '48px',
            visibility: (selectedCustomer && selectedBranch && selectedBranch !== '' && branches.includes(selectedBranch)) ? 'visible' : 'hidden'
          }}>
            <CheckCircle size={20} color="#1565c0" />
            <span style={{ color: '#1565c0', fontWeight: '600' }}>
              Selected: {selectedCustomer} - {selectedBranch}
            </span>
          </div>
        </div>
      </div>

      {/* Category Selection */}
      <div className="card" style={{ padding: '30px' }}>
        {/* Step 1: Category Selection */}
        <div style={{ marginBottom: '30px' }}>
            <h3 style={{
              margin: '0 0 20px 0',
              color: '#2c3e50',
              fontSize: '1.3rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{
                background: '#667eea',
                color: 'white',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                fontWeight: 'bold'
              }}>
                1
              </span>
              Select Category
            </h3>

            <div style={{ marginLeft: '42px' }}>
              {!selectedCustomer || !selectedBranch ? (
                <div style={{
                  padding: '20px',
                  textAlign: 'center',
                  backgroundColor: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: '8px',
                  color: '#856404'
                }}>
                  Please select customer and branch first to load categories
                </div>
              ) : loadingCategories ? (
                <div style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: '#666',
                  fontStyle: 'italic'
                }}>
                  Loading categories...
                </div>
              ) : categories.length === 0 ? (
                <div style={{
                  padding: '20px',
                  textAlign: 'center',
                  backgroundColor: '#f8d7da',
                  border: '1px solid #f5c6cb',
                  borderRadius: '8px',
                  color: '#721c24'
                }}>
                  No categories found for this branch
                </div>
              ) : (
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '1rem'
                  }}>
                    Choose the category for the PM data you want to import <span style={{ color: '#e74c3c' }}>*</span>
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{
                      width: '100%',
                      maxWidth: '500px',
                      padding: '14px',
                      border: '2px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#ddd'}
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((category, index) => (
                      <option key={index} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

          {/* Information Box */}
          <div style={{
            padding: '20px',
            background: '#e3f2fd',
            border: '2px solid #90caf9',
            borderRadius: '10px',
            display: 'flex',
            gap: '15px',
            alignItems: 'flex-start'
          }}>
            <AlertCircle size={24} color="#1565c0" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: '0 0 10px 0', color: '#1565c0', fontSize: '1.1rem' }}>
                Important Information
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#1565c0', lineHeight: '1.8' }}>
                <li>Select customer, branch, and category to load assets</li>
                <li>Expand each asset row to fill in PM checklist data</li>
                <li>All checklist items must be marked as Y (Yes) or N (No)</li>
                <li>Upload a file for each asset if available</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      {selectedCategory && (
        <div className="card" style={{ padding: '20px', marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                placeholder="Search assets by Serial Number, Tag ID, or Asset Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 40px 12px 12px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#ddd'}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#999',
                    fontSize: '1.2rem',
                    padding: '0 5px'
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
          {searchQuery && (
            <p style={{ margin: '10px 0 0 0', fontSize: '0.9rem', color: '#666' }}>
              Found {assets.filter(asset => 
                asset.Asset_Serial_Number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                asset.Asset_Tag_ID?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                asset.Item_Name?.toLowerCase().includes(searchQuery.toLowerCase())
              ).length} matching asset(s)
            </p>
          )}
        </div>
      )}

      {/* PM Data Table */}
      {selectedCategory && (
        <div className="card" style={{ padding: '30px', marginTop: '20px' }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{
                margin: 0,
                color: '#2c3e50',
                fontSize: '1.3rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{
                  background: '#667eea',
                  color: 'white',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}>
                  2
                </span>
                Enter PM Data for Assets
              </h3>

              {!loadingAssets && assets.length > 0 && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => {
                      const allResults = {};
                      checklistItems.forEach(item => {
                        allResults[item.Checklist_ID] = 'Y';
                      });
                      
                      const newPmData = {};
                      assets.forEach(asset => {
                        newPmData[asset.Asset_ID] = {
                          ...pmData[asset.Asset_ID],
                          checklistResults: allResults
                        };
                      });
                      setPmData(prev => ({
                        ...prev,
                        ...newPmData
                      }));
                    }}
                    style={{
                      padding: '8px 20px',
                      background: '#27ae60',
                      color: 'white',
                      border: '2px solid #27ae60',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseOver={(e) => e.target.style.background = '#229954'}
                    onMouseOut={(e) => e.target.style.background = '#27ae60'}
                  >
                    ✓ Select All Y (All Assets)
                  </button>
                  <button
                    onClick={() => {
                      const allResults = {};
                      checklistItems.forEach(item => {
                        allResults[item.Checklist_ID] = 'N';
                      });
                      
                      const newPmData = {};
                      assets.forEach(asset => {
                        newPmData[asset.Asset_ID] = {
                          ...pmData[asset.Asset_ID],
                          checklistResults: allResults
                        };
                      });
                      setPmData(prev => ({
                        ...prev,
                        ...newPmData
                      }));
                    }}
                    style={{
                      padding: '8px 20px',
                      background: '#e74c3c',
                      color: 'white',
                      border: '2px solid #e74c3c',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseOver={(e) => e.target.style.background = '#c0392b'}
                    onMouseOut={(e) => e.target.style.background = '#e74c3c'}
                  >
                    ✗ Select All N (All Assets)
                  </button>
                </div>
              )}
            </div>

            {loadingAssets ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#666',
                fontStyle: 'italic'
              }}>
                Loading assets...
              </div>
            ) : assets.length === 0 ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                backgroundColor: '#f8d7da',
                border: '1px solid #f5c6cb',
                borderRadius: '8px',
                color: '#721c24'
              }}>
                No assets found for this category and branch
              </div>
            ) : (
              <>
                {/* Bulk Date Operations */}
                {showBulkDateOps && (
                <div style={{
                  padding: '20px',
                  background: '#fff9e6',
                  border: '2px solid #ffd700',
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <Calendar size={20} color="#f39c12" />
                    <h4 style={{ margin: 0, color: '#2c3e50', fontSize: '1rem' }}>
                      Bulk Date Operations
                    </h4>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ fontWeight: '600', color: '#2c3e50', fontSize: '0.95rem' }}>
                        Select Date:
                      </label>
                      <input
                        type="date"
                        id="bulkDateInput"
                        style={{
                          padding: '8px 12px',
                          border: '2px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '0.95rem',
                          minWidth: '150px'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          const dateInput = document.getElementById('bulkDateInput');
                          const selectedDate = dateInput.value;
                          if (!selectedDate) {
                            toast.error('Please select a date first');
                            return;
                          }
                          const newPmData = { ...pmData };
                          const filteredAssets = assets.filter(asset => {
                            if (!searchQuery) return true;
                            const query = searchQuery.toLowerCase();
                            return (
                              asset.Asset_Serial_Number?.toLowerCase().includes(query) ||
                              asset.Asset_Tag_ID?.toLowerCase().includes(query) ||
                              asset.Item_Name?.toLowerCase().includes(query)
                            );
                          });
                          filteredAssets.forEach(asset => {
                            newPmData[asset.Asset_ID] = {
                              ...newPmData[asset.Asset_ID],
                              date: selectedDate
                            };
                          });
                          setPmData(newPmData);
                          toast.success(`Date ${selectedDate} applied to ${filteredAssets.length} asset(s)`);
                        }}
                        style={{
                          padding: '8px 16px',
                          background: '#3498db',
                          color: 'white',
                          border: '2px solid #3498db',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.background = '#2980b9'}
                        onMouseOut={(e) => e.target.style.background = '#3498db'}
                      >
                        Apply to All Assets ({assets.filter(asset => {
                          if (!searchQuery) return true;
                          const query = searchQuery.toLowerCase();
                          return (
                            asset.Asset_Serial_Number?.toLowerCase().includes(query) ||
                            asset.Asset_Tag_ID?.toLowerCase().includes(query) ||
                            asset.Item_Name?.toLowerCase().includes(query)
                          );
                        }).length})
                      </button>
                      <button
                        onClick={() => {
                          const dateInput = document.getElementById('bulkDateInput');
                          const selectedDate = dateInput.value;
                          if (!selectedDate) {
                            toast.error('Please select a date first');
                            return;
                          }
                          const newPmData = { ...pmData };
                          const filteredAssets = assets.filter(asset => {
                            if (!searchQuery) return true;
                            const query = searchQuery.toLowerCase();
                            return (
                              asset.Asset_Serial_Number?.toLowerCase().includes(query) ||
                              asset.Asset_Tag_ID?.toLowerCase().includes(query) ||
                              asset.Item_Name?.toLowerCase().includes(query)
                            );
                          });
                          const halfPoint = Math.ceil(filteredAssets.length / 2);
                          filteredAssets.slice(0, halfPoint).forEach(asset => {
                            newPmData[asset.Asset_ID] = {
                              ...newPmData[asset.Asset_ID],
                              date: selectedDate
                            };
                          });
                          setPmData(newPmData);
                          toast.success(`Date ${selectedDate} applied to first ${halfPoint} asset(s)`);
                        }}
                        style={{
                          padding: '8px 16px',
                          background: '#9b59b6',
                          color: 'white',
                          border: '2px solid #9b59b6',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.background = '#8e44ad'}
                        onMouseOut={(e) => e.target.style.background = '#9b59b6'}
                      >
                        Apply to Top Half ({Math.ceil(assets.filter(asset => {
                          if (!searchQuery) return true;
                          const query = searchQuery.toLowerCase();
                          return (
                            asset.Asset_Serial_Number?.toLowerCase().includes(query) ||
                            asset.Asset_Tag_ID?.toLowerCase().includes(query) ||
                            asset.Item_Name?.toLowerCase().includes(query)
                          );
                        }).length / 2)})
                      </button>
                      <button
                        onClick={() => {
                          const dateInput = document.getElementById('bulkDateInput');
                          const selectedDate = dateInput.value;
                          if (!selectedDate) {
                            toast.error('Please select a date first');
                            return;
                          }
                          const newPmData = { ...pmData };
                          const filteredAssets = assets.filter(asset => {
                            if (!searchQuery) return true;
                            const query = searchQuery.toLowerCase();
                            return (
                              asset.Asset_Serial_Number?.toLowerCase().includes(query) ||
                              asset.Asset_Tag_ID?.toLowerCase().includes(query) ||
                              asset.Item_Name?.toLowerCase().includes(query)
                            );
                          });
                          const halfPoint = Math.ceil(filteredAssets.length / 2);
                          filteredAssets.slice(halfPoint).forEach(asset => {
                            newPmData[asset.Asset_ID] = {
                              ...newPmData[asset.Asset_ID],
                              date: selectedDate
                            };
                          });
                          setPmData(newPmData);
                          toast.success(`Date ${selectedDate} applied to last ${filteredAssets.length - halfPoint} asset(s)`);
                        }}
                        style={{
                          padding: '8px 16px',
                          background: '#e67e22',
                          color: 'white',
                          border: '2px solid #e67e22',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.background = '#d35400'}
                        onMouseOut={(e) => e.target.style.background = '#e67e22'}
                      >
                        Apply to Bottom Half ({Math.floor(assets.filter(asset => {
                          if (!searchQuery) return true;
                          const query = searchQuery.toLowerCase();
                          return (
                            asset.Asset_Serial_Number?.toLowerCase().includes(query) ||
                            asset.Asset_Tag_ID?.toLowerCase().includes(query) ||
                            asset.Item_Name?.toLowerCase().includes(query)
                          );
                        }).length / 2)})
                      </button>
                    </div>
                  </div>
                  <p style={{ 
                    margin: '10px 0 0 0', 
                    fontSize: '0.85rem', 
                    color: '#7f8c8d',
                    fontStyle: 'italic'
                  }}>
                    💡 Tip: You can set different dates for different groups. For example, set top half to one date, then set bottom half to another date.
                  </p>
                </div>
                )}

                <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  border: '1px solid #ddd'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left', width: '50px' }}></th>
                      <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Serial Number</th>
                      <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Tag ID</th>
                      <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Asset Name</th>
                      <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center', width: '100px' }}>PM Count</th>
                      <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left', width: '180px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                          <span>PM Date</span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <span style={{ color: '#666', fontWeight: 'normal' }}>Bulk</span>
                            <div
                              onClick={() => setShowBulkDateOps(!showBulkDateOps)}
                              style={{
                                position: 'relative',
                                width: '40px',
                                height: '20px',
                                backgroundColor: showBulkDateOps ? '#27ae60' : '#ccc',
                                borderRadius: '10px',
                                transition: 'background-color 0.3s',
                                cursor: 'pointer'
                              }}
                            >
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '2px',
                                  left: showBulkDateOps ? '22px' : '2px',
                                  width: '16px',
                                  height: '16px',
                                  backgroundColor: 'white',
                                  borderRadius: '50%',
                                  transition: 'left 0.3s'
                                }}
                              />
                            </div>
                          </label>
                        </div>
                      </th>
                      <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left', width: '250px' }}>Remarks</th>
                      <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left', width: '200px' }}>File Upload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets
                      .filter(asset => {
                        if (!searchQuery) return true;
                        const query = searchQuery.toLowerCase();
                        return (
                          asset.Asset_Serial_Number?.toLowerCase().includes(query) ||
                          asset.Asset_Tag_ID?.toLowerCase().includes(query) ||
                          asset.Item_Name?.toLowerCase().includes(query)
                        );
                      })
                      .map((asset) => (
                      <React.Fragment key={asset.Asset_ID}>
                        {/* Main Row - Highlighted if file uploaded */}
                        <tr style={{ 
                          borderBottom: '1px solid #ddd',
                          backgroundColor: pmData[asset.Asset_ID]?.file ? '#d4edda' : 'white',
                          transition: 'background-color 0.3s ease'
                        }}>
                          <td style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>
                            <button
                              onClick={() => toggleRow(asset.Asset_ID)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {expandedRows[asset.Asset_ID] ? (
                                <ChevronDown size={20} color="#667eea" />
                              ) : (
                                <ChevronRight size={20} color="#667eea" />
                              )}
                            </button>
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                            {asset.Asset_Serial_Number}
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                            {asset.Asset_Tag_ID}
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                            {asset.Item_Name}
                          </td>
                          <td style={{ 
                            padding: '12px', 
                            border: '1px solid #ddd', 
                            textAlign: 'center',
                            fontWeight: '600',
                            color: asset.PM_Count > 0 ? '#27ae60' : '#95a5a6',
                            fontSize: '1.1rem'
                          }}>
                            {asset.PM_Count || 0}
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                            <input
                              type="date"
                              value={pmData[asset.Asset_ID]?.date ?? ''}
                              onChange={(e) => handleDateChange(asset.Asset_ID, e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '0.95rem'
                              }}
                            />
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                            <input
                              type="text"
                              placeholder="Enter remarks..."
                              value={pmData[asset.Asset_ID]?.remarks ?? ''}
                              onChange={(e) => handleRemarksChange(asset.Asset_ID, e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '0.95rem'
                              }}
                            />
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => handleFileChange(
                                  asset.Asset_ID, 
                                  e.target.files[0],
                                  {
                                    serialNumber: asset.Asset_Serial_Number,
                                    tagId: asset.Asset_Tag_ID,
                                    name: asset.Item_Name,
                                    model: asset.Model || asset.Model_Name || 'N/A'
                                  }
                                )}
                                style={{
                                  width: '100%',
                                  fontSize: '0.9rem'
                                }}
                              />
                              {pmData[asset.Asset_ID]?.file && (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '6px 10px',
                                  background: '#27ae60',
                                  color: 'white',
                                  borderRadius: '4px',
                                  fontSize: '0.85rem',
                                  fontWeight: '600'
                                }}>
                                  <CheckCircle size={16} />
                                  {pmData[asset.Asset_ID].file.name}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Checklist Row */}
                        {expandedRows[asset.Asset_ID] && (
                          <tr>
                            <td colSpan="7" style={{ padding: '20px', backgroundColor: '#f8f9fa', border: '1px solid #ddd' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h4 style={{ margin: 0, color: '#2c3e50', fontSize: '1rem' }}>
                                  PM Checklist Items
                                </h4>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={() => {
                                      const allResults = {};
                                      checklistItems.forEach(item => {
                                        allResults[item.Checklist_ID] = 'Y';
                                      });
                                      setPmData(prev => ({
                                        ...prev,
                                        [asset.Asset_ID]: {
                                          ...prev[asset.Asset_ID],
                                          checklistResults: allResults
                                        }
                                      }));
                                    }}
                                    style={{
                                      padding: '6px 16px',
                                      background: '#27ae60',
                                      color: 'white',
                                      border: '2px solid #27ae60',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontWeight: '600',
                                      fontSize: '0.9rem',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => e.target.style.background = '#229954'}
                                    onMouseOut={(e) => e.target.style.background = '#27ae60'}
                                  >
                                    Select All Y
                                  </button>
                                  <button
                                    onClick={() => {
                                      const allResults = {};
                                      checklistItems.forEach(item => {
                                        allResults[item.Checklist_ID] = 'N';
                                      });
                                      setPmData(prev => ({
                                        ...prev,
                                        [asset.Asset_ID]: {
                                          ...prev[asset.Asset_ID],
                                          checklistResults: allResults
                                        }
                                      }));
                                    }}
                                    style={{
                                      padding: '6px 16px',
                                      background: '#e74c3c',
                                      color: 'white',
                                      border: '2px solid #e74c3c',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontWeight: '600',
                                      fontSize: '0.9rem',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => e.target.style.background = '#c0392b'}
                                    onMouseOut={(e) => e.target.style.background = '#e74c3c'}
                                  >
                                    Select All N
                                  </button>
                                </div>
                              </div>
                              {checklistItems.length === 0 ? (
                                <p style={{ color: '#666', fontStyle: 'italic' }}>No checklist items available</p>
                              ) : (
                                <div style={{ 
                                  display: 'grid', 
                                  gridTemplateColumns: 'repeat(5, 1fr)',
                                  gap: '12px'
                                }}>
                                  {checklistItems.map((item, index) => (
                                    <div
                                      key={item.Checklist_ID}
                                      style={{
                                        padding: '10px',
                                        background: 'white',
                                        borderRadius: '6px',
                                        border: '1px solid #ddd',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{
                                          minWidth: '20px',
                                          height: '20px',
                                          background: '#667eea',
                                          color: 'white',
                                          borderRadius: '50%',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: '0.7rem',
                                          fontWeight: '600',
                                          flexShrink: 0
                                        }}>
                                          {index + 1}
                                        </span>
                                        <span style={{ flex: 1, color: '#2c3e50', fontSize: '0.88rem', lineHeight: '1.3' }}>
                                          {item.Check_item_Long}
                                        </span>
                                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                        <button
                                          onClick={() => handleChecklistChange(asset.Asset_ID, item.Checklist_ID, 'Y')}
                                          style={{
                                            padding: '6px 16px',
                                            background: pmData[asset.Asset_ID]?.checklistResults?.[item.Checklist_ID] === 'Y' ? '#27ae60' : 'white',
                                            color: pmData[asset.Asset_ID]?.checklistResults?.[item.Checklist_ID] === 'Y' ? 'white' : '#27ae60',
                                            border: '2px solid #27ae60',
                                            borderRadius: '5px',
                                            cursor: 'pointer',
                                            fontWeight: '600',
                                            fontSize: '0.9rem',
                                            transition: 'all 0.2s'
                                          }}
                                          onMouseOver={(e) => {
                                            if (pmData[asset.Asset_ID]?.checklistResults?.[item.Checklist_ID] !== 'Y') {
                                              e.target.style.background = '#27ae6020';
                                            }
                                          }}
                                          onMouseOut={(e) => {
                                            if (pmData[asset.Asset_ID]?.checklistResults?.[item.Checklist_ID] !== 'Y') {
                                              e.target.style.background = 'white';
                                            }
                                          }}
                                        >
                                          Y
                                        </button>
                                        <button
                                          onClick={() => handleChecklistChange(asset.Asset_ID, item.Checklist_ID, 'N')}
                                          style={{
                                            padding: '6px 16px',
                                            background: pmData[asset.Asset_ID]?.checklistResults?.[item.Checklist_ID] === 'N' ? '#e74c3c' : 'white',
                                            color: pmData[asset.Asset_ID]?.checklistResults?.[item.Checklist_ID] === 'N' ? 'white' : '#e74c3c',
                                            border: '2px solid #e74c3c',
                                            borderRadius: '5px',
                                            cursor: 'pointer',
                                            fontWeight: '600',
                                            fontSize: '0.9rem',
                                            transition: 'all 0.2s'
                                          }}
                                          onMouseOver={(e) => {
                                            if (pmData[asset.Asset_ID]?.checklistResults?.[item.Checklist_ID] !== 'N') {
                                              e.target.style.background = '#e74c3c20';
                                            }
                                          }}
                                          onMouseOut={(e) => {
                                            if (pmData[asset.Asset_ID]?.checklistResults?.[item.Checklist_ID] !== 'N') {
                                              e.target.style.background = 'white';
                                            }
                                          }}
                                        >
                                          N
                                        </button>
                                        </div>
                                      </div>
                                      <input
                                        type="text"
                                        placeholder="Remarks (optional)..."
                                        value={pmData[asset.Asset_ID]?.checklistRemarks?.[item.Checklist_ID] ?? ''}
                                        onChange={(e) => handleChecklistRemarksChange(asset.Asset_ID, item.Checklist_ID, e.target.value)}
                                        style={{
                                          width: 'calc(100% - 30px)',
                                          padding: '6px 8px',
                                          border: '1px solid #ddd',
                                          borderRadius: '4px',
                                          fontSize: '0.85rem',
                                          marginLeft: '30px',
                                          boxSizing: 'border-box'
                                        }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Submit Button */}
      {selectedCategory && assets.length > 0 && (
        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={handleSubmitClick}
            disabled={submitting}
            style={{
              padding: '15px 50px',
              background: submitting ? '#95a5a6' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)'
            }}
            onMouseOver={(e) => {
              if (!submitting) {
                e.target.style.background = '#5568d3';
                e.target.style.boxShadow = '0 6px 8px rgba(102, 126, 234, 0.4)';
              }
            }}
            onMouseOut={(e) => {
              if (!submitting) {
                e.target.style.background = '#667eea';
                e.target.style.boxShadow = '0 4px 6px rgba(102, 126, 234, 0.3)';
              }
            }}
          >
            {submitting ? 'Submitting...' : 'Submit PM Data'}
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '700px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ margin: '0 0 20px 0', color: '#2c3e50', fontSize: '1.5rem' }}>
              Confirm PM Data Submission
            </h2>
            
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '1.1rem', color: '#2c3e50', fontWeight: '600' }}>
                {validationResult.valid.length} asset(s) will be submitted
              </p>
            </div>

            {validationResult.valid.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ color: '#27ae60', fontSize: '1.1rem', marginBottom: '10px' }}>
                  ✓ Valid Assets ({validationResult.valid.length})
                </h3>
                <div style={{
                  maxHeight: '200px',
                  overflow: 'auto',
                  border: '1px solid #27ae60',
                  borderRadius: '6px',
                  padding: '10px',
                  backgroundColor: '#f0fff4'
                }}>
                  {validationResult.valid.map((asset, index) => (
                    <div key={asset.assetId} style={{ padding: '8px', borderBottom: index < validationResult.valid.length - 1 ? '1px solid #d4edda' : 'none' }}>
                      <strong>{asset.serialNumber}</strong> - {asset.tagId} - {asset.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {validationResult.invalid.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ color: '#e74c3c', fontSize: '1.1rem', marginBottom: '10px' }}>
                  ✗ Invalid Assets ({validationResult.invalid.length})
                </h3>
                <div style={{
                  maxHeight: '200px',
                  overflow: 'auto',
                  border: '1px solid #e74c3c',
                  borderRadius: '6px',
                  padding: '10px',
                  backgroundColor: '#fff5f5'
                }}>
                  {validationResult.invalid.map((asset, index) => (
                    <div key={asset.assetId} style={{ 
                      padding: '8px', 
                      borderBottom: index < validationResult.invalid.length - 1 ? '1px solid #f5c6cb' : 'none'
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                        {asset.serialNumber} - {asset.tagId} - {asset.name}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#721c24', paddingLeft: '10px' }}>
                        {asset.reasons.map((reason, i) => (
                          <div key={i}>• {reason}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '10px 24px',
                  background: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#7f8c8d'}
                onMouseOut={(e) => e.target.style.background = '#95a5a6'}
              >
                Cancel
              </button>
              {validationResult.valid.length > 0 && (
                <button
                  onClick={handleConfirmSubmit}
                  style={{
                    padding: '10px 24px',
                    background: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#229954'}
                  onMouseOut={(e) => e.target.style.background = '#27ae60'}
                >
                  Confirm & Submit ({validationResult.valid.length} assets)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Results Modal */}
      {showSuccessModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '1000px',
            width: '90%',
            maxHeight: '85vh',
            overflow: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.6rem' }}>
                ✓ Import Completed Successfully
              </h2>
              <button
                onClick={downloadSummaryCSV}
                style={{
                  padding: '10px 20px',
                  background: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#2980b9'}
                onMouseOut={(e) => e.target.style.background = '#3498db'}
              >
                <Download size={18} />
                Download Summary
              </button>
            </div>
            
            <div style={{ marginBottom: '20px', padding: '15px', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontSize: '1.1rem', color: '#155724', fontWeight: '600' }}>
                {successResults.successful.length} of {successResults.totalCount} asset(s) imported successfully
              </p>
            </div>

            {/* Successful Assets Table */}
            {successResults.successful.length > 0 && (
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ color: '#27ae60', fontSize: '1.2rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={22} />
                  Successfully Imported Assets
                </h3>
                <div style={{
                  maxHeight: '400px',
                  overflow: 'auto',
                  border: '1px solid #27ae60',
                  borderRadius: '8px'
                }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.9rem'
                  }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f0fff4', borderBottom: '2px solid #27ae60' }}>
                      <tr>
                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#2c3e50', minWidth: '60px' }}>PM ID</th>
                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#2c3e50', minWidth: '120px' }}>Serial Number</th>
                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#2c3e50', minWidth: '100px' }}>Tag ID</th>
                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#2c3e50', minWidth: '150px' }}>Asset Name</th>
                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#2c3e50', minWidth: '110px' }}>PM Date</th>
                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#2c3e50', minWidth: '200px' }}>File Name</th>
                        {checklistItems.map((item, idx) => (
                          <th key={item.Checklist_ID} style={{ 
                            padding: '12px 8px', 
                            textAlign: 'center', 
                            fontWeight: '600', 
                            color: '#2c3e50',
                            minWidth: '80px',
                            fontSize: '0.85rem',
                            whiteSpace: 'normal',
                            lineHeight: '1.2'
                          }}>
                            {item.Check_item_Long}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {successResults.successful.map((item, index) => (
                        <tr key={item.pmId} style={{
                          backgroundColor: index % 2 === 0 ? 'white' : '#f9fffe',
                          borderBottom: '1px solid #d4edda'
                        }}>
                          <td style={{ padding: '10px 8px', color: '#2c3e50', fontWeight: '600' }}>{item.pmId}</td>
                          <td style={{ padding: '10px 8px', color: '#2c3e50' }}>{item.serialNumber}</td>
                          <td style={{ padding: '10px 8px', color: '#2c3e50' }}>{item.tagId}</td>
                          <td style={{ padding: '10px 8px', color: '#2c3e50' }}>{item.assetName}</td>
                          <td style={{ padding: '10px 8px', color: '#2c3e50' }}>{item.pmDate}</td>
                          <td style={{ padding: '10px 8px', color: '#666', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                            {item.fileName}
                          </td>
                          {checklistItems.map((chkItem) => {
                            const value = item.checklistResults[chkItem.Checklist_ID];
                            return (
                              <td key={chkItem.Checklist_ID} style={{ 
                                padding: '10px 8px', 
                                textAlign: 'center',
                                color: value === 1 ? '#27ae60' : '#e74c3c',
                                fontWeight: '600',
                                fontSize: '0.85rem'
                              }}>
                                {value === 1 ? 'Yes(1)' : 'No(0)'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Failed Assets Section */}
            {successResults.failed.length > 0 && (
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ color: '#e74c3c', fontSize: '1.2rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={22} />
                  Failed to Import ({successResults.failed.length})
                </h3>
                <div style={{
                  maxHeight: '200px',
                  overflow: 'auto',
                  border: '1px solid #e74c3c',
                  borderRadius: '8px',
                  backgroundColor: '#fff5f5'
                }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.9rem'
                  }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fee', borderBottom: '2px solid #e74c3c' }}>
                      <tr>
                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#2c3e50' }}>Serial Number</th>
                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#2c3e50' }}>Tag ID</th>
                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#2c3e50' }}>Asset Name</th>
                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#2c3e50' }}>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {successResults.failed.map((item, index) => (
                        <tr key={index} style={{
                          backgroundColor: index % 2 === 0 ? '#fff5f5' : '#ffe6e6',
                          borderBottom: '1px solid #f5c6cb'
                        }}>
                          <td style={{ padding: '10px 8px', color: '#2c3e50' }}>{item.serialNumber}</td>
                          <td style={{ padding: '10px 8px', color: '#2c3e50' }}>{item.tagId}</td>
                          <td style={{ padding: '10px 8px', color: '#2c3e50' }}>{item.assetName}</td>
                          <td style={{ padding: '10px 8px', color: '#721c24', fontSize: '0.85rem' }}>{item.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Close Button */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '25px' }}>
              <button
                onClick={() => setShowSuccessModal(false)}
                style={{
                  padding: '12px 40px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#5568d3'}
                onMouseOut={(e) => e.target.style.background = '#667eea'}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* File Preview Modal */}
      {showFilePreview && previewFile && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '25px',
            maxWidth: '900px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '20px',
              paddingBottom: '15px',
              borderBottom: '2px solid #667eea'
            }}>
              <div>
                <h2 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '1.5rem' }}>
                  Preview File Before Upload
                </h2>
                {previewAssetInfo && (
                  <div style={{ 
                    background: '#e3f2fd', 
                    padding: '12px', 
                    borderRadius: '6px',
                    border: '1px solid #90caf9'
                  }}>
                    <p style={{ margin: '4px 0', fontSize: '0.95rem', color: '#1565c0' }}>
                      <strong>Serial Number:</strong> {previewAssetInfo.serialNumber}
                    </p>
                    <p style={{ margin: '4px 0', fontSize: '0.95rem', color: '#1565c0' }}>
                      <strong>Tag ID:</strong> {previewAssetInfo.tagId}
                    </p>
                    <p style={{ margin: '4px 0', fontSize: '0.95rem', color: '#1565c0' }}>
                      <strong>Asset Name:</strong> {previewAssetInfo.name}
                    </p>
                    <p style={{ margin: '4px 0', fontSize: '0.95rem', color: '#1565c0' }}>
                      <strong>Model:</strong> {previewAssetInfo.model || 'N/A'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* File Info */}
            <div style={{
              padding: '15px',
              background: '#f8f9fa',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <p style={{ margin: '5px 0', fontSize: '0.95rem', color: '#2c3e50' }}>
                <strong>File Name:</strong> {previewFile.name}
              </p>
              <p style={{ margin: '5px 0', fontSize: '0.95rem', color: '#2c3e50' }}>
                <strong>File Size:</strong> {(previewFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <p style={{ margin: '5px 0', fontSize: '0.95rem', color: '#2c3e50' }}>
                <strong>File Type:</strong> {previewFile.type || 'Unknown'}
              </p>
            </div>

            {/* Preview Area */}
            <div style={{
              marginBottom: '20px',
              border: '2px solid #ddd',
              borderRadius: '8px',
              overflow: 'hidden',
              minHeight: '500px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f5f5f5'
            }}>
              {previewFile.type === 'application/pdf' ? (
                <iframe
                  src={URL.createObjectURL(previewFile)}
                  style={{
                    width: '100%',
                    height: '500px',
                    border: 'none'
                  }}
                  title="PDF Preview"
                />
              ) : previewFile.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(previewFile)}
                  alt="Preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '500px',
                    objectFit: 'contain'
                  }}
                />
              ) : (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#666'
                }}>
                  <AlertCircle size={48} color="#999" style={{ marginBottom: '15px' }} />
                  <p style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '10px' }}>Preview not available</p>
                  <p style={{ fontSize: '0.95rem' }}>File type: {previewFile.type || 'Unknown'}</p>
                  <p style={{ fontSize: '0.9rem', color: '#999', marginTop: '10px' }}>You can still upload this file</p>
                </div>
              )}
            </div>

            {/* Warning Message */}
            <div style={{
              padding: '15px',
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}>
              <AlertCircle size={20} color="#856404" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ margin: '0 0 5px 0', fontWeight: '600', color: '#856404' }}>Please verify:</p>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#856404', lineHeight: '1.6' }}>
                  <li>The date in the document matches the PM date</li>
                  <li>The Tag ID in the document matches the asset Tag ID</li>
                  <li>The document is clear and readable</li>
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={cancelFileUpload}
                style={{
                  padding: '12px 30px',
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseOver={(e) => e.target.style.background = '#c0392b'}
                onMouseOut={(e) => e.target.style.background = '#e74c3c'}
              >
                Cancel
              </button>
              <button
                onClick={confirmFileUpload}
                style={{
                  padding: '12px 30px',
                  background: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseOver={(e) => e.target.style.background = '#229954'}
                onMouseOut={(e) => e.target.style.background = '#27ae60'}
              >
                <CheckCircle size={18} />
                Confirm & Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PMImport;
