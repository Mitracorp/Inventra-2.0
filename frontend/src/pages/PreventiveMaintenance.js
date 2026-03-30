import React, { useState, useEffect, useRef, useMemo } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Calendar, Clock, CheckCircle, AlertTriangle, Wrench, Filter, Building2, MapPin, Package, FileText, X, ClipboardCheck, Edit, Trash2, Plus, Save, Search, Download, ChevronRight, ChevronLeft, Copy, ArrowLeft, GripVertical, Hammer, FileUp, Lock, AlertCircle, CheckSquare, Square } from 'lucide-react';
import { API_URL } from '../config/api';
import Pagination from '../components/Pagination';
import toast from '../utils/toast';

// Reusable searchable dropdown component with inline search at top
const SearchableDropdown = ({
  value,
  onChangeEvent,
  options,
  getOptionValue,
  renderOption,
  disabled,
  placeholder = '-- Select --',
  searchPlaceholder = 'Type to search...'
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => renderOption(opt).toLowerCase().includes(q));
  }, [options, query, renderOption]);

  const selectedLabel = useMemo(() => {
    const found = options.find((opt) => String(getOptionValue(opt)) === String(value));
    return found ? renderOption(found) : placeholder;
  }, [options, value, getOptionValue, renderOption, placeholder]);

  const handleSelect = (opt) => {
    const newVal = getOptionValue(opt);
    onChangeEvent({ target: { value: newVal } });
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '12px',
          border: value ? '2px solid #000' : '2px solid #ddd',
          borderRadius: '6px',
          fontSize: '1rem',
          backgroundColor: disabled ? '#f5f5f5' : 'white',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <span style={{ color: selectedLabel === placeholder ? '#7f8c8d' : '#2c3e50' }}>{selectedLabel}</span>
        <span style={{ float: 'right', color: '#7f8c8d' }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            zIndex: 9999,
            top: '48px',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
          }}
        >
          <div style={{ padding: '8px' }}>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '0.95rem'
              }}
            />
          </div>
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '10px', color: '#7f8c8d', fontStyle: 'italic' }}>No matches</div>
            ) : (
              filtered.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    border: 'none',
                    borderTop: '1px solid #f0f0f0',
                    background: 'white',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#f5f7fa')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'white')}
                >
                  {renderOption(opt)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const PreventiveMaintenance = () => {
  usePageTitle('Preventive Maintenance');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isInitialMount = useRef(true);
  const savedBranch = useRef(null);
  const scrollPositionKey = 'pmPageScrollPosition';
  const hasRestoredScroll = useRef(false);
  const hasRestoredFromURL = useRef(false);
  const isRestoringFromURL = useRef(false);

  // Color palette for categories (matching Dashboard)
  const categoryColorPalette = [
    '#60a5fa', // Light Blue
    '#34d399', // Green
    '#a78bfa', // Purple
    '#f87171', // Red
    '#fbbf24', // Yellow
    '#fb923c', // Orange
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#8b5cf6', // Violet
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#6366f1', // Indigo
    '#ef4444', // Rose
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#d946ef', // Fuchsia
  ];

  // Function to get colors for categories
  const getCategoryColors = (categories) => {
    const categoryColors = {};
    categories.sort().forEach((category, index) => {
      categoryColors[category] = categoryColorPalette[index % categoryColorPalette.length];
    });
    return categoryColors;
  };

  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [customerFilterQuery, setCustomerFilterQuery] = useState('');
  const [branchFilterQuery, setBranchFilterQuery] = useState('');
  const [customerPMCounts, setCustomerPMCounts] = useState({}); // {customerId: count}
  const [branchPMCounts, setBranchPMCounts] = useState({}); // {branch: count}
  const [allPMRecordsForCounts, setAllPMRecordsForCounts] = useState([]); // Store all PM records for counting
  const [pmRecords, setPmRecords] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // User role for access control
  const [userRole, setUserRole] = useState('');
  
  // Check if user is customer-type role
  const isCustomerRole = () => {
    if (!userRole) return false;
    const role = userRole.toLowerCase();
    return role !== 'admin' && role !== 'staff';
  };
  
  // PM Form Modal States
  const [showPMForm, setShowPMForm] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [checklistItems, setChecklistItems] = useState([]);
  const [checklistResults, setChecklistResults] = useState({});
  const [checklistItemRemarks, setChecklistItemRemarks] = useState({});
  const [pmRemarks, setPmRemarks] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Checklist Management Modal States
  const [showChecklistManager, setShowChecklistManager] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryForEdit, setSelectedCategoryForEdit] = useState('');
  const [checklistItemsForEdit, setChecklistItemsForEdit] = useState([]);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemTextLong, setEditingItemTextLong] = useState('');
  const [newItemTextLong, setNewItemTextLong] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [pendingEdit, setPendingEdit] = useState(null);
  const [showAddConfirm, setShowAddConfirm] = useState(false);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [showCopyChecklist, setShowCopyChecklist] = useState(false);
  const [sourceCategoryForCopy, setSourceCategoryForCopy] = useState('');
  const [sourceChecklistItems, setSourceChecklistItems] = useState([]);

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

  const openOverviewPage = (type) => {
    const params = new URLSearchParams();
    if (selectedCustomer) params.set('customer', selectedCustomer);
    if (selectedBranch) params.set('branch', selectedBranch);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    navigate(`/maintenance/overview/${type}${suffix}`);
  };

  const [selectedItemsToCopy, setSelectedItemsToCopy] = useState([]);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const [loadingSourceChecklist, setLoadingSourceChecklist] = useState(false);
  const [copyingItems, setCopyingItems] = useState(false);

  // Rearrange mode states
  const [rearrangeMode, setRearrangeMode] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [showRearrangeConfirm, setShowRearrangeConfirm] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  // Bulk Download Modal States
  const [showBulkDownloadModal, setShowBulkDownloadModal] = useState(false);
  const [bulkDownloadSearch, setBulkDownloadSearch] = useState('');
  const [selectedAssets, setSelectedAssets] = useState([]); // Assets selected (left box)
  const [selectedPMRecords, setSelectedPMRecords] = useState({}); // PM records selected per asset {assetId: [pmId1, pmId2]}
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  // Delete PM Records States
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedPMsForDelete, setSelectedPMsForDelete] = useState([]); // Array of {pmId, pmDetails, assetDetails} objects
  const [showDeleteModeToast, setShowDeleteModeToast] = useState(false);
  const [showDeleteSuccessToast, setShowDeleteSuccessToast] = useState(false);
  const [deletedRecordsCount, setDeletedRecordsCount] = useState(0);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [showDeleteSummary, setShowDeleteSummary] = useState(false);
  const [showPasswordVerification, setShowPasswordVerification] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [deletingSummary, setDeletingSummary] = useState([]);

  // Combined PM Table Category Filter State
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Column Filter State
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterPopup, setActiveFilterPopup] = useState(null);
  
  // Filter to show only assets with PM records
  const [showOnlyWithPM, setShowOnlyWithPM] = useState(false);
  const [showOnlyWithPMBeforeDeleteMode, setShowOnlyWithPMBeforeDeleteMode] = useState(false);

  // Filtered lists for dropdowns (client-side search)
  const filteredCustomers = useMemo(() => {
    const q = customerFilterQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c => {
      const name = (c.Customer_Name || '').toLowerCase();
      const ref = (c.Customer_Ref_Number || '').toLowerCase();
      return name.includes(q) || ref.includes(q);
    });
  }, [customers, customerFilterQuery]);

  const filteredBranches = useMemo(() => {
    const q = branchFilterQuery.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter(b => (b || '').toLowerCase().includes(q));
  }, [branches, branchFilterQuery]);

  // Initialize from URL parameters on mount
  useEffect(() => {
    // Get user role from localStorage
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    setUserRole(userInfo.role || '');
    
    // Set flag to prevent URL updates during restoration
    isRestoringFromURL.current = true;
    
    fetchStatistics();
    fetchCustomers();
    
    // Restore filter/pagination states from URL (but NOT customer/branch - handled separately)
    const categoryFilter = searchParams.get('categoryFilter');
    const page = searchParams.get('page');
    const perPage = searchParams.get('perPage');
    const search = searchParams.get('search');
    const onlyWithPM = searchParams.get('onlyWithPM');
    
    if (categoryFilter) setSelectedCategoryFilter(categoryFilter);
    if (page) setCurrentPage(parseInt(page));
    if (perPage) setItemsPerPage(parseInt(perPage));
    if (search) setSearchQuery(search);
    if (onlyWithPM) setShowOnlyWithPM(onlyWithPM === 'true');
    
    // Restore column filters
    const columnFiltersParam = searchParams.get('columnFilters');
    if (columnFiltersParam) {
      try {
        setColumnFilters(JSON.parse(decodeURIComponent(columnFiltersParam)));
      } catch (e) {
        console.error('Failed to parse column filters:', e);
      }
    }
  }, []);

  // Separate effect to handle URL params after customers are loaded
  useEffect(() => {
    if (customers.length === 0) return;
    
    const customerParam = searchParams.get('customer');
    const branchParam = searchParams.get('branch');
    
    if (customerParam) {
      // Find customer by name (from PMImport) or by ID
      const customerObj = customers.find(c => 
        c.Customer_Name === customerParam || c.Customer_ID == customerParam
      );
      
      if (customerObj && customerObj.Customer_ID != selectedCustomer) {
        setSelectedCustomer(customerObj.Customer_ID);
        if (branchParam) {
          // Save branch to restore after branches are fetched
          savedBranch.current = branchParam;
        }
      }
    }
  }, [customers, searchParams]);

  useEffect(() => {
    if (selectedCustomer) {
      fetchBranches(selectedCustomer);
      
      // Only clear branch if not initial mount with saved branch
      if (!isInitialMount.current || !savedBranch.current) {
        setSelectedBranch('');
      }
      setPmRecords([]);
    } else {
      setBranches([]);
      setSelectedBranch('');
      setPmRecords([]);
    }
  }, [selectedCustomer]);

  // Restore scroll position after data loads
  useEffect(() => {
    if (!loading && !hasRestoredScroll.current && pmRecords.length > 0) {
      const savedPosition = sessionStorage.getItem(scrollPositionKey);
      
      if (savedPosition) {
        // Wait for all renders to complete, then scroll
        setTimeout(() => {
          requestAnimationFrame(() => {
            const scrollPos = parseInt(savedPosition, 10);
            window.scrollTo({
              top: scrollPos,
              behavior: 'instant'
            });
            hasRestoredScroll.current = true;
            sessionStorage.removeItem(scrollPositionKey);
          });
        }, 300);
      }
    }
  }, [loading, pmRecords]);

  // Restore branch from URL after branches are fetched
  useEffect(() => {
    if (savedBranch.current && branches.length > 0) {
      setSelectedBranch(savedBranch.current);
      savedBranch.current = null;
      if (isInitialMount.current) {
        isInitialMount.current = false;
      }
      
      // Restoration complete - allow URL updates now
      setTimeout(() => {
        isRestoringFromURL.current = false;
      }, 100);
    } else if (branches.length > 0 && !savedBranch.current) {
      // No branch to restore - allow URL updates now
      setTimeout(() => {
        isRestoringFromURL.current = false;
      }, 100);
    }
  }, [branches]);

  useEffect(() => {
    if (selectedCustomer && selectedBranch) {
      fetchPMRecords(selectedCustomer, selectedBranch);
    } else {
      setPmRecords([]);
    }
  }, [selectedCustomer, selectedBranch]);

  const fetchStatistics = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/statistics`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch statistics');
      const data = await response.json();
      setStatistics(data.data);
    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/customers`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();
      setCustomers(data);
      
      // Fetch all PM records to calculate counts
      try {
        const allRecordsResponse = await fetch(`${API_URL}/pm`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (allRecordsResponse.ok) {
          const response = await allRecordsResponse.json();
          const allRecords = response.data || response;
          console.log('Fetched PM records for counting:', allRecords.length);
          console.log('Sample record:', allRecords[0]);
          setAllPMRecordsForCounts(allRecords);
          
          // Calculate counts per customer (only count records with actual PM_ID)
          const counts = {};
          data.forEach(customer => {
            const count = allRecords.filter(record => 
              record.Customer_Ref_Number === customer.Customer_ID && record.PM_ID != null
            ).length;
            console.log(`Customer ${customer.Customer_Name} (Ref: ${customer.Customer_ID}): ${count} PM records`);
            counts[customer.Customer_ID] = count;
          });
          setCustomerPMCounts(counts);
        } else {
          console.error('Failed to fetch PM records:', allRecordsResponse.status);
        }
      } catch (err) {
        console.error('Error fetching all PM records for counts:', err);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async (customerId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/customers/${customerId}/branches`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch branches');
      const data = await response.json();
      setBranches(data);
      
      // Always fetch fresh PM records for counting to avoid stale state
      let pmRecordsForCounting = [];
      try {
        const allRecordsResponse = await fetch(`${API_URL}/pm`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (allRecordsResponse.ok) {
          const response = await allRecordsResponse.json();
          pmRecordsForCounting = response.data || response;
          setAllPMRecordsForCounts(pmRecordsForCounting);
        }
      } catch (err) {
        console.error('Error fetching PM records for branch counts:', err);
        // If fetch fails, try to use existing state
        pmRecordsForCounting = allPMRecordsForCounts;
      }
      
      // Calculate PM counts for each branch from stored records (only count actual PM records)
      const counts = {};
      data.forEach(branch => {
        const count = pmRecordsForCounting.filter(record => 
          record.Customer_Ref_Number == customerId && record.Branch === branch && record.PM_ID != null
        ).length;
        console.log(`Branch ${branch}: ${count} PM records (Customer Ref: ${customerId})`);
        counts[branch] = count;
      });
      setBranchPMCounts(counts);
    } catch (err) {
      console.error('Error fetching branches:', err);
    }
  };

  const fetchPMRecords = async (customerId, branch) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/filter?customerId=${customerId}&branch=${encodeURIComponent(branch)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch PM records');
      const data = await response.json();
      console.log('PM Records with Checklist:', data);
      setPmRecords(data);
    } catch (err) {
      console.error('Error fetching PM records:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter PM records based on search query
  const filteredPmRecords = searchQuery 
    ? pmRecords.filter(record => {
        const query = searchQuery.toLowerCase().trim();
        return (
          record.Asset_Tag_ID?.toLowerCase().includes(query) ||
          record.Item_Name?.toLowerCase().includes(query) ||
          record.Asset_Serial_Number?.toLowerCase().includes(query) ||
          record.Recipient_Name?.toLowerCase().includes(query) ||
          record.Department?.toLowerCase().includes(query)
        );
      })
    : pmRecords;

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategoryFilter, selectedCustomer, selectedBranch, columnFilters, showOnlyWithPM, itemsPerPage]);
  
  // Update URL whenever state changes (but skip during restoration)
  useEffect(() => {
    if (isRestoringFromURL.current) return;
    updateURLParams();
  }, [currentPage, itemsPerPage, searchQuery, selectedCategoryFilter, selectedCustomer, selectedBranch, columnFilters, showOnlyWithPM]);
  
  // Function to update URL parameters with current state
  const updateURLParams = () => {
    const params = new URLSearchParams();
    if (selectedCustomer) params.set('customer', selectedCustomer);
    if (selectedBranch) params.set('branch', selectedBranch);
    if (selectedCategoryFilter && selectedCategoryFilter !== 'all') params.set('categoryFilter', selectedCategoryFilter);
    if (currentPage > 1) params.set('page', currentPage.toString());
    if (itemsPerPage !== 25) params.set('perPage', itemsPerPage.toString());
    if (searchQuery) params.set('search', searchQuery);
    if (showOnlyWithPM) params.set('onlyWithPM', 'true');
    if (Object.keys(columnFilters).length > 0) {
      params.set('columnFilters', encodeURIComponent(JSON.stringify(columnFilters)));
    }
    setSearchParams(params, { replace: true });
  };

  // Save scroll position and current state before navigating away
  const saveStateBeforeNavigation = () => {
    sessionStorage.setItem(scrollPositionKey, window.scrollY.toString());
  };

  // Toggle filter popup for a column
  const toggleFilterPopup = (columnKey) => {
    setActiveFilterPopup(activeFilterPopup === columnKey ? null : columnKey);
  };

  // Handle column filter change
  const handleColumnFilterChange = (columnKey, value) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: value
    }));
  };

  // Clear specific column filter
  const clearColumnFilter = (columnKey) => {
    setColumnFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[columnKey];
      return newFilters;
    });
  };

  // Clear all column filters
  const clearColumnFilters = () => {
    setColumnFilters({});
  };

  // Group PM records by category and asset, keeping only latest PM per asset
  const groupedByCategory = filteredPmRecords.reduce((acc, record) => {
    const category = record.Category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = {
        assets: {}, // Changed from records to assets (keyed by Asset_ID)
        checklistItems: []
      };
    }
    
    const assetId = record.Asset_ID;
    
    // Skip if no Asset_ID
    if (!assetId) return acc;
    
    // If this asset doesn't exist yet, initialize it
    if (!acc[category].assets[assetId]) {
      // Check if this asset has PM data
      if (record.PM_ID) {
        // Asset with PM data
        acc[category].assets[assetId] = {
          ...record,
          pmCount: 1,
          latestPMDate: record.PM_Date,
          allPMRecords: [{ 
            PM_ID: record.PM_ID, 
            PM_Date: record.PM_Date,
            PM_Status: record.PM_Status
          }]
        };
      } else {
        // Asset without PM data (never had PM performed)
        acc[category].assets[assetId] = {
          ...record,
          pmCount: 0,
          latestPMDate: null,
          allPMRecords: []
        };
      }
    } else {
      // Asset already exists - only process if this record has PM_ID
      if (record.PM_ID) {
        // Add the new PM record to the array
        const updatedAllPMRecords = [
          ...acc[category].assets[assetId].allPMRecords, 
          { 
            PM_ID: record.PM_ID, 
            PM_Date: record.PM_Date,
            PM_Status: record.PM_Status
          }
        ];
        
        // Find the actual latest date from all PM records
        const latestDate = updatedAllPMRecords.reduce((maxDate, pmRecord) => {
          const currentPMDate = new Date(pmRecord.PM_Date);
          return currentPMDate > new Date(maxDate) ? pmRecord.PM_Date : maxDate;
        }, updatedAllPMRecords[0].PM_Date);
        
        // Increment PM count
        const newPmCount = acc[category].assets[assetId].pmCount + 1;
        
        // Check if this is the latest PM record (to use its checklist results)
        if (record.PM_Date === latestDate) {
          acc[category].assets[assetId] = {
            ...record,
            pmCount: newPmCount,
            latestPMDate: latestDate,
            allPMRecords: updatedAllPMRecords
          };
        } else {
          // Update counts and date but keep existing checklist results
          acc[category].assets[assetId].pmCount = newPmCount;
          acc[category].assets[assetId].latestPMDate = latestDate;
          acc[category].assets[assetId].allPMRecords = updatedAllPMRecords;
        }
      }
    }
    
    // Collect unique checklist items for this category
    if (record.checklist_results && Array.isArray(record.checklist_results)) {
      record.checklist_results.forEach(item => {
        if (!item || !item.Checklist_ID) return;
        const exists = acc[category].checklistItems.find(
          ci => ci.Checklist_ID === item.Checklist_ID
        );
        if (!exists && item.Check_item_Long) {
          acc[category].checklistItems.push({
            Checklist_ID: item.Checklist_ID,
            Check_item_Long: item.Check_item_Long
          });
        }
      });
    }
    
    return acc;
  }, {});

  // Sort checklist items by ID
  Object.keys(groupedByCategory).forEach(category => {
    groupedByCategory[category].checklistItems.sort((a, b) => a.Checklist_ID - b.Checklist_ID);
  });

  const getSortedAssetPMRecords = (asset) => {
    return (asset?.allPMRecords || [])
      .slice()
      .sort((a, b) => new Date(a.PM_Date) - new Date(b.PM_Date));
  };

  const isUnsignedPMStatus = (status) => {
    return (status || '').toLowerCase() !== 'completed';
  };

  const getUnsignedPM1PM2CountForAsset = (asset) => {
    const sortedPMs = getSortedAssetPMRecords(asset);
    if (sortedPMs.length === 0) return 0;
    const firstTwo = sortedPMs.slice(0, 2);
    return firstTwo.filter(pm => isUnsignedPMStatus(pm.PM_Status || pm.Status)).length;
  };

  const isUnsignedPM1AndPM2Asset = (asset) => {
    return getUnsignedPM1PM2CountForAsset(asset) > 0;
  };

  const summaryCards = useMemo(() => {
    const allAssets = [];

    Object.keys(groupedByCategory).forEach((category) => {
      const assets = Object.values(groupedByCategory[category]?.assets || {});
      assets.forEach((asset) => {
        allAssets.push({
          ...asset,
          categoryName: category
        });
      });
    });

    return {
      totalAssets: allAssets.length,
      unsignedPM1AndPM2: allAssets.reduce((sum, asset) => sum + getUnsignedPM1PM2CountForAsset(asset), 0),
      onlyOnePM: allAssets.filter(asset => asset.pmCount === 1).length,
      noPMYet: allAssets.filter(asset => asset.pmCount === 0).length
    };
  }, [groupedByCategory]);

  const syncedTableStats = useMemo(() => {
    const pmRows = (pmRecords || []).filter(record => record.PM_ID != null);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const thisMonth = pmRows.filter((record) => {
      if (!record.PM_Date) return false;
      const pmDate = new Date(record.PM_Date);
      return pmDate.getFullYear() === currentYear && pmDate.getMonth() === currentMonth;
    }).length;

    return {
      total: pmRows.length,
      thisMonth
    };
  }, [pmRecords]);

  const getCheckResultIcon = (isOk) => {
    if (isOk === 1 || isOk === true) {
      return <CheckCircle size={18} color="#27ae60" style={{ display: 'inline-block' }} />;
    } else {
      return <X size={18} color="#e74c3c" style={{ display: 'inline-block' }} />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    // Parse date string as local date to avoid timezone shifts
    // If date comes as "2026-01-15", treat it as local date not UTC
    const dateOnly = dateString.split('T')[0];
    const parts = dateOnly.split('-');
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    const date = new Date(year, month - 1, day); // month is 0-indexed
    const monthName = date.toLocaleString('en-MY', { month: 'short' });
    const formatted = `${day} ${monthName} ${year}`;
    return formatted;
  };

  // ============ CHECKLIST MANAGEMENT HANDLERS ============
  
  const handleOpenChecklistManager = async () => {
    setShowChecklistManager(true);
    setLoadingChecklist(true);
    
    try {
      // Fetch all categories
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/categories`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      setCategories(data);
    } catch (err) {
      console.error('Error fetching categories:', err);
      toast.error('Failed to load categories');
    } finally {
      setLoadingChecklist(false);
    }
  };

  const handleCategoryChangeForEdit = async (e) => {
    const categoryId = e.target.value;
    setSelectedCategoryForEdit(categoryId);
    setChecklistItemsForEdit([]);
    setNewItemTextLong('');
    setEditingItemId(null);
    
    if (!categoryId) return;
    
    setLoadingChecklist(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/all-checklist/${categoryId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch checklist items');
      const data = await response.json();
      setChecklistItemsForEdit(data);
    } catch (err) {
      console.error('Error fetching checklist items:', err);
      toast.error('Failed to load checklist items');
    } finally {
      setLoadingChecklist(false);
    }
  };

  const handleStartEdit = (item) => {
    setEditingItemId(item.Checklist_ID);
    setEditingItemTextLong(item.Check_item_Long);
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditingItemTextLong('');
  };

  const handleConfirmEdit = () => {
    setPendingEdit({ 
      id: editingItemId, 
      textLong: editingItemTextLong 
    });
    setShowEditConfirm(true);
  };

  const handleSaveEdit = async () => {
    setShowEditConfirm(false);
    setLoadingChecklist(true);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/checklist/${pendingEdit.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          checkItemLong: pendingEdit.textLong
        })
      });

      if (!response.ok) throw new Error('Failed to update checklist item');

      toast.success('Checklist item updated successfully!');
      
      // Refresh checklist
      await handleCategoryChangeForEdit({ target: { value: selectedCategoryForEdit } });
      setEditingItemId(null);
      setEditingItemTextLong('');
      setPendingEdit(null);
    } catch (err) {
      console.error('Error updating checklist item:', err);
      toast.error('Failed to update checklist item');
    } finally {
      setLoadingChecklist(false);
    }
  };

  const handleDeleteClick = (item) => {
    setItemToDelete(item);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setShowDeleteConfirm(false);
    setLoadingChecklist(true);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/checklist/${itemToDelete.Checklist_ID}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          toast.error(data.error || 'Cannot delete: This checklist item is used in existing PM records');
        } else {
          throw new Error(data.error || 'Failed to delete checklist item');
        }
        return;
      }

      toast.success('Checklist item deleted successfully!');
      
      // Refresh checklist
      await handleCategoryChangeForEdit({ target: { value: selectedCategoryForEdit } });
      setItemToDelete(null);
    } catch (err) {
      console.error('Error deleting checklist item:', err);
      toast.error(err.message || 'Failed to delete checklist item');
    } finally {
      setLoadingChecklist(false);
    }
  };

  const handleAddNewItem = () => {
    if (!newItemTextLong.trim()) {
      toast.error('Please enter checklist item');
      return;
    }
    setShowAddConfirm(true);
  };

  const handleConfirmAddItem = async () => {
    setShowAddConfirm(false);
    setLoadingChecklist(true);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/checklist`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          categoryId: selectedCategoryForEdit,
          checkItemLong: newItemTextLong
        })
      });

      if (!response.ok) throw new Error('Failed to add checklist item');

      toast.success('Checklist item added successfully!');
      
      // Refresh checklist
      await handleCategoryChangeForEdit({ target: { value: selectedCategoryForEdit } });
      setNewItemTextLong('');
    } catch (err) {
      console.error('Error adding checklist item:', err);
      toast.error('Failed to add checklist item');
    } finally {
      setLoadingChecklist(false);
    }
  };

  const handleCloseChecklistManager = () => {
    setShowChecklistManager(false);
    setSelectedCategoryForEdit('');
    setChecklistItemsForEdit([]);
    setEditingItemId(null);
    setNewItemTextLong('');
    setShowCopyChecklist(false);
  };

  const handleOpenCopyChecklist = () => {
    setShowCopyChecklist(true);
    setSourceCategoryForCopy('');
    setSourceChecklistItems([]);
    setSelectedItemsToCopy([]);
  };

  const handleBackToManageChecklist = () => {
    setShowCopyChecklist(false);
    setSourceCategoryForCopy('');
    setSourceChecklistItems([]);
    setSelectedItemsToCopy([]);
  };

  const handleSourceCategoryChange = async (e) => {
    const categoryId = e.target.value;
    setSourceCategoryForCopy(categoryId);
    setSelectedItemsToCopy([]);
    
    if (!categoryId) {
      setSourceChecklistItems([]);
      return;
    }
    
    try {
      setLoadingSourceChecklist(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/all-checklist/${categoryId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch source checklist');
      const data = await response.json();
      setSourceChecklistItems(data);
    } catch (err) {
      console.error('Error fetching source checklist:', err);
      toast.error('Failed to load checklist items');
    } finally {
      setLoadingSourceChecklist(false);
    }
  };

  const handleToggleItemToCopy = (item) => {
    setSelectedItemsToCopy(prev => {
      const exists = prev.find(i => i.Checklist_ID === item.Checklist_ID);
      if (exists) {
        return prev.filter(i => i.Checklist_ID !== item.Checklist_ID);
      } else {
        return [...prev, item];
      }
    });
  };

  const handleConfirmCopyClick = () => {
    if (selectedItemsToCopy.length === 0) {
      toast.error('Please select at least one item to copy');
      return;
    }
    setShowCopyConfirm(true);
  };

  const handleConfirmCopy = async () => {
    setCopyingItems(true);
    try {
      const token = localStorage.getItem('authToken');
      
      // Copy each selected item
      for (const item of selectedItemsToCopy) {
        const response = await fetch(`${API_URL}/pm/checklist`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            categoryId: selectedCategoryForEdit,
            checkItemLong: item.Check_item_Long
          })
        });
        
        if (!response.ok) throw new Error('Failed to copy item');
      }
      
      toast.success(`Successfully copied ${selectedItemsToCopy.length} item(s)!`);
      
      // Refresh the checklist for the target category
      await handleCategoryChangeForEdit({ target: { value: selectedCategoryForEdit } });
      
      // Go back to manage checklist page
      handleBackToManageChecklist();
      setShowCopyConfirm(false);
    } catch (err) {
      console.error('Error copying items:', err);
      toast.error('Failed to copy items. Please try again.');
    } finally {
      setCopyingItems(false);
    }
  };

  // Rearrange mode handlers
  const handleToggleRearrangeMode = () => {
    if (rearrangeMode) {
      // User clicked Confirm - show confirmation dialog
      setShowRearrangeConfirm(true);
    } else {
      // Enter rearrange mode
      setRearrangeMode(true);
    }
  };

  const handleCancelRearrange = () => {
    // Reload checklist to reset order
    handleCategoryChangeForEdit({ target: { value: selectedCategoryForEdit } });
    setRearrangeMode(false);
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const handleConfirmRearrange = async () => {
    setSavingOrder(true);
    try {
      const token = localStorage.getItem('authToken');
      
      // Prepare order updates with new Display_Order values
      const orderUpdates = checklistItemsForEdit.map((item, index) => ({
        Checklist_ID: item.Checklist_ID,
        Display_Order: index + 1
      }));
      
      const response = await fetch(`${API_URL}/pm/checklist-order`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ orderUpdates })
      });
      
      if (!response.ok) throw new Error('Failed to update order');
      
      toast.success('Checklist order updated successfully!');
      
      // Refresh the checklist
      await handleCategoryChangeForEdit({ target: { value: selectedCategoryForEdit } });
      
      // Exit rearrange mode
      setRearrangeMode(false);
      setShowRearrangeConfirm(false);
    } catch (err) {
      console.error('Error updating order:', err);
      toast.error('Failed to update order. Please try again.');
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItem === null) return;
    if (index !== draggedItem) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    // Reorder the array
    const newItems = [...checklistItemsForEdit];
    const draggedItemData = newItems[draggedItem];
    newItems.splice(draggedItem, 1);
    newItems.splice(dropIndex, 0, draggedItemData);

    setChecklistItemsForEdit(newItems);
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  // Handlers for customer and branch selection with URL parameter updates
  const handleCustomerChange = (e) => {
    const newCustomer = e.target.value;
    setSelectedCustomer(newCustomer);
    
    // Update URL parameters
    if (newCustomer) {
      setSearchParams({ customer: newCustomer });
    } else {
      setSearchParams({});
    }
  };

  const handleBranchChange = (e) => {
    const newBranch = e.target.value;
    setSelectedBranch(newBranch);
    
    // Update URL parameters (keep customer parameter)
    if (newBranch && selectedCustomer) {
      setSearchParams({ customer: selectedCustomer, branch: newBranch });
    } else if (selectedCustomer) {
      setSearchParams({ customer: selectedCustomer });
    }
  };

  // PM Form Handlers
  const handleOpenPMForm = async (asset) => {
    setSelectedAsset(asset);
    setShowPMForm(true);
    setPmRemarks('');
    setChecklistResults({});
    setChecklistItemRemarks({});
    
    // Fetch checklist items for this asset's category
    try {
      const response = await fetch(`${API_URL}/pm/all-checklist/${asset.Category_ID}`);
      if (!response.ok) throw new Error('Failed to fetch checklist');
      const data = await response.json();
      setChecklistItems(data);
      
      // Initialize all checklist results to false (bad)
      const initialResults = {};
      data.forEach(item => {
        initialResults[item.Checklist_ID] = false;
      });
      setChecklistResults(initialResults);
    } catch (err) {
      console.error('Error fetching checklist:', err);
      toast.error('Failed to load checklist items');
    }
  };

  const handleClosePMForm = () => {
    setShowCancelDialog(true);
  };

  const handleConfirmCancel = () => {
    setShowCancelDialog(false);
    setShowPMForm(false);
    setSelectedAsset(null);
    setChecklistItems([]);
    setChecklistResults({});
    setChecklistItemRemarks({});
    setPmRemarks('');
  };

  const handleChecklistChange = (checklistId, isOk) => {
    setChecklistResults(prev => ({
      ...prev,
      [checklistId]: isOk
    }));
  };

  const handleChecklistRemarkChange = (checklistId, remark) => {
    setChecklistItemRemarks(prev => ({
      ...prev,
      [checklistId]: remark
    }));
  };

  const handleSubmitPMForm = () => {
    setShowConfirmDialog(true);
  };

  // Delete Mode Handlers
  const handleOpenDeleteMode = () => {
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDeleteMode = () => {
    setShowDeleteConfirmation(false);
    setShowOnlyWithPMBeforeDeleteMode(showOnlyWithPM);
    setDeleteMode(true);
    setShowOnlyWithPM(true);
    setSelectedPMsForDelete([]);
    // Broadcast delete mode to sidebar
    sessionStorage.setItem('pmDeleteMode', 'true');
    window.dispatchEvent(new Event('pmDeleteModeChange'));
  };

  const handleCancelDeleteMode = () => {
    setShowCancelConfirmation(true);
  };

  const handleConfirmCancelDeleteMode = () => {
    setDeleteMode(false);
    setShowOnlyWithPM(showOnlyWithPMBeforeDeleteMode);
    setSelectedPMsForDelete([]);
    // Clear delete mode from sidebar
    sessionStorage.removeItem('pmDeleteMode');
    window.dispatchEvent(new Event('pmDeleteModeChange'));
    setShowCancelConfirmation(false);
  };

  const handleTogglePMForDelete = (pmId, pmDetails = null, assetDetails = null) => {
    setSelectedPMsForDelete(prev => {
      const exists = prev.find(item => item.pmId === pmId);
      if (exists) {
        return prev.filter(item => item.pmId !== pmId);
      } else {
        return [...prev, { pmId, pmDetails, assetDetails }];
      }
    });
  };

  const handleToggleAssetForDelete = (assetDetails, pmRecords = []) => {
    const validPMRecords = (pmRecords || []).filter(pm => pm && pm.PM_ID);
    if (validPMRecords.length === 0) return;

    const pmIds = validPMRecords.map(pm => pm.PM_ID);

    setSelectedPMsForDelete(prev => {
      const selectedSet = new Set(prev.map(item => item.pmId));
      const allSelected = pmIds.every(id => selectedSet.has(id));

      if (allSelected) {
        return prev.filter(item => !pmIds.includes(item.pmId));
      }

      const next = prev.filter(item => !pmIds.includes(item.pmId));
      validPMRecords.forEach(pm => {
        next.push({ pmId: pm.PM_ID, pmDetails: pm, assetDetails });
      });

      return next;
    });
  };

  const handleShowDeleteModeToast = () => {
    setShowDeleteModeToast(true);
    // Auto-hide after 4 seconds
    setTimeout(() => {
      setShowDeleteModeToast(false);
    }, 4000);
  };

  const handlePrepareDeleteSummary = () => {
    // Prepare detailed summary of PMs to be deleted
    const summary = selectedPMsForDelete.map(item => ({
      PM_ID: item.pmId,
      categoryName: item.assetDetails?.categoryName || 'Unknown',
      Asset_Tag_ID: item.assetDetails?.Asset_Tag_ID || 'N/A',
      Asset_Serial_Number: item.assetDetails?.Asset_Serial_Number || 'N/A',
      Item_Name: item.assetDetails?.Item_Name || 'N/A',
      PM_Date: item.pmDetails?.PM_Date || new Date(),
      checklistResults: item.pmDetails?.checklistResults || []
    }));
    
    setDeletingSummary(summary);
    setShowDeleteSummary(true);
  };

  const handleShowPasswordVerification = () => {
    setShowDeleteSummary(false);
    setShowPasswordVerification(true);
    setDeletePassword('');
    setPasswordError('');
  };

  const handleVerifyPasswordAndDelete = async () => {
    if (!deletePassword) {
      setPasswordError('Please enter your password');
      return;
    }

    try {
      // Extract PM IDs from the selected items
      const pmIds = selectedPMsForDelete.map(item => item.pmId);
      
      // Get auth token
      const token = localStorage.getItem('authToken');
      
      // Call backend to delete PM records with password verification
      const response = await fetch(`${API_URL}/pm/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({
          pmIds: pmIds,
          password: deletePassword
        })
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setPasswordError('Incorrect password');
        } else {
          setPasswordError(result.message || 'Failed to delete PM records');
        }
        return;
      }

      // Success - close modals and refresh data
      setShowPasswordVerification(false);
      setDeletePassword('');
      setPasswordError('');
      
      // Show success toast notification
      setDeletedRecordsCount(result.deletedCount);
      setShowDeleteSuccessToast(true);
      setTimeout(() => {
        setShowDeleteSuccessToast(false);
      }, 5000);
      
      // Exit delete mode and refresh
      setDeleteMode(false);
      setSelectedPMsForDelete([]);
      sessionStorage.removeItem('pmDeleteMode');
      window.dispatchEvent(new Event('pmDeleteModeChange'));
      
      // Refresh PM records and statistics (to update Total PM Records count)
      await fetchStatistics();
      if (selectedCustomer && selectedBranch) {
        await fetchPMRecords(selectedCustomer, selectedBranch);
      }
    } catch (error) {
      console.error('Error deleting PM records:', error);
      setPasswordError('Network error occurred. Please try again.');
    }
  };

  const handleConfirmSubmit = async () => {
    setSubmitting(true);
    setShowConfirmDialog(false);

    try {
      // Prepare checklist results array
      const resultsArray = Object.keys(checklistResults).map(checklistId => ({
        Checklist_ID: parseInt(checklistId),
        Is_OK_bool: checklistResults[checklistId] ? 1 : 0,
        Remarks: checklistItemRemarks[checklistId] || null
      }));

      // Get auth token
      const token = localStorage.getItem('authToken');
      
      // Submit PM record
      const response = await fetch(`${API_URL}/pm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          assetId: selectedAsset.Asset_ID,
          pmDate: new Date().toISOString().split('T')[0],
          remarks: pmRemarks || null,
          checklistResults: resultsArray,
          status: 'In-Process'
        })
      });

      if (!response.ok) throw new Error('Failed to submit PM record');

      const result = await response.json();
      const newPmId = result.pmId; // Get the new PM ID from response
      
      // Close all popups first
      setShowPMForm(false);
      setSelectedAsset(null);
      setChecklistItems([]);
      setChecklistResults({});
      setChecklistItemRemarks({});
      setPmRemarks('');
      
      // Navigate to PMDetail page for the new PM record with state
      saveStateBeforeNavigation();
      navigate(`/maintenance/detail/${newPmId}`, { 
        state: { 
          fromPMSubmission: true,
          from: location.pathname + location.search 
        } 
      });
      
    } catch (err) {
      console.error('Error submitting PM record:', err);
      toast.error('Failed to submit PM record. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '0' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '30px',
        paddingBottom: '15px',
        borderBottom: '3px solid #27ae60',
        padding: '0 20px 15px 20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Hammer size={28} color="#27ae60" />
          <div>
            <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.4rem' }}>
              Preventive Maintenance
            </h2>
            <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
              Monitor and manage preventive maintenance schedules with detailed checklists
            </p>
          </div>
        </div>
        <div className="actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleOpenChecklistManager}
            className="btn btn-primary"
            style={{
              ...headerButtonStyle,
              ...((deleteMode || isCustomerRole()) && {
                opacity: 0.6,
                pointerEvents: 'none',
                cursor: 'not-allowed',
                backgroundColor: '#e0e0e0',
                color: '#999'
              })
            }}
            onMouseEnter={(e) => !isCustomerRole() && !deleteMode && handleHeaderButtonHover(e, true)}
            onMouseLeave={(e) => !isCustomerRole() && !deleteMode && handleHeaderButtonHover(e, false)}
            disabled={deleteMode || isCustomerRole()}
            title={isCustomerRole() ? 'Customer accounts cannot edit checklist items' : (deleteMode ? 'Cannot edit checklist while in delete mode' : 'Edit checklist items for PM categories')}
          >
            <Edit size={18} />
            Edit Checklist Items
          </button>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>

      {/* Statistics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '15px', marginBottom: '15px' }}>
          <div
            className="card"
            style={{
              padding: '20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onClick={() => openOverviewPage('total')}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            title="Open all PM records page"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Package size={32} style={{ opacity: 0.9 }} />
                <div style={{ fontSize: '1rem', opacity: 0.9, fontWeight: '500' }}>Total PM Records</div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700' }}>
                {selectedCustomer && selectedBranch ? syncedTableStats.total : (statistics?.total ?? 0)}
              </div>
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: '20px',
              background: isCustomerRole() ? 'linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)' : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white',
              border: 'none',
              cursor: isCustomerRole() ? 'not-allowed' : 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              opacity: isCustomerRole() ? 0.6 : 1
            }}
            onClick={() => !isCustomerRole() && navigate('/pm-schedule')}
            onMouseOver={(e) => {
              if (!isCustomerRole()) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
              }
            }}
            onMouseOut={(e) => {
              if (!isCustomerRole()) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
            title={isCustomerRole() ? 'Customer accounts cannot access PM Calendar' : 'Open PM Calendar'}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Calendar size={32} style={{ opacity: 0.9 }} />
                <div style={{ fontSize: '1rem', opacity: 0.9, fontWeight: '500' }}>PM Calendar</div>
              </div>
              <ChevronRight size={26} style={{ opacity: 0.9 }} />
            </div>
          </div>

          <div
            className="card"
            style={{ padding: '20px', background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white', border: 'none', cursor: 'pointer' }}
            onClick={() => openOverviewPage('month')}
            title="Open PM this month page"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Clock size={32} style={{ opacity: 0.9 }} />
                <div style={{ fontSize: '1rem', opacity: 0.9, fontWeight: '500' }}>PM This Month</div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700' }}>
                {selectedCustomer && selectedBranch ? syncedTableStats.thisMonth : (statistics?.thisMonth ?? 0)}
              </div>
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: '20px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onClick={() => openOverviewPage('unsigned')}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            title="Open unsigned PM1 and PM2 page"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <AlertCircle size={32} style={{ opacity: 0.9 }} />
                <div style={{ fontSize: '1rem', opacity: 0.9, fontWeight: '500' }}>Unsigned PM1 & PM2</div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700' }}>{summaryCards.unsignedPM1AndPM2}</div>
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: '20px',
              background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onClick={() => openOverviewPage('one-pm')}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            title="Open assets with one PM page"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FileText size={32} style={{ opacity: 0.9 }} />
                <div style={{ fontSize: '1rem', opacity: 0.9, fontWeight: '500' }}>Only One PM</div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700' }}>{summaryCards.onlyOnePM}</div>
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: '20px',
              background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onClick={() => openOverviewPage('no-pm')}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            title="Open assets with no PM page"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Package size={32} style={{ opacity: 0.9 }} />
                <div style={{ fontSize: '1rem', opacity: 0.9, fontWeight: '500' }}>No PM Done</div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700' }}>{summaryCards.noPMYet}</div>
            </div>
          </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', paddingBottom: '12px', borderBottom: '2px solid #3498db' }}>
          <Filter size={22} color="#3498db" />
          <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.1rem' }}>Filter PM Records</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: '600', color: '#2c3e50', fontSize: '0.95rem' }}>
              <Building2 size={18} color="#3498db" />
              Step 1: Select Customer
            </label>
            <SearchableDropdown
              value={selectedCustomer}
              onChangeEvent={handleCustomerChange}
              options={customers}
              getOptionValue={(c) => c.Customer_ID}
              renderOption={(c) => {
                const pmCount = customerPMCounts[c.Customer_ID] || 0;
                return `${c.Customer_Name} (${c.Customer_Ref_Number}) - ${pmCount} PM record${pmCount !== 1 ? 's' : ''}`;
              }}
              disabled={false}
              placeholder="-- Select Customer --"
              searchPlaceholder="Search customer name or ref number..."
            />
            {!selectedCustomer && (
              <p style={{ fontSize: '0.85rem', color: '#7f8c8d', marginTop: '5px', fontStyle: 'italic' }}>
                Please select a customer first
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: '600', color: '#2c3e50', fontSize: '0.95rem' }}>
              <MapPin size={18} color="#e74c3c" />
              Step 2: Select Branch
            </label>
            <SearchableDropdown
              value={selectedBranch}
              onChangeEvent={handleBranchChange}
              options={branches}
              getOptionValue={(b) => b}
              renderOption={(b) => {
                const pmCount = branchPMCounts[b] || 0;
                return `${b} - ${pmCount} PM record${pmCount !== 1 ? 's' : ''}`;
              }}
              disabled={!selectedCustomer}
              placeholder="-- Select Branch --"
              searchPlaceholder="Search branch..."
            />
            {selectedCustomer && !selectedBranch && (
              <p style={{ fontSize: '0.85rem', color: '#7f8c8d', marginTop: '5px', fontStyle: 'italic' }}>
                Select a branch to view PM records
              </p>
            )}
          </div>
        </div>

        {selectedCustomer && selectedBranch && (
          <div style={{ marginTop: '20px', padding: '12px 16px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle size={20} color="#1565c0" />
            <span style={{ color: '#1565c0', fontWeight: '600' }}>
              Showing PM records for: {customers.find(c => c.Customer_ID == selectedCustomer)?.Customer_Name} - {selectedBranch}
            </span>
          </div>
        )}
      </div>

      {/* Search Bar and Download Button */}
      {selectedCustomer && selectedBranch && pmRecords.length > 0 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search 
                size={20} 
                style={{ 
                  position: 'absolute', 
                  left: '16px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: '#7f8c8d'
                }} 
              />
              <input
                type="text"
                placeholder="Search by Asset Tag ID, Serial Number, Item Name, Recipient, or Department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 16px 14px 48px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3498db';
                  e.target.style.boxShadow = '0 0 0 3px rgba(52, 152, 219, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#ddd';
                  e.target.style.boxShadow = 'none';
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: '#e0e0e0',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#bdbdbd'}
                  onMouseOut={(e) => e.target.style.background = '#e0e0e0'}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            
            {/* Download Form Button */}
            <button
              onClick={() => setShowBulkDownloadModal(true)}
              disabled={deleteMode}
              style={{
                padding: '14px 24px',
                background: '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: deleteMode ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                opacity: deleteMode ? 0.5 : 1,
                pointerEvents: deleteMode ? 'none' : 'auto'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#229954';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#27ae60';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
              }}
            >
              <Download size={18} />
              Download Form
            </button>

            {/* Delete PM Records Button */}
            {!deleteMode ? (
              <button
                onClick={handleOpenDeleteMode}
                style={{
                  padding: '14px 24px',
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  position: 'relative',
                  zIndex: 600
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#c0392b';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#e74c3c';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }}
              >
                <Trash2 size={18} />
                Delete
              </button>
            ) : (
              <button
                onClick={handleCancelDeleteMode}
                style={{
                  padding: '14px 24px',
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  position: 'relative',
                  zIndex: 600
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#c0392b';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#e74c3c';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }}
              >
                <X size={18} />
                Cancel
              </button>
            )}
          </div>
          
          {searchQuery && (
            <p style={{ 
              margin: '12px 0 0 0', 
              color: '#666', 
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Search size={16} />
              Searching for: <strong>"{searchQuery}"</strong>
            </p>
          )}
        </div>
      )}

      {/* PM Records by Category with Checklist */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <p style={{ color: '#666', fontSize: '1.1rem' }}>Loading PM records...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <AlertTriangle size={48} color="#e74c3c" style={{ marginBottom: '15px' }} />
          <p style={{ color: '#e74c3c', fontSize: '1.1rem' }}>Error: {error}</p>
        </div>
      ) : !selectedCustomer || !selectedBranch ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px', background: '#f8f9fa' }}>
          <Filter size={48} color="#95a5a6" style={{ marginBottom: '15px' }} />
          <h3 style={{ color: '#7f8c8d', marginBottom: '10px' }}>No Filters Selected</h3>
          <p style={{ color: '#95a5a6', fontSize: '0.95rem' }}>
            Please select both customer and branch to view PM records
          </p>
        </div>
      ) : pmRecords.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <FileText size={48} color="#95a5a6" style={{ marginBottom: '15px' }} />
          <h3 style={{ color: '#7f8c8d', marginBottom: '10px' }}>No PM Records Found</h3>
          <p style={{ color: '#95a5a6', fontSize: '0.95rem' }}>
            No preventive maintenance records found for the selected filters
          </p>
        </div>
      ) : (
        // Combined table with horizontal category filter
        (() => {
          // Merge all categories into single flat list
          const allRecords = [];
          const allChecklistItems = new Map();
          
          Object.keys(groupedByCategory).forEach((category) => {
            const { assets = {}, checklistItems = [] } = groupedByCategory[category] || {};
            const assetsList = Object.values(assets);
            
            assetsList.forEach(asset => {
              allRecords.push({
                ...asset,
                categoryName: category
              });
            });
            
            checklistItems.forEach(item => {
              if (!allChecklistItems.has(item.Checklist_ID)) {
                allChecklistItems.set(item.Checklist_ID, item);
              }
            });
          });
          
          // Filter by selected category
          let filteredRecords = selectedCategoryFilter === 'all'
            ? allRecords
            : allRecords.filter(r => r.categoryName === selectedCategoryFilter);
          
          // Filter to show only assets with PM records if checkbox is enabled
          if (showOnlyWithPM) {
            filteredRecords = filteredRecords.filter(r => r.pmCount > 0);
          }

          // Apply column filters
          const columnFilteredRecords = filteredRecords.filter(record => {
            for (const columnKey in columnFilters) {
              if (!columnFilters[columnKey]) continue;
              
              const filterValue = columnFilters[columnKey];
              
              // Map column keys to record properties
              if (columnKey === 'category') {
                const recordValue = (record.categoryName || '').toString().toLowerCase();
                if (!recordValue.includes(filterValue.toLowerCase())) {
                  return false;
                }
              } else if (columnKey === 'tagId') {
                const recordValue = (record.Asset_Tag_ID || '').toString().toLowerCase();
                if (!recordValue.includes(filterValue.toLowerCase())) {
                  return false;
                }
              } else if (columnKey === 'itemName') {
                const recordValue = (record.Item_Name || '').toString().toLowerCase();
                if (!recordValue.includes(filterValue.toLowerCase())) {
                  return false;
                }
              } else if (columnKey === 'serialNumber') {
                const recordValue = (record.Asset_Serial_Number || '').toString().toLowerCase();
                if (!recordValue.includes(filterValue.toLowerCase())) {
                  return false;
                }
              } else if (columnKey === 'latestPMDate') {
                // For date filtering, compare dates using UTC to avoid timezone issues
                if (record.latestPMDate) {
                  const date = new Date(record.latestPMDate);
                  // Extract date in UTC format (YYYY-MM-DD)
                  const year = date.getUTCFullYear();
                  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                  const day = String(date.getUTCDate()).padStart(2, '0');
                  const recordDate = `${year}-${month}-${day}`;
                  const filterDate = filterValue; // Already in YYYY-MM-DD format from date input
                  if (recordDate !== filterDate) {
                    return false;
                  }
                } else {
                  // If no date exists, don't match
                  return false;
                }
              }
            }
            return true;
          });
          
          const uniqueChecklistItems = Array.from(allChecklistItems.values())
            .sort((a, b) => a.Checklist_ID - b.Checklist_ID);
          
          const uniqueCategories = [...new Set(allRecords.map(r => r.categoryName))].sort();
          const categoryColors = getCategoryColors(uniqueCategories);

          // Pagination logic
          const totalPages = Math.ceil(columnFilteredRecords.length / itemsPerPage);
          const startIndex = (currentPage - 1) * itemsPerPage;
          const endIndex = startIndex + itemsPerPage;
          const paginatedRecords = columnFilteredRecords.slice(startIndex, endIndex);
          
          return (
            <div key="combined-table-container" style={{ marginBottom: '30px' }}>
              {/* Header - Full Width */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px',
                paddingBottom: '15px',
                borderBottom: '3px solid #27ae60'
              }}>
                <Wrench size={28} color="#27ae60" />
                <div>
                  <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.4rem' }}>
                    Preventive Maintenance Records
                  </h2>
                  <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
                    {columnFilteredRecords.length} record{columnFilteredRecords.length !== 1 ? 's' : ''} shown
                  </p>
                </div>
              </div>

              {/* Horizontal Category Filter */}
              <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'space-between', position: 'relative', zIndex: 600, pointerEvents: deleteMode ? 'auto' : 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: '600', color: '#2c3e50', fontSize: '0.95rem', marginRight: '10px' }}>
                    Category:
                  </span>
                  
                  {/* "All" Button */}
                  <button
                  onClick={() => setSelectedCategoryFilter('all')}
                  style={{
                    padding: '8px 16px',
                    border: selectedCategoryFilter === 'all' ? '2px solid #27ae60' : '2px solid #bdc3c7',
                    backgroundColor: selectedCategoryFilter === 'all' ? '#d5f4e6' : '#f8f9fa',
                    color: selectedCategoryFilter === 'all' ? '#27ae60' : '#2c3e50',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseOver={(e) => {
                    if (selectedCategoryFilter === 'all') {
                      e.target.style.opacity = '0.9';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (selectedCategoryFilter === 'all') {
                      e.target.style.opacity = '1';
                    }
                  }}
                  title="Show all categories"
                >
                  ✓ All ({allRecords.length})
                </button>

                {/* Category Buttons with Different Colors */}
                {uniqueCategories.map(cat => {
                  const count = allRecords.filter(r => r.categoryName === cat).length;
                  const isSelected = selectedCategoryFilter === cat;
                  const categoryColor = categoryColors[cat];
                  const lighterColor = categoryColor + '20'; // Add transparency
                  
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategoryFilter(cat)}
                      style={{
                        padding: '8px 16px',
                        border: isSelected ? `2px solid ${categoryColor}` : `2px solid #bdc3c7`,
                        backgroundColor: isSelected ? categoryColor : '#f8f9fa',
                        color: isSelected ? 'white' : '#2c3e50',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: isSelected ? `0 2px 6px ${categoryColor}40` : 'none'
                      }}
                      onMouseOver={(e) => {
                        if (isSelected) {
                          e.target.style.opacity = '0.9';
                          e.target.style.transform = 'translateY(-2px)';
                        } else {
                          e.target.style.borderColor = categoryColor;
                          e.target.style.backgroundColor = lighterColor;
                        }
                      }}
                      onMouseOut={(e) => {
                        if (isSelected) {
                          e.target.style.opacity = '1';
                          e.target.style.transform = 'translateY(0)';
                        } else {
                          e.target.style.borderColor = '#bdc3c7';
                          e.target.style.backgroundColor = '#f8f9fa';
                        }
                      }}
                      title={`Show only ${cat} (${count} items)`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
                </div>

                {/* Import Data Button */}
                <button
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (selectedCustomer) {
                      // Pass customer name instead of ID for PMImport compatibility
                      const customer = customers.find(c => c.Customer_ID == selectedCustomer);
                      if (customer) params.set('customer', customer.Customer_Name);
                    }
                    if (selectedBranch) params.set('branch', selectedBranch);
                    navigate(`/pm-import?${params.toString()}`);
                  }}
                  disabled={deleteMode}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: deleteMode ? 'not-allowed' : 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    opacity: deleteMode ? 0.5 : 1,
                    pointerEvents: deleteMode ? 'none' : 'auto'
                  }}
                  onMouseOver={(e) => {
                    if (!deleteMode) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!deleteMode) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    }
                  }}
                >
                  <FileUp size={18} />
                  Import Data
                </button>
              </div>

              {/* Flex container for table and delete box */}
              <div style={{
                display: 'flex',
                gap: '20px',
                flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                alignItems: 'stretch'
              }}>
                {/* Table Section */}
                <div style={{ 
                  flex: deleteMode ? '2' : '1',
                  minWidth: 0,
                  width: deleteMode && window.innerWidth > 768 ? '66.666%' : '100%'
                }}>

              {/* Combined Table */}
              <div style={{ overflowX: 'auto', position: 'relative', zIndex: 600, pointerEvents: deleteMode ? 'auto' : 'auto' }} className="card">
                <table className="table" style={{ minWidth: '900px', width: '100%', tableLayout: 'auto' }}>
                    <thead>
                      <tr>
                        {/* Numbering Column */}
                        <th style={{
                          background: 'linear-gradient(135deg, #2c3e50, #34495e)',
                          width: '60px',
                          minWidth: '60px',
                          maxWidth: '60px',
                          textAlign: 'center',
                          padding: '16px 8px',
                          color: 'white',
                          fontWeight: '600',
                          boxShadow: '2px 2px 4px rgba(0, 0, 0, 0.2)',
                          whiteSpace: 'nowrap'
                        }}>
                          #
                        </th>
                        {/* Category Column */}
                        <th style={{
                          background: 'linear-gradient(135deg, #2c3e50, #34495e)',
                          minWidth: '120px',
                          textAlign: 'center',
                          padding: '16px 12px',
                          color: 'white',
                          fontWeight: '600',
                          boxShadow: '2px 2px 4px rgba(0, 0, 0, 0.2)',
                          whiteSpace: 'nowrap'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', position: 'relative' }}>
                            <span>Category</span>
                            {columnFilters['category'] && (
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
                                  clearColumnFilter('category');
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
                                color: columnFilters['category'] ? '#3498db' : 'rgba(255,255,255,0.6)',
                                transition: 'color 0.2s'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFilterPopup('category');
                              }}
                              title="Filter by Category"
                            />
                            {activeFilterPopup === 'category' && (
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
                                  Filter Category
                                </div>
                                <input
                                  type="text"
                                  placeholder="Enter filter value..."
                                  value={columnFilters['category'] || ''}
                                  onChange={(e) => handleColumnFilterChange('category', e.target.value)}
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
                                    if (e.key === 'Enter' || e.key === 'Escape') {
                                      setActiveFilterPopup(null);
                                    }
                                  }}
                                />
                                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => {
                                      clearColumnFilter('category');
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
                          </div>
                        </th>
                        <th style={{
                          background: 'linear-gradient(135deg, #2c3e50, #34495e)',
                          minWidth: '130px',
                          textAlign: 'center',
                          padding: '16px 12px',
                          color: 'white',
                          fontWeight: '600',
                          boxShadow: '2px 2px 4px rgba(0, 0, 0, 0.2)',
                          whiteSpace: 'nowrap'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', position: 'relative' }}>
                            <span>Tag ID</span>
                            {columnFilters['tagId'] && (
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
                                  clearColumnFilter('tagId');
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
                                color: columnFilters['tagId'] ? '#3498db' : 'rgba(255,255,255,0.6)',
                                transition: 'color 0.2s'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFilterPopup('tagId');
                              }}
                              title="Filter by Tag ID"
                            />
                            {activeFilterPopup === 'tagId' && (
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
                                  Filter Tag ID
                                </div>
                                <input
                                  type="text"
                                  placeholder="Enter filter value..."
                                  value={columnFilters['tagId'] || ''}
                                  onChange={(e) => handleColumnFilterChange('tagId', e.target.value)}
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
                                    if (e.key === 'Enter' || e.key === 'Escape') {
                                      setActiveFilterPopup(null);
                                    }
                                  }}
                                />
                                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => {
                                      clearColumnFilter('tagId');
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
                          </div>
                        </th>
                        <th style={{ minWidth: '150px', textAlign: 'center', position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', position: 'relative' }}>
                            <span>Item Name</span>
                            {columnFilters['itemName'] && (
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
                                  clearColumnFilter('itemName');
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
                                color: columnFilters['itemName'] ? '#3498db' : '#95a5a6',
                                transition: 'color 0.2s'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFilterPopup('itemName');
                              }}
                              title="Filter by Item Name"
                            />
                            {activeFilterPopup === 'itemName' && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
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
                                  Filter Item Name
                                </div>
                                <input
                                  type="text"
                                  placeholder="Enter filter value..."
                                  value={columnFilters['itemName'] || ''}
                                  onChange={(e) => handleColumnFilterChange('itemName', e.target.value)}
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
                                    if (e.key === 'Enter' || e.key === 'Escape') {
                                      setActiveFilterPopup(null);
                                    }
                                  }}
                                />
                                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => {
                                      clearColumnFilter('itemName');
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
                          </div>
                        </th>
                        <th style={{ minWidth: '150px', textAlign: 'center', position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', position: 'relative' }}>
                            <span>Serial Number</span>
                            {columnFilters['serialNumber'] && (
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
                                  clearColumnFilter('serialNumber');
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
                                color: columnFilters['serialNumber'] ? '#3498db' : '#95a5a6',
                                transition: 'color 0.2s'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFilterPopup('serialNumber');
                              }}
                              title="Filter by Serial Number"
                            />
                            {activeFilterPopup === 'serialNumber' && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
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
                                  Filter Serial Number
                                </div>
                                <input
                                  type="text"
                                  placeholder="Enter filter value..."
                                  value={columnFilters['serialNumber'] || ''}
                                  onChange={(e) => handleColumnFilterChange('serialNumber', e.target.value)}
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
                                    if (e.key === 'Enter' || e.key === 'Escape') {
                                      setActiveFilterPopup(null);
                                    }
                                  }}
                                />
                                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => {
                                      clearColumnFilter('serialNumber');
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
                          </div>
                        </th>
                        <th style={{ minWidth: '140px', textAlign: 'center', position: 'relative', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', position: 'relative' }}>
                            <span>Latest PM Date</span>
                            {columnFilters['latestPMDate'] && (
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
                                  clearColumnFilter('latestPMDate');
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
                                color: columnFilters['latestPMDate'] ? '#3498db' : '#95a5a6',
                                transition: 'color 0.2s'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFilterPopup('latestPMDate');
                              }}
                              title="Filter by Latest PM Date"
                            />
                            {activeFilterPopup === 'latestPMDate' && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
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
                                  Filter Latest PM Date
                                </div>
                                <input
                                  type="date"
                                  value={columnFilters['latestPMDate'] || ''}
                                  onChange={(e) => handleColumnFilterChange('latestPMDate', e.target.value)}
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
                                    if (e.key === 'Enter' || e.key === 'Escape') {
                                      setActiveFilterPopup(null);
                                    }
                                  }}
                                />
                                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => {
                                      clearColumnFilter('latestPMDate');
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
                          </div>
                        </th>
                        <th style={{ minWidth: '90px', textAlign: 'center', whiteSpace: 'nowrap' }}>PM Count</th>
                        <th style={{ minWidth: '200px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <span>PM Records</span>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                color: showOnlyWithPM ? '#27ae60' : '#7f8c8d',
                                background: showOnlyWithPM ? '#d5f4e6' : '#ecf0f1',
                                padding: '2px 6px',
                                borderRadius: '10px'
                              }}
                            >
                              Only with PM
                            </span>
                            <label 
                              style={{ 
                                position: 'relative', 
                                display: 'inline-block', 
                                width: '40px', 
                                height: '20px',
                                cursor: 'pointer'
                              }}
                              title={showOnlyWithPM ? "Showing only assets with PM records" : "Showing all assets"}
                            >
                              <input
                                type="checkbox"
                                checked={showOnlyWithPM}
                                onChange={(e) => setShowOnlyWithPM(e.target.checked)}
                                style={{ opacity: 0, width: 0, height: 0 }}
                              />
                              <span style={{
                                position: 'absolute',
                                cursor: 'pointer',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: showOnlyWithPM ? '#27ae60' : '#bdc3c7',
                                transition: '0.3s',
                                borderRadius: '20px'
                              }}>
                                <span style={{
                                  position: 'absolute',
                                  content: '""',
                                  height: '14px',
                                  width: '14px',
                                  left: showOnlyWithPM ? '23px' : '3px',
                                  bottom: '3px',
                                  backgroundColor: 'white',
                                  transition: '0.3s',
                                  borderRadius: '50%'
                                }}></span>
                              </span>
                            </label>
                          </div>
                        </th>
                        <th style={{ minWidth: '140px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRecords.length === 0 ? (
                        <tr>
                          <td colSpan="9" style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <div style={{ color: '#7f8c8d', fontSize: '1rem' }}>
                              <AlertTriangle size={48} color="#95a5a6" style={{ marginBottom: '15px' }} />
                              <p style={{ margin: 0 }}>No records found for the selected filters</p>
                              <p style={{ margin: '10px 0 0 0', fontSize: '0.9rem', color: '#95a5a6' }}>
                                Try adjusting your filters or search criteria
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedRecords.map((asset, index) => {
                        const sortedPMRecords = (asset.allPMRecords || [])
                          .slice()
                          .sort((a, b) => new Date(a.PM_Date) - new Date(b.PM_Date));
                        const assetPMIds = sortedPMRecords.map(pm => pm.PM_ID);
                        const selectedCountForAsset = assetPMIds.filter(
                          pmId => selectedPMsForDelete.some(item => item.pmId === pmId)
                        ).length;
                        const isAssetFullySelected = assetPMIds.length > 0 && selectedCountForAsset === assetPMIds.length;
                        const isAssetPartiallySelected = selectedCountForAsset > 0 && !isAssetFullySelected;

                        const resultsMap = {};
                        if (asset.checklist_results && Array.isArray(asset.checklist_results)) {
                          asset.checklist_results.forEach(result => {
                            if (result && result.Checklist_ID !== undefined) {
                              resultsMap[result.Checklist_ID] = result.Is_OK_bool;
                            }
                          });
                        }

                        return (
                          <tr key={`${asset.categoryName}-${asset.Asset_ID}-${index}`}
                            style={{
                              backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.parentElement.style.backgroundColor = '#f0f8ff'}
                            onMouseLeave={(e) => e.target.parentElement.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f9f9f9'}
                          >
                            {/* Numbering Column */}
                            <td style={{
                              textAlign: 'center',
                              fontWeight: '600',
                              fontSize: '0.9rem',
                              color: '#7f8c8d',
                              borderRight: '1px solid #e0e0e0',
                              whiteSpace: 'nowrap'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                {deleteMode && (
                                  <input
                                    type="checkbox"
                                    checked={isAssetFullySelected}
                                    ref={(el) => {
                                      if (el) {
                                        el.indeterminate = isAssetPartiallySelected;
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={() => handleToggleAssetForDelete(asset, sortedPMRecords)}
                                    disabled={assetPMIds.length === 0}
                                    title={assetPMIds.length === 0 ? 'No PM records to select' : 'Select all PM records for this asset'}
                                    style={{
                                      cursor: assetPMIds.length === 0 ? 'not-allowed' : 'pointer',
                                      width: '14px',
                                      height: '14px'
                                    }}
                                  />
                                )}
                                <span>{startIndex + index + 1}</span>
                              </div>
                            </td>
                            {/* Category Name */}
                            <td style={{
                              textAlign: 'center',
                              fontWeight: '600',
                              whiteSpace: 'nowrap'
                            }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                backgroundColor: categoryColors[asset.categoryName] + '30',
                                color: categoryColors[asset.categoryName],
                                fontSize: '0.85rem',
                                fontWeight: '700',
                                border: `1px solid ${categoryColors[asset.categoryName]}80`
                              }}>
                                {asset.categoryName}
                              </span>
                            </td>

                            {/* Tag ID */}
                            <td style={{
                              fontFamily: 'monospace',
                              fontSize: '0.9rem',
                              fontWeight: '600',
                              textAlign: 'center',
                              whiteSpace: 'nowrap'
                            }}>
                              {asset.Asset_Tag_ID || 'N/A'}
                            </td>

                            {/* Item Name */}
                            <td style={{ fontWeight: '500', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {asset.Item_Name || 'N/A'}
                            </td>

                            {/* Serial Number */}
                            <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#666', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {asset.Asset_Serial_Number || 'N/A'}
                            </td>

                            {/* Latest PM Date */}
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                                <Calendar size={14} color="#666" />
                                {asset.latestPMDate ? formatDate(asset.latestPMDate) : (
                                  <span style={{ color: '#999', fontStyle: 'italic' }}>No PM Yet</span>
                                )}
                              </div>
                            </td>

                            {/* PM Count */}
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <span style={{
                                padding: '6px 12px',
                                borderRadius: '12px',
                                fontSize: '0.9rem',
                                fontWeight: '700',
                                background: asset.pmCount > 0 ? '#e3f2fd' : '#f5f5f5',
                                color: asset.pmCount > 0 ? '#1565c0' : '#999',
                                border: asset.pmCount > 0 ? '1px solid #90caf9' : '1px solid #ddd',
                                minWidth: '35px',
                                display: 'inline-block'
                              }}>
                                {asset.pmCount}
                              </span>
                            </td>

                            {/* PM Records */}
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                {deleteMode && sortedPMRecords.length > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleAssetForDelete(asset, sortedPMRecords);
                                    }}
                                    style={{
                                      padding: '6px 10px',
                                      background: isAssetFullySelected ? '#34495e' : '#2c3e50',
                                      color: 'white',
                                      border: isAssetFullySelected ? '2px solid #1abc9c' : 'none',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '0.8rem',
                                      fontWeight: '700',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      transition: 'all 0.2s',
                                      minWidth: '110px',
                                      boxShadow: isAssetFullySelected ? '0 0 0 2px rgba(26, 188, 156, 0.25)' : '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                    onMouseOver={(e) => {
                                      e.currentTarget.style.background = '#1f2d3a';
                                      e.currentTarget.style.transform = 'translateY(-1px)';
                                    }}
                                    onMouseOut={(e) => {
                                      e.currentTarget.style.background = isAssetFullySelected ? '#34495e' : '#2c3e50';
                                      e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                    title={isAssetFullySelected ? 'Deselect all PM records for this asset' : 'Select all PM records for this asset'}
                                  >
                                    {isAssetFullySelected ? <CheckSquare size={14} /> : <Square size={14} />}
                                    {isAssetFullySelected ? 'Asset Selected' : `Select Asset (${sortedPMRecords.length})`}
                                  </button>
                                )}
                                {sortedPMRecords.length > 0 ? (
                                  sortedPMRecords.map((pm, pmIndex) => {
                                      const isInProcess = pm.PM_Status === 'In-Process';
                                      const isMarkedCompleted = pm.PM_Status === 'Marked as Completed';
                                      const bgColor = isInProcess ? '#f59e0b' : isMarkedCompleted ? '#14b8a6' : '#27ae60';
                                      const hoverBgColor = isInProcess ? '#d97706' : isMarkedCompleted ? '#0d9488' : '#229954';
                                      const isSelected = selectedPMsForDelete.some(item => item.pmId === pm.PM_ID);
                                      
                                      return (
                                    <button
                                      key={pm.PM_ID}
                                      onClick={() => {
                                        if (deleteMode) {
                                          handleTogglePMForDelete(pm.PM_ID, pm, asset);
                                        } else {
                                          saveStateBeforeNavigation();
                                          navigate(`/maintenance/detail/${pm.PM_ID}`, { state: { from: location.pathname + location.search } });
                                        }
                                      }}
                                      style={{
                                        padding: '6px 12px',
                                        background: deleteMode && isSelected ? '#95a5a6' : bgColor,
                                        color: 'white',
                                        border: deleteMode && isSelected ? '2px solid #7f8c8d' : 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: '600',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        transition: 'all 0.2s',
                                        minWidth: '70px',
                                        boxShadow: deleteMode && isSelected ? '0 0 0 2px rgba(149, 165, 166, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
                                        transform: deleteMode && isSelected ? 'scale(1.05)' : 'scale(1)',
                                        opacity: deleteMode && isSelected ? 0.8 : 1
                                      }}
                                      onMouseOver={(e) => {
                                        if (deleteMode) {
                                          e.currentTarget.style.transform = isSelected ? 'scale(1.08)' : 'scale(1.05)';
                                          e.currentTarget.style.boxShadow = isSelected ? '0 0 0 3px rgba(231, 76, 60, 0.4)' : '0 4px 6px rgba(0,0,0,0.15)';
                                        } else {
                                          e.currentTarget.style.background = hoverBgColor;
                                          e.currentTarget.style.transform = 'translateY(-1px)';
                                          e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.15)';
                                        }
                                      }}
                                      onMouseOut={(e) => {
                                        if (deleteMode) {
                                          e.currentTarget.style.transform = isSelected ? 'scale(1.05)' : 'scale(1)';
                                          e.currentTarget.style.boxShadow = isSelected ? '0 0 0 2px rgba(231, 76, 60, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)';
                                        } else {
                                          e.currentTarget.style.background = bgColor;
                                          e.currentTarget.style.transform = 'translateY(0)';
                                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                                        }
                                      }}
                                      title={deleteMode ? (isSelected ? 'Click to deselect' : 'Click to select for deletion') : `View PM ${pmIndex + 1} details - ${new Date(pm.PM_Date).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' })}`}
                                    >
                                      <FileText size={14} />
                                      PM{pmIndex + 1}
                                    </button>
                                      );
                                    })
                                ) : (
                                  <span style={{ color: '#999', fontStyle: 'italic', fontSize: '0.9rem' }}>
                                    No records
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Actions */}
                            <td style={{ textAlign: 'center' }}>
                              <button
                                onClick={() => !deleteMode && handleOpenPMForm(asset)}
                                disabled={deleteMode}
                                style={{
                                  padding: '8px 16px',
                                  background: deleteMode ? '#95a5a6' : '#3498db',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: deleteMode ? 'not-allowed' : 'pointer',
                                  fontSize: '0.9rem',
                                  fontWeight: '600',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  transition: 'background 0.2s',
                                  opacity: deleteMode ? 0.6 : 1
                                }}
                                onMouseOver={(e) => !deleteMode && (e.target.style.background = '#2980b9')}
                                onMouseOut={(e) => !deleteMode && (e.target.style.background = '#3498db')}
                              >
                                <ClipboardCheck size={16} />
                                PM
                              </button>
                            </td>
                          </tr>
                        );
                      }))}
                    </tbody>
                  </table>
                </div>

              {/* Pagination */}
              {columnFilteredRecords.length > 0 && (
                <div style={{ marginTop: '20px', position: 'relative', zIndex: 600, pointerEvents: deleteMode ? 'auto' : 'auto' }}>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    itemsPerPage={itemsPerPage}
                    onItemsPerPageChange={setItemsPerPage}
                    totalItems={columnFilteredRecords.length}
                    itemsPerPageOptions={[10, 25, 50, 100]}
                  />
                </div>
              )}
                </div>
                {/* End Table Section */}

                {/* Delete PM Record Box - Only show in delete mode */}
                {deleteMode && (
                  <div 
                    style={{
                      flex: '1',
                      minWidth: window.innerWidth <= 768 ? '100%' : '300px',
                      maxHeight: 'calc(100vh - 100px)',
                      minHeight: 0,
                      width: window.innerWidth > 768 ? '33.333%' : '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      zIndex: 600,
                      overflow: 'hidden',
                      alignSelf: 'flex-start'
                    }}>
                    <div 
                      className="card" 
                      style={{
                        background: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        maxHeight: '100%',
                        overflow: 'hidden'
                      }}>
                      {/* Header */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '20px 20px 15px 20px',
                        borderBottom: '2px solid #e74c3c',
                        flexShrink: 0
                      }}>
                        <Trash2 size={24} color="#e74c3c" />
                        <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.1rem', fontWeight: '600' }}>
                          Delete PM Record
                        </h3>
                      </div>

                      {/* Selected PM Records Count */}
                      <div style={{
                        background: '#ecf0f1',
                        padding: '10px 12px',
                        margin: '15px 20px',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        color: '#2c3e50',
                        fontWeight: '600',
                        flexShrink: 0
                      }}>
                        {selectedPMsForDelete.length} record{selectedPMsForDelete.length !== 1 ? 's' : ''} selected
                      </div>

                      {/* Scrollable PM Records List */}
                      <div 
                        style={{
                          flex: 1,
                          overflowY: 'auto',
                          overflowX: 'hidden',
                          padding: '0 20px',
                          minHeight: 0,
                          maxHeight: '100%',
                          scrollbarWidth: 'thin',
                          scrollbarColor: '#bdc3c7 #f8f9fa'
                        }}
                        className="delete-pm-scroll"
                      >
                        {selectedPMsForDelete.length === 0 ? (
                          <div style={{
                            textAlign: 'center',
                            padding: '40px 20px',
                            color: '#95a5a6',
                            fontSize: '0.9rem'
                          }}>
                            <Trash2 size={48} color="#bdc3c7" style={{ marginBottom: '10px' }} />
                            <p style={{ margin: 0 }}>No PM records selected</p>
                            <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem' }}>Click on PM buttons to select</p>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '15px' }}>
                            {selectedPMsForDelete.map((selectedItem) => {
                              const pmId = selectedItem.pmId;
                              const pmDetails = selectedItem.pmDetails;
                              const assetDetails = selectedItem.assetDetails;
                              
                              if (!pmDetails || !assetDetails) return null;

                              return (
                                <div
                                  key={pmId}
                                  style={{
                                    background: '#f8f9fa',
                                    border: '1px solid #dee2e6',
                                    borderRadius: '6px',
                                    padding: '12px',
                                    position: 'relative'
                                  }}
                                >
                                  {/* Remove button */}
                                  <button
                                    onClick={() => handleTogglePMForDelete(pmId)}
                                    style={{
                                      position: 'absolute',
                                      top: '8px',
                                      right: '8px',
                                      background: '#e74c3c',
                                      border: 'none',
                                      borderRadius: '50%',
                                      width: '24px',
                                      height: '24px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.background = '#c0392b'}
                                    onMouseOut={(e) => e.currentTarget.style.background = '#e74c3c'}
                                    title="Remove from selection"
                                  >
                                    <X size={14} color="white" />
                                  </button>

                                  {/* PM Details */}
                                  <div style={{ paddingRight: '30px' }}>
                                    <div style={{
                                      fontSize: '0.75rem',
                                      color: '#7f8c8d',
                                      marginBottom: '8px',
                                      fontWeight: '600',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px'
                                    }}>
                                      <span style={{
                                        background: categoryColors[pmDetails.categoryName] + '30',
                                        color: categoryColors[pmDetails.categoryName],
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.7rem',
                                        fontWeight: '700',
                                        border: `1px solid ${categoryColors[pmDetails.categoryName]}80`
                                      }}>
                                        {assetDetails.categoryName}
                                      </span>
                                      <span style={{
                                        background: '#e8f4f8',
                                        color: '#3498db',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.7rem',
                                        fontWeight: '700',
                                        border: '1px solid #3498db80',
                                        fontFamily: 'monospace'
                                      }}>
                                        PM #{pmId}
                                      </span>
                                    </div>
                                    
                                    <div style={{ fontSize: '0.85rem', color: '#2c3e50', lineHeight: '1.6' }}>
                                      <div style={{ marginBottom: '4px' }}>
                                        <strong style={{ color: '#7f8c8d', fontSize: '0.75rem' }}>Tag ID:</strong>{' '}
                                        <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{assetDetails.Asset_Tag_ID}</span>
                                      </div>
                                      <div style={{ marginBottom: '4px' }}>
                                        <strong style={{ color: '#7f8c8d', fontSize: '0.75rem' }}>Serial:</strong>{' '}
                                        <span style={{ fontFamily: 'monospace' }}>{assetDetails.Asset_Serial_Number || 'N/A'}</span>
                                      </div>
                                      <div>
                                        <strong style={{ color: '#7f8c8d', fontSize: '0.75rem' }}>PM Date:</strong>{' '}
                                        <span>{new Date(pmDetails.PM_Date).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Confirm Delete Button - Sticky at Bottom */}
                      <div style={{
                        padding: '15px 20px',
                        borderTop: '1px solid #e0e0e0',
                        background: 'white',
                        borderRadius: '0 0 8px 8px',
                        flexShrink: 0
                      }}>
                        <button
                          onClick={handlePrepareDeleteSummary}
                          disabled={selectedPMsForDelete.length === 0}
                          style={{
                            width: '100%',
                            padding: '12px 20px',
                            background: selectedPMsForDelete.length === 0 ? '#95a5a6' : 'linear-gradient(135deg, #e74c3c, #c0392b)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: selectedPMsForDelete.length === 0 ? 'not-allowed' : 'pointer',
                            fontSize: '1rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s',
                            boxShadow: selectedPMsForDelete.length === 0 ? 'none' : '0 2px 8px rgba(231, 76, 60, 0.3)',
                            opacity: selectedPMsForDelete.length === 0 ? 0.6 : 1
                          }}
                          onMouseOver={(e) => {
                            if (selectedPMsForDelete.length > 0) {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(231, 76, 60, 0.4)';
                            }
                          }}
                          onMouseOut={(e) => {
                            if (selectedPMsForDelete.length > 0) {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(231, 76, 60, 0.3)';
                            }
                          }}
                        >
                          <Trash2 size={18} />
                          Confirm Delete ({selectedPMsForDelete.length})
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {/* End Delete PM Record Box */}
              </div>
              {/* End Flex Container */}
            </div>
          );
        })()
      )}
      {/* OLD MULTIPLE TABLES CODE - DISABLED */}
      {false && (
        Object.keys(groupedByCategory).map((category) => {
          const { assets = {}, checklistItems = [] } = groupedByCategory[category] || {};
          const assetsList = Object.values(assets);
          
          // Skip if no assets in this category
          if (assetsList.length === 0) return null;
          
          return (
            <div key={category} className="card" style={{ marginBottom: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingBottom: '15px', borderBottom: '3px solid #27ae60' }}>
                <Wrench size={28} color="#27ae60" />
                <div>
                  <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.4rem' }}>
                    {category} ({assetsList.length})
                  </h2>
                  <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
                    Preventive maintenance checklist results for {category.toLowerCase()} assets
                  </p>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ minWidth: '1200px' }}>
                  <thead>
                    <tr>
                      <th style={{ 
                        position: 'sticky', 
                        left: 0, 
                        top: 0,
                        background: 'linear-gradient(135deg, #2c3e50, #34495e)', 
                        zIndex: 20, 
                        minWidth: '140px', 
                        textAlign: 'center', 
                        padding: '16px 12px',
                        color: 'white',
                        fontWeight: '600',
                        boxShadow: '2px 2px 4px rgba(0, 0, 0, 0.2)'
                      }}>
                        Tag ID
                      </th>
                      <th style={{ minWidth: '150px', textAlign: 'center' }}>Item Name</th>
                      <th style={{ minWidth: '150px', textAlign: 'center' }}>Serial Number</th>
                      <th style={{ minWidth: '120px', textAlign: 'center' }}>Latest PM Date</th>
                      <th style={{ minWidth: '80px', textAlign: 'center' }}>PM Count</th>
                      <th style={{ minWidth: '200px', textAlign: 'center' }}>PM Records</th>
                      <th style={{ minWidth: '140px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetsList.map((asset) => {
                      // Create a map of checklist results for quick lookup
                      const resultsMap = {};
                      if (asset.checklist_results && Array.isArray(asset.checklist_results)) {
                        asset.checklist_results.forEach(result => {
                          if (result && result.Checklist_ID !== undefined) {
                            resultsMap[result.Checklist_ID] = result.Is_OK_bool;
                          }
                        });
                      }

                      return (
                        <tr key={`${category}-${asset.Asset_ID}`}>
                          <td style={{ 
                            fontFamily: 'monospace', 
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            position: 'sticky',
                            left: 0,
                            background: 'white',
                            zIndex: 5,
                            textAlign: 'center'
                          }}>
                            {asset.Asset_Tag_ID || 'N/A'}
                          </td>
                          <td style={{ fontWeight: '500', textAlign: 'center' }}>{asset.Item_Name || 'N/A'}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#666', textAlign: 'center' }}>
                            {asset.Asset_Serial_Number || 'N/A'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                              <Calendar size={14} color="#666" />
                              {asset.latestPMDate ? formatDate(asset.latestPMDate) : (
                                <span style={{ color: '#999', fontStyle: 'italic' }}>No PM Yet</span>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {/* PM Count Badge */}
                            <span style={{
                              padding: '6px 12px',
                              borderRadius: '12px',
                              fontSize: '0.9rem',
                              fontWeight: '700',
                              background: asset.pmCount > 0 ? '#e3f2fd' : '#f5f5f5',
                              color: asset.pmCount > 0 ? '#1565c0' : '#999',
                              border: asset.pmCount > 0 ? '1px solid #90caf9' : '1px solid #ddd',
                              minWidth: '35px',
                              display: 'inline-block'
                            }}>
                              {asset.pmCount}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {/* Individual PM Buttons */}
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                              {asset.allPMRecords && asset.allPMRecords.length > 0 ? (
                                asset.allPMRecords
                                  .sort((a, b) => new Date(a.PM_Date) - new Date(b.PM_Date))
                                  .map((pm, index) => {
                                    const isInProcess = pm.Status === 'In-Process';
                                    const isMarkedCompleted = pm.Status === 'Marked as Completed';
                                    const bgColor = isInProcess ? '#f59e0b' : isMarkedCompleted ? '#14b8a6' : '#27ae60';
                                    const hoverBgColor = isInProcess ? '#d97706' : isMarkedCompleted ? '#0d9488' : '#229954';
                                    
                                    return (
                                  <button
                                    key={pm.PM_ID}
                                    onClick={() => navigate(`/maintenance/detail/${pm.PM_ID}`)}
                                    style={{
                                      padding: '6px 12px',
                                      background: bgColor,
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '0.85rem',
                                      fontWeight: '600',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      transition: 'all 0.2s',
                                      minWidth: '70px',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                    onMouseOver={(e) => {
                                      e.currentTarget.style.background = hoverBgColor;
                                      e.currentTarget.style.transform = 'translateY(-1px)';
                                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.15)';
                                    }}
                                    onMouseOut={(e) => {
                                      e.currentTarget.style.background = bgColor;
                                      e.currentTarget.style.transform = 'translateY(0)';
                                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                                    }}
                                    title={`View PM ${index + 1} details - ${new Date(pm.PM_Date).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' })}`}
                                  >
                                    <FileText size={14} />
                                    PM{index + 1}
                                  </button>
                                    );
                                  })
                              ) : (
                                <span style={{ color: '#999', fontStyle: 'italic', fontSize: '0.9rem' }}>
                                  No records
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => handleOpenPMForm(asset)}
                              style={{
                                padding: '8px 16px',
                                background: '#3498db',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'background 0.2s'
                              }}
                              onMouseOver={(e) => e.target.style.background = '#2980b9'}
                              onMouseOut={(e) => e.target.style.background = '#3498db'}
                            >
                              <ClipboardCheck size={16} />
                              PM
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Category Summary */}
              <div style={{ marginTop: '15px', padding: '15px', background: '#f8f9fa', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ color: '#7f8c8d', fontSize: '0.85rem' }}>Total Assets:</span>
                    <strong style={{ marginLeft: '8px', color: '#2c3e50', fontSize: '1.1rem' }}>
                      {assetsList.length}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#7f8c8d', fontSize: '0.85rem' }}>Total PM Records:</span>
                    <strong style={{ marginLeft: '8px', color: '#27ae60', fontSize: '1.1rem' }}>
                      {assetsList.reduce((sum, asset) => sum + (asset.pmCount || 0), 0)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#7f8c8d', fontSize: '0.85rem' }}>Checklist Items:</span>
                    <strong style={{ marginLeft: '8px', color: '#3498db', fontSize: '1.1rem' }}>
                      {checklistItems.length}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#7f8c8d', fontSize: '0.85rem' }}>Latest PM Date:</span>
                    <strong style={{ marginLeft: '8px', color: '#7f8c8d', fontSize: '1rem' }}>
                      {formatDate(assetsList[0]?.latestPMDate)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )
      } {/* End of OLD disabled multiple tables code */}
      </div> {/* End of padding wrapper (0 20px) */}

      {/* PM Form Modal */}
      {showPMForm && selectedAsset && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '24px',
              borderBottom: '2px solid #e0e0e0',
              background: '#f8f9fa',
              borderRadius: '12px 12px 0 0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <ClipboardCheck size={32} color="#3498db" />
                  <div>
                    <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.5rem' }}>
                      Preventive Maintenance Form
                    </h2>
                    <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
                      Complete checklist for this asset
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClosePMForm}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '6px',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#f0f0f0'}
                  onMouseOut={(e) => e.target.style.background = 'transparent'}
                >
                  <X size={24} color="#666" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px' }}>
              {/* Asset Information */}
              <div style={{
                background: '#f8f9fa',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '24px',
                border: '1px solid #e0e0e0'
              }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#2c3e50', fontSize: '1.1rem', fontWeight: '600' }}>
                  Asset Information
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <div>
                    <span style={{ color: '#7f8c8d', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Serial Number:</span>
                    <strong style={{ color: '#2c3e50', fontSize: '1rem' }}>{selectedAsset.Asset_Serial_Number}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#7f8c8d', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Asset Tag ID:</span>
                    <strong style={{ color: '#2c3e50', fontSize: '1rem' }}>{selectedAsset.Asset_Tag_ID}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#7f8c8d', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Item Name:</span>
                    <strong style={{ color: '#2c3e50', fontSize: '1rem' }}>{selectedAsset.Item_Name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#7f8c8d', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Category:</span>
                    <strong style={{ color: '#2c3e50', fontSize: '1rem' }}>{selectedAsset.Category}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#7f8c8d', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Recipient Name:</span>
                    <strong style={{ color: '#2c3e50', fontSize: '1rem' }}>{selectedAsset.Recipient_Name || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#7f8c8d', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Department:</span>
                    <strong style={{ color: '#2c3e50', fontSize: '1rem' }}>{selectedAsset.Department || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#7f8c8d', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Model:</span>
                    <strong style={{ color: '#2c3e50', fontSize: '1rem' }}>{selectedAsset.Model || 'N/A'}</strong>
                  </div>
                </div>
              </div>

              {/* Checklist Items */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#2c3e50', fontSize: '1.1rem', fontWeight: '600' }}>
                  PM Checklist ({checklistItems.length} items)
                </h3>
                <div style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  {checklistItems.map((item, index) => (
                    <div
                      key={item.Checklist_ID}
                      style={{
                        padding: '16px',
                        borderBottom: index < checklistItems.length - 1 ? '1px solid #e0e0e0' : 'none',
                        background: index % 2 === 0 ? 'white' : '#f8f9fa'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        marginBottom: '12px'
                      }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: '#7f8c8d', fontSize: '0.75rem', marginRight: '8px' }}>
                            #{index + 1}
                          </span>
                          <span style={{ color: '#2c3e50', fontSize: '0.95rem', fontWeight: '500' }}>
                            {item.Check_item_Long}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button
                            onClick={() => handleChecklistChange(item.Checklist_ID, true)}
                            style={{
                              padding: '8px 20px',
                              border: checklistResults[item.Checklist_ID] === true ? '2px solid #27ae60' : '2px solid #ddd',
                              borderRadius: '6px',
                              background: checklistResults[item.Checklist_ID] === true ? '#27ae60' : 'white',
                              color: checklistResults[item.Checklist_ID] === true ? 'white' : '#666',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              fontWeight: '600',
                              transition: 'all 0.2s',
                              minWidth: '80px'
                            }}
                          >
                            Good
                          </button>
                          <button
                            onClick={() => handleChecklistChange(item.Checklist_ID, false)}
                            style={{
                              padding: '8px 20px',
                              border: checklistResults[item.Checklist_ID] === false ? '2px solid #e74c3c' : '2px solid #ddd',
                              borderRadius: '6px',
                              background: checklistResults[item.Checklist_ID] === false ? '#e74c3c' : 'white',
                              color: checklistResults[item.Checklist_ID] === false ? 'white' : '#666',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              fontWeight: '600',
                              transition: 'all 0.2s',
                              minWidth: '80px'
                            }}
                          >
                            Bad
                          </button>
                        </div>
                      </div>
                      <div style={{ paddingLeft: '40px' }}>
                        <input
                          type="text"
                          placeholder="Remarks (optional)"
                          value={checklistItemRemarks[item.Checklist_ID] || ''}
                          onChange={(e) => handleChecklistRemarkChange(item.Checklist_ID, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            color: '#2c3e50',
                            fontFamily: 'inherit'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Remarks */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#2c3e50', fontWeight: '600', fontSize: '0.95rem' }}>
                  Remarks (Optional)
                </label>
                <textarea
                  value={pmRemarks}
                  onChange={(e) => setPmRemarks(e.target.value)}
                  placeholder="Enter any additional remarks or notes..."
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    resize: 'vertical',
                    minHeight: '80px',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Form Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleClosePMForm}
                  disabled={submitting}
                  style={{
                    padding: '12px 24px',
                    background: 'white',
                    color: '#666',
                    border: '2px solid #ddd',
                    borderRadius: '6px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    opacity: submitting ? 0.5 : 1
                  }}
                  onMouseOver={(e) => !submitting && (e.target.style.background = '#f5f5f5')}
                  onMouseOut={(e) => !submitting && (e.target.style.background = 'white')}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitPMForm}
                  disabled={submitting}
                  style={{
                    padding: '12px 32px',
                    background: submitting ? '#95a5a6' : '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => !submitting && (e.target.style.background = '#229954')}
                  onMouseOut={(e) => !submitting && (e.target.style.background = '#27ae60')}
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Submit Dialog */}
      {showConfirmDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '400px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#2c3e50', fontSize: '1.3rem' }}>
              Confirm Submission
            </h3>
            <p style={{ margin: '0 0 24px 0', color: '#666', fontSize: '1rem', lineHeight: '1.5' }}>
              Are you sure you want to submit this PM record? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirmDialog(false)}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  color: '#666',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSubmit}
                style={{
                  padding: '10px 20px',
                  background: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '400px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#2c3e50', fontSize: '1.3rem' }}>
              Cancel Form?
            </h3>
            <p style={{ margin: '0 0 24px 0', color: '#666', fontSize: '1rem', lineHeight: '1.5' }}>
              Are you sure you want to cancel? All your changes will be lost.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCancelDialog(false)}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  color: '#666',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
              >
                Keep Editing
              </button>
              <button
                onClick={handleConfirmCancel}
                style={{
                  padding: '10px 20px',
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checklist Manager Modal */}
      {showChecklistManager && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            width: '900px',
            height: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '24px',
              borderBottom: '2px solid #ecf0f1',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '12px 12px 0 0',
              color: 'white'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Edit size={28} />
                  <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>
                    Manage Checklist Items
                  </h2>
                </div>
                <button
                  onClick={handleCloseChecklistManager}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'white'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', flex: 1, overflow: 'auto' }}>
              {/* Category Selection */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  fontSize: '1rem'
                }}>
                  <Package size={18} color="#667eea" />
                  Select Category
                </label>
                <select
                  value={selectedCategoryForEdit}
                  onChange={handleCategoryChangeForEdit}
                  disabled={loadingChecklist}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">-- Select a Category --</option>
                  {categories.map((cat) => (
                    <option key={cat.Category_ID} value={cat.Category_ID}>
                      {cat.Category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Checklist Items List */}
              {selectedCategoryForEdit && !showCopyChecklist && (
                <div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px'
                  }}>
                    <h3 style={{
                      margin: 0,
                      color: '#2c3e50',
                      fontSize: '1.2rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <ClipboardCheck size={20} color="#667eea" />
                      Checklist Items
                    </h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {rearrangeMode && (
                        <button
                          onClick={handleCancelRearrange}
                          style={{
                            padding: '8px 16px',
                            background: '#95a5a6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => e.target.style.background = '#7f8c8d'}
                          onMouseOut={(e) => e.target.style.background = '#95a5a6'}
                        >
                          <X size={16} />
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={handleToggleRearrangeMode}
                        disabled={checklistItemsForEdit.length === 0}
                        style={{
                          padding: '8px 16px',
                          background: rearrangeMode ? '#27ae60' : '#f39c12',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: checklistItemsForEdit.length === 0 ? 'not-allowed' : 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s',
                          opacity: checklistItemsForEdit.length === 0 ? 0.5 : 1
                        }}
                        onMouseOver={(e) => {
                          if (checklistItemsForEdit.length > 0) {
                            e.target.style.background = rearrangeMode ? '#229954' : '#e67e22';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (checklistItemsForEdit.length > 0) {
                            e.target.style.background = rearrangeMode ? '#27ae60' : '#f39c12';
                          }
                        }}
                      >
                        <GripVertical size={16} />
                        {rearrangeMode ? 'Confirm' : 'Rearrange'}
                      </button>
                      <button
                        onClick={handleOpenCopyChecklist}
                        disabled={rearrangeMode}
                        style={{
                          padding: '8px 16px',
                          background: rearrangeMode ? '#bdc3c7' : '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: rearrangeMode ? 'not-allowed' : 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s',
                          opacity: rearrangeMode ? 0.5 : 1
                        }}
                        onMouseOver={(e) => !rearrangeMode && (e.target.style.background = '#5568d3')}
                        onMouseOut={(e) => !rearrangeMode && (e.target.style.background = '#667eea')}
                      >
                        <Copy size={16} />
                        Copy from other category
                      </button>
                    </div>
                  </div>

                  {loadingChecklist ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
                      Loading...
                    </div>
                  ) : (
                    <>
                      {/* Existing Items */}
                      <div style={{ marginBottom: '20px' }}>
                        {checklistItemsForEdit.length === 0 ? (
                          <div style={{
                            padding: '20px',
                            textAlign: 'center',
                            color: '#7f8c8d',
                            fontSize: '0.95rem',
                            background: '#f8f9fa',
                            borderRadius: '6px'
                          }}>
                            No checklist items found for this category
                          </div>
                        ) : (
                          checklistItemsForEdit.map((item, index) => (
                            <div
                              key={item.Checklist_ID}
                              draggable={rearrangeMode}
                              onDragStart={(e) => handleDragStart(e, index)}
                              onDragOver={(e) => handleDragOver(e, index)}
                              onDrop={(e) => handleDrop(e, index)}
                              onDragEnd={handleDragEnd}
                              style={{
                                padding: '12px',
                                marginBottom: '8px',
                                border: `2px solid ${dragOverIndex === index ? '#667eea' : '#ecf0f1'}`,
                                borderRadius: '6px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: editingItemId === item.Checklist_ID ? '#f0f7ff' : (draggedItem === index ? '#f0f0f0' : 'white'),
                                cursor: rearrangeMode ? 'move' : 'default',
                                transition: 'all 0.2s',
                                opacity: draggedItem === index ? 0.5 : 1
                              }}
                            >
                              {editingItemId === item.Checklist_ID ? (
                                <>
                                  <div style={{ 
                                    flex: 1, 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '10px',
                                    marginRight: '12px'
                                  }}>
                                    <div>
                                      <label style={{ 
                                        fontSize: '0.75rem', 
                                        color: '#7f8c8d', 
                                        fontWeight: '600',
                                        textTransform: 'uppercase',
                                        marginBottom: '4px',
                                        display: 'block'
                                      }}>
                                        Checklist Item
                                      </label>
                                      <input
                                        type="text"
                                        value={editingItemTextLong}
                                        onChange={(e) => setEditingItemTextLong(e.target.value)}
                                        style={{
                                          width: '100%',
                                          padding: '8px 12px',
                                          border: '2px solid #667eea',
                                          borderRadius: '4px',
                                          fontSize: '0.95rem'
                                        }}
                                        autoFocus
                                        placeholder="Enter checklist item"
                                      />
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                      onClick={handleConfirmEdit}
                                      style={{
                                        padding: '8px 16px',
                                        background: '#27ae60',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '0.9rem',
                                        fontWeight: '600'
                                      }}
                                    >
                                      <Save size={14} />
                                      Save
                                    </button>
                                    <button
                                      onClick={handleCancelEdit}
                                      style={{
                                        padding: '8px 16px',
                                        background: '#95a5a6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        fontWeight: '600'
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  {rearrangeMode && (
                                    <div style={{ marginRight: '12px', color: '#667eea' }}>
                                      <GripVertical size={20} />
                                    </div>
                                  )}
                                  <div style={{ 
                                    flex: 1,
                                    fontSize: '0.95rem', 
                                    color: '#2c3e50',
                                    fontWeight: '500'
                                  }}>
                                    {item.Check_item_Long}
                                  </div>
                                  {!rearrangeMode && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <button
                                        onClick={() => handleStartEdit(item)}
                                        style={{
                                          padding: '6px 12px',
                                          background: '#3498db',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          fontSize: '0.85rem'
                                        }}
                                      >
                                        <Edit size={14} />
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleDeleteClick(item)}
                                        style={{
                                          padding: '6px 12px',
                                          background: '#e74c3c',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          fontSize: '0.85rem'
                                        }}
                                      >
                                        <Trash2 size={14} />
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      {/* Add New Item */}
                      {!rearrangeMode && (
                        <div style={{
                          padding: '16px',
                          background: '#f8f9fa',
                          borderRadius: '6px',
                          border: '2px dashed #ddd'
                        }}>
                        <h4 style={{
                          margin: '0 0 12px 0',
                          color: '#2c3e50',
                          fontSize: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <Plus size={18} color="#27ae60" />
                          Add New Checklist Item
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <label style={{ 
                              fontSize: '0.75rem', 
                              color: '#7f8c8d', 
                              fontWeight: '600',
                              textTransform: 'uppercase',
                              marginBottom: '4px',
                              display: 'block'
                            }}>
                              Checklist Item
                            </label>
                            <input
                              type="text"
                              value={newItemTextLong}
                              onChange={(e) => setNewItemTextLong(e.target.value)}
                              placeholder="Enter checklist item..."
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '2px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '0.95rem'
                              }}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && newItemTextLong.trim()) {
                                  handleAddNewItem();
                                }
                              }}
                            />
                          </div>
                          <button
                            onClick={handleAddNewItem}
                            disabled={!newItemTextLong.trim()}
                            style={{
                              padding: '10px 20px',
                              background: newItemTextLong.trim() ? '#27ae60' : '#95a5a6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: newItemTextLong.trim() ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              fontSize: '0.95rem',
                              fontWeight: '600'
                            }}
                          >
                            <Plus size={16} />
                            Add Item
                          </button>
                        </div>
                      </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Copy Checklist Section */}
              {selectedCategoryForEdit && showCopyChecklist && (
                <div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px'
                  }}>
                    <h3 style={{
                      margin: 0,
                      color: '#2c3e50',
                      fontSize: '1.2rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Copy size={20} color="#667eea" />
                      Copy Checklist
                    </h3>
                    <button
                      onClick={handleBackToManageChecklist}
                      style={{
                        padding: '8px 16px',
                        background: '#95a5a6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <ArrowLeft size={16} />
                      Back
                    </button>
                  </div>

                  {/* Target Category Display */}
                  <div style={{
                    padding: '12px',
                    background: '#f0f7ff',
                    borderRadius: '6px',
                    marginBottom: '20px',
                    border: '2px solid #667eea'
                  }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#2c3e50' }}>
                      <strong>Copying to:</strong> {categories.find(c => c.Category_ID === parseInt(selectedCategoryForEdit))?.Category}
                    </p>
                  </div>

                  {/* Source Category Selection */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px',
                      fontWeight: '600',
                      color: '#2c3e50',
                      fontSize: '1rem'
                    }}>
                      <Package size={18} color="#667eea" />
                      Select Source Category
                    </label>
                    <select
                      value={sourceCategoryForCopy}
                      onChange={handleSourceCategoryChange}
                      disabled={loadingSourceChecklist}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        backgroundColor: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">-- Select a Category to Copy From --</option>
                      {categories
                        .filter(cat => cat.Category_ID !== parseInt(selectedCategoryForEdit))
                        .map((cat) => (
                          <option key={cat.Category_ID} value={cat.Category_ID}>
                            {cat.Category}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Source Checklist Items */}
                  {sourceCategoryForCopy && (
                    <div>
                      <h4 style={{
                        margin: '0 0 12px 0',
                        color: '#2c3e50',
                        fontSize: '1rem',
                        fontWeight: '600'
                      }}>
                        Select Items to Copy ({selectedItemsToCopy.length} selected)
                      </h4>

                      {loadingSourceChecklist ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
                          Loading...
                        </div>
                      ) : sourceChecklistItems.length === 0 ? (
                        <div style={{
                          padding: '20px',
                          textAlign: 'center',
                          color: '#7f8c8d',
                          fontSize: '0.95rem',
                          background: '#f8f9fa',
                          borderRadius: '6px'
                        }}>
                          No checklist items found for this category
                        </div>
                      ) : (
                        <>
                          <div style={{ marginBottom: '16px' }}>
                            {sourceChecklistItems.map((item) => {
                              const isSelected = selectedItemsToCopy.find(i => i.Checklist_ID === item.Checklist_ID);
                              return (
                                <div
                                  key={item.Checklist_ID}
                                  style={{
                                    padding: '12px',
                                    marginBottom: '8px',
                                    border: `2px solid ${isSelected ? '#27ae60' : '#ecf0f1'}`,
                                    borderRadius: '6px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: isSelected ? '#d4edda' : 'white'
                                  }}
                                >
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.95rem', color: '#2c3e50', fontWeight: '500' }}>
                                      {item.Check_item_Long}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleToggleItemToCopy(item)}
                                    style={{
                                      padding: '8px 16px',
                                      background: isSelected ? '#27ae60' : '#667eea',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '0.9rem',
                                      fontWeight: '600',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      minWidth: '100px',
                                      justifyContent: 'center'
                                    }}
                                  >
                                    {isSelected ? (
                                      <>
                                        <CheckCircle size={16} />
                                        Selected
                                      </>
                                    ) : (
                                      <>
                                        <Copy size={16} />
                                        Copy
                                      </>
                                    )}
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          {/* Confirm Button */}
                          <div style={{ textAlign: 'center', marginTop: '20px' }}>
                            <button
                              onClick={handleConfirmCopyClick}
                              disabled={selectedItemsToCopy.length === 0}
                              style={{
                                padding: '12px 32px',
                                background: selectedItemsToCopy.length > 0 ? '#27ae60' : '#95a5a6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: selectedItemsToCopy.length > 0 ? 'pointer' : 'not-allowed',
                                fontSize: '1rem',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                margin: '0 auto'
                              }}
                            >
                              <CheckCircle size={18} />
                              Confirm Copy ({selectedItemsToCopy.length} items)
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!selectedCategoryForEdit && (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#7f8c8d',
                  fontSize: '1rem'
                }}>
                  Please select a category to view and manage checklist items
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1002
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '28px',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#e74c3c', fontSize: '1.3rem' }}>
              Delete Checklist Item?
            </h3>
            <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '1rem' }}>
              Are you sure you want to delete this checklist item?
            </p>
            <p style={{ margin: '0 0 24px 0', color: '#2c3e50', fontSize: '0.95rem', fontWeight: '600', background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
              "{itemToDelete?.Check_item_Long}"
            </p>
            <p style={{ margin: '0 0 24px 0', color: '#e74c3c', fontSize: '0.9rem', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span>Warning: This action cannot be undone. If this item is used in existing PM records, deletion will fail.</span>
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  color: '#666',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                style={{
                  padding: '10px 20px',
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Confirmation Dialog */}
      {showEditConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1002
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '28px',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#3498db', fontSize: '1.3rem' }}>
              Update Checklist Item?
            </h3>
            <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '1rem' }}>
              Are you sure you want to update this checklist item?
            </p>
            <p style={{ margin: '0 0 24px 0', color: '#2c3e50', fontSize: '0.95rem', fontWeight: '600', background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
              "{pendingEdit?.text}"
            </p>
            <p style={{ margin: '0 0 24px 0', color: '#f39c12', fontSize: '0.9rem', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span>This will affect all assets in this category for future PM records.</span>
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowEditConfirm(false)}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  color: '#666',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                style={{
                  padding: '10px 20px',
                  background: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
              >
                Yes, Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Confirmation Dialog */}
      {showAddConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1002
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '28px',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#27ae60', fontSize: '1.3rem' }}>
              Add New Checklist Item?
            </h3>
            <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '1rem' }}>
              Are you sure you want to add this checklist item?
            </p>
            <p style={{ margin: '0 0 24px 0', color: '#2c3e50', fontSize: '0.95rem', fontWeight: '600', background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
              "{newItemTextLong}"
            </p>
            <p style={{ margin: '0 0 24px 0', color: '#27ae60', fontSize: '0.9rem', fontStyle: 'italic' }}>
              ✓ This item will be available for all future PM records in this category.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddConfirm(false)}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  color: '#666',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAddItem}
                style={{
                  padding: '10px 20px',
                  background: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
              >
                Yes, Add Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Checklist Confirmation Dialog */}
      {showCopyConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1003
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '28px',
            maxWidth: '550px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#667eea', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Copy size={24} />
              Confirm Copy Checklist Items
            </h3>
            <p style={{ margin: '0 0 16px 0', color: '#666', fontSize: '1rem' }}>
              You are about to copy <strong>{selectedItemsToCopy.length}</strong> item(s) to <strong>{categories.find(c => c.Category_ID === parseInt(selectedCategoryForEdit))?.Category}</strong>
            </p>
            
            <div style={{ 
              margin: '16px 0 24px 0',
              maxHeight: '300px',
              overflow: 'auto',
              border: '2px solid #ecf0f1',
              borderRadius: '6px',
              padding: '12px',
              background: '#f8f9fa'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#2c3e50', fontSize: '0.95rem' }}>
                Selected Items:
              </h4>
              {selectedItemsToCopy.map((item, index) => (
                <div key={item.Checklist_ID} style={{
                  padding: '8px',
                  marginBottom: '8px',
                  background: 'white',
                  borderRadius: '4px',
                  border: '1px solid #ddd'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#7f8c8d', marginBottom: '4px' }}>
                    #{index + 1}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#2c3e50', fontWeight: '500' }}>
                    {item.Check_item_Long}
                  </div>
                </div>
              ))}
            </div>

            <p style={{ margin: '0 0 24px 0', color: '#667eea', fontSize: '0.9rem', fontStyle: 'italic' }}>
              ✓ These items will be added to the target category and available for future PM records.
            </p>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCopyConfirm(false)}
                disabled={copyingItems}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  color: '#666',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  cursor: copyingItems ? 'not-allowed' : 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCopy}
                disabled={copyingItems}
                style={{
                  padding: '10px 20px',
                  background: copyingItems ? '#95a5a6' : '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: copyingItems ? 'not-allowed' : 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
              >
                {copyingItems ? 'Copying...' : 'Yes, Copy Items'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Download Modal */}
      {showBulkDownloadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1003,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            width: '95%',
            maxWidth: '1400px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            {/* Header */}
            <div style={{
              padding: '24px 28px',
              borderBottom: '2px solid #e0e0e0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Download size={28} color="#27ae60" />
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#2c3e50' }}>
                  Download Bulk PM Forms
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowBulkDownloadModal(false);
                  setSelectedAssets([]);
                  setSelectedPMRecords({});
                  setBulkDownloadSearch('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
              >
                <X size={24} color="#666" />
              </button>
            </div>

            {/* Search Bar */}
            <div style={{ padding: '20px 28px', borderBottom: '1px solid #e0e0e0' }}>
              <div style={{ position: 'relative' }}>
                <Search 
                  size={18} 
                  style={{ 
                    position: 'absolute', 
                    left: '14px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    color: '#7f8c8d'
                  }} 
                />
                <input
                  type="text"
                  placeholder="Search assets by Tag ID, Item Name, Serial Number..."
                  value={bulkDownloadSearch}
                  onChange={(e) => setBulkDownloadSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 44px',
                    border: '2px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3498db'}
                  onBlur={(e) => e.target.style.borderColor = '#ddd'}
                />
              </div>
            </div>

            {/* Two Boxes Container */}
            <div style={{
              flex: 1,
              display: 'flex',
              gap: '20px',
              padding: '20px 28px',
              overflow: 'hidden'
            }}>
              {/* Left Box - Available Assets */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                border: '2px solid #3498db',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '16px',
                  background: 'linear-gradient(135deg, #3498db, #2980b9)',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '1rem'
                }}>
                  Available Assets ({(() => {
                    const allAssets = Object.values(groupedByCategory).flatMap(cat => 
                      Object.values(cat.assets)
                    );
                    const filtered = allAssets.filter(asset => {
                      if (!bulkDownloadSearch) return true;
                      const query = bulkDownloadSearch.toLowerCase();
                      return (
                        asset.Asset_Tag_ID?.toLowerCase().includes(query) ||
                        asset.Item_Name?.toLowerCase().includes(query) ||
                        asset.Asset_Serial_Number?.toLowerCase().includes(query)
                      );
                    });
                    return filtered.length;
                  })()})
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                  {(() => {
                    const allAssets = Object.values(groupedByCategory).flatMap(cat => 
                      Object.values(cat.assets)
                    );
                    const filteredAssets = allAssets.filter(asset => {
                      if (!bulkDownloadSearch) return true;
                      const query = bulkDownloadSearch.toLowerCase();
                      return (
                        asset.Asset_Tag_ID?.toLowerCase().includes(query) ||
                        asset.Item_Name?.toLowerCase().includes(query) ||
                        asset.Asset_Serial_Number?.toLowerCase().includes(query)
                      );
                    });

                    if (filteredAssets.length === 0) {
                      return (
                        <div style={{
                          padding: '40px 20px',
                          textAlign: 'center',
                          color: '#999'
                        }}>
                          <Package size={48} color="#ddd" style={{ marginBottom: '12px' }} />
                          <p>No assets found</p>
                        </div>
                      );
                    }

                    return filteredAssets.map(asset => {
                      const isSelected = selectedAssets.some(a => a.Asset_ID === asset.Asset_ID);
                      return (
                        <div
                          key={asset.Asset_ID}
                          style={{
                            padding: '14px 16px',
                            marginBottom: '8px',
                            border: '1px solid #e0e0e0',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            background: isSelected ? '#e8f5e9' : 'white',
                            transition: 'all 0.2s',
                            minHeight: '70px'
                          }}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedAssets(selectedAssets.filter(a => a.Asset_ID !== asset.Asset_ID));
                              // Remove PM selections for this asset
                              const newPMRecords = { ...selectedPMRecords };
                              delete newPMRecords[asset.Asset_ID];
                              setSelectedPMRecords(newPMRecords);
                            } else {
                              setSelectedAssets([...selectedAssets, asset]);
                            }
                          }}
                          onMouseOver={(e) => {
                            if (!isSelected) e.currentTarget.style.background = '#f5f5f5';
                          }}
                          onMouseOut={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'white';
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: 'pointer',
                              flexShrink: 0
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                              <div style={{ fontWeight: '600', color: '#2c3e50', fontSize: '0.95rem' }}>
                                {asset.Asset_Tag_ID}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#999', fontFamily: 'monospace' }}>
                                {asset.Asset_Serial_Number || 'N/A'}
                              </div>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {asset.Item_Name}
                            </div>
                          </div>
                          {isSelected && <ChevronRight size={20} color="#27ae60" style={{ flexShrink: 0 }} />}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Right Box - Selected Assets with PM Records */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                border: '2px solid #27ae60',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '16px',
                  background: 'linear-gradient(135deg, #27ae60, #229954)',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '1rem'
                }}>
                  Selected Assets ({selectedAssets.length})
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                  {selectedAssets.length === 0 ? (
                    <div style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: '#999'
                    }}>
                      <ChevronLeft size={48} color="#ddd" style={{ marginBottom: '12px' }} />
                      <p>Select assets from the left to add PM records</p>
                    </div>
                  ) : (
                    selectedAssets.map(asset => {
                      const assetPMRecords = asset.allPMRecords || [];
                      const selectedPMs = selectedPMRecords[asset.Asset_ID] || [];
                      
                      return (
                        <div
                          key={asset.Asset_ID}
                          style={{
                            marginBottom: '8px',
                            border: '1px solid #e0e0e0',
                            borderRadius: '6px',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Asset Row with PM Selection Inline */}
                          <div style={{
                            padding: '14px 16px',
                            background: '#f8f9fa',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            justifyContent: 'space-between',
                            minHeight: '70px'
                          }}>
                            {/* Asset Info */}
                            <div style={{ flex: '0 0 auto', minWidth: '180px', maxWidth: '180px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                <div style={{ fontWeight: '600', color: '#2c3e50', fontSize: '0.95rem' }}>
                                  {asset.Asset_Tag_ID}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#999', fontFamily: 'monospace' }}>
                                  {asset.Asset_Serial_Number || 'N/A'}
                                </div>
                              </div>
                              <div style={{ fontSize: '0.85rem', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {asset.Item_Name}
                              </div>
                            </div>

                            {/* PM Records Selection - Horizontal in same row */}
                            <div style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              flexWrap: 'wrap'
                            }}>
                              <span style={{
                                fontSize: '0.85rem',
                                color: '#666',
                                fontWeight: '600',
                                marginRight: '4px'
                              }}>
                                Forms:
                              </span>
                              {/* Blank Form Option */}
                              <div
                                style={{
                                  padding: '6px 12px',
                                  border: selectedPMs.includes('BLANK') ? '2px solid #9b59b6' : '1px solid #ddd',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  background: selectedPMs.includes('BLANK') ? '#f4ecf7' : 'white',
                                  transition: 'all 0.2s',
                                  fontSize: '0.85rem',
                                  fontWeight: selectedPMs.includes('BLANK') ? '600' : '500',
                                  color: selectedPMs.includes('BLANK') ? '#2c3e50' : '#666',
                                  whiteSpace: 'nowrap',
                                  boxShadow: selectedPMs.includes('BLANK') ? '0 2px 4px rgba(155, 89, 182, 0.2)' : 'none'
                                }}
                                onClick={() => {
                                  const currentPMs = selectedPMRecords[asset.Asset_ID] || [];
                                  if (currentPMs.includes('BLANK')) {
                                    setSelectedPMRecords({
                                      ...selectedPMRecords,
                                      [asset.Asset_ID]: currentPMs.filter(id => id !== 'BLANK')
                                    });
                                  } else {
                                    setSelectedPMRecords({
                                      ...selectedPMRecords,
                                      [asset.Asset_ID]: [...currentPMs, 'BLANK']
                                    });
                                  }
                                }}
                                onMouseOver={(e) => {
                                  if (!selectedPMs.includes('BLANK')) {
                                    e.currentTarget.style.background = '#f0f0f0';
                                    e.currentTarget.style.borderColor = '#9b59b6';
                                  }
                                }}
                                onMouseOut={(e) => {
                                  if (!selectedPMs.includes('BLANK')) {
                                    e.currentTarget.style.background = 'white';
                                    e.currentTarget.style.borderColor = '#ddd';
                                  }
                                }}
                                title="Blank PM Form (empty template)"
                              >
                                {selectedPMs.includes('BLANK') && <span style={{ marginRight: '4px', color: '#27ae60' }}>✓</span>}
                                Blank
                              </div>
                              
                              {/* Existing PM Records */}
                              {assetPMRecords.length > 0 && assetPMRecords.map((pm, index) => {
                                  const isPMSelected = selectedPMs.includes(pm.PM_ID);
                                  const isDisabled = pm.Status === 'In-Process'; // Only In-Process is disabled, Marked as Completed allowed
                                  return (
                                    <div
                                      key={pm.PM_ID}
                                      style={{
                                        padding: '6px 12px',
                                        border: isPMSelected ? '2px solid #3498db' : '1px solid #ddd',
                                        borderRadius: '6px',
                                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                                        background: isDisabled ? '#f5f5f5' : (isPMSelected ? '#e3f2fd' : 'white'),
                                        transition: 'all 0.2s',
                                        fontSize: '0.85rem',
                                        fontWeight: isPMSelected ? '600' : '500',
                                        color: isDisabled ? '#bdc3c7' : (isPMSelected ? '#2c3e50' : '#666'),
                                        whiteSpace: 'nowrap',
                                        boxShadow: isPMSelected ? '0 2px 4px rgba(52, 152, 219, 0.2)' : 'none',
                                        opacity: isDisabled ? 0.5 : 1,
                                        position: 'relative'
                                      }}
                                      onClick={() => {
                                        if (isDisabled) return;
                                        const currentPMs = selectedPMRecords[asset.Asset_ID] || [];
                                        if (isPMSelected) {
                                          setSelectedPMRecords({
                                            ...selectedPMRecords,
                                            [asset.Asset_ID]: currentPMs.filter(id => id !== pm.PM_ID)
                                          });
                                        } else {
                                          setSelectedPMRecords({
                                            ...selectedPMRecords,
                                            [asset.Asset_ID]: [...currentPMs, pm.PM_ID]
                                          });
                                        }
                                      }}
                                      onMouseOver={(e) => {
                                        if (!isPMSelected && !isDisabled) {
                                          e.currentTarget.style.background = '#f0f0f0';
                                          e.currentTarget.style.borderColor = '#3498db';
                                        }
                                      }}
                                      onMouseOut={(e) => {
                                        if (!isPMSelected && !isDisabled) {
                                          e.currentTarget.style.background = 'white';
                                          e.currentTarget.style.borderColor = '#ddd';
                                        }
                                      }}
                                      title={isDisabled ? `Cannot download - Status: In-Process (requires signature)` : `PM Date: ${formatDate(pm.PM_Date)} - Status: ${pm.Status || 'Completed'}`}
                                    >
                                      {isPMSelected && <span style={{ marginRight: '4px', color: '#27ae60' }}>✓</span>}
                                      {isDisabled && <span style={{ marginRight: '4px', color: '#e74c3c' }}>🔒</span>}
                                      {index + 1}
                                    </div>
                                  );
                                })}
                            </div>

                            {/* Remove Button */}
                            <button
                              onClick={() => {
                                setSelectedAssets(selectedAssets.filter(a => a.Asset_ID !== asset.Asset_ID));
                                const newPMRecords = { ...selectedPMRecords };
                                delete newPMRecords[asset.Asset_ID];
                                setSelectedPMRecords(newPMRecords);
                              }}
                              style={{
                                background: '#e74c3c',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '6px 12px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                transition: 'background 0.2s',
                                whiteSpace: 'nowrap'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = '#c0392b'}
                              onMouseOut={(e) => e.currentTarget.style.background = '#e74c3c'}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Footer with Download Button */}
            <div style={{
              padding: '20px 28px',
              borderTop: '2px solid #e0e0e0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ color: '#666', fontSize: '0.95rem' }}>
                {(() => {
                  const totalSelected = Object.values(selectedPMRecords).reduce((sum, pms) => sum + pms.length, 0);
                  return (
                    <>
                      <strong>{selectedAssets.length}</strong> asset{selectedAssets.length !== 1 ? 's' : ''} selected, 
                      <strong> {totalSelected}</strong> PM record{totalSelected !== 1 ? 's' : ''} to download
                    </>
                  );
                })()}
              </div>
              <button
                onClick={async () => {
                  // TODO: Implement PDF download
                  const totalSelected = Object.values(selectedPMRecords).reduce((sum, pms) => sum + pms.length, 0);
                  if (totalSelected === 0) {
                    toast.error('Please select at least one PM record to download');
                    return;
                  }
                  
                  setDownloadingPDF(true);
                  try {
                    // Get customer and branch names
                    const customerName = customers.find(c => c.Customer_ID == selectedCustomer)?.Customer_Name || 'Customer';
                    const branchName = selectedBranch;
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                    const filename = `${customerName}_${branchName}_${timestamp}.pdf`;
                    
                    // Separate PM IDs and blank forms
                    const allSelections = Object.entries(selectedPMRecords);
                    const pmIds = [];
                    const blankAssetIds = [];
                    
                    allSelections.forEach(([assetId, selections]) => {
                      selections.forEach(selection => {
                        if (selection === 'BLANK') {
                          blankAssetIds.push(parseInt(assetId));
                        } else {
                          pmIds.push(selection);
                        }
                      });
                    });
                    
                    // Call backend API to generate PDF
                    const token = localStorage.getItem('authToken');
                    const response = await fetch(`${API_URL}/pm/bulk-download`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ pmIds, blankAssetIds })
                    });

                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({}));
                      const errorMessage = errorData.message || errorData.error || 'Failed to generate PDF';
                      throw new Error(errorMessage);
                    }

                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    // Close modal and reset
                    setShowBulkDownloadModal(false);
                    setSelectedAssets([]);
                    setSelectedPMRecords({});
                    setBulkDownloadSearch('');
                  } catch (error) {
                    console.error('Error downloading PDF:', error);
                    toast.error(`Failed to download PDF: ${error.message}`);
                  } finally {
                    setDownloadingPDF(false);
                  }
                }}
                disabled={downloadingPDF || Object.values(selectedPMRecords).reduce((sum, pms) => sum + pms.length, 0) === 0}
                style={{
                  padding: '14px 32px',
                  background: downloadingPDF ? '#95a5a6' : '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: downloadingPDF ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
                onMouseOver={(e) => {
                  if (!downloadingPDF && Object.values(selectedPMRecords).reduce((sum, pms) => sum + pms.length, 0) > 0) {
                    e.currentTarget.style.background = '#229954';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!downloadingPDF) {
                    e.currentTarget.style.background = '#27ae60';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                  }
                }}
              >
                <Download size={18} />
                {downloadingPDF ? 'Generating PDF...' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rearrange Confirmation Dialog */}
      {showRearrangeConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1003
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '28px',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#f39c12', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GripVertical size={24} />
              Confirm Rearrangement
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: '1rem', lineHeight: '1.6' }}>
              Are you sure you want to save this new order?
            </p>
            <p style={{ margin: '0 0 24px 0', color: '#f39c12', fontSize: '0.9rem', fontStyle: 'italic' }}>
              ✓ This will update the display order for all PM forms, reports, and details pages.
            </p>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowRearrangeConfirm(false)}
                disabled={savingOrder}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  color: '#666',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  cursor: savingOrder ? 'not-allowed' : 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRearrange}
                disabled={savingOrder}
                style={{
                  padding: '10px 20px',
                  background: savingOrder ? '#95a5a6' : '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: savingOrder ? 'not-allowed' : 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
              >
                {savingOrder ? 'Saving...' : 'Yes, Save Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Mode Confirmation Modal */}
      {showDeleteConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '25px' }}>
              <AlertTriangle size={48} color="#e74c3c" style={{ marginBottom: '15px' }} />
              <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '1.3rem' }}>
                Delete PM Records
              </h3>
              <p style={{ margin: 0, color: '#7f8c8d', fontSize: '0.95rem', lineHeight: '1.6' }}>
                This feature allows you to delete multiple PM records at once. 
                Once activated, you can select PM records by clicking them in the table. 
                Are you sure you want to proceed?
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                style={{
                  padding: '10px 24px',
                  background: 'white',
                  color: '#666',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.borderColor = '#999'}
                onMouseOut={(e) => e.target.style.borderColor = '#ddd'}
              >
                No, Cancel
              </button>
              <button
                onClick={handleConfirmDeleteMode}
                style={{
                  padding: '10px 24px',
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#c0392b'}
                onMouseOut={(e) => e.target.style.background = '#e74c3c'}
              >
                Yes, Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Mode Overlay - dims everything except table area */}
      {deleteMode && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            zIndex: 500,
            pointerEvents: 'none'
          }}
        />
      )}

      {/* Delete Mode Toast Notification */}
      {showDeleteModeToast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 10001,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: '14px',
            minWidth: '320px',
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={24} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>Delete Mode Active</div>
              <div style={{ opacity: 0.9, fontSize: '13px' }}>Exit delete mode to access other features. Click Cancel to continue.</div>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteModeToast(false);
            }}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              opacity: 0.7
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Success Toast Notification */}
      {showDeleteSuccessToast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 10001,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: '14px',
            minWidth: '320px',
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CheckCircle size={24} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>Successfully Deleted!</div>
              <div style={{ opacity: 0.9, fontSize: '13px' }}>
                {deletedRecordsCount} PM record{deletedRecordsCount !== 1 ? 's' : ''} permanently removed from the system.
              </div>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteSuccessToast(false);
            }}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              opacity: 0.7
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Cancel Delete Mode Confirmation Modal */}
      {showCancelConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <AlertCircle size={32} color="#e67e22" />
              <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.4rem' }}>Cancel Delete Mode</h3>
            </div>
            <p style={{ color: '#666', marginBottom: '25px', fontSize: '1rem', lineHeight: '1.5' }}>
              Are you sure you want to cancel and discard your selection? All selected PM records will be deselected.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCancelConfirmation(false)}
                style={{
                  padding: '10px 24px',
                  background: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#7f8c8d'}
                onMouseOut={(e) => e.target.style.background = '#95a5a6'}
              >
                No, Continue
              </button>
              <button
                onClick={handleConfirmCancelDeleteMode}
                style={{
                  padding: '10px 24px',
                  background: 'linear-gradient(135deg, #e67e22, #d35400)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(230, 126, 34, 0.3)'
                }}
                onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
              >
                Yes, Cancel & Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Summary Modal */}
      {showDeleteSummary && (() => {
        // Calculate category colors for the modal
        const uniqueCategories = [...new Set(deletingSummary.map(item => item.categoryName))].sort();
        const categoryColors = getCategoryColors(uniqueCategories);
        
        return (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
          animation: 'fadeIn 0.2s ease-out',
          padding: '20px',
          overflowY: 'auto'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={28} color="#e74c3c" />
                PM Records to be Deleted
              </h2>
              <button
                onClick={() => setShowDeleteSummary(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '28px',
                  color: '#95a5a6',
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  lineHeight: '1'
                }}
                onMouseOver={(e) => e.target.style.color = '#7f8c8d'}
                onMouseOut={(e) => e.target.style.color = '#95a5a6'}
              >×</button>
            </div>
            
            <div style={{ marginBottom: '20px', padding: '15px', background: '#fee', border: '1px solid #f5c6cb', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontSize: '1.1rem', color: '#721c24', fontWeight: '600' }}>
                {deletingSummary.length} PM record(s) will be moved to trash (soft delete)
              </p>
            </div>

            {/* PM Records Table */}
            <div style={{
              maxHeight: '400px',
              overflow: 'auto',
              border: '1px solid #e74c3c',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9rem'
              }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fee', borderBottom: '2px solid #e74c3c' }}>
                  <tr>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#2c3e50', minWidth: '60px' }}>PM ID</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#2c3e50', minWidth: '100px' }}>Category</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#2c3e50', minWidth: '120px' }}>Tag ID</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#2c3e50', minWidth: '120px' }}>Serial Number</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#2c3e50', minWidth: '150px' }}>Asset Name</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#2c3e50', minWidth: '110px' }}>PM Date</th>
                  </tr>
                </thead>
                <tbody>
                  {deletingSummary.map((item, index) => (
                    <tr key={item.PM_ID} style={{
                      backgroundColor: index % 2 === 0 ? 'white' : '#fff5f5',
                      borderBottom: '1px solid #f5c6cb'
                    }}>
                      <td style={{ padding: '10px 8px', color: '#2c3e50', fontWeight: '600' }}>{item.PM_ID}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{
                          background: categoryColors[item.categoryName] + '30',
                          color: categoryColors[item.categoryName],
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: '700',
                          border: `1px solid ${categoryColors[item.categoryName]}80`
                        }}>
                          {item.categoryName}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', color: '#2c3e50', fontFamily: 'monospace', fontWeight: '600' }}>{item.Asset_Tag_ID}</td>
                      <td style={{ padding: '10px 8px', color: '#2c3e50', fontFamily: 'monospace' }}>{item.Asset_Serial_Number || 'N/A'}</td>
                      <td style={{ padding: '10px 8px', color: '#2c3e50' }}>{item.Item_Name}</td>
                      <td style={{ padding: '10px 8px', color: '#2c3e50' }}>
                        {new Date(item.PM_Date).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '15px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', marginBottom: '20px' }}>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#856404', lineHeight: '1.5' }}>
                <strong>Warning:</strong> This action will move the selected PM records to trash (soft delete). 
                Associated checklist results will be hidden with the PM records. Assets are not deleted.
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteSummary(false)}
                style={{
                  padding: '12px 30px',
                  background: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#7f8c8d'}
                onMouseOut={(e) => e.target.style.background = '#95a5a6'}
              >
                Cancel
              </button>
              <button
                onClick={handleShowPasswordVerification}
                style={{
                  padding: '12px 30px',
                  background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(231, 76, 60, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 4px 12px rgba(231, 76, 60, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 8px rgba(231, 76, 60, 0.3)';
                }}
              >
                <Trash2 size={18} />
                Delete
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Password Verification Modal */}
      {showPasswordVerification && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10001,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <Lock size={32} color="#e74c3c" />
              <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.4rem' }}>Verify Password</h3>
            </div>
            <p style={{ color: '#666', marginBottom: '20px', fontSize: '0.95rem', lineHeight: '1.5' }}>
              To confirm deletion of {selectedPMsForDelete.length} PM record(s), please enter your password.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#2c3e50', fontWeight: '600' }}>
                Password
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => {
                  setDeletePassword(e.target.value);
                  setPasswordError('');
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleVerifyPasswordAndDelete();
                  }
                }}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: `2px solid ${passwordError ? '#e74c3c' : '#ddd'}`,
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                autoFocus
              />
              {passwordError && (
                <p style={{ color: '#e74c3c', fontSize: '0.85rem', marginTop: '8px', marginBottom: 0 }}>
                  {passwordError}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowPasswordVerification(false);
                  setDeletePassword('');
                  setPasswordError('');
                  setShowDeleteSummary(true);
                }}
                style={{
                  padding: '10px 24px',
                  background: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#7f8c8d'}
                onMouseOut={(e) => e.target.style.background = '#95a5a6'}
              >
                Back
              </button>
              <button
                onClick={handleVerifyPasswordAndDelete}
                disabled={!deletePassword}
                style={{
                  padding: '10px 24px',
                  background: deletePassword ? 'linear-gradient(135deg, #e74c3c, #c0392b)' : '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: deletePassword ? 'pointer' : 'not-allowed',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  boxShadow: deletePassword ? '0 2px 8px rgba(231, 76, 60, 0.3)' : 'none',
                  opacity: deletePassword ? 1 : 0.6
                }}
                onMouseOver={(e) => {
                  if (deletePassword) {
                    e.target.style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseOut={(e) => {
                  if (deletePassword) {
                    e.target.style.transform = 'translateY(0)';
                  }
                }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreventiveMaintenance;
