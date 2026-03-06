import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';

const CSVUploader = ({ onFileSelect, loading }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // File validation settings
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

  const validateFile = (file) => {
    setError(null);

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
      return false;
    }

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExtension) && !ALLOWED_TYPES.includes(file.type)) {
      setError('Only CSV, XLS, and XLSX files are allowed');
      return false;
    }

    return true;
  };

  const handleFileSelection = (file) => {
    if (validateFile(file)) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onFileSelect(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="csv-uploader">
      <style jsx>{`
        .csv-uploader {
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
        }

        .upload-zone {
          border: 2px dashed #cbd5e1;
          border-radius: 12px;
          padding: 40px 20px;
          text-align: center;
          background: #f8fafc;
          transition: all 0.3s ease;
          cursor: pointer;
          position: relative;
        }

        .upload-zone:hover,
        .upload-zone.drag-active {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .upload-zone.has-file {
          border-color: #22c55e;
          background: #f0fdf4;
        }

        .upload-zone.has-error {
          border-color: #ef4444;
          background: #fef2f2;
        }

        .upload-icon {
          margin: 0 auto 16px;
          width: 48px;
          height: 48px;
          color: #64748b;
        }

        .upload-zone.drag-active .upload-icon,
        .upload-zone:hover .upload-icon {
          color: #3b82f6;
        }

        .upload-zone.has-file .upload-icon {
          color: #22c55e;
        }

        .upload-zone.has-error .upload-icon {
          color: #ef4444;
        }

        .upload-title {
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 8px;
        }

        .upload-subtitle {
          color: #64748b;
          margin-bottom: 16px;
        }

        .upload-button {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.2s;
        }

        .upload-button:hover {
          background: #2563eb;
        }

        .upload-button:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        .file-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 16px;
          margin-top: 16px;
        }

        .file-details {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .file-icon {
          width: 20px;
          height: 20px;
          color: #22c55e;
        }

        .file-name {
          font-weight: 500;
          color: #1e293b;
        }

        .file-size {
          color: #64748b;
          font-size: 14px;
        }

        .clear-button {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .clear-button:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #ef4444;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 12px 16px;
          margin-top: 16px;
          font-size: 14px;
        }

        .error-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        .file-requirements {
          margin-top: 16px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
          font-size: 14px;
          color: #64748b;
        }

        .file-requirements h4 {
          color: #1e293b;
          margin: 0 0 8px 0;
          font-size: 14px;
          font-weight: 600;
        }

        .file-requirements ul {
          margin: 8px 0 0 0;
          padding-left: 16px;
        }

        .file-requirements li {
          margin: 4px 0;
        }

        .loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e2e8f0;
          border-top: 3px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .hidden-input {
          display: none;
        }
      `}</style>

      <div
        className={`upload-zone ${dragActive ? 'drag-active' : ''} ${selectedFile ? 'has-file' : ''} ${error ? 'has-error' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !loading && fileInputRef.current?.click()}
      >
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileInputChange}
          className="hidden-input"
          disabled={loading}
        />

        {selectedFile ? (
          <CheckCircle className="upload-icon" />
        ) : error ? (
          <AlertCircle className="upload-icon" />
        ) : (
          <Upload className="upload-icon" />
        )}

        <h3 className="upload-title">
          {selectedFile ? 'File Selected' : error ? 'Upload Failed' : 'Upload CSV File'}
        </h3>
        
        <p className="upload-subtitle">
          {selectedFile
            ? 'File ready for processing'
            : 'Drag and drop your CSV file here, or click to browse'
          }
        </p>

        {!selectedFile && !loading && (
          <button
            className="upload-button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Choose File
          </button>
        )}
      </div>

      {selectedFile && (
        <div className="file-info">
          <div className="file-details">
            <FileText className="file-icon" />
            <div>
              <div className="file-name">{selectedFile.name}</div>
              <div className="file-size">{formatFileSize(selectedFile.size)}</div>
            </div>
          </div>
          <button
            className="clear-button"
            onClick={clearFile}
            disabled={loading}
            title="Remove file"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {error && (
        <div className="error-message">
          <AlertCircle className="error-icon" />
          <span>{error}</span>
        </div>
      )}

      <div className="file-requirements">
        <h4>File Requirements:</h4>
        <ul>
          <li>Supported formats: CSV, XLS, XLSX</li>
          <li>Maximum file size: 10MB</li>
          <li>Required columns: project_reference_num, serial_number, tag_id, item_name</li>
          <li>Ensure data follows the template format</li>
        </ul>
      </div>
    </div>
  );
};

export default CSVUploader;