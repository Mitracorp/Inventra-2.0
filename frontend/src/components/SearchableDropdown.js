import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';

const SearchableDropdown = ({ 
  options = [], 
  value, 
  onChange, 
  placeholder = "Select option...", 
  searchPlaceholder = "Search...",
  emptyMessage = "No options found",
  disabled = false,
  required = false,
  label,
  error,
  maxHeight = 200,
  clearable = true,
  renderOption,
  getOptionLabel = (option) => option.label || option.name || option,
  getOptionValue = (option) => option.value || option.id || option
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const optionRefs = useRef([]);

  // Filter options based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredOptions(options);
    } else {
      const filtered = options.filter(option => 
        getOptionLabel(option).toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOptions(filtered);
    }
    setHighlightedIndex(-1);
  }, [searchTerm, options, getOptionLabel]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex(prev => 
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
          break;
        case 'Enter':
          event.preventDefault();
          if (highlightedIndex >= 0) {
            handleSelectOption(filteredOptions[highlightedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setSearchTerm('');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, highlightedIndex, filteredOptions]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex].scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [highlightedIndex]);

  const handleSelectOption = (option) => {
    onChange(getOptionValue(option), option);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('', null);
  };

  const getDisplayValue = () => {
    if (!value) return '';
    const selectedOption = options.find(option => getOptionValue(option) === value);
    return selectedOption ? getOptionLabel(selectedOption) : value;
  };

  const defaultRenderOption = (option, index) => (
    <div
      key={getOptionValue(option)}
      ref={el => optionRefs.current[index] = el}
      className={`dropdown-option ${highlightedIndex === index ? 'highlighted' : ''}`}
      onClick={() => handleSelectOption(option)}
      onMouseEnter={() => setHighlightedIndex(index)}
    >
      {getOptionLabel(option)}
    </div>
  );

  return (
    <div className="searchable-dropdown-container" ref={dropdownRef}>
      <style>{`
        .searchable-dropdown-container {
          position: relative;
          width: 100%;
        }
        
        .dropdown-trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          min-height: 38px;
          transition: border-color 0.2s ease;
        }
        
        .dropdown-trigger:hover {
          border-color: #bbb;
        }
        
        .dropdown-trigger.open {
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }
        
        .dropdown-trigger.disabled {
          background: #f5f5f5;
          cursor: not-allowed;
          opacity: 0.7;
        }
        
        .dropdown-trigger.error {
          border-color: #dc3545;
        }
        
        .dropdown-value {
          flex: 1;
          color: ${!value ? '#999' : '#333'};
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .dropdown-icons {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .clear-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border: none;
          background: none;
          cursor: pointer;
          color: #666;
          border-radius: 50%;
          transition: background-color 0.2s ease;
        }
        
        .clear-button:hover {
          background: #f0f0f0;
          color: #333;
        }
        
        .chevron-icon {
          transition: transform 0.2s ease;
          color: #666;
        }
        
        .chevron-icon.open {
          transform: rotate(180deg);
        }
        
        .dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          margin-top: 2px;
          max-height: ${maxHeight}px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        
        .search-container {
          padding: 8px;
          border-bottom: 1px solid #eee;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        
        .search-input {
          flex: 1;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 6px 8px;
          outline: none;
          font-size: 14px;
        }
        
        .search-input:focus {
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }
        
        .options-container {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          max-height: ${maxHeight - 60}px;
        }
        
        .dropdown-option {
          padding: 10px 12px;
          cursor: pointer;
          border-bottom: 1px solid #f0f0f0;
          transition: background-color 0.2s ease;
        }
        
        .dropdown-option:last-child {
          border-bottom: none;
        }
        
        .dropdown-option:hover,
        .dropdown-option.highlighted {
          background-color: #f8f9fa;
        }
        
        .dropdown-option.highlighted {
          background-color: #e3f2fd;
        }
        
        .empty-message {
          padding: 12px;
          text-align: center;
          color: #666;
          font-style: italic;
        }
        
        .error-message {
          color: #dc3545;
          font-size: 12px;
          margin-top: 4px;
        }
        
        .label {
          display: block;
          margin-bottom: 4px;
          font-weight: 500;
          color: #333;
        }
        
        .required {
          color: #dc3545;
        }
      `}</style>

      {label && (
        <label className="label">
          {label}
          {required && <span className="required"> *</span>}
        </label>
      )}

      <div
        className={`dropdown-trigger ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''} ${error ? 'error' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="dropdown-value">
          {getDisplayValue() || placeholder}
        </span>
        
        <div className="dropdown-icons">
          {clearable && value && !disabled && (
            <button
              type="button"
              className="clear-button"
              onClick={handleClear}
              title="Clear selection"
            >
              <X size={12} />
            </button>
          )}
          <ChevronDown 
            size={16} 
            className={`chevron-icon ${isOpen ? 'open' : ''}`} 
          />
        </div>
      </div>

      {isOpen && (
        <div className="dropdown-menu">
          <div className="search-container">
            <Search size={16} color="#666" />
            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="options-container">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const isHighlighted = highlightedIndex === index;
                return (
                  <div
                    key={getOptionValue(option)}
                    ref={el => optionRefs.current[index] = el}
                    className={`dropdown-option ${isHighlighted ? 'highlighted' : ''}`}
                    onClick={() => handleSelectOption(option)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    {renderOption 
                      ? renderOption(option, index, isHighlighted)
                      : getOptionLabel(option)}
                  </div>
                );
              })
            ) : (
              <div className="empty-message">{emptyMessage}</div>
            )}
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default SearchableDropdown;