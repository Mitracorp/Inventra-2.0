import React, { useState } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import CSVUploader from '../components/CSVUploader';
import ImportPreview from '../components/ImportPreview';
import ImportConfirmationDialog from '../components/ImportConfirmationDialog';
import HeaderMappingConfirmation from '../components/HeaderMappingConfirmation';
import AssetGroupingPreview from '../components/AssetGroupingPreview';
import NewOptionsDialog from '../components/NewOptionsDialog';
import HeaderMapper from '../utils/headerMapper';
import AssetGrouper from '../utils/assetGrouper';
import apiService from '../services/apiService';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const CSVImport = () => {
  usePageTitle('CSV Import');
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1); // 1: Upload, 1.5: Header Mapping, 1.7: Grouping, 2: Preview, 3: Import
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [originalData, setOriginalData] = useState(null); // Store original data before transformation
  const [detectedHeaders, setDetectedHeaders] = useState(null);
  const [headerMapping, setHeaderMapping] = useState(null);
  const [showHeaderMapping, setShowHeaderMapping] = useState(false);
  const [groupingPreview, setGroupingPreview] = useState(null);
  const [showGroupingPreview, setShowGroupingPreview] = useState(false);
  const [groupedData, setGroupedData] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
  const [validationSummary, setValidationSummary] = useState(null);
  const [newOptions, setNewOptions] = useState(null);
  const [showNewOptionsDialog, setShowNewOptionsDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [processing, setProcessing] = useState(false);

  // File processing and validation
  const handleFileSelect = async (file) => {
    setSelectedFile(file);
    setParsedData(null);
    setValidationResults(null);
    setValidationSummary(null);
    setImportResults(null);
    
    if (file) {
      setProcessing(true);
      try {
        await processFile(file);
      } catch (error) {
        console.error('Error processing file:', error);
        // Handle error - maybe show notification
      } finally {
        setProcessing(false);
      }
    } else {
      setCurrentStep(1);
    }
  };

  const processFile = async (file) => {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    let data = [];

    if (fileExtension === 'csv') {
      // Parse CSV
      data = await new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              console.warn('CSV parsing warnings:', results.errors);
            }
            resolve(results.data);
          },
          error: reject
        });
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Parse Excel
      data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array', cellText: false, cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
              defval: '',
              raw: false,
              blankrows: false
            });
            console.log('Excel parsed, sample row:', jsonData[0]);
            resolve(jsonData);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    }

    if (data.length === 0) {
      throw new Error('No data found in the file');
    }

    // Store original data
    setOriginalData(data);
    
    // Detect headers and create mapping
    const headers = Object.keys(data[0]);
    setDetectedHeaders(headers);
    
    const mappingResult = HeaderMapper.mapHeaders(headers);
    setHeaderMapping(mappingResult);
    
    console.log('Header Mapping Result:', mappingResult);
    console.log('First row raw data:', data[0]);
    console.log('Checking specific fields in first row:', {
      Windows: data[0]['Windows'],
      'Microsoft Office': data[0]['Microsoft Office'],
      'Monthly Price': data[0]['Monthly Price'],
      Department: data[0]['Department'],
      Position: data[0]['Position']
    });
    
    // Check if mapping is valid
    const validation = HeaderMapper.validateMapping(mappingResult.mapping);
    
    if (!validation.isValid || mappingResult.unmapped.length > 0 || mappingResult.duplicates.length > 0) {
      // Show header mapping confirmation
      setShowHeaderMapping(true);
    } else {
      // Auto-map and continue
      const transformedData = HeaderMapper.transformData(data, mappingResult.mapping);
      
      console.log('After transformation, first row:', transformedData[0]);
      console.log('Transformed specific fields:', {
        windows: transformedData[0].windows,
        microsoft_office: transformedData[0].microsoft_office,
        monthly_prices: transformedData[0].monthly_prices,
        department: transformedData[0].department,
        position: transformedData[0].position
      });
      
      // Check if data needs grouping (duplicate assets with different peripherals)
      const needsGrouping = AssetGrouper.needsGrouping(transformedData);
      
      if (needsGrouping) {
        console.log('Asset grouping needed (auto-mapped) - showing preview');
        const preview = AssetGrouper.previewGrouping(transformedData);
        setGroupingPreview(preview);
        setShowGroupingPreview(true);
        setParsedData(transformedData); // Store for potential grouping
      } else {
        // No grouping needed, proceed directly to validation
        setParsedData(transformedData);
        const validationResults = await validateData(transformedData, false);
        setValidationResults(validationResults);
        setCurrentStep(2);
      }
    }
  };

  const validateData = async (data, isGroupedData = false) => {
    const validationResults = [];
    
    // Define validation rules - using standard field names from HeaderMapper
    const requiredFields = [
      { key: 'project_ref_num', alternatives: ['project_reference_num'], label: 'project reference number' },
      { key: 'serial_number', alternatives: [], label: 'serial number' },
      { key: 'tag_id', alternatives: [], label: 'tag ID' },
      { key: 'item_name', alternatives: [], label: 'item name' }
    ];
    const validStatuses = ['Active', 'Inactive', 'Maintenance'];
    
    // Track unique values for uniqueness validation (only if not grouped data)
    const seenSerialNumbers = new Set();
    const seenTagIds = new Set();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const errors = [];

      // Check required fields (accept both primary and alternative field names)
      requiredFields.forEach(field => {
        const value = row[field.key] || field.alternatives.find(alt => row[alt]);
        if (!value || String(value).trim() === '') {
          errors.push({
            field: field.key,
            message: `${field.label} is required`
          });
        }
      });

      // Check unique fields (skip uniqueness check if data is already grouped)
      if (!isGroupedData) {
        if (row.serial_number) {
          const serialNum = String(row.serial_number).trim();
          if (seenSerialNumbers.has(serialNum)) {
            errors.push({
              field: 'serial_number',
              message: 'Duplicate serial number detected - asset grouping may be needed'
            });
          } else {
            seenSerialNumbers.add(serialNum);
          }
        }

        if (row.tag_id) {
          const tagId = String(row.tag_id).trim();
          if (seenTagIds.has(tagId)) {
            errors.push({
              field: 'tag_id',
              message: 'Duplicate tag ID detected - asset grouping may be needed'
            });
          } else {
            seenTagIds.add(tagId);
          }
        }
      }

      // Check status value (case-insensitive)
      if (row.status) {
        const normalizedStatus = validStatuses.find(
          validStatus => validStatus.toLowerCase() === String(row.status).toLowerCase().trim()
        );
        if (!normalizedStatus) {
          errors.push({
            field: 'status',
            message: `Status must be one of: ${validStatuses.join(', ')} (case-insensitive)`
          });
        } else if (normalizedStatus !== row.status) {
          // Normalize the status value in the data
          row.status = normalizedStatus;
        }
      }

      // Check data formats
      if (row.serial_number && !/^[a-zA-Z0-9\-_]+$/.test(row.serial_number)) {
        errors.push({
          field: 'serial_number',
          message: 'Serial number should contain only alphanumeric characters, hyphens, and underscores'
        });
      }

      // If row has peripherals array (grouped data), validate peripheral data
      if (row.peripherals && Array.isArray(row.peripherals)) {
        row.peripherals.forEach((peripheral, pIndex) => {
        });
      }

      validationResults.push(errors);
    }

    return validationResults;
  };

  const handleValidationComplete = (summary) => {
    setValidationSummary(summary);
  };

  const handleHeaderMappingConfirm = async (confirmedMapping) => {
    setShowHeaderMapping(false);
    
    // Transform data using confirmed mapping
    const transformedData = HeaderMapper.transformData(originalData, confirmedMapping);
    
    console.log('Transformed Data:', transformedData);
    
    // Check if data needs grouping (duplicate assets with different peripherals)
    const needsGrouping = AssetGrouper.needsGrouping(transformedData);
    
    if (needsGrouping) {
      console.log('Asset grouping needed - showing preview');
      const preview = AssetGrouper.previewGrouping(transformedData);
      setGroupingPreview(preview);
      setShowGroupingPreview(true);
      setParsedData(transformedData); // Store for potential grouping
    } else {
      // No grouping needed, proceed directly to validation
      setParsedData(transformedData);
      const validationResults = await validateData(transformedData, false);
      setValidationResults(validationResults);
      setCurrentStep(2);
    }
  };

  const handleHeaderMappingCancel = () => {
    setShowHeaderMapping(false);
    resetImport();
  };

  const handleGroupingConfirm = async () => {
    setShowGroupingPreview(false);
    
    // Group the assets
    const groupingResult = AssetGrouper.groupAssets(parsedData);
    const finalData = AssetGrouper.transformForBackend(groupingResult.groupedAssets);
    
    console.log('Grouped Data:', finalData);
    console.log('Grouping Info:', groupingResult.groupingInfo);
    
    setGroupedData(finalData);
    setParsedData(finalData); // Update parsedData with grouped data
    
    // Validate the grouped data (passing true to skip duplicate checks)
    const validationResults = await validateData(finalData, true);
    setValidationResults(validationResults);
    setCurrentStep(2);
  };

  const handleGroupingCancel = () => {
    setShowGroupingPreview(false);
    resetImport();
  };

  const handleConfirmImport = async (importOption, enableUpdate) => {
    setImporting(true);
    try {
      let dataToImport = parsedData;
      
      if (importOption === 'valid-only') {
        // Filter only valid rows
        dataToImport = parsedData.filter((row, index) => {
          const rowErrors = validationResults[index] || [];
          return rowErrors.length === 0;
        });
      }

      // Call the bulk import API with upsert flag
      const result = await apiService.bulkImportAssets(dataToImport, enableUpdate);
      
      setImportResults(result);
      setShowConfirmDialog(false);
      setCurrentStep(3);
      
    } catch (error) {
      console.error('Import failed:', error);
      // If error is about duplicates or no new data, treat as partial success
      const isDuplicateError = error.message?.includes('already exist') || error.message?.includes('duplicate');
      
      setImportResults({
        success: isDuplicateError,
        error: isDuplicateError ? null : error.message,
        imported: 0,
        failed: isDuplicateError ? 0 : (parsedData?.length || 0),
        duplicates: isDuplicateError ? (parsedData?.length || 0) : 0,
        warnings: isDuplicateError ? [{ message: error.message }] : []
      });
      setShowConfirmDialog(false);
      setCurrentStep(3);
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setCurrentStep(1);
    setSelectedFile(null);
    setParsedData(null);
    setValidationResults(null);
    setValidationSummary(null);
    setImportResults(null);
    setNewOptions(null);
    setShowNewOptionsDialog(false);
  };

  const handleProceedToImport = async () => {
    try {
      setProcessing(true);
      console.log('🔍 Validating import data...', parsedData);
      
      // Validate and check for new options
      const validationResult = await apiService.validateImportAssets(parsedData);
      console.log('✅ Validation result:', validationResult);
      
      if (validationResult.success && validationResult.hasNewOptions) {
        console.log('📦 New options detected:', validationResult.newOptions);
        setNewOptions(validationResult.newOptions);
        setShowNewOptionsDialog(true);
      } else {
        console.log('ℹ️ No new options detected, proceeding to confirmation');
        setShowConfirmDialog(true);
      }
    } catch (error) {
      console.error('❌ Validation error:', error);
      // Proceed anyway if validation fails
      setShowConfirmDialog(true);
    } finally {
      setProcessing(false);
    }
  };

  const handleNewOptionsConfirm = () => {
    setShowNewOptionsDialog(false);
    setShowConfirmDialog(true);
  };

  const handleNewOptionsCancel = () => {
    setShowNewOptionsDialog(false);
  };

  const goToAssets = () => {
    // Navigate to assets with refresh flag to reload data
    navigate('/assets', { state: { refresh: true } });
  };

  return (
    <div className="csv-import-page">
      <style>{`
        .csv-import-page {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 32px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e2e8f0;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .back-button {
          display: flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: 1px solid #e2e8f0;
          color: #64748b;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-button:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #475569;
        }

        .page-title {
          font-size: 28px;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }

        .btn-outline {
          background: white;
          color: #3b82f6;
          border: 1px solid #3b82f6;
        }

        .btn-outline:hover {
          background: #eff6ff;
        }

        .progress-indicator {
          display: flex;
          align-items: center;
          margin-bottom: 32px;
          max-width: 600px;
        }

        .progress-step {
          display: flex;
          align-items: center;
          flex: 1;
          position: relative;
        }

        .step-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 14px;
          background: #f1f5f9;
          color: #64748b;
          border: 2px solid #e2e8f0;
          z-index: 2;
          position: relative;
        }

        .progress-step.active .step-circle {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .progress-step.completed .step-circle {
          background: #22c55e;
          color: white;
          border-color: #22c55e;
        }

        .step-label {
          margin-left: 12px;
          font-weight: 500;
          color: #64748b;
        }

        .progress-step.active .step-label {
          color: #1e293b;
        }

        .step-connector {
          height: 2px;
          background: #e2e8f0;
          flex: 1;
          margin: 0 16px;
        }

        .progress-step.completed + .progress-step .step-connector {
          background: #22c55e;
        }

        .content-section {
          background: white;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          margin-bottom: 24px;
        }

        .section-header {
          padding: 24px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .section-title {
          font-size: 20px;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 8px 0;
        }

        .section-subtitle {
          color: #64748b;
          margin: 0;
        }

        .section-content {
          padding: 24px;
        }

        .import-results {
          text-align: center;
          padding: 40px 20px;
        }

        .result-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 16px;
        }

        .result-icon.success {
          color: #22c55e;
        }

        .result-icon.error {
          color: #ef4444;
        }

        .result-title {
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 8px 0;
        }

        .result-title.success {
          color: #166534;
        }

        .result-title.error {
          color: #dc2626;
        }

        .result-message {
          color: #64748b;
          margin: 0 0 24px 0;
          font-size: 16px;
        }

        .result-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
          margin: 24px 0;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }

        .stat-item {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }

        .stat-number {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 4px 0;
          color: #1e293b;
        }

        .stat-label {
          font-size: 12px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 500;
          margin: 0;
        }

        .result-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover {
          background: #2563eb;
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
      `}</style>

      <div className="page-header">
        <div className="header-left">
          <button className="back-button" onClick={() => navigate('/assets')}>
            <ArrowLeft size={20} />
            Back to Assets
          </button>
          <h1 className="page-title">CSV Bulk Import</h1>
        </div>
      </div>

      <div className="progress-indicator">
        <div className={`progress-step ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
          <div className="step-circle">1</div>
          <div className="step-label">Upload File</div>
        </div>
        <div className="step-connector"></div>
        <div className={`progress-step ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
          <div className="step-circle">2</div>
          <div className="step-label">Preview & Validate</div>
        </div>
        <div className="step-connector"></div>
        <div className={`progress-step ${currentStep >= 3 ? 'active' : ''}`}>
          <div className="step-circle">3</div>
          <div className="step-label">Import Complete</div>
        </div>
      </div>

      {currentStep === 1 && (
        <div className="content-section">
          <div className="section-header">
            <h2 className="section-title">Upload CSV File</h2>
            <p className="section-subtitle">
              Select a CSV, XLS, or XLSX file containing asset data to import. The file will be validated before import.
            </p>
          </div>
          <div className="section-content">
            <CSVUploader 
              onFileSelect={handleFileSelect}
              loading={processing}
            />
          </div>
        </div>
      )}

      {currentStep === 2 && parsedData && (
        <div className="content-section">
          <div className="section-header">
            <h2 className="section-title">Data Preview & Validation</h2>
            <p className="section-subtitle">
              Review your data and validation results before importing. Fix any issues or proceed with valid records only.
            </p>
          </div>
          <div className="section-content">
            <ImportPreview
              parsedData={parsedData}
              validationResults={validationResults}
              onValidationComplete={handleValidationComplete}
            />
            
            {validationSummary && (
              <div style={{ marginTop: '24px', textAlign: 'center' }}>
                <button 
                  className="btn btn-primary"
                  onClick={handleProceedToImport}
                  disabled={processing}
                  style={{ marginRight: '12px' }}
                >
                  {processing ? 'Validating...' : 'Proceed to Import'}
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={resetImport}
                  disabled={processing}
                >
                  Upload Different File
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {currentStep === 3 && importResults && (
        <div className="content-section">
          <div className="section-content">
            <div className="import-results">
              {importResults.success ? (
                <CheckCircle className="result-icon success" />
              ) : (
                <AlertCircle className="result-icon error" />
              )}
              
              <h2 className={`result-title ${importResults.success ? 'success' : 'error'}`}>
                {importResults.success 
                  ? (importResults.imported > 0 
                      ? 'Import Completed Successfully!' 
                      : 'Import Completed - No New Assets Added')
                  : 'Import Failed'}
              </h2>
              
              <p className="result-message">
                {importResults.success 
                  ? (importResults.imported > 0 
                      ? 'Your asset data has been imported and is now available in the system.'
                      : 'All assets in the file already exist in the system or were skipped due to duplicates.')
                  : `Import failed: ${importResults.error || 'Unknown error occurred'}`
                }
              </p>

              {importResults.success && (
                <div className="result-stats">
                  {importResults.assetsCreated > 0 && (
                    <div className="stat-item">
                      <div className="stat-number">{importResults.assetsCreated || 0}</div>
                      <div className="stat-label">Created</div>
                    </div>
                  )}
                  {importResults.updated > 0 && (
                    <div className="stat-item">
                      <div className="stat-number" style={{ color: '#3b82f6' }}>{importResults.updated || 0}</div>
                      <div className="stat-label">Updated</div>
                    </div>
                  )}
                  {importResults.duplicates > 0 && (
                    <div className="stat-item">
                      <div className="stat-number" style={{ color: '#ff9800' }}>{importResults.duplicates || 0}</div>
                      <div className="stat-label">Duplicates Skipped</div>
                    </div>
                  )}
                  {importResults.skipped > 0 && (
                    <div className="stat-item">
                      <div className="stat-number" style={{ color: '#9e9e9e' }}>{importResults.skipped || 0}</div>
                      <div className="stat-label">Skipped</div>
                    </div>
                  )}
                  {importResults.failed > 0 && (
                    <div className="stat-item">
                      <div className="stat-number" style={{ color: '#f44336' }}>{importResults.failed || 0}</div>
                      <div className="stat-label">Failed</div>
                    </div>
                  )}
                </div>
              )}
              
              {importResults.warnings && importResults.warnings.length > 0 && (
                <div style={{ 
                  marginTop: '20px', 
                  padding: '15px', 
                  backgroundColor: '#fff3e0', 
                  borderRadius: '8px',
                  textAlign: 'left',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  border: '1px solid #ffe0b2'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <AlertTriangle size={20} style={{ color: '#ff9800' }} />
                    <h4 style={{ margin: 0, color: '#ff9800' }}>Warnings ({importResults.warnings.length})</h4>
                  </div>
                  {importResults.warnings.slice(0, 10).map((warning, idx) => (
                    <div key={idx} style={{ fontSize: '12px', marginBottom: '8px', color: '#666', paddingLeft: '28px' }}>
                      {warning.message || JSON.stringify(warning)}
                    </div>
                  ))}
                  {importResults.warnings.length > 10 && (
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '10px', paddingLeft: '28px' }}>
                      ... and {importResults.warnings.length - 10} more warnings
                    </div>
                  )}
                </div>
              )}

              <div className="result-actions">
                <button className="btn btn-primary" onClick={goToAssets}>
                  View Assets
                </button>
                <button className="btn btn-secondary" onClick={resetImport}>
                  Import More Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHeaderMapping && headerMapping && (
        <HeaderMappingConfirmation
          detectedHeaders={detectedHeaders}
          mappingResult={headerMapping}
          onConfirm={handleHeaderMappingConfirm}
          onCancel={handleHeaderMappingCancel}
        />
      )}

      {showGroupingPreview && groupingPreview && (
        <AssetGroupingPreview
          groupingResult={groupingPreview}
          onConfirm={handleGroupingConfirm}
          onCancel={handleGroupingCancel}
        />
      )}

      {showNewOptionsDialog && newOptions && (
        <NewOptionsDialog
          newOptions={newOptions}
          onConfirm={handleNewOptionsConfirm}
          onCancel={handleNewOptionsCancel}
        />
      )}

      <ImportConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        validationSummary={validationSummary}
        parsedData={parsedData}
        onConfirmImport={handleConfirmImport}
        loading={importing}
      />
    </div>
  );
};

export default CSVImport;