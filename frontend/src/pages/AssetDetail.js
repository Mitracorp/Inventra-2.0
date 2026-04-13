import React, { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Package, FileText, Building2, Users, Wrench, 
  Calendar, CheckCircle, AlertCircle, Info, Monitor, Mouse, 
  Keyboard, Cable, Shield, Eye, ClipboardList, Trash2, Flag, FlagOff, Edit2
} from 'lucide-react';
import { API_URL } from '../config/api';
import apiService from '../services/apiService';
import toast from '../utils/toast';

const AssetDetail = () => {
  usePageTitle('Asset Details');
  const { assetId } = useParams();
  const navigate = useNavigate();
  const [assetData, setAssetData] = useState(null);
  const [pmRecords, setPmRecords] = useState([]);
  const [loadingPM, setLoadingPM] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deletingAck, setDeletingAck] = useState(false);
  const [isWideScreen, setIsWideScreen] = useState(window.innerWidth > 992);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagRemarks, setFlagRemarks] = useState('');
  const [updatingFlag, setUpdatingFlag] = useState(false);

  useEffect(() => {
    fetchAssetDetail();
    fetchPMRecords();

    // Handle responsive layout
    const handleResize = () => {
      setIsWideScreen(window.innerWidth > 992);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [assetId]);

  const fetchAssetDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Fetching asset detail for ID:', assetId);

      // Fetch complete asset information from backend
      const response = await fetch(`${API_URL}/assets/detail/${assetId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Asset Detail received:', data);
      console.log('Asset attributes:', {
        serial: data.Asset_Serial_Number,
        tag: data.Asset_Tag_ID,
        item: data.Item_Name,
        customer: data.Customer_Name,
        branch: data.Branch,
        category: data.Category,
        model: data.Model,
        windows: data.Windows,
        office: data.Microsoft_Office,
        software: data.Software,
        peripherals: data.Peripherals?.length || 0
      });
      setAssetData(data);
    } catch (err) {
      console.error('❌ Error fetching asset detail:', err);
      setError(err.message || 'Failed to load asset details');
    } finally {
      setLoading(false);
    }
  };

  const fetchPMRecords = async () => {
    try {
      setLoadingPM(true);
      
      // Fetch PM records for this asset
      const response = await fetch(`${API_URL}/pm/asset/${assetId}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('PM Records:', data);
        // Sort PM records by date (ascending - earliest date = PM 1)
        const sortedData = data.sort((a, b) => new Date(a.PM_Date) - new Date(b.PM_Date));
        setPmRecords(sortedData);
      } else {
        console.log('No PM records found or error fetching PM records');
        setPmRecords([]);
      }
    } catch (err) {
      console.error('Error fetching PM records:', err);
      setPmRecords([]);
    } finally {
      setLoadingPM(false);
    }
  };

  const handleStartPMNow = () => {
    if (!assetData) return;

    const query = new URLSearchParams();
    if (assetData.Customer_Name) query.set('customer', assetData.Customer_Name);
    if (assetData.Branch) query.set('branch', assetData.Branch);
    if (assetData.Asset_ID) query.set('assetId', String(assetData.Asset_ID));
    const searchHint = assetData.Asset_Tag_ID || assetData.Asset_Serial_Number || '';
    if (searchHint) query.set('search', searchHint);

    navigate(`/maintenance?${query.toString()}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-MY', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getStatusBadgeStyle = (status) => {
    const styles = {
      'Active': { backgroundColor: '#d4edda', color: '#155724', border: '1px solid #c3e6cb' },
      'Inactive': { backgroundColor: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb' },
      'Under Repair': { backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba' },
      'Retired': { backgroundColor: '#e2e3e5', color: '#383d41', border: '1px solid #d6d8db' }
    };
    return styles[status] || styles['Active'];
  };

  const getPeripheralIcon = (type) => {
    const icons = {
      'Keyboard': <Keyboard size={20} />,
      'Mouse': <Mouse size={20} />,
      'Monitor': <Monitor size={20} />,
      'Ethernet Cable': <Cable size={20} />,
      'Power Cable': <Cable size={20} />
    };
    return icons[type] || <Package size={20} />;
  };

  const handleDeleteAcknowledgement = async (pmId) => {
    if (!window.confirm('Are you sure you want to delete this acknowledgement file? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingAck(true);

      const response = await fetch(`${API_URL}/pm/${pmId}/delete-acknowledgement`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Delete failed');
      }

      toast.success('Acknowledgement deleted successfully!');
      
      // Refresh PM records to update UI
      fetchPMRecords();
    } catch (err) {
      console.error('Error deleting acknowledgement:', err);
      toast.error(err.message || 'Failed to delete file. Please try again.');
    } finally {
      setDeletingAck(false);
    }
  };

  const handleDeleteAsset = async () => {
    if (!assetData?.Asset_ID) return;

    const confirmed = window.confirm('Delete this asset? This will remove inventory rows, software links, peripherals, and PM records/results.');
    if (!confirmed) return;

    setDeleting(true);
    try {
      const response = await apiService.deleteAssetById(assetData.Asset_ID);
      const data = response.data || {};

      const parts = [];
      if (data.peripherals_deleted > 0) parts.push(`Peripherals: ${data.peripherals_deleted}`);
      if (data.pm_records_deleted > 0) parts.push(`PM Records: ${data.pm_records_deleted}`);
      if (data.pm_results_deleted > 0) parts.push(`PM Results: ${data.pm_results_deleted}`);
      if (data.software_links_deleted > 0) parts.push(`Software Links: ${data.software_links_deleted}`);
      if (data.inventory_deleted > 0) parts.push(`Inventory Deleted: ${data.inventory_deleted}`);
      if (data.inventory_nulled > 0) parts.push(`Inventory Preserved: ${data.inventory_nulled}`);

      const message = parts.length > 0 
        ? `Deleted asset. ${parts.join(', ')}` 
        : 'Deleted asset successfully';

      navigate('/assets', {
        state: {
          refresh: true,
          message
        },
        replace: false
      });
    } catch (err) {
      console.error('Error deleting asset:', err);
      toast.error(err.message || 'Failed to delete asset');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleFlag = async (flag) => {
    if (flag && !flagRemarks.trim()) {
      toast.error('Please enter remarks before flagging the asset');
      return;
    }

    setUpdatingFlag(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/assets/id/${assetData.Asset_ID}/flag`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          Is_Flagged: flag ? 1 : 0,
          Flag_Remarks: flag ? flagRemarks : null,
          Flagged_By: 'Current User' // Replace with actual user from auth context
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update flag status');
      }

      const data = await response.json();
      
      // Update local state
      if (flag) {
        setAssetData({
          ...assetData,
          Is_Flagged: 1,
          Flag_Remarks: flagRemarks,
          Flag_Date: new Date().toISOString(),
          Flagged_By: 'Current User'
        });
      } else {
        // When unflagging, clear all flag-related fields
        const updatedData = { ...assetData };
        updatedData.Is_Flagged = 0;
        updatedData.Flag_Remarks = null;
        updatedData.Flag_Date = null;
        updatedData.Flagged_By = null;
        setAssetData(updatedData);
      }

      setShowFlagModal(false);
      setFlagRemarks('');
      
      toast.success(data.message || (flag ? 'Asset flagged successfully' : 'Asset unflagged successfully'));
    } catch (err) {
      console.error('Error updating flag:', err);
      toast.error('Failed to update flag status');
    } finally {
      setUpdatingFlag(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <button onClick={() => navigate('/assets')} className="btn btn-secondary">
            <ArrowLeft size={16} style={{ marginRight: '5px' }} />
            Back
          </button>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '1.2rem', color: '#666' }}>
            Loading asset details...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="page-header">
          <button onClick={() => navigate('/assets')} className="btn btn-secondary">
            <ArrowLeft size={16} style={{ marginRight: '5px' }} />
            Back
          </button>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <AlertCircle size={48} color="#e74c3c" style={{ marginBottom: '20px' }} />
          <h3 style={{ color: '#e74c3c', marginBottom: '10px' }}>Error Loading Asset</h3>
          <p style={{ color: '#666', marginBottom: '20px' }}>{error}</p>
          <button onClick={fetchAssetDetail} className="btn btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!assetData) {
    return (
      <div className="page-container">
        <div className="page-header">
          <button onClick={() => navigate('/assets')} className="btn btn-secondary">
            <ArrowLeft size={16} style={{ marginRight: '5px' }} />
            Back
          </button>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Info size={48} color="#95a5a6" style={{ marginBottom: '20px' }} />
          <h3 style={{ color: '#666' }}>Asset Not Found</h3>
        </div>
      </div>
    );
  }

  const pmCompletedCount = pmRecords.filter((pm) => String(pm.Status || '').toLowerCase() === 'completed').length;
  const hasPM = pmRecords.length > 0;
  const latestPMDate = hasPM ? pmRecords[pmRecords.length - 1]?.PM_Date : null;

  return (
    <div className="page-container">
      {/* Header with Back Button */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <button onClick={() => navigate('/assets')} className="btn btn-secondary" style={{ marginBottom: '10px' }}>
            <ArrowLeft size={16} style={{ marginRight: '5px' }} />
            Back
          </button>
          <h1 className="page-title" style={{ marginTop: '10px', marginBottom: '5px' }}>Asset Details</h1>
          <p style={{ color: '#7f8c8d', fontSize: '0.9rem', margin: 0 }}>
            Complete overview of {assetData.Asset_Tag_ID || 'Asset'}
          </p>
        </div>
        <div className="actions">
          {assetData.Is_Flagged !== 1 && (
            <button 
              onClick={() => {
                setFlagRemarks('');
                setShowFlagModal(true);
              }}
              className="btn btn-warning"
              style={{ marginRight: '10px', backgroundColor: '#f39c12', borderColor: '#f39c12' }}
              title="Flag asset"
            >
              <Flag size={18} />
            </button>
          )}
          <Link to={`/edit-asset/${assetData.Asset_ID}`} className="btn btn-primary">
            Edit Asset
          </Link>
        </div>
      </div>

      {/* Flag Alert Banner */}
      {assetData.Is_Flagged === 1 && (
        <div className="card" style={{ 
          marginBottom: '20px', 
          background: '#fff3cd', 
          border: '2px solid #f39c12',
          borderLeft: '6px solid #f39c12'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', flex: 1 }}>
              <Flag size={32} color="#f39c12" style={{ flexShrink: 0, marginTop: '5px' }} />
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AlertCircle size={20} />
                  Flagged Asset
                </h3>
                <div style={{ color: '#856404', marginBottom: '8px' }}>
                  <strong>Remarks:</strong> {assetData.Flag_Remarks || 'No remarks provided'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexShrink: 0, alignSelf: 'flex-start' }}>
              <button 
                onClick={() => {
                  setFlagRemarks(assetData.Flag_Remarks || '');
                  setShowFlagModal(true);
                }}
                className="btn btn-warning"
                style={{ 
                  backgroundColor: '#f39c12', 
                  borderColor: '#f39c12'
                }}
                disabled={updatingFlag}
                title="Edit flag remarks"
              >
                <Edit2 size={16} style={{ marginRight: '5px' }} />
                Edit Remarks
              </button>
              <button 
                onClick={() => handleToggleFlag(false)}
                className="btn"
                style={{ 
                  backgroundColor: '#95a5a6',
                  borderColor: '#95a5a6',
                  color: 'white'
                }}
                disabled={updatingFlag}
                title="Unflag asset"
              >
                <FlagOff size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Overview Card */}
      <div className="card" style={{ marginBottom: '20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
              <Package size={40} />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.8rem' }}>{assetData.Item_Name || 'N/A'}</h2>
                <p style={{ margin: '5px 0 0 0', opacity: 0.9, fontSize: '1rem' }}>
                  {assetData.Asset_Tag_ID || 'No Tag ID'}
                </p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginTop: '20px' }}>
              <div>
                <div style={{ opacity: 0.8, fontSize: '0.85rem', marginBottom: '5px' }}>Serial Number</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>{assetData.Asset_Serial_Number || 'N/A'}</div>
              </div>
              <div>
                <div style={{ opacity: 0.8, fontSize: '0.85rem', marginBottom: '5px' }}>Category</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>{assetData.Category || 'N/A'}</div>
              </div>
              <div>
                <div style={{ opacity: 0.8, fontSize: '0.85rem', marginBottom: '5px' }}>Model</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>{assetData.Model || 'N/A'}</div>
              </div>
            </div>
          </div>
          <div style={{ 
            padding: '12px 24px', 
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '1rem',
            ...getStatusBadgeStyle(assetData.Status)
          }}>
            {assetData.Status || 'Unknown'}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
        
        {/* Asset Specifications */}
        <div className="card">
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            marginBottom: '20px',
            paddingBottom: '15px',
            borderBottom: '2px solid #9b59b6'
          }}>
            <Monitor size={24} color="#9b59b6" />
            <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.2rem' }}>Asset Specifications</h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
                  Windows
                </div>
                <div style={{ color: '#2c3e50', fontSize: '1rem' }}>
                  {assetData.Windows || 'N/A'}
                </div>
              </div>
              <div>
                <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
                  Microsoft Office
                </div>
                <div style={{ color: '#2c3e50', fontSize: '1rem' }}>
                  {assetData.Microsoft_Office || 'N/A'}
                </div>
              </div>
            </div>

            <div>
              <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
                <Shield size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Antivirus
              </div>
              <div style={{ color: '#2c3e50', fontSize: '1rem' }}>
                {assetData.Antivirus || 'N/A'}
              </div>
            </div>

            <div>
              <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
                Software Installed
              </div>
              <div style={{ 
                color: '#2c3e50', 
                fontSize: '0.9rem', 
                lineHeight: '1.6',
                padding: '10px',
                background: '#f8f9fa',
                borderRadius: '6px',
                border: '1px solid #e9ecef',
                maxHeight: '100px',
                overflowY: 'auto'
              }}>
                {assetData.Software || 'No software installed'}
              </div>
            </div>

            {assetData.Software_Prices && (
              <div>
                <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
                  Software Prices
                </div>
                <div style={{ color: '#2c3e50', fontSize: '0.95rem' }}>
                  {assetData.Software_Prices.split(',').map((p, idx) => {
                    const price = parseFloat(p.trim());
                    return isNaN(price) ? '' : `RM ${price.toFixed(2)}`;
                  }).filter(p => p).join(', ') || 'N/A'}
                </div>
              </div>
            )}

            {/* Model Specifications Section */}
            {assetData.ModelSpecifications && assetData.ModelSpecifications.length > 0 && (
              <div>
                <div style={{ 
                  color: '#7f8c8d', 
                  fontSize: '0.85rem', 
                  marginBottom: '15px', 
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <ClipboardList size={18} style={{ color: '#667eea' }} />
                  Model Technical Specifications
                  <span style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '700'
                  }}>
                    {assetData.ModelSpecifications.length}
                  </span>
                </div>
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '15px'
                }}>
                  {assetData.ModelSpecifications.map((spec, index) => (
                    <div 
                      key={spec.Attributes_ID || index}
                      style={{
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                        border: '2px solid #e9ecef',
                        borderLeft: '4px solid #667eea',
                        borderRadius: '10px',
                        padding: '18px',
                        transition: 'all 0.3s ease',
                        cursor: 'default',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.2)';
                        e.currentTarget.style.borderLeftColor = '#5a67d8';
                        e.currentTarget.style.borderColor = '#667eea';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.borderLeftColor = '#667eea';
                        e.currentTarget.style.borderColor = '#e9ecef';
                      }}
                    >
                      {/* Decorative corner accent */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '60px',
                        height: '60px',
                        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, transparent 100%)',
                        borderRadius: '0 10px 0 100%'
                      }} />
                      
                      <div style={{
                        color: '#667eea',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        marginBottom: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        position: 'relative',
                        zIndex: 1
                      }}>
                        {spec.Attribute_Name}
                      </div>
                      <div style={{
                        color: '#2d3748',
                        fontSize: '0.95rem',
                        lineHeight: '1.6',
                        fontWeight: '500',
                        wordBreak: 'break-word',
                        position: 'relative',
                        zIndex: 1,
                        minHeight: '24px'
                      }}>
                        {spec.Attributes_Value || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Not specified</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy Specs_Attributes for backward compatibility */}
            {assetData.Specs_Attributes && !assetData.ModelSpecifications && (
              <div>
                <div style={{ 
                  color: '#7f8c8d', 
                  fontSize: '0.85rem', 
                  marginBottom: '15px', 
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Technical Specifications
                </div>
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '12px'
                }}>
                  {assetData.Specs_Attributes.split('; ').map((spec, index) => {
                    const [name, ...valueParts] = spec.split(': ');
                    const value = valueParts.join(': '); // Rejoin in case value contains ':'
                    
                    return (
                      <div 
                        key={index}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e0e0e0',
                          borderLeft: '3px solid #667eea',
                          borderRadius: '6px',
                          padding: '14px',
                          transition: 'all 0.2s ease',
                          cursor: 'default',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.15)';
                          e.currentTarget.style.borderLeftColor = '#5a67d8';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.borderLeftColor = '#667eea';
                        }}
                      >
                        <div style={{
                          color: '#4a5568',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          marginBottom: '8px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {name}
                        </div>
                        <div style={{
                          color: '#2d3748',
                          fontSize: '0.85rem',
                          lineHeight: '1.5',
                          fontWeight: '400',
                          wordBreak: 'break-word'
                        }}>
                          {value || 'Not specified'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {assetData.Monthly_Prices && parseFloat(assetData.Monthly_Prices) > 0 && (
              <div>
                <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
                  Monthly Price
                </div>
                <div style={{ 
                  color: '#27ae60', 
                  fontSize: '1.3rem', 
                  fontWeight: '600' 
                }}>
                  RM {parseFloat(assetData.Monthly_Prices).toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Project, Customer & Recipient Information - Stacked Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Project Information Card */}
          <div className="card">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '15px',
              paddingBottom: '12px',
              borderBottom: '2px solid #3498db'
            }}>
              <FileText size={20} color="#3498db" />
              <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.1rem' }}>Project Information</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
                  Project Reference
                </div>
                <div style={{ color: '#2c3e50', fontSize: '0.95rem' }}>
                  {assetData.Project_Ref_Number || 'N/A'}
                </div>
              </div>
              
              <div>
                <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
                  Project Title
                </div>
                <div style={{ color: '#2c3e50', fontSize: '0.95rem', lineHeight: '1.6' }}>
                  {assetData.Project_Title || 'N/A'}
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
                    Start Date
                  </div>
                  <div style={{ color: '#2c3e50', fontSize: '0.95rem' }}>
                    <Calendar size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                    {assetData.Start_Date ? new Date(assetData.Start_Date).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
                
                <div>
                  <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
                    End Date
                  </div>
                  <div style={{ color: '#2c3e50', fontSize: '0.95rem' }}>
                    <Calendar size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                    {assetData.End_Date ? new Date(assetData.End_Date).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>
              
              <div>
                <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
                  <Shield size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                  Warranty
                </div>
                <div style={{ color: '#2c3e50', fontSize: '0.95rem' }}>
                  {assetData.Warranty || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Customer Information Card */}
          <div className="card">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '15px',
              paddingBottom: '12px',
              borderBottom: '2px solid #e74c3c'
            }}>
              <Building2 size={20} color="#e74c3c" />
              <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.1rem' }}>Customer Information</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
                  Customer Name
                </div>
                <div style={{ color: '#2c3e50', fontSize: '0.95rem', fontWeight: '600' }}>
                  {assetData.Customer_Name || 'N/A'}
                </div>
              </div>
              
              <div>
                <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
                  Reference
                </div>
                <div style={{ color: '#2c3e50', fontSize: '0.95rem' }}>
                  {assetData.Customer_Ref_Number || 'N/A'}
                </div>
              </div>
              
              <div>
                <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
                  Branch / Location
                </div>
                <div style={{ color: '#2c3e50', fontSize: '0.95rem' }}>
                  {assetData.Branch || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Recipient Information Card */}
          <div className="card">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '15px',
              paddingBottom: '12px',
              borderBottom: '2px solid #9b59b6'
            }}>
              <Users size={20} color="#9b59b6" />
              <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.1rem' }}>Recipient Information</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
                  Recipient Name
                </div>
                <div style={{ color: '#2c3e50', fontSize: '0.95rem', fontWeight: '600' }}>
                  {assetData.Recipient_Name || 'N/A'}
                </div>
              </div>
              <div>
                <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
                  Department
                </div>
                <div style={{ color: '#2c3e50', fontSize: '0.95rem' }}>
                  {assetData.Department || 'N/A'}
                </div>
              </div>
              <div>
                <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
                  Position
                </div>
                <div style={{ color: '#2c3e50', fontSize: '0.95rem' }}>
                  {assetData.Position || 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preventive Maintenance Information */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '18px',
          paddingBottom: '14px',
          borderBottom: '2px solid #4f46e5',
          flexWrap: 'wrap'
        }}>
          <h3 style={{ margin: 0, color: '#1f2937', fontSize: '1.2rem' }}>Service Completion & Quick Actions</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleStartPMNow}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <Wrench size={16} />
              PM Now
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          <div style={{ border: '1px solid #d1fae5', borderRadius: '10px', padding: '14px', background: '#f0fdf4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontWeight: 700, color: '#166534' }}>PM Status</span>
              <span style={{
                background: hasPM ? '#16a34a' : '#9ca3af',
                color: 'white',
                borderRadius: '999px',
                padding: '2px 10px',
                fontSize: '0.78rem',
                fontWeight: 700
              }}>
                {hasPM ? 'DONE' : 'PENDING'}
              </span>
            </div>
            <div style={{ color: '#14532d', fontSize: '0.92rem', lineHeight: 1.7 }}>
              <div>Total records: <strong>{pmRecords.length}</strong></div>
              <div>Completed: <strong>{pmCompletedCount}</strong></div>
              <div>Latest PM: <strong>{latestPMDate ? formatDate(latestPMDate) : 'N/A'}</strong></div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', 
          marginBottom: '20px',
          paddingBottom: '15px',
          borderBottom: '2px solid #27ae60'
        }}>
          <Wrench size={24} color="#27ae60" />
          <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.2rem' }}>Preventive Maintenance</h3>
        </div>
        
        {/* PM Schedule Description */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ 
            margin: '0 0 12px 0', 
            color: '#2c3e50', 
            fontSize: '1rem', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Calendar size={18} color="#27ae60" />
            Maintenance Schedule
          </h4>
          <div style={{ 
            padding: '15px', 
            background: '#f0f9f4', 
            borderRadius: '8px',
            border: '1px solid #c3e6cb',
            lineHeight: '1.8',
            color: '#2c3e50'
          }}>
            {assetData.Preventive_Maintenance || 'No preventive maintenance schedule available'}
          </div>
        </div>

        {/* PM Records Table */}
        <div>
          <h4 style={{ 
            margin: '0 0 15px 0', 
            color: '#2c3e50', 
            fontSize: '1rem', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <ClipboardList size={18} color="#27ae60" />
            PM Records ({pmRecords.length})
          </h4>

          {loadingPM ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px', 
              background: '#f8f9fa',
              borderRadius: '8px'
            }}>
              <p style={{ color: '#666', margin: 0 }}>Loading PM records...</p>
            </div>
          ) : pmRecords.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px', 
              background: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}>
              <ClipboardList size={48} color="#95a5a6" style={{ marginBottom: '15px' }} />
              <h4 style={{ color: '#7f8c8d', margin: '0 0 10px 0' }}>No PM Records</h4>
              <p style={{ color: '#95a5a6', margin: 0, fontSize: '0.9rem' }}>
                No preventive maintenance has been recorded for this asset yet
              </p>
            </div>
          ) : (
            <div style={{ 
              border: '1px solid #e9ecef', 
              borderRadius: '8px', 
              overflow: 'hidden' 
            }}>
              <table className="table" style={{ marginBottom: 0 }}>
                <thead style={{ background: '#f8f9fa' }}>
                  <tr>
                    <th style={{ width: '80px', textAlign: 'center' }}>#</th>
                    <th>PM Record</th>
                    <th style={{ width: '150px' }}>Date</th>
                    <th style={{ width: '120px' }}>Status</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                    <th style={{ width: '140px', textAlign: 'center' }}>Acknowledgement</th>
                  </tr>
                </thead>
                <tbody>
                  {pmRecords.map((pm, index) => (
                    <tr key={pm.PM_ID}>
                      <td style={{ textAlign: 'center', fontWeight: '600', color: '#7f8c8d' }}>
                        {index + 1}
                      </td>
                      <td>
                        <div style={{ fontWeight: '600', color: '#2c3e50', marginBottom: '4px' }}>
                          Preventive Maintenance {index + 1}
                        </div>
                        {pm.Remarks && (
                          <div style={{ fontSize: '0.85rem', color: '#7f8c8d', fontStyle: 'italic' }}>
                            {pm.Remarks}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={14} color="#666" />
                          <span>{formatDate(pm.PM_Date)}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            background: pm.Status === 'Completed' ? '#d4edda' : '#d1ecf1',
                            color: pm.Status === 'Completed' ? '#155724' : '#0c5460',
                            border: pm.Status === 'Completed' ? '1px solid #c3e6cb' : '1px solid #bee5eb',
                            display: 'inline-block'
                          }}>
                            {pm.Status || 'In-Process'}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => navigate(`/maintenance/detail/${pm.PM_ID}`)}
                          style={{
                            padding: '6px 14px',
                            background: '#3498db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'background 0.2s'
                          }}
                          onMouseOver={(e) => e.target.style.background = '#2980b9'}
                          onMouseOut={(e) => e.target.style.background = '#3498db'}
                        >
                          <Eye size={14} />
                          Details
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {pm.file_path_acknowledgement ? (
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                            <button
                              onClick={() => {
                                const baseUrl = API_URL.replace('/api/v1', '');
                                const fileUrl = `${baseUrl}/${pm.file_path_acknowledgement}`;
                                window.open(fileUrl, '_blank');
                              }}
                              style={{
                                padding: '6px 14px',
                                background: '#27ae60',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'background 0.2s'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = '#229954'}
                              onMouseOut={(e) => e.currentTarget.style.background = '#27ae60'}
                            >
                              <Eye size={14} />
                              View
                            </button>
                            <button
                              onClick={() => handleDeleteAcknowledgement(pm.PM_ID)}
                              disabled={deletingAck}
                              style={{
                                padding: '6px',
                                background: 'white',
                                color: '#e74c3c',
                                border: '2px solid #e74c3c',
                                borderRadius: '6px',
                                cursor: deletingAck ? 'not-allowed' : 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                transition: 'all 0.2s',
                                opacity: deletingAck ? 0.6 : 1
                              }}
                              onMouseOver={(e) => {
                                if (!deletingAck) {
                                  e.currentTarget.style.background = '#e74c3c';
                                  e.currentTarget.style.color = 'white';
                                }
                              }}
                              onMouseOut={(e) => {
                                if (!deletingAck) {
                                  e.currentTarget.style.background = 'white';
                                  e.currentTarget.style.color = '#e74c3c';
                                }
                              }}
                              title="Delete Acknowledgement"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: '#95a5a6', fontSize: '0.85rem', fontStyle: 'italic' }}>
                            No file
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Peripherals Information */}
      {assetData.Peripherals && assetData.Peripherals.length > 0 && (
        <div className="card">
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            marginBottom: '20px',
            paddingBottom: '15px',
            borderBottom: '2px solid #f39c12'
          }}>
            <Package size={24} color="#f39c12" />
            <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.2rem' }}>
              Peripherals ({assetData.Peripherals.length})
            </h3>
          </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
            gap: '15px' 
          }}>
            {assetData.Peripherals.map((peripheral, index) => (
              <div 
                key={index}
                style={{
                  padding: '15px',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'default'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ color: '#f39c12' }}>
                    {getPeripheralIcon(peripheral.Peripheral_Type_Name)}
                  </div>
                  <div style={{ fontWeight: '600', color: '#2c3e50', fontSize: '1rem' }}>
                    {peripheral.Peripheral_Type_Name || 'Unknown Type'}
                  </div>
                </div>
                
                {peripheral.Serial_Code && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ color: '#7f8c8d', fontSize: '0.75rem', marginBottom: '3px' }}>
                      Serial Code
                    </div>
                    <div style={{ color: '#2c3e50', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                      {peripheral.Serial_Code}
                    </div>
                  </div>
                )}
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '10px' }}>
                  {peripheral.Condition === 'Good' ? (
                    <CheckCircle size={16} color="#27ae60" />
                  ) : (
                    <AlertCircle size={16} color="#e74c3c" />
                  )}
                  <span style={{ 
                    color: peripheral.Condition === 'Good' ? '#27ae60' : '#e74c3c',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}>
                    {peripheral.Condition || 'Unknown'}
                  </span>
                </div>
                
                {peripheral.Remarks && (
                  <div style={{ 
                    marginTop: '10px', 
                    paddingTop: '10px', 
                    borderTop: '1px solid #dee2e6',
                    fontSize: '0.85rem',
                    color: '#666',
                    fontStyle: 'italic'
                  }}>
                    {peripheral.Remarks}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Peripherals Message */}
      {(!assetData.Peripherals || assetData.Peripherals.length === 0) && (
        <div className="card" style={{ textAlign: 'center', padding: '40px', background: '#f8f9fa' }}>
          <Package size={48} color="#95a5a6" style={{ marginBottom: '15px' }} />
          <h4 style={{ color: '#7f8c8d', margin: '0 0 10px 0' }}>No Peripherals</h4>
          <p style={{ color: '#95a5a6', margin: 0, fontSize: '0.9rem' }}>
            This asset has no registered peripherals
          </p>
        </div>
      )}

      {/* Delete action at very bottom, after peripherals */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: '40px',
          paddingTop: '20px',
          paddingBottom: '40px',
          borderTop: '1px solid #e0e0e0'
        }}
      >
        <button
          onClick={handleDeleteAsset}
          disabled={deleting}
          style={{
            background: deleting ? '#c0392b' : 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
            color: 'white',
            border: 'none',
            padding: '12px 22px',
            borderRadius: '8px',
            cursor: deleting ? 'not-allowed' : 'pointer',
            fontSize: '15px',
            fontWeight: '700',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: deleting ? 'none' : '0 3px 8px rgba(231, 76, 60, 0.35)',
            opacity: deleting ? 0.85 : 1,
            minWidth: '200px',
            justifyContent: 'center'
          }}
          title="Delete this asset"
        >
          {deleting ? 'Deleting...' : 'Delete Asset'}
        </button>
      </div>

      {/* Flag Asset Modal */}
      {showFlagModal && (
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
          <div className="card" style={{
            maxWidth: '500px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px',
              paddingBottom: '15px',
              borderBottom: '2px solid #f39c12'
            }}>
              <Flag size={24} color="#f39c12" />
              <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.3rem' }}>
                {assetData.Is_Flagged === 1 ? 'Edit Flag Remarks' : 'Flag Asset'}
              </h3>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#2c3e50',
                fontWeight: '600',
                fontSize: '0.95rem'
              }}>
                Remarks <span style={{ color: '#e74c3c' }}>*</span>
              </label>
              <textarea
                value={flagRemarks}
                onChange={(e) => setFlagRemarks(e.target.value)}
                placeholder="Enter remarks for flagging this asset..."
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
              <small style={{ color: '#7f8c8d', fontSize: '0.85rem' }}>
                Please provide detailed remarks explaining why this asset is being flagged
              </small>
            </div>

            <div style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowFlagModal(false);
                  setFlagRemarks('');
                }}
                className="btn btn-secondary"
                disabled={updatingFlag}
              >
                Cancel
              </button>
              <button
                onClick={() => handleToggleFlag(true)}
                className="btn btn-warning"
                style={{ backgroundColor: '#f39c12', borderColor: '#f39c12' }}
                disabled={updatingFlag || !flagRemarks.trim()}
              >
                {updatingFlag ? (assetData.Is_Flagged === 1 ? 'Updating...' : 'Flagging...') : (assetData.Is_Flagged === 1 ? 'Update Remarks' : 'Flag Asset')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetDetail;
