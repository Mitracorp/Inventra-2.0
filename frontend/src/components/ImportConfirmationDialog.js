import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Download, FileText, Users, AlertCircle } from 'lucide-react';

const ImportConfirmationDialog = ({ 
  isOpen, 
  onClose, 
  validationSummary, 
  parsedData,
  onConfirmImport, 
  loading 
}) => {
  const [importOption, setImportOption] = useState('valid-only');
  const [enableUpdate, setEnableUpdate] = useState(false);

  if (!isOpen) return null;

  const handleImportConfirm = () => {
    onConfirmImport(importOption, enableUpdate);
  };

  const downloadFailedRecords = () => {
    if (!validationSummary.errors || validationSummary.errors.length === 0) return;

    // Create CSV content for failed records
    const headers = Object.keys(parsedData[0] || {});
    const csvContent = [
      [...headers, 'Error_Reason'].join(','),
      ...validationSummary.errors.map(error => {
        const row = parsedData[error.row - 1];
        const errorMessages = error.errors.map(err => err.message).join('; ');
        return [...headers.map(h => `"${row[h] || ''}"`), `"${errorMessages}"`].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'failed-records.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
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
              z-index: 1000;
              animation: fadeIn 0.2s ease-out;
            }

            .modal-content {
              background: white;
              border-radius: 16px;
              width: 90%;
              max-width: 600px;
              max-height: 90vh;
              overflow-y: auto;
              animation: slideIn 0.3s ease-out;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            }

            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }

            @keyframes slideIn {
              from { transform: translateY(-20px) scale(0.95); opacity: 0; }
              to { transform: translateY(0) scale(1); opacity: 1; }
            }

            .modal-header {
              padding: 24px 24px 0 24px;
              border-bottom: 1px solid #e2e8f0;
            }

            .modal-title {
              font-size: 20px;
              font-weight: 600;
              color: #1e293b;
              margin: 0 0 8px 0;
              display: flex;
              align-items: center;
              gap: 12px;
            }

            .modal-subtitle {
              color: #64748b;
              margin: 0 0 24px 0;
              font-size: 14px;
            }

            .modal-body {
              padding: 24px;
            }

            .summary-section {
              margin-bottom: 24px;
            }

            .summary-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
              gap: 16px;
              margin-bottom: 20px;
            }

            .summary-card {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 16px;
              text-align: center;
            }

            .summary-card.total {
              border-color: #bfdbfe;
              background: #eff6ff;
            }

            .summary-card.valid {
              border-color: #bbf7d0;
              background: #f0fdf4;
            }

            .summary-card.invalid {
              border-color: #fecaca;
              background: #fef2f2;
            }

            .summary-icon {
              width: 32px;
              height: 32px;
              margin: 0 auto 8px;
            }

            .summary-card.total .summary-icon { color: #3b82f6; }
            .summary-card.valid .summary-icon { color: #22c55e; }
            .summary-card.invalid .summary-icon { color: #ef4444; }

            .summary-number {
              font-size: 24px;
              font-weight: 700;
              margin: 0 0 4px 0;
            }

            .summary-card.total .summary-number { color: #1e40af; }
            .summary-card.valid .summary-number { color: #166534; }
            .summary-card.invalid .summary-number { color: #dc2626; }

            .summary-label {
              font-size: 12px;
              color: #64748b;
              text-transform: uppercase;
              font-weight: 500;
              margin: 0;
            }

            .warning-section {
              background: #fffbeb;
              border: 1px solid #fed7aa;
              border-radius: 12px;
              padding: 16px;
              margin: 20px 0;
            }

            .warning-header {
              display: flex;
              align-items: center;
              gap: 8px;
              color: #d97706;
              font-weight: 600;
              margin: 0 0 8px 0;
              font-size: 14px;
            }

            .warning-list {
              margin: 0;
              padding-left: 16px;
              color: #92400e;
              font-size: 14px;
            }

            .warning-list li {
              margin: 4px 0;
            }

            .options-section {
              margin: 24px 0;
            }

            .options-title {
              font-weight: 600;
              color: #1e293b;
              margin: 0 0 16px 0;
              font-size: 16px;
            }

            .option-group {
              display: flex;
              flex-direction: column;
              gap: 12px;
            }

            .option-item {
              display: flex;
              align-items: flex-start;
              gap: 12px;
              padding: 16px;
              border: 2px solid #e2e8f0;
              border-radius: 12px;
              cursor: pointer;
              transition: all 0.2s;
            }

            .option-item:hover {
              border-color: #cbd5e1;
              background: #f8fafc;
            }

            .option-item.selected {
              border-color: #3b82f6;
              background: #eff6ff;
            }

            .option-radio {
              width: 20px;
              height: 20px;
              border: 2px solid #d1d5db;
              border-radius: 50%;
              position: relative;
              flex-shrink: 0;
              margin-top: 2px;
            }

            .option-item.selected .option-radio {
              border-color: #3b82f6;
            }

            .option-item.selected .option-radio::after {
              content: '';
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 10px;
              height: 10px;
              background: #3b82f6;
              border-radius: 50%;
            }

            .option-content {
              flex: 1;
            }

            .option-title {
              font-weight: 600;
              color: #1e293b;
              margin: 0 0 4px 0;
              font-size: 14px;
            }

            .option-description {
              color: #64748b;
              margin: 0;
              font-size: 13px;
              line-height: 1.4;
            }

            .option-stats {
              margin: 8px 0 0 0;
              padding: 8px 12px;
              background: white;
              border-radius: 6px;
              font-size: 12px;
              color: #374151;
              border: 1px solid #e5e7eb;
            }

            .error-preview {
              margin: 20px 0;
              max-height: 200px;
              overflow-y: auto;
            }

            .error-preview-title {
              font-weight: 600;
              color: #dc2626;
              margin: 0 0 12px 0;
              font-size: 14px;
              display: flex;
              align-items: center;
              gap: 8px;
            }

            .error-list {
              background: #fef2f2;
              border: 1px solid #fecaca;
              border-radius: 8px;
              padding: 12px;
            }

            .error-item {
              margin: 8px 0;
              padding: 8px;
              background: white;
              border-radius: 6px;
              border-left: 3px solid #ef4444;
              font-size: 13px;
            }

            .error-row {
              font-weight: 600;
              color: #1e293b;
              margin: 0 0 4px 0;
            }

            .error-details {
              color: #64748b;
              margin: 0;
            }

            .download-failed {
              display: flex;
              align-items: center;
              gap: 8px;
              color: #3b82f6;
              background: none;
              border: none;
              cursor: pointer;
              font-size: 14px;
              padding: 8px 0;
              margin: 12px 0 0 0;
            }

            .download-failed:hover {
              text-decoration: underline;
            }

            .modal-footer {
              padding: 0 24px 24px 24px;
              display: flex;
              gap: 12px;
              justify-content: flex-end;
            }

            .btn {
              padding: 12px 20px;
              border: none;
              border-radius: 8px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s;
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 14px;
            }

            .btn-secondary {
              background: #f8fafc;
              color: #64748b;
              border: 1px solid #e2e8f0;
            }

            .btn-secondary:hover {
              background: #f1f5f9;
              color: #475569;
            }

            .btn-primary {
              background: #3b82f6;
              color: white;
            }

            .btn-primary:hover {
              background: #2563eb;
            }

            .btn-primary:disabled {
              background: #94a3b8;
              cursor: not-allowed;
            }

            .loading-spinner {
              width: 16px;
              height: 16px;
              border: 2px solid transparent;
              border-top: 2px solid currentColor;
              border-radius: 50%;
              animation: spin 1s linear infinite;
            }

            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>

          <div className="modal-header">
            <h2 className="modal-title">
              <FileText />
              Confirm Bulk Import
            </h2>
            <p className="modal-subtitle">
              Review the import summary and choose how to proceed with the data import.
            </p>
          </div>

          <div className="modal-body">
            <div className="summary-section">
              <div className="summary-grid">
                <div className="summary-card total">
                  <Users className="summary-icon" />
                  <div className="summary-number">{validationSummary.totalRows}</div>
                  <div className="summary-label">Total Records</div>
                </div>
                <div className="summary-card valid">
                  <CheckCircle className="summary-icon" />
                  <div className="summary-number">{validationSummary.validRows}</div>
                  <div className="summary-label">Valid Records</div>
                </div>
                <div className="summary-card invalid">
                  <XCircle className="summary-icon" />
                  <div className="summary-number">{validationSummary.invalidRows}</div>
                  <div className="summary-label">Invalid Records</div>
                </div>
              </div>

              {validationSummary.invalidRows > 0 && (
                <div className="warning-section">
                  <div className="warning-header">
                    <AlertTriangle />
                    Data Quality Issues Detected
                  </div>
                  <ul className="warning-list">
                    <li>{validationSummary.invalidRows} records have validation errors</li>
                    <li>Invalid records will be skipped or cause import failure</li>
                    <li>Review the error details below before proceeding</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="options-section">
              <h3 className="options-title">Import Options</h3>
              <div className="option-group">
                <div 
                  className={`option-item ${importOption === 'valid-only' ? 'selected' : ''}`}
                  onClick={() => setImportOption('valid-only')}
                >
                  <div className="option-radio"></div>
                  <div className="option-content">
                    <div className="option-title">Import Only Valid Records (Recommended)</div>
                    <div className="option-description">
                      Import only the records that passed all validation checks. Invalid records will be skipped and can be downloaded for review.
                    </div>
                    <div className="option-stats">
                      Will import {validationSummary.validRows} out of {validationSummary.totalRows} records
                    </div>
                  </div>
                </div>

                <div 
                  className={`option-item ${importOption === 'attempt-all' ? 'selected' : ''}`}
                  onClick={() => setImportOption('attempt-all')}
                >
                  <div className="option-radio"></div>
                  <div className="option-content">
                    <div className="option-title">Attempt All Records</div>
                    <div className="option-description">
                      Attempt to import all records. Valid records will be imported successfully, and invalid records will be automatically skipped with detailed error logging.
                    </div>
                    <div className="option-stats">
                      Will attempt all {validationSummary.totalRows} records, expect {validationSummary.validRows} successful imports
                    </div>
                  </div>
                </div>

                {validationSummary.invalidRows === 0 && (
                  <div 
                    className={`option-item ${importOption === 'all-valid' ? 'selected' : ''}`}
                    onClick={() => setImportOption('all-valid')}
                  >
                    <div className="option-radio"></div>
                    <div className="option-content">
                      <div className="option-title">Import All Records</div>
                      <div className="option-description">
                        All records passed validation. Import all {validationSummary.totalRows} records successfully.
                      </div>
                      <div className="option-stats">
                        Will import all {validationSummary.totalRows} records
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="options-section" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <label 
                className="checkbox-container" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  cursor: 'pointer', 
                  padding: '16px', 
                  borderRadius: '8px', 
                  border: enableUpdate ? '2px solid #3b82f6' : '1px solid #e2e8f0', 
                  backgroundColor: enableUpdate ? '#eff6ff' : 'white', 
                  boxShadow: enableUpdate ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none',
                  transition: 'all 0.3s ease',
                  position: 'relative'
                }}
              >
                {enableUpdate && (
                  <div style={{
                    position: 'absolute',
                    top: '-1px',
                    right: '-1px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '0 6px 0 8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Active
                  </div>
                )}
                <input 
                  type="checkbox" 
                  checked={enableUpdate} 
                  onChange={(e) => setEnableUpdate(e.target.checked)}
                  style={{ 
                    width: '20px', 
                    height: '20px', 
                    cursor: 'pointer', 
                    accentColor: '#3b82f6',
                    flexShrink: 0
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontWeight: '700', 
                    color: enableUpdate ? '#1e40af' : '#1e293b', 
                    marginBottom: '4px',
                    fontSize: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    Enable Update Mode (Upsert)
                    {enableUpdate && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        ON
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '14px', color: enableUpdate ? '#1e40af' : '#64748b', fontWeight: enableUpdate ? '500' : '400' }}>
                    Update existing assets if they have the same serial number but different data. Assets with identical data will be skipped as duplicates. New assets will still be created.
                  </div>
                </div>
              </label>
            </div>

            {validationSummary.errors && validationSummary.errors.length > 0 && (
              <div className="error-preview">
                <div className="error-preview-title">
                  <AlertCircle />
                  Validation Errors Preview
                </div>
                <div className="error-list">
                  {validationSummary.errors.slice(0, 5).map((error, index) => (
                    <div key={index} className="error-item">
                      <div className="error-row">Row {error.row}</div>
                      <div className="error-details">
                        {error.errors.map(err => err.message).join(', ')}
                      </div>
                    </div>
                  ))}
                  {validationSummary.errors.length > 5 && (
                    <div style={{ textAlign: 'center', padding: '8px', color: '#64748b', fontStyle: 'italic' }}>
                      ... and {validationSummary.errors.length - 5} more errors
                    </div>
                  )}
                </div>
                <button className="download-failed" onClick={downloadFailedRecords}>
                  <Download size={16} />
                  Download Failed Records as CSV
                </button>
              </div>
            )}

            <div className="warning-section">
              <div className="warning-header">
                <AlertTriangle />
                Important Notice
              </div>
              <ul className="warning-list">
                <li>This action will create new asset records in the database.</li>
                <li>The import process cannot be undone.</li>
                <li>Ensure all data has been reviewed and validated.</li>
                <li>Duplicate serial numbers or tag IDs will cause import failures.</li>
              </ul>
            </div>
          </div>

          <div className="modal-footer">
            <button 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={loading}
            >
              Cancel Import
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleImportConfirm}
              disabled={loading || validationSummary.validRows === 0}
            >
              {loading ? (
                <>
                  <div className="loading-spinner"></div>
                  Processing...
                </>
              ) : (
                <>
                  Confirm Import
                  {importOption === 'valid-only' && ` (${validationSummary.validRows} records)`}
                  {importOption === 'attempt-all' && ` (${validationSummary.totalRows} records)`}
                  {importOption === 'all-valid' && ` (${validationSummary.totalRows} records)`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ImportConfirmationDialog;