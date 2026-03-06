import React, { useState, useRef, useEffect } from 'react';
import { Search, Check, X, RotateCcw, GripVertical, Eye, EyeOff, Lightbulb } from 'lucide-react';
import ColumnConfigService from '../services/columnConfigService';

/**
 * ColumnFilterPopup - Right sidebar component for customizing table columns
 * Features:
 * - Toggle column visibility with checkboxes
 * - Drag-and-drop reordering
 * - Search/filter columns
 * - Reset to default
 * - Sidebar design with smooth slide animation
 */
const ColumnFilterPopup = ({ isOpen, onClose, columns, onApply }) => {
  const [localColumns, setLocalColumns] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [dragPosition, setDragPosition] = useState(null); // 'top' or 'bottom'
  const popupRef = useRef(null);
  const listRef = useRef(null);

  // Initialize local state when popup opens
  useEffect(() => {
    if (isOpen) {
      setLocalColumns([...columns]);
      setSearchTerm('');
    }
  }, [isOpen, columns]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        handleCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Filter columns based on search term
  const filteredColumns = localColumns.filter(col =>
    col.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    col.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle drag start
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
    e.target.style.opacity = '0.4';
  };

  // Handle drag over
  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedIndex !== index) {
      setDragOverIndex(index);
      
      // Determine if hovering over top or bottom third of the item (more sensitive)
      const rect = e.currentTarget.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const threshold = rect.height * 0.35; // 35% from top/bottom for more sensitive detection
      
      let position;
      if (relativeY < threshold) {
        position = 'top';
      } else if (relativeY > rect.height - threshold) {
        position = 'bottom';
      } else {
        position = 'bottom'; // Default to bottom for middle area
      }
      
      setDragPosition(position);
    }
  };

  // Handle drag end
  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDragPosition(null);
  };

  // Handle drop
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragPosition(null);
      return;
    }

    // Adjust drop index based on position (top or bottom)
    let finalDropIndex = dropIndex;
    if (dragPosition === 'bottom' && draggedIndex < dropIndex) {
      finalDropIndex = dropIndex;
    } else if (dragPosition === 'bottom' && draggedIndex > dropIndex) {
      finalDropIndex = dropIndex + 1;
    } else if (dragPosition === 'top' && draggedIndex > dropIndex) {
      finalDropIndex = dropIndex;
    }

    // Reorder columns
    const reordered = ColumnConfigService.reorderColumns(
      localColumns,
      draggedIndex,
      finalDropIndex
    );
    
    setLocalColumns(reordered);
    
    // PERSISTENCE FIX: Save column order immediately when reordered
    ColumnConfigService.saveConfig(reordered);
    
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDragPosition(null);
  };

  // Toggle column visibility
  const handleToggle = (columnKey) => {
    const updated = ColumnConfigService.toggleColumn(localColumns, columnKey);
    setLocalColumns(updated);
    // PERSISTENCE FIX: Save column visibility immediately when toggled
    ColumnConfigService.saveConfig(updated);
  };

  // Select all columns
  const handleSelectAll = () => {
    const updated = localColumns.map(col => ({ ...col, visible: true }));
    setLocalColumns(updated);
    // PERSISTENCE FIX: Save immediately when selecting all
    ColumnConfigService.saveConfig(updated);
  };

  // Deselect all columns
  const handleDeselectAll = () => {
    const updated = localColumns.map(col => ({ ...col, visible: false }));
    setLocalColumns(updated);
    // PERSISTENCE FIX: Save immediately when deselecting all
    ColumnConfigService.saveConfig(updated);
  };

  // Reset to default configuration
  const handleReset = () => {
    const defaultConfig = ColumnConfigService.resetToDefault();
    setLocalColumns(defaultConfig);
    // Immediately save the reset configuration
    ColumnConfigService.saveConfig(defaultConfig);
    onApply(defaultConfig);
  };

  // Apply changes and close
  const handleApply = () => {
    // Save configuration (order already saved on reorder, but save visibility changes)
    ColumnConfigService.saveConfig(localColumns);
    onApply(localColumns);
    onClose();
  };

  // Cancel and close without saving
  const handleCancel = () => {
    // Reload from localStorage to get the most recent saved state
    const savedConfig = ColumnConfigService.loadConfig();
    setLocalColumns(savedConfig);
    onApply(savedConfig); // Update parent with saved config
    onClose();
  };

  // Count visible columns
  const visibleCount = localColumns.filter(col => col.visible).length;

  if (!isOpen) return null;

  return (
    <div className="column-filter-overlay">
      <div className={`column-filter-sidebar ${isOpen ? 'column-filter-sidebar-open' : ''}`} ref={popupRef}>
        {/* Header */}
        <div className="column-filter-header">
          <h3>Customize Columns</h3>
          <button 
            className="column-filter-close-btn" 
            onClick={handleCancel}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search bar */}
        <div className="column-filter-search">
          <Search size={16} className="column-filter-search-icon" />
          <input
            type="text"
            placeholder="Search columns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="column-filter-search-input"
          />
        </div>

        {/* Action buttons */}
        <div className="column-filter-actions">
          <button onClick={handleSelectAll} className="column-filter-action-btn">
            <Eye size={14} style={{ marginRight: '6px' }} />
            Select All
          </button>
          <button onClick={handleDeselectAll} className="column-filter-action-btn">
            <EyeOff size={14} style={{ marginRight: '6px' }} />
            Deselect All
          </button>
          <button onClick={handleReset} className="column-filter-action-btn column-filter-reset-btn">
            <RotateCcw size={14} style={{ marginRight: '6px' }} />
            Reset to Default
          </button>
        </div>

        {/* Column list */}
        <div className="column-filter-list-container">
          <div className="column-filter-list-header">
            <span className="column-filter-drag-hint">
              <Lightbulb size={14} style={{ marginRight: '6px' }} />
              Drag to reorder
            </span>
            <span className="column-filter-visible-count">
              {visibleCount} of {localColumns.length} visible
            </span>
          </div>

          <div className="column-filter-list" ref={listRef}>
            {filteredColumns.length === 0 ? (
              <div className="column-filter-no-results">
                No columns match "{searchTerm}"
              </div>
            ) : (
              filteredColumns.map((column, index) => (
                <div
                  key={column.key}
                  className={`column-filter-item ${
                    column.visible ? 'column-filter-item-visible' : ''
                  } ${
                    draggedIndex === index ? 'column-filter-item-dragging' : ''
                  } ${
                    dragOverIndex === index ? 'column-filter-item-drag-over' : ''
                  } ${
                    dragOverIndex === index && dragPosition === 'top' ? 'column-filter-item-drag-over-top' : ''
                  } ${
                    dragOverIndex === index && dragPosition === 'bottom' ? 'column-filter-item-drag-over-bottom' : ''
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  {/* Drag handle */}
                  <span className="column-filter-drag-handle" title="Drag to reorder">
                    <GripVertical size={16} />
                  </span>

                  {/* Checkbox */}
                  <label className="column-filter-checkbox-label">
                    <input
                      type="checkbox"
                      checked={column.visible}
                      onChange={() => handleToggle(column.key)}
                      className="column-filter-checkbox"
                    />
                    <span className="column-filter-label-text">{column.label}</span>
                  </label>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer action buttons */}
        <div className="column-filter-footer">
          <div className="column-filter-footer-buttons">
            <button 
              className="column-filter-cancel-btn" 
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button 
              className="column-filter-apply-btn" 
              onClick={handleApply}
              disabled={visibleCount === 0}
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColumnFilterPopup;
