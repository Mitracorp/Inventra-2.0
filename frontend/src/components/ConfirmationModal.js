import React from 'react';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Confirm", 
  cancelText = "Cancel",
  type = "warning", // "warning", "success", "danger"
  showSummary = false,
  summaryData = {},
  loading = false
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={24} color="#28a745" />;
      case 'danger':
        return <AlertCircle size={24} color="#dc3545" />;
      default:
        return <AlertCircle size={24} color="#ffc107" />;
    }
  };

  const getButtonColor = () => {
    switch (type) {
      case 'success':
        return '#28a745';
      case 'danger':
        return '#dc3545';
      default:
        return '#007bff';
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderSummary = () => {
    if (!showSummary || !summaryData) return null;

    return (
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '15px',
        borderRadius: '6px',
        margin: '15px 0',
        border: '1px solid #e9ecef'
      }}>
        <h5 style={{ margin: '0 0 10px 0', color: '#495057', fontSize: '14px', fontWeight: '600' }}>
          Asset Summary:
        </h5>
        <div style={{ fontSize: '13px', color: '#6c757d' }}>
          {summaryData.projectRef && (
            <div style={{ marginBottom: '5px' }}>
              <strong>Project:</strong> {summaryData.projectRef}
            </div>
          )}
          {summaryData.customer && (
            <div style={{ marginBottom: '5px' }}>
              <strong>Customer:</strong> {summaryData.customer}
            </div>
          )}
          {summaryData.branch && (
            <div style={{ marginBottom: '5px' }}>
              <strong>Branch:</strong> {summaryData.branch}
            </div>
          )}
          {summaryData.serialNumber && (
            <div style={{ marginBottom: '5px' }}>
              <strong>Serial Number:</strong> {summaryData.serialNumber}
            </div>
          )}
          {summaryData.tagId && (
            <div style={{ marginBottom: '5px' }}>
              <strong>Tag ID:</strong> {summaryData.tagId}
            </div>
          )}
          {summaryData.itemName && (
            <div style={{ marginBottom: '5px' }}>
              <strong>Item Name:</strong> {summaryData.itemName}
            </div>
          )}
          {summaryData.category && (
            <div style={{ marginBottom: '5px' }}>
              <strong>Category:</strong> {summaryData.category}
            </div>
          )}
          {summaryData.model && (
            <div style={{ marginBottom: '5px' }}>
              <strong>Model:</strong> {summaryData.model}
            </div>
          )}
          {summaryData.peripheralCount && summaryData.peripheralCount > 0 && (
            <div style={{ marginBottom: '5px' }}>
              <strong>Peripherals:</strong> {summaryData.peripheralCount} item(s)
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.2s ease-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideIn {
          from { 
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        .modal-content {
          background: white;
          border-radius: 8px;
          padding: 0;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
          animation: slideIn 0.2s ease-out;
        }
        
        .modal-header {
          padding: 20px;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #212529;
          flex: 1;
        }
        
        .close-button {
          background: none;
          border: none;
          cursor: pointer;
          color: #6c757d;
          padding: 4px;
          border-radius: 4px;
          transition: background-color 0.2s ease;
        }
        
        .close-button:hover {
          background-color: #f8f9fa;
          color: #495057;
        }
        
        .modal-body {
          padding: 20px;
        }
        
        .modal-message {
          margin: 0;
          color: #495057;
          line-height: 1.5;
        }
        
        .modal-footer {
          padding: 15px 20px;
          border-top: 1px solid #e9ecef;
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        
        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .btn-cancel {
          background: #6c757d;
          color: white;
        }
        
        .btn-cancel:hover:not(:disabled) {
          background: #545b62;
        }
        
        .btn-confirm {
          background: ${getButtonColor()};
          color: white;
        }
        
        .btn-confirm:hover:not(:disabled) {
          filter: brightness(0.9);
        }
        
        .loading-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="modal-overlay" onClick={handleOverlayClick}>
        <div className="modal-content">
          <div className="modal-header">
            {getIcon()}
            <h3 className="modal-title">{title}</h3>
            <button 
              type="button" 
              className="close-button" 
              onClick={onClose}
              disabled={loading}
            >
              <X size={20} />
            </button>
          </div>

          <div className="modal-body">
            <p className="modal-message">{message}</p>
            {renderSummary()}
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-cancel" 
              onClick={onClose}
              disabled={loading}
            >
              {cancelText}
            </button>
            <button 
              type="button" 
              className="btn btn-confirm" 
              onClick={onConfirm}
              disabled={loading}
            >
              {loading && <div className="loading-spinner" />}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConfirmationModal;