import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, X, RefreshCw } from 'lucide-react';
import HeaderMapper from '../utils/headerMapper';

const HeaderMappingConfirmation = ({ 
  detectedHeaders, 
  mappingResult, 
  onConfirm, 
  onCancel,
  onManualMap 
}) => {
  const [customMapping, setCustomMapping] = useState(mappingResult.mapping);
  const requiredFields = HeaderMapper.getRequiredFields();
  const standardFields = HeaderMapper.getStandardFields();
  
  // Calculate current duplicates dynamically from customMapping
  const getCurrentDuplicates = () => {
    const fieldCounts = {};
    Object.values(customMapping).forEach(field => {
      if (field) {
        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
      }
    });
    return Object.keys(fieldCounts).filter(field => fieldCounts[field] > 1);
  };
  
  // Calculate current unmapped headers dynamically
  const getCurrentUnmapped = () => {
    return detectedHeaders.filter(header => !customMapping[header]);
  };
  
  const currentDuplicates = getCurrentDuplicates();
  const currentUnmapped = getCurrentUnmapped();
  
  const handleMappingChange = (originalHeader, newStandardField) => {
    setCustomMapping(prev => ({
      ...prev,
      [originalHeader]: newStandardField
    }));
  };

  const handleConfirm = () => {
    const validation = HeaderMapper.validateMapping(customMapping);
    
    if (!validation.isValid) {
      alert(`Missing required fields: ${validation.missingRequired.join(', ')}`);
      return;
    }
    
    onConfirm(customMapping);
  };

  const getMappingStatus = () => {
    const validation = HeaderMapper.validateMapping(customMapping);
    return validation.isValid;
  };

  return (
    <div className="header-mapping-modal">
      <div className="modal-overlay" onClick={onCancel} />
      <div className="modal-content">
        <div className="modal-header">
          <h2>Confirm Header Mapping</h2>
          <button className="close-button" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="mapping-info">
            <div className="info-card success">
              <CheckCircle size={20} />
              <div>
                <strong>{Object.keys(customMapping).length}</strong>
                <span>Headers Mapped</span>
              </div>
            </div>
            
            {currentUnmapped.length > 0 && (
              <div className="info-card warning">
                <AlertTriangle size={20} />
                <div>
                  <strong>{currentUnmapped.length}</strong>
                  <span>Headers Unmapped</span>
                </div>
              </div>
            )}
            
            {currentDuplicates.length > 0 && (
              <div className="info-card error">
                <AlertTriangle size={20} />
                <div>
                  <strong>{currentDuplicates.length}</strong>
                  <span>Duplicate Mappings</span>
                </div>
              </div>
            )}
          </div>

          <div className="mapping-table">
            <h3>Detected Headers</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Your Header</th>
                    <th>Mapped To</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detectedHeaders.map((header, index) => {
                    const mappedField = customMapping[header];
                    const isRequired = requiredFields.includes(mappedField);
                    const isDuplicate = currentDuplicates.includes(mappedField);
                    
                    return (
                      <tr key={index} className={!mappedField ? 'unmapped' : ''}>
                        <td className="original-header">
                          <code>{header}</code>
                        </td>
                        <td className="mapped-field">
                          <select
                            value={mappedField || ''}
                            onChange={(e) => handleMappingChange(header, e.target.value)}
                            className={isDuplicate ? 'duplicate' : ''}
                          >
                            <option value="">-- Not Mapped --</option>
                            {standardFields.map(field => (
                              <option key={field} value={field}>
                                {field}
                                {requiredFields.includes(field) ? ' *' : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="status">
                          {mappedField ? (
                            <span className={`badge ${isRequired ? 'required' : 'optional'} ${isDuplicate ? 'duplicate' : ''}`}>
                              {isDuplicate ? 'Duplicate' : isRequired ? 'Required' : 'Optional'}
                            </span>
                          ) : (
                            <span className="badge unmapped">Unmapped</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {currentUnmapped.length > 0 && (
            <div className="unmapped-warning">
              <AlertTriangle size={16} />
              <p>
                The following headers couldn't be automatically mapped: 
                <strong> {currentUnmapped.join(', ')}</strong>
              </p>
              <p className="hint">You can manually map them using the dropdowns above or they will be ignored during import.</p>
            </div>
          )}

          {currentDuplicates.length > 0 && (
            <div className="duplicate-error">
              <AlertTriangle size={16} />
              <div>
                <p>
                  <strong>Warning:</strong> Multiple CSV columns are mapped to the same database field:
                </p>
                {currentDuplicates.map(field => {
                  const duplicateHeaders = Object.entries(customMapping)
                    .filter(([_, mappedField]) => mappedField === field)
                    .map(([header, _]) => header);
                  return (
                    <div key={field} className="duplicate-detail">
                      <strong>{field}:</strong> {duplicateHeaders.map((h, i) => (
                        <span key={i}>
                          "{h}"{i < duplicateHeaders.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  );
                })}
                <p className="hint">
                  Please remove duplicate columns from your CSV or manually remap them to different fields using the dropdowns above.
                </p>
              </div>
            </div>
          )}

          <div className="required-fields-info">
            <h4>Required Fields</h4>
            <div className="required-list">
              {requiredFields.map(field => {
                const isMapped = Object.values(customMapping).includes(field);
                return (
                  <span 
                    key={field} 
                    className={`required-field ${isMapped ? 'mapped' : 'missing'}`}
                  >
                    {isMapped ? <CheckCircle size={14} /> : <X size={14} />}
                    {field}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleConfirm}
            disabled={!getMappingStatus()}
          >
            <CheckCircle size={18} />
            Confirm & Continue
          </button>
        </div>
      </div>

      <style>{`
        .header-mapping-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
        }

        .modal-content {
          position: relative;
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 900px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px;
          border-bottom: 1px solid #e2e8f0;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #1e293b;
        }

        .close-button {
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          color: #64748b;
          transition: color 0.2s;
        }

        .close-button:hover {
          color: #1e293b;
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .mapping-info {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .info-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-radius: 8px;
          border: 1px solid;
        }

        .info-card.success {
          background: #f0fdf4;
          border-color: #86efac;
          color: #166534;
        }

        .info-card.warning {
          background: #fffbeb;
          border-color: #fcd34d;
          color: #92400e;
        }

        .info-card.error {
          background: #fef2f2;
          border-color: #fca5a5;
          color: #991b1b;
        }

        .info-card strong {
          display: block;
          font-size: 24px;
          font-weight: 700;
        }

        .info-card span {
          font-size: 12px;
          opacity: 0.8;
        }

        .mapping-table h3 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }

        .table-container {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        thead {
          background: #f8fafc;
        }

        th {
          text-align: left;
          padding: 12px 16px;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #e2e8f0;
        }

        td {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
        }

        tr:last-child td {
          border-bottom: none;
        }

        tr.unmapped {
          background: #fef2f2;
        }

        .original-header code {
          background: #f1f5f9;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 13px;
          color: #0f172a;
        }

        .mapped-field select {
          width: 100%;
          padding: 6px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 14px;
          background: white;
          cursor: pointer;
        }

        .mapped-field select.duplicate {
          border-color: #f87171;
          background: #fef2f2;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .badge.required {
          background: #dbeafe;
          color: #1e40af;
        }

        .badge.optional {
          background: #f3f4f6;
          color: #4b5563;
        }

        .badge.unmapped {
          background: #fee2e2;
          color: #991b1b;
        }

        .badge.duplicate {
          background: #fecaca;
          color: #991b1b;
        }

        .unmapped-warning,
        .duplicate-error {
          margin-top: 16px;
          padding: 16px;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .unmapped-warning {
          background: #fffbeb;
          border: 1px solid #fcd34d;
          color: #92400e;
        }

        .duplicate-error {
          background: #fef2f2;
          border: 1px solid #fca5a5;
          color: #991b1b;
        }
        
        .duplicate-detail {
          margin: 8px 0 8px 24px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 4px;
          font-size: 13px;
          font-family: 'Courier New', monospace;
        }
        
        .duplicate-detail strong {
          color: #7c2d12;
          margin-right: 8px;
        }

        .unmapped-warning svg,
        .duplicate-error svg {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .unmapped-warning p,
        .duplicate-error p {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
        }

        .hint {
          font-size: 13px !important;
          opacity: 0.8;
        }

        .required-fields-info {
          margin-top: 24px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .required-fields-info h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
        }

        .required-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .required-field {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
        }

        .required-field.mapped {
          background: #dcfce7;
          color: #166534;
        }

        .required-field.missing {
          background: #fee2e2;
          color: #991b1b;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 20px 24px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: white;
          color: #64748b;
          border: 1px solid #cbd5e1;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #f8fafc;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }
      `}</style>
    </div>
  );
};

export default HeaderMappingConfirmation;
