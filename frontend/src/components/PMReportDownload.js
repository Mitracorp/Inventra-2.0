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

      // Get PDF info from backend (generates if needed, returns path)
      const apiUrl = process.env.REACT_APP_API_URL || `${window.location.origin}/api/v1`;
      const response = await fetch(`${apiUrl}/pm/${pmId}/pdf-info`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get PDF info');
      }
      
      const pdfInfo = await response.json();
      
      if (!pdfInfo.success || !pdfInfo.url) {
        throw new Error('Invalid PDF info received');
      }
      
      // Open PDF via direct static file URL - this preserves the actual filename!
      const baseUrl = apiUrl.replace('/api/v1', ''); // Remove API prefix
      const pdfUrl = `${baseUrl}${pdfInfo.url}`;
      
      console.log('👁️  Opening PDF with preserved filename:', pdfInfo.filename);
      console.log('📄 PDF URL:', pdfUrl);
      
      // Open PDF directly - browser will show the actual filename!
      window.open(pdfUrl, '_blank');
      
      console.log('✅ PDF opened successfully with filename:', pdfInfo.filename);
      
      // After successful view, mark that PDF now exists
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
