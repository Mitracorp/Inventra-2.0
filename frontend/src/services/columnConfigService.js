/**
 * Column Configuration Service
 * Manages column visibility, order, and persistence for the Assets table
 */

class ColumnConfigService {
  // Default visible columns (15 columns with peripherals)
  static defaultColumns = [
    { key: 'customer_name', label: 'Customer Name', visible: true, order: 0 },
    { key: 'branch', label: 'Branch', visible: true, order: 1 },
    { key: 'serial_number', label: 'Serial Number', visible: true, order: 2 },
    { key: 'tag_id', label: 'Tag ID', visible: true, order: 3 },
    { key: 'status', label: 'Status', visible: true, order: 4 },
    { key: 'item_name', label: 'Item Name', visible: true, order: 5 },
    { key: 'model', label: 'Model', visible: true, order: 6 },
    { key: 'category', label: 'Category', visible: true, order: 7 },
    { key: 'antivirus', label: 'Antivirus', visible: true, order: 8 },
    { key: 'windows', label: 'Windows', visible: true, order: 9 },
    { key: 'microsoft_office', label: 'Microsoft Office', visible: true, order: 10 },
    { key: 'software', label: 'Software', visible: true, order: 11 },
    { key: 'peripheral_type', label: 'Peripheral Name', visible: true, order: 12 },
    { key: 'peripheral_serial', label: 'Peripheral Serial Code', visible: true, order: 13 },
    { key: 'recipient_name', label: 'Recipient Name', visible: true, order: 14 }
  ];

  // All available columns (31 total with peripherals)
  static allColumns = [
    // Default visible columns
    ...this.defaultColumns,
    
    // Additional project-related columns
    { key: 'project_ref_num', label: 'Project Ref Number', visible: false, order: 15 },
    { key: 'project_title', label: 'Project Title', visible: false, order: 16 },
    { key: 'warranty', label: 'Warranty', visible: false, order: 17 },
    { key: 'preventive_maintenance', label: 'Preventive Maintenance', visible: false, order: 18 },
    { key: 'start_date', label: 'Start Date', visible: false, order: 19 },
    { key: 'end_date', label: 'End Date', visible: false, order: 20 },
    
    // Additional customer columns
    { key: 'customer_ref_num', label: 'Customer Ref Number', visible: false, order: 21 },
    
    // Recipient details
    { key: 'department', label: 'Department', visible: false, order: 22 },
    { key: 'position', label: 'Position', visible: false, order: 23 },
    
    // Asset pricing
    { key: 'monthly_prices', label: 'Monthly Price', visible: false, order: 24 },
    { key: 'software_prices', label: 'Software Prices', visible: false, order: 25 },
    
    // Specifications
    { key: 'specs_attributes', label: 'Specifications', visible: false, order: 26 }
  ];

  /**
   * Load column configuration from localStorage
   * Merges saved config with all available columns to handle new columns
   * @returns {Array} Array of column configuration objects
   */
  static loadConfig() {
    try {
      const saved = localStorage.getItem('assetTableColumns');
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Merge saved config with all columns
        // This ensures new columns added later appear with default settings
        return this.allColumns.map(col => {
          const savedCol = parsed.find(c => c.key === col.key);
          return savedCol ? { ...col, ...savedCol } : col;
        });
      }
    } catch (error) {
      console.error('Failed to load column config:', error);
    }
    
    // Return default if no saved config
    return [...this.allColumns];
  }

  /**
   * Save column configuration to localStorage
   * @param {Array} columns - Array of column configuration objects
   */
  static saveConfig(columns) {
    try {
      localStorage.setItem('assetTableColumns', JSON.stringify(columns));
      return true;
    } catch (error) {
      console.error('Failed to save column config:', error);
      return false;
    }
  }

  /**
   * Get only visible columns in correct display order
   * @param {Array} columns - Array of column configuration objects
   * @returns {Array} Filtered and sorted array of visible columns
   */
  static getVisibleColumns(columns) {
    return columns
      .filter(col => col.visible)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Reset column configuration to default state
   * @returns {Array} Default column configuration
   */
  static resetToDefault() {
    try {
      localStorage.removeItem('assetTableColumns');
    } catch (error) {
      console.error('Failed to clear column config:', error);
    }
    
    // Return fresh copy of all columns with default visibility
    return this.allColumns.map(col => {
      const defaultCol = this.defaultColumns.find(dc => dc.key === col.key);
      if (defaultCol) {
        return { ...col, visible: true, order: defaultCol.order };
      }
      return { ...col, visible: false };
    });
  }

  /**
   * Reorder columns based on drag-and-drop
   * @param {Array} columns - Current column array
   * @param {number} fromIndex - Source index
   * @param {number} toIndex - Destination index
   * @returns {Array} Reordered column array
   */
  static reorderColumns(columns, fromIndex, toIndex) {
    const result = Array.from(columns);
    const [removed] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, removed);
    
    // Update order property for all columns
    return result.map((col, index) => ({
      ...col,
      order: index
    }));
  }

  /**
   * Toggle column visibility
   * @param {Array} columns - Current column array
   * @param {string} columnKey - Key of column to toggle
   * @returns {Array} Updated column array
   */
  static toggleColumn(columns, columnKey) {
    return columns.map(col => 
      col.key === columnKey ? { ...col, visible: !col.visible } : col
    );
  }

  /**
   * Map backend data field names to frontend column keys
   * @param {string} columnKey - Frontend column key
   * @returns {string} Backend field name
   */
  static getBackendFieldName(columnKey) {
    const fieldMapping = {
      'customer_name': 'Customer_Name',
      'branch': 'Branch',
      'serial_number': 'Asset_Serial_Number',
      'tag_id': 'Asset_Tag_ID',
      'status': 'Status',
      'item_name': 'Item_Name',
      'model': 'Model',
      'category': 'Category',
      'antivirus': 'Antivirus',
      'windows': 'Windows',
      'microsoft_office': 'Microsoft_Office',
      'software': 'Software',
      'peripheral_type': 'Peripheral_Type',
      'peripheral_serial': 'Peripheral_Serial',
      'recipient_name': 'Recipient_Name',
      'project_ref_num': 'Project_Ref_Number',
      'project_title': 'Project_Title',
      'warranty': 'Warranty',
      'preventive_maintenance': 'Preventive_Maintenance',
      'start_date': 'Start_Date',
      'end_date': 'End_Date',
      'customer_ref_num': 'Customer_Ref_Number',
      'department': 'Department',
      'position': 'Position',
      'monthly_prices': 'Monthly_Prices',
      'software_prices': 'Software_Prices',
      'specs_attributes': 'Specs_Attributes'
    };
    
    return fieldMapping[columnKey] || columnKey;
  }

  /**
   * Get display value for a cell based on column key
   * @param {Object} asset - Asset data object
   * @param {string} columnKey - Column key to display
   * @returns {string} Formatted display value
   */
  static getCellValue(asset, columnKey) {
    const backendField = this.getBackendFieldName(columnKey);
    let value = asset[backendField];
    
    // Handle null/undefined
    if (value === null || value === undefined) {
      return '-';
    }
    
    // Format dates
    if (['start_date', 'end_date'].includes(columnKey) && value) {
      try {
        return new Date(value).toLocaleDateString('en-MY', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } catch {
        return value;
      }
    }
    
    // Format prices
    if (columnKey === 'monthly_prices' && value) {
      return `RM ${parseFloat(value).toFixed(2)}`;
    }
    
    // Format software prices list (comma-separated)
    if (columnKey === 'software_prices' && value) {
      const prices = value.split(',').map(p => `RM ${parseFloat(p.trim()).toFixed(2)}`);
      return prices.join(', ');
    }
    
    // Truncate long text
    if (typeof value === 'string' && value.length > 50) {
      return value.substring(0, 47) + '...';
    }
    
    return value;
  }
}

export default ColumnConfigService;
