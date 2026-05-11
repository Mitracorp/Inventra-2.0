import React, { useState, useEffect, useRef } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, CheckCircle, X, Calendar, FileText, Package, 
  Wrench, AlertTriangle, ClipboardCheck, Download, Upload, Eye, Trash2, PenTool
} from 'lucide-react';
import PMReportDownload from '../components/PMReportDownload';
import SignatureModal from '../components/SignatureModal';
import { API_URL } from '../config/api';
import toast from '../utils/toast';

const PMDetail = () => {
  usePageTitle('PM Details');
  const { pmId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const returnToQuery = new URLSearchParams(location.search).get('returnTo');
  const backDestination = location.state?.from || returnToQuery;

  const handleBackNavigation = () => {
    if (backDestination) {
      navigate(backDestination);
      return;
    }
    navigate('/maintenance');
  };
  const [pmData, setPmData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Upload states
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [deletingAck, setDeletingAck] = useState(false);
  
  // Signature modal states
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureMessage, setSignatureMessage] = useState(null);

  // Mark as Completed states
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    fetchPMDetail();
  }, [pmId]);
  
  // Auto-show signature modal after PM submission (when navigated from PM form)
  useEffect(() => {
    if (pmData && !pmData.signature_path && !pmData.file_path_acknowledgement && pmData.Status !== 'Marked as Completed' && location.state?.fromPMSubmission) {
      // Small delay to ensure page is loaded
      setTimeout(() => {
        setShowSignatureModal(true);
      }, 500);
    }
  }, [pmData, location.state]);

  const fetchPMDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/detail/${pmId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('PM Detail:', data);
      setPmData(data);
    } catch (err) {
      console.error('Error fetching PM detail:', err);
      setError(err.message || 'Failed to load PM details');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-MY', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getCheckResultIcon = (isOk) => {
    if (isOk === 1 || isOk === true) {
      return <CheckCircle size={20} color="#27ae60" />;
    } else {
      return <X size={20} color="#e74c3c" />;
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/${pmId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete PM record');
      }

      toast.success('PM record deleted successfully');
      handleBackNavigation();
    } catch (err) {
      console.error('Error deleting PM record:', err);
      toast.error('Failed to delete PM record. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Mark as Completed handlers
  const handleMarkClick = () => {
    setShowMarkModal(true);
  };

  const handleCancelMark = () => {
    setShowMarkModal(false);
  };

  const handleConfirmMark = async () => {
    setMarking(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/${pmId}/mark-completed`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to mark PM as completed');
      }

      toast.success('PM marked as completed successfully');
      await fetchPMDetail(); // Refresh PM data
    } catch (err) {
      console.error('Error marking PM as completed:', err);
      toast.error('Failed to mark PM as completed. Please try again.');
    } finally {
      setMarking(false);
      setShowMarkModal(false);
    }
  };

  const handleViewAcknowledgement = () => {
    if (pmData.file_path_acknowledgement) {
      // Remove /api/v1 from API_URL to get base URL for static files
      const baseUrl = API_URL.replace('/api/v1', '');
      const fileUrl = `${baseUrl}/${pmData.file_path_acknowledgement}`;
      window.open(fileUrl, '_blank');
    }
  };

  const handleDeleteAcknowledgement = async () => {
    if (!window.confirm('Are you sure you want to delete this acknowledgement file? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingAck(true);
      setUploadMessage(null);

      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/${pmId}/delete-acknowledgement`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Delete failed');
      }

      setUploadMessage({ 
        type: 'success', 
        text: 'Acknowledgement deleted successfully!' 
      });
      
      // Refresh PM data to update UI
      fetchPMDetail();
      
      // Clear message after 5 seconds
      setTimeout(() => setUploadMessage(null), 5000);
    } catch (err) {
      console.error('Error deleting acknowledgement:', err);
      setUploadMessage({ 
        type: 'error', 
        text: err.message || 'Failed to delete file. Please try again.' 
      });
      setTimeout(() => setUploadMessage(null), 5000);
    } finally {
      setDeletingAck(false);
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      setUploadMessage({ type: 'error', text: 'Please select a PDF file' });
      setTimeout(() => setUploadMessage(null), 4000);
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadMessage({ type: 'error', text: 'File size must be less than 10MB' });
      setTimeout(() => setUploadMessage(null), 4000);
      return;
    }

    try {
      setUploading(true);
      setUploadMessage(null);

      const formData = new FormData();
      formData.append('acknowledgement', file);

      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/${pmId}/upload-acknowledgement`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Upload failed');
      }

      setUploadMessage({ 
        type: 'success', 
        text: 'Acknowledgement uploaded successfully!' 
      });
      
      // Refresh PM data to show updated file path
      fetchPMDetail();
      
      // Clear message after 5 seconds
      setTimeout(() => setUploadMessage(null), 5000);
    } catch (err) {
      console.error('Error uploading acknowledgement:', err);
      setUploadMessage({ 
        type: 'error', 
        text: err.message || 'Failed to upload file. Please try again.' 
      });
      setTimeout(() => setUploadMessage(null), 5000);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const handleOpenSignatureModal = () => {
    setShowSignatureModal(true);
  };
  
  const handleCloseSignatureModal = () => {
    setShowSignatureModal(false);
  };
  
  const handleConfirmSignature = async (payload) => {
    try {
      const token = localStorage.getItem('authToken');
      // Support both legacy string and structured payload
      const signatureBase64 = typeof payload === 'string' ? payload : payload.signature;
      const bagiPihak = (typeof payload === 'object' && payload.onBehalf && payload.name)
        ? `${payload.name}\\${payload.department || '-'}`
        : undefined;
      const response = await fetch(`${API_URL}/pm/${pmId}/signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          signature: signatureBase64,
          ...(bagiPihak ? { bagiPihak } : {})
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save signature');
      }
      
      setSignatureMessage({
        type: 'success',
        text: typeof payload === 'object' && payload?.fromFullName
          ? 'Recipient full name signature saved successfully! Status updated to Completed.'
          : 'Signature saved successfully! Status updated to Completed.'
      });
      
      // Close modal
      setShowSignatureModal(false);
      
      // Refresh PM data to show signature and updated Status
      await fetchPMDetail();
      
      // Clear message after 5 seconds
      setTimeout(() => setSignatureMessage(null), 5000);
    } catch (err) {
      console.error('Error saving signature:', err);
      throw err; // Re-throw to be handled by modal
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <button onClick={handleBackNavigation} className="btn btn-secondary">
            <ArrowLeft size={16} style={{ marginRight: '5px' }} />
            Back
          </button>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <p style={{ color: '#666', fontSize: '1.1rem' }}>Loading PM details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="page-header">
          <button onClick={handleBackNavigation} className="btn btn-secondary">
            <ArrowLeft size={16} style={{ marginRight: '5px' }} />
            Back
          </button>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <AlertTriangle size={48} color="#e74c3c" style={{ marginBottom: '15px' }} />
          <h3 style={{ color: '#e74c3c', marginBottom: '10px' }}>Error Loading PM Details</h3>
          <p style={{ color: '#666' }}>{error}</p>
          <button onClick={fetchPMDetail} className="btn btn-primary" style={{ marginTop: '20px' }}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!pmData) {
    return (
      <div className="page-container">
        <div className="page-header">
          <button onClick={handleBackNavigation} className="btn btn-secondary">
            <ArrowLeft size={16} style={{ marginRight: '5px' }} />
            Back
          </button>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <FileText size={48} color="#95a5a6" style={{ marginBottom: '15px' }} />
          <h3 style={{ color: '#666' }}>PM Record Not Found</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <button 
            onClick={handleBackNavigation}
            style={{
              padding: '10px 20px',
              background: 'white',
              color: '#667eea',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
              marginBottom: '10px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
            }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <h1 className="page-title" style={{ marginTop: '10px', marginBottom: '5px' }}>
            Preventive Maintenance Details
          </h1>
          <p style={{ color: '#7f8c8d', fontSize: '0.9rem', margin: 0 }}>
            PM Record #{pmData.PM_ID}
          </p>
        </div>
        
        {/* Upload or View Recipient Acknowledgement Button */}
        {pmData.file_path_acknowledgement ? (
          // View and Delete Buttons - when file exists
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              onClick={handleDeleteAcknowledgement}
              disabled={deletingAck}
              style={{
                padding: '12px',
                background: 'white',
                color: '#e74c3c',
                border: '2px solid #e74c3c',
                borderRadius: '8px',
                cursor: deletingAck ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                opacity: deletingAck ? 0.6 : 1
              }}
              onMouseOver={(e) => {
                if (!deletingAck) {
                  e.currentTarget.style.background = '#e74c3c';
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
                }
              }}
              onMouseOut={(e) => {
                if (!deletingAck) {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.color = '#e74c3c';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
                }
              }}
              title="Delete Acknowledgement"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={handleViewAcknowledgement}
              style={{
                padding: '12px 24px',
                background: 'white',
                color: '#667eea',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
              }}
            >
              <Eye size={18} />
              View Recipient Acknowledgement
            </button>
          </div>
        ) : (
          // Upload Button - when no file exists
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              padding: '12px 24px',
              background: 'white',
              color: '#667eea',
              border: 'none',
              borderRadius: '8px',
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
              marginTop: '10px',
              opacity: uploading ? 0.6 : 1
            }}
            onMouseOver={(e) => {
              if (!uploading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
              }
            }}
            onMouseOut={(e) => {
              if (!uploading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
              }
            }}
          >
            <Upload size={18} />
            {uploading ? 'Uploading...' : 'Upload Recipient Acknowledgement'}
          </button>
        )}
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>

      {/* Upload Message */}
      {uploadMessage && (
        <div style={{
          marginTop: '20px',
          padding: '15px 20px',
          borderRadius: '8px',
          background: uploadMessage.type === 'success' ? '#d4edda' : '#f8d7da',
          border: uploadMessage.type === 'success' ? '1px solid #c3e6cb' : '1px solid #f5c6cb',
          color: uploadMessage.type === 'success' ? '#155724' : '#721c24',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.95rem',
          fontWeight: '500'
        }}>
          {uploadMessage.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          {uploadMessage.text}
        </div>
      )}

      {/* PM Overview Card */}
      <div className="card" style={{ 
        marginBottom: '20px', 
        background: pmData.Status === 'In-Process' 
          ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
          : pmData.Status === 'Marked as Completed'
          ? 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)'
          : 'linear-gradient(135deg, #27ae60 0%, #229954 100%)', 
        color: 'white' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
              <Wrench size={40} />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.8rem' }}>Preventive Maintenance</h2>
                <p style={{ margin: '5px 0 0 0', opacity: 0.9, fontSize: '1rem' }}>
                  {pmData.Asset_Tag_ID || 'Asset'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '30px', marginTop: '20px' }}>
              <div>
                <div style={{ opacity: 0.8, fontSize: '0.85rem', marginBottom: '5px' }}>PM Date</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} />
                  {formatDate(pmData.PM_Date)}
                </div>
              </div>
              <div>
                <div style={{ opacity: 0.8, fontSize: '0.85rem', marginBottom: '5px' }}>Category</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                  {pmData.Category || 'N/A'}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'flex-end' }}>
            <div style={{ 
              padding: '12px 24px', 
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '1rem',
              background: pmData.Status === 'Completed' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.2)',
              border: '2px solid rgba(255, 255, 255, 0.5)'
            }}>
              {pmData.Status || 'In-Process'}
            </div>

            {pmData && !pmData.signature_path && pmData.Status !== 'Marked as Completed' && (
              <button
                onClick={handleOpenSignatureModal}
                style={{
                  padding: '10px 18px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  border: '2px solid rgba(255, 255, 255, 0.5)',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                title="Recipient can sign digitally or by typing full name"
              >
                <PenTool size={16} />
                Recipient Sign
              </button>
            )}
            
            {/* Download Form Button */}
            <PMReportDownload 
              pmId={pmData.PM_ID} 
              assetSerialNumber={pmData.Asset_Serial_Number}
              customerName={pmData.Customer_Name}
              variant="light"
              hasExistingPDF={pmData.file_path ? true : false}
              status={pmData.Status}
              hasAcknowledgement={!!pmData.file_path_acknowledgement}
            />
          </div>
        </div>
      </div>

      {/* Asset Information */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', 
          marginBottom: '20px',
          paddingBottom: '15px',
          borderBottom: '2px solid #3498db'
        }}>
          <Package size={24} color="#3498db" />
          <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.2rem' }}>Asset Information</h3>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          <div>
            <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
              Asset Tag ID
            </div>
            <div style={{ color: '#2c3e50', fontSize: '1rem', fontFamily: 'monospace', fontWeight: '600' }}>
              {pmData.Asset_Tag_ID || 'N/A'}
            </div>
          </div>
          <div>
            <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
              Serial Number
            </div>
            <div style={{ color: '#2c3e50', fontSize: '1rem', fontFamily: 'monospace' }}>
              {pmData.Asset_Serial_Number || 'N/A'}
            </div>
          </div>
          <div>
            <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
              Item Name
            </div>
            <div style={{ color: '#2c3e50', fontSize: '1rem' }}>
              {pmData.Item_Name || 'N/A'}
            </div>
          </div>
          <div>
            <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
              Category
            </div>
            <div style={{ color: '#2c3e50', fontSize: '1rem' }}>
              {pmData.Category || 'N/A'}
            </div>
          </div>
          <div>
            <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
              Model
            </div>
            <div style={{ color: '#2c3e50', fontSize: '1rem' }}>
              {pmData.Model || 'N/A'}
            </div>
          </div>
          <div>
            <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
              Recipient
            </div>
            <div style={{ color: '#2c3e50', fontSize: '1rem' }}>
              {pmData.Recipient_Name || 'N/A'}
            </div>
          </div>
          <div>
            <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '600' }}>
              Department
            </div>
            <div style={{ color: '#2c3e50', fontSize: '1rem' }}>
              {pmData.Department || 'N/A'}
            </div>
          </div>
        </div>

        {pmData.Remarks && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e9ecef' }}>
            <div style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '8px', fontWeight: '600' }}>
              Remarks
            </div>
            <div style={{ 
              color: '#2c3e50', 
              fontSize: '0.95rem',
              padding: '12px',
              background: '#f8f9fa',
              borderRadius: '6px',
              border: '1px solid #e9ecef',
              fontStyle: 'italic'
            }}>
              {pmData.Remarks}
            </div>
          </div>
        )}
      </div>

      {/* Checklist Results */}
      <div className="card">
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardCheck size={24} color="#27ae60" />
            <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.2rem' }}>
              Checklist Results ({pmData.checklist_results?.length || 0} items)
            </h3>
          </div>
          {pmData.checklist_results && pmData.checklist_results.length > 0 && (
            <div style={{ display: 'flex', gap: '20px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={16} color="#27ae60" />
                <span style={{ color: '#27ae60', fontWeight: '600' }}>
                  {pmData.checklist_results.filter(r => r.Is_OK_bool === 1).length} Good
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <X size={16} color="#e74c3c" />
                <span style={{ color: '#e74c3c', fontWeight: '600' }}>
                  {pmData.checklist_results.filter(r => r.Is_OK_bool === 0).length} Bad
                </span>
              </div>
            </div>
          )}
        </div>

        {/* User Information */}
        {pmData.Created_By_Name && (
          <div style={{ 
            marginBottom: '15px',
            padding: '8px 0',
            color: '#6c757d',
            fontSize: '0.9rem',
            fontStyle: 'italic',
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
          }}>
            Recorded by: <span style={{ fontWeight: '500', color: '#5a6268' }}>
              {pmData.Created_By_Name}
              {pmData.Created_By_Department && ` (${pmData.Created_By_Department})`}
            </span>
          </div>
        )}

        <div style={{ 
          borderBottom: '2px solid #27ae60',
          marginBottom: '20px'
        }} />

        {!pmData.checklist_results || pmData.checklist_results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: '#f8f9fa', borderRadius: '8px' }}>
            <ClipboardCheck size={48} color="#95a5a6" style={{ marginBottom: '15px' }} />
            <h4 style={{ color: '#7f8c8d', margin: '0 0 10px 0' }}>No Checklist Results</h4>
            <p style={{ color: '#95a5a6', margin: 0, fontSize: '0.9rem' }}>
              No checklist items were recorded for this PM
            </p>
          </div>
        ) : (
          <div style={{ 
            border: '1px solid #e9ecef', 
            borderRadius: '8px', 
            overflow: 'hidden' 
          }}>
            {pmData.checklist_results.map((result, index) => (
              <div
                key={result.PM_Result_ID}
                style={{
                  padding: '16px 20px',
                  borderBottom: index < pmData.checklist_results.length - 1 ? '1px solid #e9ecef' : 'none',
                  background: index % 2 === 0 ? 'white' : '#f8f9fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '20px'
                }}
              >
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ 
                    minWidth: '40px', 
                    height: '40px', 
                    borderRadius: '50%', 
                    background: result.Is_OK_bool === 1 ? '#d4edda' : '#f8d7da',
                    color: result.Is_OK_bool === 1 ? '#155724' : '#721c24',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '600',
                    fontSize: '0.9rem'
                  }}>
                    {index + 1}
                  </div>
                  <div>
                    <div style={{ color: '#2c3e50', fontSize: '1rem', fontWeight: '500', marginBottom: '4px' }}>
                      {result.Check_item_Long}
                    </div>
                    {result.Remarks && (
                      <div style={{ color: '#7f8c8d', fontSize: '0.85rem', fontStyle: 'italic' }}>
                        Note: {result.Remarks}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  background: result.Is_OK_bool === 1 ? '#d4edda' : '#f8d7da',
                  border: result.Is_OK_bool === 1 ? '1px solid #c3e6cb' : '1px solid #f5c6cb'
                }}>
                  {getCheckResultIcon(result.Is_OK_bool)}
                  <span style={{ 
                    color: result.Is_OK_bool === 1 ? '#155724' : '#721c24',
                    fontWeight: '600',
                    fontSize: '0.9rem'
                  }}>
                    {result.Is_OK_bool === 1 ? 'Good' : 'Bad'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast Notification for Signature */}
      {signatureMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          minWidth: '320px',
          maxWidth: '450px',
          background: signatureMessage.type === 'success' ? '#10b981' : '#ef4444',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'slideInRight 0.4s ease-out',
          fontSize: '0.95rem',
          fontWeight: '500'
        }}>
          <style>
            {`
              @keyframes slideInRight {
                from {
                  transform: translateX(400px);
                  opacity: 0;
                }
                to {
                  transform: translateX(0);
                  opacity: 1;
                }
              }
              @keyframes slideOutRight {
                from {
                  transform: translateX(0);
                  opacity: 1;
                }
                to {
                  transform: translateX(400px);
                  opacity: 0;
                }
              }
            `}
          </style>
          {signatureMessage.type === 'success' ? <CheckCircle size={22} /> : <AlertTriangle size={22} />}
          <span style={{ flex: 1 }}>{signatureMessage.text}</span>
          <button
            onClick={() => setSignatureMessage(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Action Buttons - User Signature & Delete */}
      <div style={{ 
        marginTop: '30px', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        gap: '20px',
        paddingBottom: '20px',
        flexWrap: 'wrap'
      }}>
        {/* User Signature Button - Show only if no signature exists AND status is not "Marked as Completed" AND no acknowledgement file uploaded */}
        {pmData && !pmData.signature_path && !pmData.file_path_acknowledgement && pmData.Status !== 'Marked as Completed' && (
          <button
            onClick={handleOpenSignatureModal}
            style={{
              padding: '14px 36px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.05rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
            }}
          >
            <PenTool size={17} />
            User Signature
          </button>
        )}

        {/* Delete Button */}
        <button
          onClick={handleDeleteClick}
          disabled={deleting}
          style={{
            padding: '14px 36px',
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1.05rem',
            fontWeight: '600',
            cursor: deleting ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 15px rgba(231, 76, 60, 0.4)',
            opacity: deleting ? 0.6 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px'
          }}
          onMouseOver={(e) => {
            if (!deleting) {
              e.target.style.background = '#c0392b';
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 20px rgba(231, 76, 60, 0.6)';
            }
          }}
          onMouseOut={(e) => {
            if (!deleting) {
              e.target.style.background = '#e74c3c';
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 15px rgba(231, 76, 60, 0.4)';
            }
          }}
        >
          <Trash2 size={17} />
          {deleting ? 'Deleting...' : 'Delete PM Record'}
        </button>

        {/* Mark as Completed Button - Only shown when status is "In-Process" */}
        {pmData.Status === 'In-Process' && (
          <button
            onClick={handleMarkClick}
            disabled={marking}
            style={{
              padding: '14px 36px',
              background: '#14b8a6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.05rem',
              fontWeight: '600',
              cursor: marking ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(20, 184, 166, 0.4)',
              opacity: marking ? 0.6 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px'
            }}
            onMouseOver={(e) => {
              if (!marking) {
                e.currentTarget.style.background = '#0d9488';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(20, 184, 166, 0.6)';
              }
            }}
            onMouseOut={(e) => {
              if (!marking) {
                e.currentTarget.style.background = '#14b8a6';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(20, 184, 166, 0.4)';
              }
            }}
          >
            <CheckCircle size={17} />
            {marking ? 'Marking...' : 'Mark as Completed'}
          </button>
        )}
      </div>
      
      {/* Signature Modal */}
      <SignatureModal
        isOpen={showSignatureModal}
        onClose={handleCloseSignatureModal}
        onConfirm={handleConfirmSignature}
        pmId={pmId}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '25px' }}>
              <AlertTriangle size={48} color="#e74c3c" style={{ marginBottom: '15px' }} />
              <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '1.3rem' }}>
                Delete PM Record?
              </h3>
              <p style={{ margin: 0, color: '#7f8c8d', fontSize: '0.95rem', lineHeight: '1.5' }}>
                This will permanently delete PM #{pmData.PM_ID} and all associated checklist results. This action cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={handleCancelDelete}
                disabled={deleting}
                style={{
                  padding: '10px 24px',
                  background: 'white',
                  color: '#666',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => !deleting && (e.target.style.borderColor = '#999')}
                onMouseOut={(e) => (e.target.style.borderColor = '#ddd')}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{
                  padding: '10px 24px',
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: deleting ? 0.6 : 1
                }}
                onMouseOver={(e) => !deleting && (e.target.style.background = '#c0392b')}
                onMouseOut={(e) => (e.target.style.background = '#e74c3c')}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Completed Confirmation Modal */}
      {showMarkModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '25px' }}>
              <CheckCircle size={48} color="#14b8a6" style={{ marginBottom: '15px' }} />
              <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50', fontSize: '1.3rem' }}>
                Mark PM as Completed?
              </h3>
              <div style={{ 
                background: '#fffbeb', 
                border: '2px solid #fbbf24', 
                borderRadius: '8px', 
                padding: '15px', 
                marginBottom: '20px',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <AlertTriangle size={24} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ color: '#92400e', fontSize: '0.9rem', lineHeight: '1.6' }}>
                    <strong style={{ display: 'block', marginBottom: '8px', color: '#78350f' }}>
                      ⚠️ Important Notice:
                    </strong>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      <li style={{ marginBottom: '6px' }}>This will mark PM #{pmData.PM_ID} as completed <strong>WITHOUT recipient signature</strong>.</li>
                      <li style={{ marginBottom: '6px' }}>The generated report will have a <strong>blank signature section</strong> for manual signing.</li>
                      <li style={{ marginBottom: '6px' }}>You will be able to generate and print the PM report immediately.</li>
                      <li><strong>This action cannot be undone.</strong></li>
                    </ul>
                  </div>
                </div>
              </div>
              <p style={{ margin: 0, color: '#666', fontSize: '0.95rem', lineHeight: '1.5' }}>
                Are you sure you want to proceed?
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={handleCancelMark}
                disabled={marking}
                style={{
                  padding: '10px 24px',
                  background: 'white',
                  color: '#666',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: marking ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => !marking && (e.target.style.borderColor = '#999')}
                onMouseOut={(e) => (e.target.style.borderColor = '#ddd')}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMark}
                disabled={marking}
                style={{
                  padding: '10px 24px',
                  background: '#14b8a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: marking ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: marking ? 0.6 : 1
                }}
                onMouseOver={(e) => !marking && (e.target.style.background = '#0d9488')}
                onMouseOut={(e) => (e.target.style.background = '#14b8a6')}
              >
                {marking ? 'Processing...' : 'Confirm & Mark Completed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PMDetail;
