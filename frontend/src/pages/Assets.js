import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Filter, Edit, Trash2, Download, Plus, Upload, FileText, Columns, AlertTriangle, X, Settings2, Eye, Trash, Edit2, AlertCircle, RefreshCw, Package, Boxes, Flag } from 'lucide-react';
import Pagination from '../components/Pagination';
import ConfirmationModal from '../components/ConfirmationModal';
import apiService from '../services/apiService';
import ColumnFilterPopup from '../components/ColumnFilterPopup';
import ColumnConfigService from '../services/columnConfigService';
import { API_URL } from '../config/api';
import usePageTitle from '../hooks/usePageTitle';
import toast from '../utils/toast';

const Assets = ({ onDelete }) => {
  usePageTitle('Assets');
  const navigate = useNavigate();
  const location = useLocation();
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  
  // User role for access control
  const [userRole, setUserRole] = useState('');
  
  // Check if user is customer-type role
  const isCustomerRole = () => {
    if (!userRole) return false;
    const role = userRole.toLowerCase();
    return role !== 'admin' && role !== 'staff';
  };
  
  // Column customization state
  const [columnConfig, setColumnConfig] = useState([]);
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  
  // Column-specific filters
  const [columnFilters, setColumnFilters] = useState({});
  const [debouncedColumnFilters, setDebouncedColumnFilters] = useState({});
  const [activeFilterPopup, setActiveFilterPopup] = useState(null); // Track which column's filter is open
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // State for all assets (loaded once)
  const [allAssets, setAllAssets] = useState([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const CACHE_DURATION = 10000; // 10 seconds cache - shorter since we only fetch one page
  
  // Sorting state
  const [sortField, setSortField] = useState(() => localStorage.getItem('inventraAssetsSortField') || 'Inventory_ID');
  const [sortDirection, setSortDirection] = useState(() => localStorage.getItem('inventraAssetsSortDirection') || 'desc'); // Show newest first
  
  // Success message state
  const [successMessage, setSuccessMessage] = useState('');

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState({
    show: false,
    asset: null,
    deleting: false
  });

  // Bulk delete state
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState({
    show: false,
    assetIds: []
  });

  // Selection state
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // Column resize state
  const [columnWidths, setColumnWidths] = useState({});
  const [resizingColumn, setResizingColumn] = useState(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  // CSV Export Modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCustomers, setExportCustomers] = useState([]);
  const [selectedCustomersForExport, setSelectedCustomersForExport] = useState([]);
  const [exportSearchTerm, setExportSearchTerm] = useState('');
  const [allAssetsForExport, setAllAssetsForExport] = useState([]);
  const [loadingExportData, setLoadingExportData] = useState(false);

  const headerButtonStyle = {
    background: 'white',
    color: '#667eea',
    border: 'none',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    textDecoration: 'none',
    transition: 'all 0.3s ease'
  };

  const handleHeaderButtonHover = (event, isHover) => {
    const target = event.currentTarget;
    target.style.transform = isHover ? 'translateY(-2px)' : 'translateY(0)';
    target.style.boxShadow = isHover
      ? '0 6px 20px rgba(0, 0, 0, 0.25)'
      : '0 4px 15px rgba(0, 0, 0, 0.2)';
  };

  const listSortMode = useMemo(() => {
    if (sortField === 'Customer_Name' && sortDirection === 'asc') return 'alpha-asc';
    if (sortField === 'Customer_Name' && sortDirection === 'desc') return 'alpha-desc';
    if (sortField === 'Inventory_ID' && sortDirection === 'asc') return 'num-asc';
    if (sortField === 'Inventory_ID' && sortDirection === 'desc') return 'default';
    return 'default';
  }, [sortField, sortDirection]);

  const handleListSortChange = (mode) => {
    if (mode === 'alpha-asc') {
      setSortField('Customer_Name');
      setSortDirection('asc');
    } else if (mode === 'alpha-desc') {
      setSortField('Customer_Name');
      setSortDirection('desc');
    } else if (mode === 'num-asc') {
      setSortField('Inventory_ID');
      setSortDirection('asc');
    } else if (mode === 'num-desc') {
      setSortField('Inventory_ID');
      setSortDirection('desc');
    } else {
      setSortField('Inventory_ID');
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  // Load column configuration on mount
  useEffect(() => {
    const savedConfig = ColumnConfigService.loadConfig();
    setColumnConfig(savedConfig);
    
    // Get user role from localStorage
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    setUserRole(userInfo.role || '');
  }, []);

  // Extract unique customers when assets are loaded
  useEffect(() => {
    if (allAssetsForExport.length > 0) {
      const uniqueCustomers = [...new Set(allAssetsForExport.map(asset => asset.Customer_Name).filter(Boolean))];
      setExportCustomers(uniqueCustomers.sort());
    }
  }, [allAssetsForExport]);

  useEffect(() => {
    localStorage.setItem('inventraAssetsSortField', sortField);
    localStorage.setItem('inventraAssetsSortDirection', sortDirection);
  }, [sortField, sortDirection]);

  // Debounce search input for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      // Reset to page 1 when search changes
      if (searchTerm !== debouncedSearchTerm) {
        setCurrentPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, debouncedSearchTerm]);

  // Debounce column filters for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentFiltersStr = JSON.stringify(columnFilters);
      const debouncedFiltersStr = JSON.stringify(debouncedColumnFilters);
      
      if (currentFiltersStr !== debouncedFiltersStr) {
        setDebouncedColumnFilters(columnFilters);
        setCurrentPage(1);
      }
    }, 300); // Match search debounce for consistency
    return () => clearTimeout(timer);
  }, [columnFilters, debouncedColumnFilters]);

  // Fetch assets from database with server-side pagination
  const fetchAssets = useCallback(async (force = false) => {
    const now = Date.now();
    
    // Deduplication: prevent multiple simultaneous requests
    if (isFetching) {
      return;
    }
    
    // Bypass cache when filters are active or force refresh
    const hasActiveFilters = Object.keys(debouncedColumnFilters).some(key => debouncedColumnFilters[key]);
    const shouldUseCache = !force && !hasActiveFilters && now - lastFetchTime < CACHE_DURATION && allAssets.length > 0;
    
    if (shouldUseCache) {
      return;
    }
    
    try {
      setIsFetching(true);
      setLoading(true);
      setError(null);
        
        // Build query parameters for server-side pagination
        const params = new URLSearchParams({
          page: currentPage,
          limit: itemsPerPage,
          sortField: sortField,
          sortDirection: sortDirection
        });
        
        // Add search parameter if exists
        if (debouncedSearchTerm) {
          params.append('search', debouncedSearchTerm);
        }
        
        // Add flagged filter parameter
        if (showFlaggedOnly) {
          params.append('flagged', 'true');
        }
        
        // Add column filters as individual query parameters
        for (const [columnKey, filterValue] of Object.entries(debouncedColumnFilters)) {
          if (filterValue && filterValue.trim()) {
            params.append(`filter_${columnKey}`, filterValue.trim());
          }
        }
        
        // Use direct fetch with pagination parameters
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/assets?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('Too many requests. Please wait a moment and try again.');
          }
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        const result = await response.json();
        
        // Handle paginated response
        setAllAssets(result.data || result);
        setTotalAssets(result.pagination?.total || result.length);
        setLastFetchTime(now);
        
        // Create columns based on new database schema
        // Default columns in specified order:
        // 1. Customer name, 2. Branch, 3. Serial number, 4. Tag ID, 5. Status
        // 6. Item name, 7. Model, 8. Category, 9. Antivirus, 10. Windows version
        // 11. Microsoft Office version, 12. Recipient name
        // Note: Software and Peripheral columns are available but hidden by default
        const assetColumns = [
          { Field: 'Customer_Name', Type: 'varchar(255)', Label: 'Customer Name' },
          { Field: 'Branch', Type: 'varchar(255)', Label: 'Branch' },
          { Field: 'Asset_Serial_Number', Type: 'varchar(255)', Label: 'Serial Number' },
          { Field: 'Asset_Tag_ID', Type: 'varchar(255)', Label: 'Tag ID' },
          { Field: 'Status', Type: 'varchar(50)', Label: 'Status' },
          { Field: 'Item_Name', Type: 'varchar(255)', Label: 'Item Name' },
          { Field: 'Model', Type: 'varchar(255)', Label: 'Model' },
          { Field: 'Category', Type: 'varchar(255)', Label: 'Category' },
          { Field: 'Antivirus', Type: 'varchar(255)', Label: 'Antivirus' },
          { Field: 'Windows', Type: 'varchar(255)', Label: 'Windows Version' },
          { Field: 'Microsoft_Office', Type: 'varchar(255)', Label: 'Microsoft Office' },
          { Field: 'Recipient_Name', Type: 'varchar(255)', Label: 'Recipient Name' }
        ];
        setColumns(assetColumns);
      } catch (err) {
        console.error('Error fetching assets:', err);
        setError(err.message || 'Failed to load assets. Make sure the backend server is running.');
        setAllAssets([]);
        setColumns([]);
      } finally {
        setLoading(false);
        setIsFetching(false);
      }
    }, [isFetching, lastFetchTime, allAssets.length, currentPage, itemsPerPage, sortField, sortDirection, debouncedSearchTerm, showFlaggedOnly, debouncedColumnFilters]);

  // Load assets on component mount and when pagination/sort/search changes
  useEffect(() => {
    fetchAssets(true); // Force fetch when page, sort, search, or flagged filter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage, sortField, sortDirection, debouncedSearchTerm, showFlaggedOnly, debouncedColumnFilters]);

  // Refresh data when coming from CSV import or when explicitly requested
  useEffect(() => {
    // Check if we're coming from CSV import, Add Asset, or when explicitly requested
    const stateMessage = location.state?.message;
    const hasRefresh = location.state?.refresh || location.search.includes('refresh=true');
    
    if (hasRefresh) {
      setSuccessMessage(stateMessage || 'Asset data refreshed successfully');
      fetchAssets(true); // Force refresh
      
      // Clear the state to prevent infinite refreshing
      if (location.state) {
        navigate(location.pathname, { replace: true, state: {} });
      }
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5002);
    }
  }, [location, navigate]);

  // Refresh function to be called from external components
  const refreshAssets = useCallback(() => {
    fetchAssets(true); // Force refresh when explicitly called
  }, [fetchAssets]);

  // Handle column configuration changes
  const handleColumnConfigApply = (newConfig) => {
    setColumnConfig(newConfig);
    ColumnConfigService.saveConfig(newConfig);
  };

  // Get currently visible columns
  const visibleColumns = ColumnConfigService.getVisibleColumns(columnConfig);

  // Handle checkbox selection
  const handleSelectAsset = useCallback((assetId) => {
    setSelectedAssets(prev => {
      if (prev.includes(assetId)) {
        return prev.filter(id => id !== assetId);
      } else {
        return [...prev, assetId];
      }
    });
  }, []);

  // Handle delete button click - show confirmation dialog
  const handleDeleteClick = useCallback((asset) => {
    setDeleteDialog({
      show: true,
      asset: asset,
      deleting: false
    });
  }, []);

  // Handle confirmed delete
  const handleConfirmDelete = async () => {
    if (!deleteDialog.asset) return;

    setDeleteDialog(prev => ({ ...prev, deleting: true }));

    try {
      const response = await apiService.deleteAssetById(deleteDialog.asset.Asset_ID);
      
      if (response.success) {

        const data = response.data || {};
        const peripheralsDeleted = data.peripherals_deleted ?? 0;
        const pmRecordsDeleted = data.pm_records_deleted ?? 0;
        const pmResultsDeleted = data.pm_results_deleted ?? 0;
        const softwareLinksDeleted = data.software_links_deleted ?? 0;
        const inventoryDeleted = data.inventory_deleted ?? 0;
        const inventoryNulled = data.inventory_nulled ?? 0;
        
        // Build success message parts
        const parts = [];
        if (peripheralsDeleted > 0) parts.push(`Peripherals: ${peripheralsDeleted}`);
        if (pmRecordsDeleted > 0) parts.push(`PM Records: ${pmRecordsDeleted}`);
        if (pmResultsDeleted > 0) parts.push(`PM Results: ${pmResultsDeleted}`);
        if (softwareLinksDeleted > 0) parts.push(`Software Links: ${softwareLinksDeleted}`);
        if (inventoryDeleted > 0) parts.push(`Inventory Deleted: ${inventoryDeleted}`);
        if (inventoryNulled > 0) parts.push(`Inventory Preserved: ${inventoryNulled}`);
        
        const detailsMessage = parts.length > 0 ? ` (${parts.join(', ')})` : '';
        
        // Show success message
        setSuccessMessage(`Asset deleted successfully!${detailsMessage}`);
        
        // Close dialog
        setDeleteDialog({ show: false, asset: null, deleting: false });
        
        // Refresh assets list
        await fetchAssets();
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5002);
      } else {
        throw new Error(response.error || 'Failed to delete asset');
      }
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast.error(`Failed to delete asset: ${error.message}`);
      setDeleteDialog(prev => ({ ...prev, deleting: false }));
    }
  };

  // Handle cancel delete
  const handleCancelDelete = useCallback(() => {
    setDeleteDialog({ show: false, asset: null, deleting: false });
  }, []);

  // Filter and sort assets - server-side pagination handles most of this
  const filteredAssets = useMemo(() => {
    // All filtering (including column filters) is now handled server-side
    return allAssets;
  }, [allAssets]);

  // Client-side pagination calculations - using server-provided total
  const { totalItems, calculatedTotalPages, paginatedAssets } = useMemo(() => {
    const totalItems = totalAssets; // Use server-provided total
    const calculatedTotalPages = Math.ceil(totalItems / itemsPerPage);
    // Server already paginated, so just use filtered assets directly
    const paginatedAssets = filteredAssets;
    
    return { totalItems, calculatedTotalPages, paginatedAssets };
  }, [filteredAssets, totalAssets, itemsPerPage]);

  // Handle select all checkbox (must be after paginatedAssets is defined)
  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedAssets([]);
      setSelectAll(false);
    } else {
      const allAssetIds = paginatedAssets.map(asset => asset.Asset_ID);
      setSelectedAssets(allAssetIds);
      setSelectAll(true);
    }
  }, [selectAll, paginatedAssets]);

  // Check if all current page assets are selected (for checkbox state)
  const isAllSelected = paginatedAssets.length > 0 && 
    paginatedAssets.every(asset => selectedAssets.includes(asset.Asset_ID));

  // Bulk action handlers (must be after paginatedAssets is defined)
  const handleBulkView = () => {
    if (selectedAssets.length === 1) {
      navigate(`/asset-detail/${selectedAssets[0]}`);
    } else {
      toast.error('Please select exactly one asset to view');
    }
  };

  const handleBulkEdit = () => {
    if (selectedAssets.length === 1) {
      navigate(`/edit-asset/${selectedAssets[0]}`);
    } else {
      toast.error('Please select exactly one asset to edit');
    }
  };

  const handleBulkDelete = () => {
    if (selectedAssets.length === 0) {
      toast.error('Please select at least one asset to delete');
      return;
    }

    setBulkDeleteConfirm({
      show: true,
      assetIds: [...selectedAssets]
    });
  };

  const handleConfirmBulkDelete = async () => {
    const assetsToDelete = [...bulkDeleteConfirm.assetIds];

    if (assetsToDelete.length === 0) {
      setBulkDeleteConfirm({ show: false, assetIds: [] });
      return;
    }

    setBulkDeleteConfirm({ show: false, assetIds: [] });

    setBulkDeleting(true);
    try {
      let successCount = 0;
      let peripheralsDeleted = 0;
      let pmRecordsDeleted = 0;
      let pmResultsDeleted = 0;
      let softwareLinksDeleted = 0;
      let inventoryDeleted = 0;
      let inventoryNulled = 0;
      const failures = [];

      for (const assetId of assetsToDelete) {
        try {
          const response = await apiService.deleteAssetById(assetId);
          const data = response.data || {};
          successCount += 1;
          peripheralsDeleted += data.peripherals_deleted ?? 0;
          pmRecordsDeleted += data.pm_records_deleted ?? 0;
          pmResultsDeleted += data.pm_results_deleted ?? 0;
          softwareLinksDeleted += data.software_links_deleted ?? 0;
          inventoryDeleted += data.inventory_deleted ?? 0;
          inventoryNulled += data.inventory_nulled ?? 0;
        } catch (error) {
          failures.push({ assetId, message: error.message });
          console.error(`Failed to delete asset ${assetId}:`, error);
        }
      }

      await fetchAssets();
      setSelectedAssets([]);
      setSelectAll(false);

      if (successCount > 0) {
        const parts = [];
        if (peripheralsDeleted > 0) parts.push(`Peripherals: ${peripheralsDeleted}`);
        if (pmRecordsDeleted > 0) parts.push(`PM Records: ${pmRecordsDeleted}`);
        if (pmResultsDeleted > 0) parts.push(`PM Results: ${pmResultsDeleted}`);
        if (softwareLinksDeleted > 0) parts.push(`Software Links: ${softwareLinksDeleted}`);
        if (inventoryDeleted > 0) parts.push(`Inventory Deleted: ${inventoryDeleted}`);
        if (inventoryNulled > 0) parts.push(`Inventory Preserved: ${inventoryNulled}`);
        
        const detailsMessage = parts.length > 0 ? ` ${parts.join(', ')}` : '';
        
        setSuccessMessage(
          `Deleted ${successCount}/${assetsToDelete.length} assets.${detailsMessage}`
        );
        setTimeout(() => setSuccessMessage(''), 5002);
      }

      if (failures.length > 0) {
        toast.error(`Failed to delete ${failures.length} asset(s): ${failures.map(f => `${f.assetId} (${f.message})`).join(', ')}`);
      }
    } finally {
      setBulkDeleting(false);
    }
  };

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, columnFilters]);

  // Close filter popup when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeFilterPopup && !event.target.closest('th')) {
        setActiveFilterPopup(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeFilterPopup]);

  // Pagination handlers
  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  // Toggle filter popup for a column
  const toggleFilterPopup = (columnField) => {
    setActiveFilterPopup(activeFilterPopup === columnField ? null : columnField);
  };

  // Handle column filter change
  const handleColumnFilterChange = (columnField, value) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnField]: value
    }));
    // Page reset is handled by debounce effect
  };

  // Clear specific column filter
  const clearColumnFilter = (columnField) => {
    setColumnFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[columnField];
      return newFilters;
    });
    // Reset to page 1 when filter is cleared
    setCurrentPage(1);
  };

  // Clear all column filters
  const clearColumnFilters = () => {
    setColumnFilters({});
    // Reset to page 1 when all filters are cleared
    setCurrentPage(1);
  };

  // Column resize handlers
  const handleMouseDown = (e, columnField) => {
    e.preventDefault();
    setResizingColumn(columnField);
    setStartX(e.clientX);
    setStartWidth(columnWidths[columnField] || 150);
  };

  const handleMouseMove = (e) => {
    if (!resizingColumn) return;
    
    const diff = e.clientX - startX;
    const newWidth = Math.max(80, startWidth + diff); // Minimum width of 80px
    
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn]: newWidth
    }));
  };

  const handleMouseUp = () => {
    setResizingColumn(null);
  };

  // Add event listeners for column resizing
  useEffect(() => {
    if (resizingColumn) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizingColumn, startX, startWidth]);
  
  // Define which columns to hide (typically internal/system columns)
  const hiddenColumns = [
    'Asset_ID', 
    'Inventory_ID',
    'Project_ID',
    'Customer_ID',
    'Recipients_ID',
    'Category_ID',
    'Model_ID',
    'Created_By',
    'Updated_By',
    'Customer_Ref_Number', // Hide customer ref as we show customer name
    'Project_Ref_Number',  // Hide unless specifically needed
    'Project_Title',       // Hide unless specifically needed
    'Department',          // Hide for cleaner view (can be shown on demand)
    'Warranty',
    'Preventive_Maintenance',
    'Start_Date',
    'End_Date',
    'Monthly_Prices',
    'Created_At', 
    'Updated_At', 
    'Deleted_At', 
    'createdAt', 
    'updatedAt'
  ];
  
  // Get displayable columns using ColumnConfigService
  // Map visible columns from config to column objects for backward compatibility
  const displayColumns = visibleColumns.map(configCol => {
    const backendField = ColumnConfigService.getBackendFieldName(configCol.key);
    return {
      Field: backendField,
      Label: configCol.label,
      Type: 'varchar(255)' // Default type
    };
  });
  
  // Helper function to format column names for display
  const formatColumnName = (column) => {
    // Use Label if available, otherwise format the Field name
    if (column.Label) {
      return column.Label;
    }
    return column.Field
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };
  
  // Helper function to format cell values
  const formatCellValue = (value, columnName) => {
    // Special handling for Peripheral columns - format with line breaks
    if (columnName === 'Peripheral_Type' || columnName === 'Peripheral_Serial') {
      if (!value || value === '' || value === null || value === undefined) {
        return 'N/A';
      }
      // Value already comes formatted with commas from backend, replace with line breaks
      return value.split(', ').join('\n');
    }
    
    // Special handling for Software column - show 'None' for assets without software
    if (columnName === 'Software') {
      if (!value || value === '' || value === null || value === undefined) {
        return 'None';
      }
      return value;
    }
    
    // Special handling for Software_Name column - show 'None' for assets without software name
    if (columnName === 'Software_Name') {
      if (!value || value === '' || value === null || value === undefined) {
        return 'None';
      }
      return value;
    }
    
    if (value === null || value === undefined) return 'N/A';
    
    // Format date columns to show only date (YYYY-MM-DD)
    if (columnName === 'Start_Date' || columnName === 'End_Date') {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD format
        }
      } catch (e) {
        return value;
      }
    }
    
    if (typeof value === 'string' && value.length > 50) {
      return value.substring(0, 50) + '...';
    }
    return value;
  };



  const handleExportCSV = async () => {
    setShowExportModal(true);
    await fetchAllAssetsForExport();
  };

  // Fetch all assets for export (without pagination)
  const fetchAllAssetsForExport = async () => {
    try {
      setLoadingExportData(true);
      
      // Fetch all assets without pagination
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/assets?limit=999999`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch assets for export');
      }
      
      const result = await response.json();
      const allData = result.data || result;
      
      setAllAssetsForExport(allData);
      
      // Extract unique customers
      const uniqueCustomers = [...new Set(allData.map(asset => asset.Customer_Name).filter(Boolean))];
      setExportCustomers(uniqueCustomers.sort());
    } catch (err) {
      console.error('Error fetching all assets for export:', err);
      toast.error('Failed to load assets for export. Please try again.');
    } finally {
      setLoadingExportData(false);
    }
  };

  // Export all assets to CSV
  const exportAllAssets = () => {
    if (allAssetsForExport.length === 0) {
      toast.error('No data to export');
      return;
    }
    
    generateCSV(allAssetsForExport, 'all_assets.csv');
    setShowExportModal(false);
  };

  // Export selected customers to CSV
  const exportSelectedCustomers = () => {
    if (selectedCustomersForExport.length === 0) {
      toast.error('Please select at least one customer');
      return;
    }

    const filteredAssets = allAssetsForExport.filter(asset => 
      selectedCustomersForExport.includes(asset.Customer_Name)
    );

    if (filteredAssets.length === 0) {
      toast.error('No assets found for selected customers');
      return;
    }

    const filename = selectedCustomersForExport.length === 1 
      ? `${selectedCustomersForExport[0].replace(/[^a-z0-9]/gi, '_')}_assets.csv`
      : `${selectedCustomersForExport.length}_customers_assets.csv`;
    
    generateCSV(filteredAssets, filename);
    setShowExportModal(false);
    setSelectedCustomersForExport([]);
  };

  // Generate CSV from asset data
  const generateCSV = (assets, filename) => {
    // Get visible columns from column config
    const visibleCols = ColumnConfigService.getVisibleColumns(columnConfig);
    
    // Create headers
    const headers = visibleCols.map(col => col.label);
    
    // Create rows
    const rows = assets.map(asset => 
      visibleCols.map(col => {
        const value = ColumnConfigService.getCellValue(asset, col.key);
        // Escape quotes and handle special characters
        return String(value).replace(/"/g, '""');
      })
    );
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Toggle customer selection
  const toggleCustomerSelection = (customerName) => {
    setSelectedCustomersForExport(prev => 
      prev.includes(customerName)
        ? prev.filter(c => c !== customerName)
        : [...prev, customerName]
    );
  };

  // Select all customers
  const selectAllCustomers = () => {
    const filtered = exportCustomers.filter(customer => 
      customer.toLowerCase().includes(exportSearchTerm.toLowerCase())
    );
    setSelectedCustomersForExport(filtered);
  };

  // Deselect all customers
  const deselectAllCustomers = () => {
    setSelectedCustomersForExport([]);
  };

  return (
    <div style={{ padding: '0', overflow: 'visible', width: '100%', maxWidth: '100%' }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '20px',
        marginBottom: '30px',
        paddingBottom: '15px',
        borderBottom: '3px solid #667eea',
        padding: '0 20px 15px 20px',
        flexWrap: 'wrap',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 auto', minWidth: '250px', maxWidth: '100%' }}>
          <Boxes size={28} color="#667eea" style={{ flexShrink: 0 }} />
          <div style={{ overflow: 'hidden' }}>
            <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.4rem' }}>
              Assets
            </h2>
            <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
              View complete asset information including project, customer, and maintenance details
            </p>
          </div>
        </div>
        <div className="actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flex: '0 0 auto', justifyContent: 'flex-end' }}>
          <button
            onClick={() => navigate('/assets/import')}
            className="btn btn-secondary"
            disabled={isCustomerRole()}
            style={{
              ...headerButtonStyle,
              opacity: isCustomerRole() ? 0.6 : 1,
              cursor: isCustomerRole() ? 'not-allowed' : 'pointer',
              backgroundColor: isCustomerRole() ? '#e0e0e0' : 'white',
              color: isCustomerRole() ? '#999' : '#667eea'
            }}
            onMouseEnter={(e) => !isCustomerRole() && handleHeaderButtonHover(e, true)}
            onMouseLeave={(e) => !isCustomerRole() && handleHeaderButtonHover(e, false)}
            title={isCustomerRole() ? 'Customer accounts cannot import assets' : 'Import assets from CSV'}
          >
            <Download size={16} />
            Import CSV
          </button>
          <button
            onClick={handleExportCSV}
            className="btn btn-secondary"
            style={headerButtonStyle}
            onMouseEnter={(e) => handleHeaderButtonHover(e, true)}
            onMouseLeave={(e) => handleHeaderButtonHover(e, false)}
          >
            <Upload size={16} />
            Export CSV
          </button>
          <Link
            to="/add-asset"
            className="btn btn-primary"
            style={headerButtonStyle}
            onMouseEnter={(e) => handleHeaderButtonHover(e, true)}
            onMouseLeave={(e) => handleHeaderButtonHover(e, false)}
          >
            <Plus size={16} />
            Add New Asset
          </Link>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div style={{
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          color: '#155724',
          padding: '15px 20px',
          margin: '0 20px 20px 20px',
          borderRadius: '8px',
          fontWeight: '500'
        }}>
          {successMessage}
        </div>
      )}

      {/* Full Width Asset Table Section */}
      <div style={{ padding: '0 20px', width: '100%', boxSizing: 'border-box' }}>
        <div className="card" style={{ width: '100%' }}>
        {/* Enhanced Search Bar Section */}
        <div style={{ 
          display: 'flex', 
          gap: '15px', 
          flexWrap: 'wrap', 
          width: '100%',
          marginBottom: '20px',
          alignItems: 'center'
        }}>
          {/* Responsive Search Bar */}
          <div style={{ 
            flex: '1', 
            minWidth: '280px', 
            maxWidth: selectedAssets.length > 0 ? '400px' : '600px',
            position: 'relative' 
          }}>
            <Search 
              size={20} 
              style={{ 
                position: 'absolute', 
                left: '15px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: searchFocused ? '#667eea' : '#9ca3af',
                transition: 'color 0.3s ease',
                pointerEvents: 'none',
                zIndex: 1
              }} 
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setIsSearching(false);
                }}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'all 0.2s ease',
                  zIndex: 1
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.color = '#667eea';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#9ca3af';
                }}
                title="Clear search (Esc)"
                aria-label="Clear search"
              >
                <X size={18} />
              </button>
            )}
            <input
              type="text"
              placeholder="Search assets by customer, serial, tag, model, category..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsSearching(e.target.value.length > 0);
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchTerm('');
                  setIsSearching(false);
                  e.target.blur();
                }
              }}
              style={{
                width: '100%',
                padding: '13px 45px 13px 48px',
                border: `2px solid ${searchFocused ? '#667eea' : '#e5e7eb'}`,
                borderRadius: '10px',
                fontSize: '15px',
                transition: 'all 0.3s ease',
                outline: 'none',
                backgroundColor: 'white',
                boxShadow: searchFocused ? '0 0 0 3px rgba(102, 126, 234, 0.1)' : 'none',
                fontFamily: 'inherit'
              }}
              aria-label="Search assets"
            />
            {isSearching && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: '0',
                right: '0',
                marginTop: '4px',
                fontSize: '12px',
                color: '#6b7280',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{ 
                  width: '4px', 
                  height: '4px', 
                  backgroundColor: '#667eea', 
                  borderRadius: '50%',
                  display: 'inline-block'
                }} />
                Searching across all asset fields...
              </div>
            )}
          </div>
          
          {/* Flagged Assets Filter Button */}
          <button
            onClick={() => setShowFlaggedOnly(!showFlaggedOnly)}
            className="btn"
            style={{
              padding: '12px 20px',
              border: showFlaggedOnly ? '2px solid #f39c12' : '2px solid #e1e8ed',
              borderRadius: '8px',
              backgroundColor: showFlaggedOnly ? '#fff3cd' : 'white',
              color: showFlaggedOnly ? '#856404' : '#666',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: showFlaggedOnly ? '600' : '500',
              transition: 'all 0.2s ease',
              boxShadow: showFlaggedOnly ? '0 2px 8px rgba(243, 156, 18, 0.2)' : 'none'
            }}
            title={showFlaggedOnly ? 'Show all assets' : 'Show flagged assets only'}
          >
            <Flag size={18} color={showFlaggedOnly ? '#f39c12' : '#666'} fill={showFlaggedOnly ? '#f39c12' : 'none'} />
            {showFlaggedOnly && filteredAssets.length > 0 && (
              <span style={{
                backgroundColor: '#f39c12',
                color: 'white',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '0.75rem',
                fontWeight: '700'
              }}>
                {filteredAssets.length}
              </span>
            )}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '220px' }}>
            <span style={{ color: '#4b5563', fontSize: '14px', fontWeight: '600' }}>List Order</span>
            <select
              value={listSortMode}
              onChange={(e) => handleListSortChange(e.target.value)}
              style={{
                flex: 1,
                padding: '12px 10px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: 'white',
                color: '#374151',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="default">Default</option>
              <option value="alpha-asc">A-Z</option>
              <option value="alpha-desc">Z-A</option>
              <option value="num-asc">0-9</option>
              <option value="num-desc">9-0</option>
            </select>
          </div>
          
          {/* Bulk Action Buttons */}
          {selectedAssets.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button 
                onClick={handleBulkView}
                disabled={selectedAssets.length !== 1}
                style={{
                  background: selectedAssets.length === 1 ? 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)' : '#95a5a6',
                  color: 'white',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  cursor: selectedAssets.length === 1 ? 'pointer' : 'not-allowed',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  boxShadow: selectedAssets.length === 1 ? '0 2px 6px rgba(52, 152, 219, 0.3)' : 'none',
                  opacity: selectedAssets.length === 1 ? 1 : 0.6
                }}
                title="View selected asset"
              >
                <Eye size={14} />
                View
              </button>
              
              <button 
                onClick={handleBulkEdit}
                disabled={selectedAssets.length !== 1}
                style={{
                  background: selectedAssets.length === 1 ? 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)' : '#95a5a6',
                  color: 'white',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  cursor: selectedAssets.length === 1 ? 'pointer' : 'not-allowed',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  boxShadow: selectedAssets.length === 1 ? '0 2px 6px rgba(243, 156, 18, 0.3)' : 'none',
                  opacity: selectedAssets.length === 1 ? 1 : 0.6
                }}
                title="Edit selected asset"
              >
                <Edit2 size={14} />
                Edit
              </button>
              
              <button 
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                style={{
                  background: bulkDeleting ? '#c0392b' : 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  cursor: bulkDeleting ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  boxShadow: bulkDeleting ? 'none' : '0 2px 6px rgba(231, 76, 60, 0.3)',
                  opacity: bulkDeleting ? 0.8 : 1
                }}
                title={`Delete ${selectedAssets.length} selected asset(s)`}
              >
                <Trash size={14} />
                {bulkDeleting ? 'Deleting...' : `Delete (${selectedAssets.length})`}
              </button>
            </div>
          )}
          
          {/* Manage Columns Button */}
          <button 
            onClick={() => setShowColumnFilter(true)} 
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              padding: '13px 20px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              border: '2px solid transparent'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
            }}
            title="Manage table columns"
            aria-label="Manage columns"
          >
            <Settings2 size={18} />
            Manage Columns
          </button>
        </div>

        {loading ? (
          <div className="table-loading">
            <p>Loading assets...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '8px', border: '1px solid #e9ecef' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#e74c3c', fontSize: '1.1rem', marginBottom: '20px' }}>
              <AlertCircle size={24} />
              <span>Error: {error}</span>
            </div>
            <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto' }}>
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ 
                    width: '60px', 
                    minWidth: '60px',
                    textAlign: 'center',
                    padding: '14px 10px',
                    background: 'linear-gradient(180deg, #5a67d8 0%, #6b46c1 100%)',
                    position: 'relative'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        className="custom-checkbox"
                        style={{
                          display: 'block',
                          cursor: 'pointer',
                          width: '17px',
                          height: '17px',
                          accentColor: '#667eea',
                          borderRadius: '3px',
                          border: '2px solid rgba(255, 255, 255, 0.6)',
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          transition: 'all 0.2s ease',
                          flexShrink: 0
                        }}
                        title="Select all on this page"
                      />
                    </div>
                  </th>
                  {displayColumns.map((column, columnIndex) => (
                    <th 
                      key={column.Field} 
                      style={{ 
                        position: 'relative',
                        width: columnWidths[column.Field] || 'auto',
                        minWidth: columnWidths[column.Field] || '150px',
                        maxWidth: columnWidths[column.Field] || 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        {column.Field === 'Model' ? (
                          <Link
                            to="/models/specs"
                            style={{
                              color: 'white',
                              textDecoration: 'none',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              flex: 1
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = '0.85';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = '1';
                            }}
                            title="View all models with specifications"
                          >
                            {formatColumnName(column)}
                          </Link>
                        ) : (
                          <span>{formatColumnName(column)}</span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {columnFilters[column.Field] && (
                            <span 
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                backgroundColor: '#e74c3c',
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                clearColumnFilter(column.Field);
                              }}
                              title="Clear filter"
                            >
                              ×
                            </span>
                          )}
                          <Filter 
                            size={14} 
                            style={{ 
                              cursor: 'pointer',
                              color: columnFilters[column.Field] ? '#3498db' : '#95a5a6',
                              transition: 'color 0.2s'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFilterPopup(column.Field);
                            }}
                            title={`Filter by ${formatColumnName(column)}`}
                          />
                        </div>
                      </div>
                      
                      {/* Resize Handle - Only show if not the last column */}
                      {columnIndex < displayColumns.length - 1 && (
                        <div
                          onMouseDown={(e) => handleMouseDown(e, column.Field)}
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: '8px',
                            cursor: 'col-resize',
                            backgroundColor: resizingColumn === column.Field ? '#667eea' : 'transparent',
                            transition: 'background-color 0.2s',
                            zIndex: 10,
                            userSelect: 'none'
                          }}
                          onMouseEnter={(e) => {
                            if (!resizingColumn) {
                              e.currentTarget.style.backgroundColor = 'rgba(102, 126, 234, 0.3)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!resizingColumn) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                          }}
                          title="Drag to resize column"
                        />
                      )}
                      
                      {/* Filter Popup */}
                      {activeFilterPopup === column.Field && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: '0',
                            zIndex: 1000,
                            backgroundColor: 'white',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            padding: '12px',
                            minWidth: '200px',
                            marginTop: '5px'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ marginBottom: '8px', fontWeight: '600', fontSize: '0.85rem', color: '#2c3e50' }}>
                            Filter {formatColumnName(column)}
                          </div>
                          <input
                            type="text"
                            placeholder="Enter filter value..."
                            value={columnFilters[column.Field] || ''}
                            onChange={(e) => handleColumnFilterChange(column.Field, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '0.9rem',
                              outline: 'none'
                            }}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setActiveFilterPopup(null);
                              } else if (e.key === 'Escape') {
                                setActiveFilterPopup(null);
                              }
                            }}
                          />
                          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => {
                                clearColumnFilter(column.Field);
                                setActiveFilterPopup(null);
                              }}
                              style={{
                                padding: '5px 10px',
                                fontSize: '0.8rem',
                                backgroundColor: '#95a5a6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              Clear
                            </button>
                            <button
                              onClick={() => setActiveFilterPopup(null)}
                              style={{
                                padding: '5px 10px',
                                fontSize: '0.8rem',
                                backgroundColor: '#3498db',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ userSelect: resizingColumn ? 'none' : 'auto' }}>
                {paginatedAssets.length > 0 ? paginatedAssets.map((asset, index) => {
                  return (
                  <React.Fragment key={asset.Inventory_ID || asset.Asset_ID || index}>
                    <tr>
                      <td style={{ 
                        textAlign: 'center', 
                        padding: '14px 10px',
                        width: '60px',
                        minWidth: '60px',
                        backgroundColor: index % 2 === 0 ? '#fafbfc' : '#ffffff',
                        verticalAlign: 'middle',
                        borderLeft: selectedAssets.includes(asset.Asset_ID) ? '3px solid #667eea' : '3px solid transparent',
                        transition: 'all 0.2s ease'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative'
                        }}>
                          <input
                            type="checkbox"
                            checked={selectedAssets.includes(asset.Asset_ID)}
                            onChange={() => handleSelectAsset(asset.Asset_ID)}
                            className="custom-checkbox"
                            style={{
                              display: 'block',
                              cursor: 'pointer',
                              width: '16px',
                              height: '16px',
                              accentColor: '#667eea',
                              borderRadius: '3px',
                              border: '1.5px solid #cbd5e0',
                              backgroundColor: selectedAssets.includes(asset.Asset_ID) ? '#667eea' : 'white',
                              transition: 'all 0.2s ease',
                              position: 'relative',
                              outline: 'none',
                              flexShrink: 0
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseOver={(e) => {
                              if (!selectedAssets.includes(asset.Asset_ID)) {
                                e.currentTarget.style.borderColor = '#667eea';
                                e.currentTarget.style.backgroundColor = '#f0f4ff';
                              }
                            }}
                            onMouseOut={(e) => {
                              if (!selectedAssets.includes(asset.Asset_ID)) {
                                e.currentTarget.style.borderColor = '#cbd5e0';
                                e.currentTarget.style.backgroundColor = 'white';
                              }
                            }}
                          />
                          {selectedAssets.includes(asset.Asset_ID) && (
                            <svg 
                              style={{
                                position: 'absolute',
                                width: '10px',
                                height: '10px',
                                pointerEvents: 'none',
                                fill: 'white'
                              }}
                              viewBox="0 0 16 16"
                            >
                              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                            </svg>
                          )}
                        </div>
                      </td>
                      {displayColumns.map(column => (
                        <td 
                          key={column.Field}
                          style={{
                            width: columnWidths[column.Field] || 'auto',
                            minWidth: columnWidths[column.Field] || '150px',
                            maxWidth: columnWidths[column.Field] || 'none',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {(column.Field === 'Status' || column.Field === 'assetStatus' || column.Field === 'Asset_Status') ? (
                            <span className={`status-badge status-${(asset[column.Field] || '').toLowerCase().replace(/\s+/g, '-')}`}>
                              {formatCellValue(asset[column.Field], column.Field)}
                            </span>
                          ) : column.Field === 'Asset_Serial_Number' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {asset.Is_Flagged ? (
                                <Flag 
                                  size={16} 
                                  color="#f39c12" 
                                  fill="#f39c12"
                                  title={`Flagged: ${asset.Flag_Remarks || 'No remarks'}`}
                                  style={{ flexShrink: 0 }}
                                />
                              ) : null}
                              <span title={asset[column.Field]}>
                                {formatCellValue(asset[column.Field], column.Field)}
                              </span>
                            </div>
                          ) : column.Field === 'Model' ? (
                            asset.Model_ID ? (
                              <Link
                                to={`/models/${asset.Model_ID}/add-specs`}
                                style={{
                                  color: 'inherit',
                                  textDecoration: 'none',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#667eea';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = 'inherit';
                                }}
                                title={`Add/Edit specifications for ${asset.Model || 'this model'}`}
                              >
                                {formatCellValue(asset[column.Field], column.Field)}
                              </Link>
                            ) : (
                              <span>{formatCellValue(asset[column.Field], column.Field)}</span>
                            )
                          ) : column.Field === 'Peripheral_Type' || column.Field === 'Peripheral_Serial' ? (
                            <div style={{ whiteSpace: 'pre-line' }}>
                              {formatCellValue(asset[column.Field], column.Field)}
                            </div>
                          ) : column.Field === 'Project_Title' ? (
                            <span 
                              title={asset[column.Field]}
                              style={{ 
                                display: 'block',
                                maxWidth: '200px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {formatCellValue(asset[column.Field], column.Field)}
                            </span>
                          ) : (
                            <span title={asset[column.Field]}>
                              {formatCellValue(asset[column.Field], column.Field)}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  </React.Fragment>
                );
                }) : (
                  <tr>
                    <td colSpan="100%" style={{ textAlign: 'center', padding: '20px' }}>
                      No assets to display
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && filteredAssets.length === 0 && (
          <div className="empty-state">
            <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Package size={20} />
              No assets found matching your search criteria.
            </p>
            <Link to="/add-asset" className="btn btn-primary">
              <Plus size={16} style={{ marginRight: '5px' }} />
              Add Your First Asset
            </Link>
          </div>
        )}

        {!loading && !error && filteredAssets.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={calculatedTotalPages}
            onPageChange={handlePageChange}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={handleItemsPerPageChange}
            totalItems={totalItems}
          />
        )}
      </div>
      </div>
      
      {/* Column Filter Popup */}
      <ColumnFilterPopup
        isOpen={showColumnFilter}
        onClose={() => setShowColumnFilter(false)}
        columns={columnConfig}
        onApply={handleColumnConfigApply}
      />

      <ConfirmationModal
        isOpen={bulkDeleteConfirm.show}
        onClose={() => {
          if (!bulkDeleting) {
            setBulkDeleteConfirm({ show: false, assetIds: [] });
          }
        }}
        onConfirm={handleConfirmBulkDelete}
        title={`Delete ${bulkDeleteConfirm.assetIds.length} asset(s)?`}
        message="This will remove inventory rows, software links, peripherals, and PM records/results."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        loading={bulkDeleting}
      />

      {/* Delete Confirmation Dialog */}
      {deleteDialog.show && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
            position: 'relative'
          }}>
            {/* Close button */}
            <button
              onClick={handleCancelDelete}
              disabled={deleteDialog.deleting}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'none',
                border: 'none',
                cursor: deleteDialog.deleting ? 'not-allowed' : 'pointer',
                padding: '5px',
                opacity: deleteDialog.deleting ? 0.5 : 1
              }}
            >
              <X size={24} color="#666" />
            </button>

            {/* Warning Icon */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <div style={{
                backgroundColor: '#fee',
                borderRadius: '50%',
                padding: '15px',
                display: 'inline-flex'
              }}>
                <AlertTriangle size={40} color="#dc3545" />
              </div>
            </div>

            {/* Title */}
            <h2 style={{
              textAlign: 'center',
              color: '#dc3545',
              marginBottom: '20px',
              fontSize: '1.5rem'
            }}>
              Delete Asset?
            </h2>

            {/* Asset Information */}
            {deleteDialog.asset && (
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <p style={{ margin: '5px 0', fontSize: '0.95rem' }}>
                  <strong>Serial Number:</strong> {deleteDialog.asset.Asset_Serial_Number}
                </p>
                <p style={{ margin: '5px 0', fontSize: '0.95rem' }}>
                  <strong>Tag ID:</strong> {deleteDialog.asset.Asset_Tag_ID}
                </p>
                <p style={{ margin: '5px 0', fontSize: '0.95rem' }}>
                  <strong>Item Name:</strong> {deleteDialog.asset.Item_Name}
                </p>
              </div>
            )}

            {/* Warning Message */}
            <div style={{
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '25px'
            }}>
              <p style={{
                margin: 0,
                color: '#856404',
                fontSize: '0.9rem',
                lineHeight: '1.5',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px'
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Warning:</strong> This action cannot be undone. The following related records will also be permanently deleted:</span>
              </p>
              <ul style={{
                marginTop: '10px',
                marginBottom: 0,
                paddingLeft: '20px',
                color: '#856404',
                fontSize: '0.9rem'
              }}>
                <li>All <strong>Peripherals</strong> associated with this asset</li>
                <li>All <strong>Preventive Maintenance (PM)</strong> records for this asset</li>
                <li>Inventory links will be cleared (not deleted)</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '15px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={handleCancelDelete}
                disabled={deleteDialog.deleting}
                style={{
                  padding: '12px 24px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#666',
                  cursor: deleteDialog.deleting ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500',
                  opacity: deleteDialog.deleting ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteDialog.deleting}
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: deleteDialog.deleting ? '#ccc' : '#dc3545',
                  color: 'white',
                  cursor: deleteDialog.deleting ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {deleteDialog.deleting ? (
                  <>
                    <span>Deleting...</span>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid white',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite'
                    }} />
                  </>
                ) : (
                  <>
                    <Trash2 size={18} />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Export Modal */}
      {showExportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '25px',
              paddingBottom: '15px',
              borderBottom: '2px solid #667eea'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Download size={24} color="#667eea" />
                <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.3rem' }}>
                  Export Assets to CSV
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setSelectedCustomersForExport([]);
                  setExportSearchTerm('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '5px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={24} color="#7f8c8d" />
              </button>
            </div>

            {/* Export All Section */}
            <div style={{
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              marginBottom: '25px'
            }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '1.1rem' }}>
                Export All Assets
              </h3>
              <p style={{ margin: '0 0 15px 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
                {loadingExportData ? 'Loading assets...' : `Export all ${allAssetsForExport.length} assets from all customers in one file`}
              </p>
              <button
                onClick={exportAllAssets}
                disabled={loadingExportData || allAssetsForExport.length === 0}
                style={{
                  padding: '12px 24px',
                  backgroundColor: loadingExportData || allAssetsForExport.length === 0 ? '#bdc3c7' : '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loadingExportData || allAssetsForExport.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => {
                  if (!loadingExportData && allAssetsForExport.length > 0) {
                    e.target.style.backgroundColor = '#229954';
                  }
                }}
                onMouseOut={(e) => {
                  if (!loadingExportData && allAssetsForExport.length > 0) {
                    e.target.style.backgroundColor = '#27ae60';
                  }
                }}
              >
                <Download size={18} />
                {loadingExportData ? 'Loading...' : 'Export All Assets'}
              </button>
            </div>

            {/* Divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '15px',
              margin: '25px 0'
            }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#ddd' }}></div>
              <span style={{ color: '#7f8c8d', fontSize: '0.9rem', fontWeight: '600' }}>OR</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#ddd' }}></div>
            </div>

            {/* Export by Customer Section */}
            <div>
              <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '1.1rem' }}>
                Export by Customer
              </h3>
              <p style={{ margin: '0 0 15px 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
                Select specific customers to export their assets
              </p>

              {/* Search Customers */}
              <div style={{ position: 'relative', marginBottom: '15px' }}>
                <Search 
                  size={18} 
                  style={{ 
                    position: 'absolute', 
                    left: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    color: '#7f8c8d'
                  }} 
                />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={exportSearchTerm}
                  onChange={(e) => setExportSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 40px',
                    border: '2px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Select/Deselect All */}
              <div style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '15px'
              }}>
                <button
                  onClick={selectAllCustomers}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllCustomers}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#95a5a6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}
                >
                  Deselect All
                </button>
                <div style={{
                  marginLeft: 'auto',
                  padding: '8px 12px',
                  backgroundColor: '#e3f2fd',
                  borderRadius: '4px',
                  color: '#1976d2',
                  fontSize: '0.9rem',
                  fontWeight: '600'
                }}>
                  {selectedCustomersForExport.length} selected
                </div>
              </div>

              {/* Customer List */}
              <div style={{
                maxHeight: '250px',
                overflowY: 'auto',
                border: '2px solid #ddd',
                borderRadius: '6px',
                padding: '10px',
                backgroundColor: '#fafafa',
                opacity: loadingExportData ? 0.6 : 1,
                pointerEvents: loadingExportData ? 'none' : 'auto'
              }}>
                {loadingExportData ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#7f8c8d'
                  }}>
                    <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ marginTop: '10px' }}>Loading assets...</p>
                  </div>
                ) : exportCustomers.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#7f8c8d'
                  }}>
                    <p>No customers found</p>
                  </div>
                ) : (
                  exportCustomers
                    .filter(customer => customer.toLowerCase().includes(exportSearchTerm.toLowerCase()))
                    .map((customer, index) => (
                      <label
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '10px',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          marginBottom: '5px',
                          backgroundColor: selectedCustomersForExport.includes(customer) ? '#e3f2fd' : 'white',
                          border: selectedCustomersForExport.includes(customer) ? '1px solid #3498db' : '1px solid #ddd',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          if (!selectedCustomersForExport.includes(customer)) {
                            e.currentTarget.style.backgroundColor = '#f5f5f5';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (!selectedCustomersForExport.includes(customer)) {
                            e.currentTarget.style.backgroundColor = 'white';
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCustomersForExport.includes(customer)}
                          onChange={() => toggleCustomerSelection(customer)}
                          style={{
                            width: '18px',
                            height: '18px',
                            marginRight: '12px',
                            cursor: 'pointer'
                          }}
                        />
                        <span style={{
                          flex: 1,
                          color: '#2c3e50',
                          fontSize: '0.95rem',
                          fontWeight: selectedCustomersForExport.includes(customer) ? '600' : '400'
                        }}>
                          {customer}
                        </span>
                        <span style={{
                          color: '#7f8c8d',
                          fontSize: '0.85rem',
                          marginLeft: '10px'
                        }}>
                          ({allAssetsForExport.filter(a => a.Customer_Name === customer).length} assets)
                        </span>
                      </label>
                    ))
                )}
              </div>

              {/* Export Selected Button */}
              <button
                onClick={exportSelectedCustomers}
                disabled={selectedCustomersForExport.length === 0}
                style={{
                  marginTop: '20px',
                  width: '100%',
                  padding: '14px',
                  backgroundColor: selectedCustomersForExport.length > 0 ? '#667eea' : '#bdc3c7',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: selectedCustomersForExport.length > 0 ? 'pointer' : 'not-allowed',
                  fontSize: '1rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => {
                  if (selectedCustomersForExport.length > 0) {
                    e.target.style.backgroundColor = '#5568d3';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedCustomersForExport.length > 0) {
                    e.target.style.backgroundColor = '#667eea';
                  }
                }}
              >
                <Download size={18} />
                Export Selected Customers
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add spinning animation for loading indicator */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        /* Disable text selection while resizing */
        body.resizing-column {
          user-select: none;
          cursor: col-resize !important;
        }
        
        /* Column resize cursor */
        th {
          position: relative;
        }
      `}</style>
    </div>
  );
};

export default Assets;