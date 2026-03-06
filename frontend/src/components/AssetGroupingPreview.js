import React from 'react';
import { Users, Package, AlertTriangle, CheckCircle, Layers } from 'lucide-react';

const AssetGroupingPreview = ({ groupingResult, onConfirm, onCancel }) => {
  const { summary, preview, hasMore } = groupingResult;

  return (
    <div className="asset-grouping-modal">
      <div className="modal-overlay" onClick={onCancel} />
      <div className="modal-content">
        <div className="modal-header">
          <div className="header-icon">
            <Layers size={24} />
          </div>
          <div className="header-text">
            <h2>Asset Grouping Detected</h2>
            <p>Multiple rows represent the same assets with different peripherals</p>
          </div>
        </div>

        <div className="modal-body">
          {/* Summary Statistics */}
          <div className="grouping-stats">
            <div className="stat-card primary">
              <div className="stat-icon">
                <Package size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-number">{summary.uniqueAssets}</div>
                <div className="stat-label">Unique Assets</div>
                <div className="stat-detail">from {summary.totalInputRows} rows</div>
              </div>
            </div>

            <div className="stat-card success">
              <div className="stat-icon">
                <Layers size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-number">{summary.rowsGrouped}</div>
                <div className="stat-label">Rows Grouped</div>
                <div className="stat-detail">{summary.reductionPercentage}% reduction</div>
              </div>
            </div>

            <div className="stat-card info">
              <div className="stat-icon">
                <Users size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-number">{summary.totalPeripherals}</div>
                <div className="stat-label">Total Peripherals</div>
                <div className="stat-detail">{summary.assetsWithMultiplePeripherals} assets with multiple</div>
              </div>
            </div>
          </div>

          {/* Conflicts Warning */}
          {summary.conflicts.length > 0 && (
            <div className="conflicts-warning">
              <div className="warning-header">
                <AlertTriangle size={20} />
                <h4>Data Conflicts Detected ({summary.conflicts.length})</h4>
              </div>
              <p className="warning-message">
                Some rows with the same identifiers have different core asset data. 
                The first occurrence will be used.
              </p>
              <div className="conflicts-list">
                {summary.conflicts.slice(0, 3).map((conflict, index) => (
                  <div key={index} className="conflict-item">
                    <strong>{conflict.field}:</strong>
                    <span className="conflict-values">
                      Rows {conflict.existingRows.join(', ')} = "{conflict.existingValue}" 
                      vs Row {conflict.conflictRow} = "{conflict.newValue}"
                    </span>
                  </div>
                ))}
                {summary.conflicts.length > 3 && (
                  <div className="more-conflicts">
                    + {summary.conflicts.length - 3} more conflicts
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Grouping Preview */}
          <div className="grouping-preview">
            <h3>Grouping Preview</h3>
            <p className="preview-description">
              Here's how your data will be grouped. Each asset will be created once with all peripherals attached.
            </p>

            <div className="preview-list">
              {preview.map((asset, index) => (
                <div key={index} className="preview-item">
                  <div className="asset-header">
                    <div className="asset-info">
                      <span className="asset-serial">{asset.serial_number}</span>
                      {asset.tag_id && (
                        <span className="asset-tag">Tag: {asset.tag_id}</span>
                      )}
                    </div>
                    <div className="asset-meta">
                      <span className="source-rows">
                        From rows: {asset.sourceRows.join(', ')}
                      </span>
                    </div>
                  </div>

                  <div className="asset-details">
                    <div className="detail-item">
                      <strong>Item:</strong> {asset.item_name}
                    </div>
                  </div>

                  {asset.peripherals.length > 0 && (
                    <div className="peripherals-section">
                      <div className="peripherals-header">
                        <Package size={14} />
                        <span>Peripherals ({asset.peripheralCount})</span>
                      </div>
                      <div className="peripherals-list">
                        {asset.peripherals.map((peripheral, pIndex) => (
                          <div key={pIndex} className="peripheral-item">
                            <span className="peripheral-name">{peripheral.name}</span>
                            {peripheral.serial && (
                              <span className="peripheral-serial">S/N: {peripheral.serial}</span>
                            )}
                            <span className="peripheral-source">Row {peripheral.sourceRow}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {hasMore && (
                <div className="preview-more">
                  <span>+ More grouped assets not shown...</span>
                </div>
              )}
            </div>
          </div>

          {/* Information Box */}
          <div className="info-box">
            <CheckCircle size={16} />
            <div className="info-content">
              <strong>What this means:</strong>
              <p>
                Instead of creating {summary.totalInputRows} separate assets, the system will create {summary.uniqueAssets} unique assets 
                with their respective peripherals properly attached. This prevents duplicate assets in your inventory.
              </p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel Import
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            <CheckCircle size={18} />
            Confirm & Continue
          </button>
        </div>
      </div>

      <style>{`
        .asset-grouping-modal {
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
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
        }

        .modal-content {
          position: relative;
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 900px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 24px;
          border-bottom: 1px solid #e2e8f0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 16px 16px 0 0;
        }

        .header-icon {
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-text h2 {
          margin: 0 0 4px 0;
          font-size: 22px;
          font-weight: 700;
        }

        .header-text p {
          margin: 0;
          font-size: 14px;
          opacity: 0.9;
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .grouping-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          display: flex;
          gap: 12px;
          padding: 16px;
          border-radius: 12px;
          border: 2px solid;
        }

        .stat-card.primary {
          background: #eff6ff;
          border-color: #3b82f6;
          color: #1e40af;
        }

        .stat-card.success {
          background: #f0fdf4;
          border-color: #22c55e;
          color: #166534;
        }

        .stat-card.info {
          background: #faf5ff;
          border-color: #a855f7;
          color: #6b21a8;
        }

        .stat-icon {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.8);
        }

        .stat-content {
          flex: 1;
        }

        .stat-number {
          font-size: 28px;
          font-weight: 700;
          line-height: 1;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 13px;
          font-weight: 600;
          opacity: 0.8;
        }

        .stat-detail {
          font-size: 11px;
          opacity: 0.7;
          margin-top: 2px;
        }

        .conflicts-warning {
          background: #fef2f2;
          border: 2px solid #fca5a5;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
        }

        .warning-header {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #991b1b;
          margin-bottom: 8px;
        }

        .warning-header h4 {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
        }

        .warning-message {
          margin: 0 0 12px 0;
          font-size: 13px;
          color: #7f1d1d;
        }

        .conflicts-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .conflict-item {
          padding: 8px 12px;
          background: white;
          border-radius: 6px;
          font-size: 12px;
          color: #7f1d1d;
        }

        .conflict-item strong {
          color: #991b1b;
          margin-right: 6px;
        }

        .conflict-values {
          font-family: 'Courier New', monospace;
        }

        .more-conflicts {
          padding: 8px 12px;
          text-align: center;
          font-size: 12px;
          color: #991b1b;
          font-weight: 500;
        }

        .grouping-preview {
          margin-bottom: 24px;
        }

        .grouping-preview h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }

        .preview-description {
          margin: 0 0 16px 0;
          font-size: 13px;
          color: #64748b;
        }

        .preview-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .preview-item {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }

        .asset-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .asset-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .asset-serial {
          font-weight: 600;
          color: #0f172a;
          font-size: 14px;
        }

        .asset-tag {
          font-size: 12px;
          color: #64748b;
          padding: 2px 8px;
          background: white;
          border-radius: 4px;
        }

        .asset-meta {
          font-size: 11px;
          color: #64748b;
        }

        .source-rows {
          font-family: 'Courier New', monospace;
        }

        .asset-details {
          padding: 12px 16px;
          background: white;
        }

        .detail-item {
          font-size: 13px;
          color: #475569;
        }

        .detail-item strong {
          color: #1e293b;
          margin-right: 6px;
        }

        .peripherals-section {
          padding: 12px 16px;
          background: #fefce8;
          border-top: 1px solid #fde047;
        }

        .peripherals-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #713f12;
          margin-bottom: 8px;
        }

        .peripherals-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .peripheral-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 12px;
          background: white;
          border-radius: 4px;
          font-size: 12px;
        }

        .peripheral-name {
          font-weight: 500;
          color: #0f172a;
        }

        .peripheral-serial {
          color: #64748b;
          font-family: 'Courier New', monospace;
        }

        .peripheral-source {
          margin-left: auto;
          color: #94a3b8;
          font-size: 11px;
        }

        .preview-more {
          padding: 16px;
          text-align: center;
          color: #64748b;
          font-size: 13px;
          font-style: italic;
        }

        .info-box {
          display: flex;
          gap: 12px;
          padding: 16px;
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          color: #0c4a6e;
        }

        .info-box svg {
          flex-shrink: 0;
          color: #0284c7;
          margin-top: 2px;
        }

        .info-content strong {
          display: block;
          margin-bottom: 4px;
          font-size: 13px;
        }

        .info-content p {
          margin: 0;
          font-size: 12px;
          line-height: 1.5;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 20px 24px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 0 0 16px 16px;
        }

        .btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary {
          background: white;
          color: #64748b;
          border: 1px solid #cbd5e1;
        }

        .btn-secondary:hover {
          background: #f8fafc;
          border-color: #94a3b8;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
      `}</style>
    </div>
  );
};

export default AssetGroupingPreview;
