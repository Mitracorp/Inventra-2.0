import React from 'react';
import { Eye } from 'lucide-react';

/**
 * Component for viewing PM reports as PDF
 * Can be integrated into PMDetail.js, PreventiveMaintenance.js, or AssetDetail.js
 */
const PMReportDownload = ({ pmId, assetSerialNumber, customerName, variant = 'default', hasExistingPDF = false, status = null, hasAcknowledgement = false }) => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [pdfExists, setPdfExists] = React.useState(hasExistingPDF);
  
  // Check if button should be disabled
  // Disabled if: In-Process status OR acknowledgement file uploaded (PM Import with physical signature)
  const isDisabled = status === 'In-Process' || hasAcknowledgement || loading;
  
  // Tooltip messages
  let tooltipMessage = '';
  if (hasAcknowledgement) {
    tooltipMessage = 'Form generation disabled - acknowledgement file already uploaded (PM imported with physical signature)';
  } else if (status === 'In-Process') {
    tooltipMessage = 'Complete PM or mark as completed to view report';
  }

  // Sanitize customer name for filename
  const sanitizeForFilename = (text) => {
    if (!text) return 'UNKNOWN';
    return text
      .replace(/\s+/g, '_')        // Spaces → underscores
      .replace(/[^a-zA-Z0-9_-]/g, '') // Remove special characters
      .toUpperCase()               // Uppercase
      .substring(0, 50);           // Limit length
  };

  const handleViewReport = async () => {
    try {
      setLoading(true);
      setError(null);

      // Request PM form; backend may return JSON metadata or a PDF stream.
      const apiUrl = process.env.REACT_APP_API_URL || `${window.location.origin}/api/v1`;
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${apiUrl}/pm/${pmId}/pdf-info`, {
        headers: {
          Accept: 'application/json, application/pdf',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      
      if (!response.ok) {
        let message = 'Failed to get PDF info';
        try {
          const errorData = await response.json();
          message = errorData.message || errorData.error || message;
        } catch (_) {
          // Ignore JSON parsing failure for non-JSON error bodies.
        }
        throw new Error(message);
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();

      // JSON response path: backend provides URL for report download.
      if (contentType.includes('application/json')) {
        const pdfInfo = await response.json();

        if (!pdfInfo.success || !pdfInfo.url) {
          throw new Error('Invalid PDF info received');
        }

        const baseUrl = apiUrl.replace('/api/v1', '');
        const pdfUrl = `${baseUrl}${pdfInfo.url}`;

        window.open(pdfUrl, '_blank', 'noopener,noreferrer');
        setPdfExists(true);
        return;
      }

      // PDF response path: stream the file directly.
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60000);
      setPdfExists(true);
    } catch (err) {
      console.error('Error opening PM report:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Styling based on variant (default or light for green box)
  const getButtonStyle = () => {
    const baseStyle = {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 24px',
      border: 'none',
      borderRadius: '8px',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      fontSize: '1rem',
      fontWeight: '600',
      transition: 'all 0.2s',
    };

    if (variant === 'light') {
      return {
        ...baseStyle,
        backgroundColor: isDisabled ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.9)',
        color: isDisabled ? '#95a5a6' : '#667eea',
        border: 'none',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
        opacity: isDisabled ? 0.6 : 1
      };
    }

    return {
      ...baseStyle,
      backgroundColor: isDisabled ? '#9ca3af' : '#667eea',
      color: 'white',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
      opacity: isDisabled ? 0.6 : 1
    };
  };

  const handleMouseOver = (e) => {
    if (!isDisabled) {
      if (variant === 'light') {
        e.target.style.backgroundColor = 'rgba(255, 255, 255, 1)';
        e.target.style.transform = 'translateY(-2px)';
        e.target.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
      } else {
        e.target.style.backgroundColor = '#5568d3';
      }
    }
  };

  const handleMouseOut = (e) => {
    if (!isDisabled) {
      if (variant === 'light') {
        e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        e.target.style.transform = 'translateY(0)';
        e.target.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
      } else {
        e.target.style.backgroundColor = '#667eea';
      }
    }
  };

  return (
    <div>
      <button
        onClick={handleViewReport}
        disabled={isDisabled}
        style={getButtonStyle()}
        title={tooltipMessage}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
      >
        <Eye size={18} />
        {loading 
          ? (pdfExists ? 'Opening PDF...' : 'Generating PDF...') 
          : (pdfExists ? 'View Form' : 'Generate Form')
        }
      </button>

      {error && (
        <div
          style={{
            marginTop: '10px',
            padding: '10px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            borderRadius: '6px',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default PMReportDownload;

/**
 * USAGE EXAMPLES:
 * 
 * 1. In PMDetail.js (PM detail page - light variant for green box):
 * 
 *    import PMReportDownload from '../components/PMReportDownload';
 * 
 *    // In the green PM Overview Card:
 *    <PMReportDownload 
 *      pmId={pmDetail.PM_ID} 
 *      assetSerialNumber={pmDetail.Asset_Serial_Number}
 *      variant="light"
 *      hasExistingPDF={pmDetail.file_path ? true : false}
 *    />
 * 
 * 2. In PreventiveMaintenance.js (PM list page):
 * 
 *    import PMReportDownload from '../components/PMReportDownload';
 * 
 *    // Inside the PM card or row:
 *    <PMReportDownload 
 *      pmId={pm.PM_ID} 
 *      assetSerialNumber={pm.Asset_Serial_Number}
 *      hasExistingPDF={pm.file_path ? true : false}
 *    />
 * 
 * 3. In AssetDetail.js (Asset PM history):
 * 
 *    import PMReportDownload from '../components/PMReportDownload';
 * 
 *    // In each PM record row:
 *    {pmHistory.map(pm => (
 *      <div key={pm.PM_ID}>
 *        <span>{pm.PM_Date}</span>
 *        <PMReportDownload 
 *          pmId={pm.PM_ID} 
 *          assetSerialNumber={asset.Asset_Serial_Number}
 *          hasExistingPDF={pm.file_path ? true : false}
 *        />
 *      </div>
 *    ))}
 * 
 * PROPS:
 * - pmId: PM record ID (required)
 * - assetSerialNumber: Asset serial number for filename (required)
 * - customerName: Customer name for filename (optional)
 * - variant: 'default' (purple) or 'light' (white with purple text) (optional, default: 'default')
 * - hasExistingPDF: Boolean indicating if PDF already exists (optional, default: false)
 *   - true: Shows "View Form" button (opens existing PDF in new tab)
 *   - false: Shows "Generate Form" button (generates new PDF then opens in new tab)
 * - status: PM status string (optional) - used to disable button for 'In-Process' status
 */
