import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ClipboardCheck, PenTool, Search, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { API_URL } from '../config/api';
import usePageTitle from '../hooks/usePageTitle';

const COMPUTER_CHECKLIST = [
  {
    title: '1. Check Physical Model & Specification',
    items: [
      'Processor',
      'Memory',
      'Hard Drive / SSD',
      'Video Card',
      'Screen Size & Resolution'
    ]
  },
  {
    title: '2. Functionality',
    items: [
      'Start-up Windows',
      'Windows Settings',
      'Check wireless connection',
      'Check power connection',
      'Check integrated camera',
      'Check audio and microphone',
      'Check keyboard and mouse'
    ]
  },
  {
    title: '3. Check Installation and Configuration',
    items: [
      'Windows Installed & Activated',
      'Antivirus Installed',
      'Google Chrome',
      'Adobe Acrobat Reader',
      'Microsoft Office LTSC Standard 2024'
    ]
  }
];

const PRINTER_CHECKLIST = [
  {
    title: 'Check Physical Model & Specification',
    items: [
      'Network Port',
      'USB Port',
      'Wireless Connection'
    ]
  },
  {
    title: 'Functionality',
    items: [
      'Cartridge Inserted',
      'Power On',
      'Test-Print',
      'Self-Print'
    ]
  },
  {
    title: 'Check Network Configuration and Connection',
    items: ['Network Configured']
  }
];

const PROJECTOR_CHECKLIST = [
  {
    title: 'Check Physical Model & Specification',
    items: [
      'Network Port',
      'USB Port',
      'HDMI Port'
    ]
  },
  {
    title: 'Functionality',
    items: [
      'Power On',
      'Display On'
    ]
  }
];

const DEFAULT_PERIPHERAL_OPTIONS = [
  'Antivirus',
  'Router',
  'Mouse',
  'Keyboard',
  'Printer USB Wire'
];

const normalizePeripheralName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const buildPeripheralSelectionsFromAsset = (asset = {}) => {
  const baseSelections = DEFAULT_PERIPHERAL_OPTIONS.map((name) => ({
    name,
    checked: false,
    serial: '',
    isCustom: false
  }));

  const peripheralNames = String(
    asset.Peripheral_Type || asset.Peripherals || asset.Accessories || ''
  )
    .split(/[,;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const peripheralSerials = String(asset.Peripheral_Serial || '')
    .split(/[,;\n]/)
    .map((entry) => entry.trim());

  peripheralNames.forEach((name, index) => {
    const normalizedIncoming = normalizePeripheralName(name);
    const matchingIndex = baseSelections.findIndex(
      (entry) => normalizePeripheralName(entry.name) === normalizedIncoming
    );

    const serial = peripheralSerials[index] || '';

    if (matchingIndex >= 0) {
      baseSelections[matchingIndex] = {
        ...baseSelections[matchingIndex],
        checked: true,
        serial
      };
      return;
    }

    baseSelections.push({
      name,
      checked: true,
      serial,
      isCustom: true
    });
  });

  return baseSelections;
};

const parseSortNumber = (value) => {
  const numeric = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
};

const sortListItems = (items, getValue, mode = 'default') => {
  if (mode === 'default') return items;

  const sorted = [...items];
  sorted.sort((left, right) => {
    const leftValue = getValue(left);
    const rightValue = getValue(right);

    if (mode === 'numeric-asc' || mode === 'numeric-desc') {
      const leftNumber = parseSortNumber(leftValue);
      const rightNumber = parseSortNumber(rightValue);
      if (leftNumber !== null && rightNumber !== null) {
        return mode === 'numeric-asc' ? leftNumber - rightNumber : rightNumber - leftNumber;
      }
      if (leftNumber !== null) return -1;
      if (rightNumber !== null) return 1;
    }

    const result = String(leftValue ?? '').localeCompare(String(rightValue ?? ''), undefined, {
      sensitivity: 'base',
      numeric: true
    });
    return mode === 'alpha-desc' ? -result : result;
  });

  return sorted;
};

const getChecklistByCategory = (asset = {}) => {
  const category = String(asset.Category || '').toLowerCase();
  const itemName = String(asset.Item_Name || '').toLowerCase();
  const model = String(asset.Model || '').toLowerCase();
  const haystack = `${category} ${itemName} ${model}`;

  if (haystack.includes('printer') || haystack.includes('laserjet') || haystack.includes('mfp')) {
    return PRINTER_CHECKLIST;
  }

  if (haystack.includes('projector') || haystack.includes('epson')) {
    return PROJECTOR_CHECKLIST;
  }

  return COMPUTER_CHECKLIST;
};

const getFormCategoryTitle = (asset = {}) => {
  const category = String(asset.Category || '').toLowerCase();
  const itemName = String(asset.Item_Name || '').toLowerCase();
  const haystack = `${category} ${itemName}`;

  if (haystack.includes('printer') && haystack.includes('color')) {
    return 'PENCETAK LASER (BERWARNA) PELBAGAI FUNGSI';
  }

  if (haystack.includes('printer')) {
    return 'PENCETAK LASER (HITAM PUTIH)';
  }

  if (haystack.includes('projector')) {
    return 'PROJEKTOR';
  }

  if (haystack.includes('tablet') || haystack.includes('ipad')) {
    return 'TABLET (2 IN 1)';
  }

  if (haystack.includes('laptop') || haystack.includes('riba') || haystack.includes('notebook')) {
    return 'KOMPUTER RIBA (2 IN 1)';
  }

  return 'KOMPUTER MEJA (ALL-IN-ONE)';
};

const buildInitialResults = (template) => {
  const initial = {};
  template.forEach((section, sectionIndex) => {
    section.items.forEach((_, itemIndex) => {
      initial[`${sectionIndex}-${itemIndex}`] = false;
    });
  });
  return initial;
};

const getAssetTypeKey = (asset = {}) => {
  const category = String(asset.Category || '').toLowerCase();
  const itemName = String(asset.Item_Name || '').toLowerCase();
  const model = String(asset.Model || '').toLowerCase();
  const haystack = `${category} ${itemName} ${model}`;

  if (haystack.includes('printer') || haystack.includes('laserjet') || haystack.includes('mfp')) {
    return 'Printer';
  }

  if (haystack.includes('projector') || haystack.includes('epson')) {
    return 'Projector';
  }

  if (
    haystack.includes('tablet') ||
    haystack.includes('ipad') ||
    haystack.includes('2 in 1') ||
    haystack.includes('2in1') ||
    haystack.includes('detachable')
  ) {
    return 'Tablet';
  }

  if (haystack.includes('laptop') || haystack.includes('notebook') || haystack.includes('riba')) {
    return 'Notebook/Laptop';
  }

  if (haystack.includes('server')) {
    return 'Server';
  }

  if (haystack.includes('router') || haystack.includes('switch') || haystack.includes('network')) {
    return 'Network';
  }

  return 'Desktop/AIO';
};

const formatHistoryDate = (dateValue) => {
  if (!dateValue) return '-';
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const createClientDocumentId = () => {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('');
  const randomPart = Math.random().toString(16).slice(2, 10).toUpperCase().padEnd(8, '0');
  return `UAT-${datePart}-${randomPart}`;
};

const SignatureDialog = ({ isOpen, onClose, onConfirm, loading }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = 560;
    canvas.height = 230;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasSignature(false);
  }, [isOpen]);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const point = event.touches ? event.touches[0] : event;
    return {
      x: (point.clientX - rect.left) * scaleX,
      y: (point.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (event) => {
    event.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (event) => {
    if (!isDrawing) return;
    event.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getPoint(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleConfirm = () => {
    if (!hasSignature) {
      alert('Please sign before submitting the UAT form.');
      return;
    }

    onConfirm(canvasRef.current.toDataURL('image/png'));
  };

  if (!isOpen) return null;

  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: '#111827' }}>Recipient Signature</h3>
          <button type="button" onClick={onClose} style={closeButtonStyle} disabled={loading}>
            <X size={20} />
          </button>
        </div>

        <p style={{ marginTop: 0, color: '#374151', fontSize: 14 }}>
          Sign inside the box to confirm this UAT checklist.
        </p>

        <canvas
          ref={canvasRef}
          style={{ width: '100%', border: '1px solid #9ca3af', borderRadius: 10, touchAction: 'none', background: '#fff' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
          <button type="button" style={secondaryButtonStyle} onClick={clearSignature} disabled={loading}>
            Clear Signature
          </button>
          <button type="button" style={primaryButtonStyle} onClick={handleConfirm} disabled={loading}>
            {loading ? 'Generating Form...' : 'Submit & Generate UAT'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SuccessDialog = ({ isOpen, onClose, message }) => {
  if (!isOpen) return null;

  return (
    <div style={overlayStyle}>
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 24,
          width: 'min(560px, 100%)',
          boxShadow: '0 20px 45px rgba(0,0,0,0.25)',
          border: '1px solid #dbeafe'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '999px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CheckCircle2 size={24} color="#fff" />
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#111827', fontSize: '1.2rem' }}>UAT Form Generated</h3>
            <p style={{ margin: '4px 0 0 0', color: '#4b5563', fontSize: 14 }}>
              Your file has been downloaded successfully.
            </p>
          </div>
        </div>

        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#14532d',
            borderRadius: 10,
            padding: '10px 12px',
            fontWeight: 600,
            fontSize: 14
          }}
        >
          {message}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" style={primaryButtonStyle} onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

const UAT = () => {
  usePageTitle('UAT Form');
  const location = useLocation();

  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedAssetType, setSelectedAssetType] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [uatHistoryByAssetId, setUatHistoryByAssetId] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [globalUatHistoryByAssetId, setGlobalUatHistoryByAssetId] = useState({});
  const [loadingGlobalHistory, setLoadingGlobalHistory] = useState(false);
  const [showOnlyWithUAT, setShowOnlyWithUAT] = useState(false);
  const [bulkAssetType, setBulkAssetType] = useState('');
  const [bulkDownloading, setBulkDownloading] = useState('');
  const [listSortMode, setListSortMode] = useState('default');

  const [recipientName, setRecipientName] = useState('');
  const [recipientDepartment, setRecipientDepartment] = useState('');
  const [recipientContact, setRecipientContact] = useState('');
  const [contractNo, setContractNo] = useState('CT240000000025913');
  const [peripheralSelections, setPeripheralSelections] = useState([]);

  const [results, setResults] = useState({});
  const [remarks, setRemarks] = useState({});
  const [showSignature, setShowSignature] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successDialogMessage, setSuccessDialogMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [viewingAssetId, setViewingAssetId] = useState('');
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [suppressDependentReset, setSuppressDependentReset] = useState(false);
  const [lockDeepLinkedAsset, setLockDeepLinkedAsset] = useState(false);
  const prefillTargetAssetIdRef = useRef('');

  useEffect(() => {
    const fetchAssets = async () => {
      setLoadingAssets(true);
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/assets?page=1&limit=5000&sortField=Asset_ID&sortDirection=DESC`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch assets (${response.status})`);
        }

        const data = await response.json();
        setAssets(Array.isArray(data.data) ? data.data : []);
      } catch (error) {
        console.error('Error fetching assets:', error);
        alert('Unable to load assets for UAT. Please refresh and try again.');
      } finally {
        setLoadingAssets(false);
      }
    };

    fetchAssets();
  }, []);

  useEffect(() => {
    if (prefillApplied || assets.length === 0) return;

    const params = new URLSearchParams(location.search || '');
    const customerParam = String(params.get('customer') || '').trim();
    const branchParam = String(params.get('branch') || '').trim();
    const assetIdParam = String(params.get('assetId') || '').trim();

    if (!customerParam && !branchParam && !assetIdParam) {
      setPrefillApplied(true);
      return;
    }

    setSuppressDependentReset(true);

    if (customerParam) setSelectedCustomer(customerParam);
    if (branchParam) setSelectedBranch(branchParam);

    if (assetIdParam) {
      prefillTargetAssetIdRef.current = assetIdParam;
      setLockDeepLinkedAsset(true);
      const matchedAsset = assets.find((asset) => String(asset.Asset_ID) === assetIdParam);
      if (matchedAsset) {
        const matchedCustomer = String(matchedAsset.Customer_Name || '').trim();
        const matchedBranch = String(matchedAsset.Branch || '').trim();

        if (matchedCustomer) setSelectedCustomer(matchedCustomer);
        if (matchedBranch) setSelectedBranch(matchedBranch);
        setSelectedAssetType(getAssetTypeKey(matchedAsset));
        setSelectedAssetId(String(matchedAsset.Asset_ID));
      }
    }

    setPrefillApplied(true);
  }, [assets, location.search, prefillApplied]);

  useEffect(() => {
    if (!suppressDependentReset) return;

    const targetId = String(prefillTargetAssetIdRef.current || '').trim();
    if (!targetId || String(selectedAssetId) === targetId) {
      setSuppressDependentReset(false);
    }
  }, [selectedAssetId, suppressDependentReset]);

  const customerOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        assets
          .map((asset) => asset.Customer_Name)
          .filter(Boolean)
      )
    );

    return sortListItems(unique, (item) => item, listSortMode);
  }, [assets, listSortMode]);

  const branchOptions = useMemo(() => {
    if (!selectedCustomer) return [];

    const unique = Array.from(
      new Set(
        assets
          .filter((asset) => String(asset.Customer_Name || '') === String(selectedCustomer))
          .map((asset) => asset.Branch)
          .filter(Boolean)
      )
    );

    return sortListItems(unique, (item) => item, listSortMode);
  }, [assets, selectedCustomer, listSortMode]);

  const scopedAssets = useMemo(() => {
    if (!selectedCustomer || !selectedBranch) return [];

    return assets.filter((asset) =>
      String(asset.Customer_Name || '') === String(selectedCustomer) &&
      String(asset.Branch || '') === String(selectedBranch)
    );
  }, [assets, selectedCustomer, selectedBranch]);

  const assetTypeCards = useMemo(() => {
    const counts = scopedAssets.reduce((acc, asset) => {
      const key = getAssetTypeKey(asset);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const orderedTypes = ['Desktop/AIO', 'Notebook/Laptop', 'Tablet', 'Printer', 'Projector', 'Server', 'Network'];

    const cards = orderedTypes
      .filter((key) => (counts[key] || 0) > 0 || key === 'Tablet')
      .map((key) => ({ key, count: counts[key] || 0 }));

    if (listSortMode === 'default') return cards;
    return sortListItems(cards, (item) => (
      listSortMode.startsWith('numeric') ? item.count : item.key
    ), listSortMode);
  }, [scopedAssets, listSortMode]);

  const filteredAssets = useMemo(() => {
    if (!selectedAssetType) return [];

    let items = scopedAssets.filter((asset) => getAssetTypeKey(asset) === selectedAssetType);

    if (!assetSearch.trim()) return items;

    const term = assetSearch.toLowerCase();
    return items.filter((asset) => {
      const serial = String(asset.Asset_Serial_Number || '').toLowerCase();
      const tag = String(asset.Asset_Tag_ID || '').toLowerCase();
      const item = String(asset.Item_Name || '').toLowerCase();
      const model = String(asset.Model || '').toLowerCase();
      const recipient = String(asset.Recipient_Name || '').toLowerCase();
      return serial.includes(term) || tag.includes(term) || item.includes(term) || model.includes(term) || recipient.includes(term);
    });
  }, [scopedAssets, selectedAssetType, assetSearch]);

  const tableAssets = useMemo(() => {
    const enhanced = filteredAssets.map((asset) => {
      const history = uatHistoryByAssetId[String(asset.Asset_ID)] || {};
      return {
        ...asset,
        uatCount: Number(history.count || 0),
        latestUatDate: history.latestGeneratedAt || null,
        latestRecipientName: history.latestRecipientName || '',
        latestFileName: history.latestAvailableFileName || history.latestFileName || '',
        latestDocumentId: history.latestAvailableDocumentId || history.latestDocumentId || ''
      };
    });

    const withFilter = showOnlyWithUAT
      ? enhanced.filter((asset) => asset.uatCount > 0)
      : enhanced;

    if (listSortMode === 'alpha-asc') {
      return sortListItems(withFilter, (asset) => asset.Asset_Serial_Number || asset.Item_Name || '', 'alpha-asc');
    }

    if (listSortMode === 'alpha-desc') {
      return sortListItems(withFilter, (asset) => asset.Asset_Serial_Number || asset.Item_Name || '', 'alpha-desc');
    }

    if (listSortMode === 'numeric-asc') {
      return sortListItems(withFilter, (asset) => asset.Asset_ID || 0, 'numeric-asc');
    }

    if (listSortMode === 'numeric-desc') {
      return sortListItems(withFilter, (asset) => asset.Asset_ID || 0, 'numeric-desc');
    }

    return withFilter.sort((a, b) => {
      const aTime = a.latestUatDate ? new Date(a.latestUatDate).getTime() : 0;
      const bTime = b.latestUatDate ? new Date(b.latestUatDate).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return String(a.Asset_Serial_Number || '').localeCompare(String(b.Asset_Serial_Number || ''));
    });
  }, [filteredAssets, showOnlyWithUAT, uatHistoryByAssetId, listSortMode]);

  const doneAssetTypesForSelectedCustomer = useMemo(() => {
    if (!selectedCustomer) return [];

    const typeCounts = assets
      .filter((asset) => String(asset.Customer_Name || '') === String(selectedCustomer))
      .filter((asset) => Boolean(globalUatHistoryByAssetId[String(asset.Asset_ID)]?.count > 0))
      .reduce((acc, asset) => {
        const typeKey = getAssetTypeKey(asset);
        acc[typeKey] = (acc[typeKey] || 0) + 1;
        return acc;
      }, {});

    const typedList = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => a.type.localeCompare(b.type));

    if (listSortMode === 'default') return typedList;
    return sortListItems(typedList, (item) => (
      listSortMode.startsWith('numeric') ? item.count : item.type
    ), listSortMode);
  }, [assets, selectedCustomer, globalUatHistoryByAssetId, listSortMode]);

  useEffect(() => {
    const fetchUatHistory = async () => {
      if (!selectedCustomer || !selectedBranch || !selectedAssetType) {
        setUatHistoryByAssetId({});
        return;
      }

      setLoadingHistory(true);
      try {
        const token = localStorage.getItem('authToken');
        const query = new URLSearchParams({
          customerName: selectedCustomer,
          branch: selectedBranch,
          assetType: selectedAssetType
        });

        const response = await fetch(`${API_URL}/uat/history-summary?${query.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch UAT history (${response.status})`);
        }

        const payload = await response.json();
        const nextMap = {};
        (Array.isArray(payload.data) ? payload.data : []).forEach((entry) => {
          if (!entry?.assetId) return;
          nextMap[String(entry.assetId)] = entry;
        });
        setUatHistoryByAssetId(nextMap);
      } catch (error) {
        console.error('Error fetching UAT history summary:', error);
        setUatHistoryByAssetId({});
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchUatHistory();
  }, [selectedCustomer, selectedBranch, selectedAssetType]);

  useEffect(() => {
    const fetchGlobalUatHistory = async () => {
      setLoadingGlobalHistory(true);
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/uat/history-summary`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch global UAT history (${response.status})`);
        }

        const payload = await response.json();
        const nextMap = {};
        (Array.isArray(payload.data) ? payload.data : []).forEach((entry) => {
          if (!entry?.assetId) return;
          nextMap[String(entry.assetId)] = entry;
        });
        setGlobalUatHistoryByAssetId(nextMap);
      } catch (error) {
        console.error('Error fetching global UAT history summary:', error);
        setGlobalUatHistoryByAssetId({});
      } finally {
        setLoadingGlobalHistory(false);
      }
    };

    fetchGlobalUatHistory();
  }, []);

  const pendingByCustomer = useMemo(() => {
    const summary = new Map();

    assets.forEach((asset) => {
      const customerName = String(asset.Customer_Name || 'Unknown Customer').trim() || 'Unknown Customer';
      const assetId = String(asset.Asset_ID || '').trim();
      const hasSubmitted = Boolean(globalUatHistoryByAssetId[assetId]?.count > 0);

      if (!summary.has(customerName)) {
        summary.set(customerName, {
          customerName,
          totalAssets: 0,
          submittedAssets: 0,
          pendingAssets: 0
        });
      }

      const customerSummary = summary.get(customerName);
      customerSummary.totalAssets += 1;
      if (hasSubmitted) {
        customerSummary.submittedAssets += 1;
      } else {
        customerSummary.pendingAssets += 1;
      }
    });

    return Array.from(summary.values())
      .filter((item) => item.pendingAssets > 0)
      .sort((a, b) => {
        if (b.pendingAssets !== a.pendingAssets) return b.pendingAssets - a.pendingAssets;
        return a.customerName.localeCompare(b.customerName);
      });
  }, [assets, globalUatHistoryByAssetId]);

  const totalPendingAssets = useMemo(
    () => pendingByCustomer.reduce((sum, item) => sum + item.pendingAssets, 0),
    [pendingByCustomer]
  );

  useEffect(() => {
    if (suppressDependentReset || lockDeepLinkedAsset) return;
    setSelectedBranch('');
    setSelectedAssetType('');
    setAssetSearch('');
    setSelectedAssetId('');
    setBulkAssetType('');
  }, [selectedCustomer, suppressDependentReset, lockDeepLinkedAsset]);

  useEffect(() => {
    if (suppressDependentReset || lockDeepLinkedAsset) return;
    setSelectedAssetType('');
    setAssetSearch('');
    setSelectedAssetId('');
  }, [selectedBranch, suppressDependentReset, lockDeepLinkedAsset]);

  useEffect(() => {
    if (suppressDependentReset || lockDeepLinkedAsset) return;
    setAssetSearch('');
    setSelectedAssetId('');
    setShowOnlyWithUAT(false);
  }, [selectedAssetType, suppressDependentReset, lockDeepLinkedAsset]);

  const selectedAsset = useMemo(
    () => assets.find((asset) => String(asset.Asset_ID) === String(selectedAssetId)),
    [assets, selectedAssetId]
  );

  const deepLinkedAssetId = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    return String(params.get('assetId') || '').trim();
  }, [location.search]);

  const isDeepLinkedAssetSelected = Boolean(
    deepLinkedAssetId && selectedAsset && String(selectedAsset.Asset_ID) === deepLinkedAssetId
  );

  const checklistTemplate = useMemo(() => getChecklistByCategory(selectedAsset), [selectedAsset]);

  useEffect(() => {
    if (!selectedAsset) {
      setRecipientName('');
      setRecipientDepartment('');
      setRecipientContact('');
      setPeripheralSelections([]);
      setResults({});
      setRemarks({});
      return;
    }

    setRecipientName(selectedAsset.Recipient_Name || '');
    setRecipientDepartment(selectedAsset.Department || '');
    setRecipientContact(selectedAsset.Contact_Number || selectedAsset.Contact_Number1 || '');
    setPeripheralSelections(buildPeripheralSelectionsFromAsset(selectedAsset));
    setResults(buildInitialResults(checklistTemplate));
    setRemarks({});
  }, [selectedAsset, checklistTemplate]);

  const selectedPeripheralItems = useMemo(
    () => peripheralSelections
      .map((entry) => ({
        name: String(entry.name || '').trim(),
        serial: String(entry.serial || '').trim(),
        checked: Boolean(entry.checked)
      }))
      .filter((entry) => entry.name && (entry.checked || entry.serial)),
    [peripheralSelections]
  );

  const togglePeripheralChecked = (index) => {
    setPeripheralSelections((previous) => previous.map((entry, entryIndex) => (
      entryIndex === index
        ? { ...entry, checked: !entry.checked }
        : entry
    )));
  };

  const updatePeripheralSerial = (index, value) => {
    setPeripheralSelections((previous) => previous.map((entry, entryIndex) => (
      entryIndex === index
        ? { ...entry, serial: value }
        : entry
    )));
  };

  const updatePeripheralName = (index, value) => {
    setPeripheralSelections((previous) => previous.map((entry, entryIndex) => (
      entryIndex === index
        ? { ...entry, name: value }
        : entry
    )));
  };

  const addCustomPeripheralOption = () => {
    setPeripheralSelections((previous) => ([
      ...previous,
      {
        name: '',
        checked: true,
        serial: '',
        isCustom: true
      }
    ]));
  };

  const totalChecklistItems = useMemo(
    () => checklistTemplate.reduce((total, section) => total + section.items.length, 0),
    [checklistTemplate]
  );

  const checkedCount = useMemo(
    () => Object.values(results).filter(Boolean).length,
    [results]
  );

  const allChecked = totalChecklistItems > 0 && checkedCount === totalChecklistItems;

  const toggleResult = (sectionIndex, itemIndex) => {
    const key = `${sectionIndex}-${itemIndex}`;
    setResults((previous) => ({
      ...previous,
      [key]: !previous[key]
    }));
  };

  const isSectionFullyChecked = (sectionIndex, itemCount) => {
    if (!itemCount) return false;
    return Array.from({ length: itemCount }).every((_, itemIndex) => Boolean(results[`${sectionIndex}-${itemIndex}`]));
  };

  const setSectionCheckedState = (sectionIndex, itemCount, checked) => {
    setResults((previous) => {
      const next = { ...previous };
      for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
        next[`${sectionIndex}-${itemIndex}`] = checked;
      }
      return next;
    });
  };

  const canOpenSignature = selectedAsset && allChecked && recipientName.trim();

  const handleGenerate = async (signatureBase64) => {
    if (!selectedAsset) return;

    const documentId = createClientDocumentId();

    const checklistSections = checklistTemplate.map((section, sectionIndex) => ({
      title: section.title,
      items: section.items.map((label, itemIndex) => {
        const key = `${sectionIndex}-${itemIndex}`;
        return {
          label,
          checked: Boolean(results[key]),
          remarks: remarks[key] || ''
        };
      })
    }));

    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

    const payload = {
      documentId,
      contractNo,
      formTitle: 'USER ACCEPTANCE TEST (UAT) FORM',
      categoryTitle: getFormCategoryTitle(selectedAsset),
      recipient: {
        name: recipientName,
        department: recipientDepartment,
        contact: recipientContact
      },
      asset: {
        Asset_ID: selectedAsset.Asset_ID,
        Asset_Serial_Number: selectedAsset.Asset_Serial_Number,
        Asset_Tag_ID: selectedAsset.Asset_Tag_ID,
        Item_Name: selectedAsset.Item_Name,
        Model: selectedAsset.Model,
        Category: selectedAsset.Category,
        Branch: selectedAsset.Branch,
        Customer_Name: selectedAsset.Customer_Name,
        accessories: selectedPeripheralItems.map((item) => item.name).join(', ') || '-',
        peripheralAssets: selectedPeripheralItems.map((item) => item.name).join(', ') || '-',
        peripheralSerialNumber: selectedPeripheralItems
          .map((item) => `${item.name}: ${item.serial || '-'}`)
          .join('; ') || '-',
        peripheralItems: selectedPeripheralItems
      },
      checklistSections,
      signature: signatureBase64,
      signedAt: new Date().toISOString(),
      submittedBy: userInfo.username || 'System User'
    };

    setSubmitting(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/uat/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Failed (${response.status})`);
      }

      const blob = await response.blob();
      const filename = `UAT_${documentId}_ASSET_${selectedAsset.Asset_ID}.pdf`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setShowSignature(false);
      setSuccessDialogMessage(`UAT form generated successfully for ${selectedAsset.Asset_Serial_Number || selectedAsset.Asset_ID}.`);
      setShowSuccessDialog(true);
    } catch (error) {
      console.error('Error generating UAT form:', error);
      alert(`Failed to generate UAT form: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewLatestUat = async (asset) => {
    const fileName = asset?.latestFileName;
    if (!fileName) {
      alert('No generated UAT form found for this asset yet.');
      return;
    }

    setViewingAssetId(String(asset.Asset_ID));
    try {
      const token = localStorage.getItem('authToken');
      const preferredName = asset?.latestDocumentId
        ? `UAT_${asset.latestDocumentId}_ASSET_${asset.Asset_ID}.pdf`
        : (asset?.latestFileName || `UAT_ASSET_${asset.Asset_ID}.pdf`);

      const tokenResponse = await fetch(`${API_URL}/uat/report-link/${encodeURIComponent(fileName)}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!tokenResponse.ok) {
        throw new Error(`Unable to prepare UAT view (${tokenResponse.status})`);
      }

      const tokenPayload = await tokenResponse.json();
      const viewToken = tokenPayload?.token;
      if (!viewToken) {
        throw new Error('Missing view token for UAT report');
      }

      const reportUrl = `${API_URL}/uat/report/${encodeURIComponent(fileName)}?vt=${encodeURIComponent(viewToken)}&downloadName=${encodeURIComponent(preferredName)}`;
      window.open(reportUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error opening latest UAT form:', error);
      alert(`Failed to open UAT form: ${error.message}`);
    } finally {
      setViewingAssetId('');
    }
  };

  const handleBulkDownload = async (mode) => {
    const isTypeMode = mode === 'type' || mode === 'asset-type';

    if (!selectedCustomer) {
      alert('Please select a customer first.');
      return;
    }

    if (isTypeMode && !bulkAssetType) {
      alert('Please select an asset type for type-level bulk download.');
      return;
    }

    setBulkDownloading(mode);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/uat/bulk-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          mode,
          customerName: selectedCustomer,
          assetType: isTypeMode ? bulkAssetType : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Failed (${response.status})`);
      }

      const blob = await response.blob();
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const safeCustomer = String(selectedCustomer).replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeType = String(bulkAssetType || 'TYPE').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fallbackName = isTypeMode
        ? `UAT_BULK_${safeCustomer}_${safeType}_${datePart}.zip`
        : `UAT_BULK_${safeCustomer}_${datePart}.zip`;

      const contentDisposition = response.headers.get('Content-Disposition') || '';
      const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const fileName = fileNameMatch?.[1] || fallbackName;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading bulk UAT forms:', error);
      alert(`Failed to download bulk UAT forms: ${error.message}`);
    } finally {
      setBulkDownloading('');
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
        borderBottom: '3px solid #667eea',
        padding: '0 20px 15px 20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ClipboardCheck size={28} color="#667eea" />
          <div>
            <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.4rem' }}>
              User Acceptance Test (UAT)
            </h2>
            <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
              Select an asset, verify checklist conditions, capture signature, and generate the UAT PDF.
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 8 }}>
          <strong style={{ fontSize: 14, color: '#1f2937' }}>Pending UAT by Customer</strong>
          <span style={{ fontSize: 12, color: '#4b5563' }}>
            {loadingGlobalHistory || loadingAssets
              ? 'Calculating...'
              : `${totalPendingAssets} pending asset(s)`}
          </span>
        </div>

        {loadingGlobalHistory || loadingAssets ? (
          <div style={{ fontSize: 13, color: '#6b7280' }}>Loading UAT pending summary...</div>
        ) : pendingByCustomer.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b7280' }}>All assets already have UAT forms submitted.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {pendingByCustomer.map((item) => (
              <div
                key={item.customerName}
                style={{
                  border: '1px solid #bfdbfe',
                  background: '#eff6ff',
                  borderRadius: 999,
                  padding: '6px 10px',
                  fontSize: 12,
                  color: '#1e3a8a'
                }}
              >
                <strong>{item.customerName}</strong>: {item.pendingAssets} pending
              </div>
            ))}
          </div>
        )}
      </div>

      {deepLinkedAssetId && (
        <div
          style={{
            marginBottom: 14,
            borderRadius: 12,
            border: `1px solid ${isDeepLinkedAssetSelected ? '#86efac' : '#fcd34d'}`,
            background: isDeepLinkedAssetSelected ? '#f0fdf4' : '#fffbeb',
            color: isDeepLinkedAssetSelected ? '#166534' : '#92400e',
            padding: '10px 12px',
            fontSize: 13,
            fontWeight: 600
          }}
        >
          {isDeepLinkedAssetSelected
            ? `Opened from selected asset: ${selectedAsset.Asset_Tag_ID || selectedAsset.Asset_Serial_Number || selectedAsset.Asset_ID}`
            : 'Opened from asset detail. Matching asset is being prepared from current filters...'}
        </div>
      )}

      <div style={cardStyle}>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 230 }}>
            <label style={labelStyle}>List Order</label>
            <select value={listSortMode} onChange={(event) => setListSortMode(event.target.value)} style={inputStyle}>
              <option value="default">Default</option>
              <option value="alpha-asc">A-Z</option>
              <option value="alpha-desc">Z-A</option>
              <option value="numeric-asc">Numeric (0-9)</option>
              <option value="numeric-desc">Numeric (9-0)</option>
            </select>
          </div>
        </div>

        <div style={{
          border: '1px solid #cbd5e1',
          borderRadius: 10,
          padding: 12,
          background: '#f8fafc',
          marginBottom: 14
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#0f172a', fontSize: '1rem' }}>Bulk UAT Form Download</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              type="button"
              onClick={() => handleBulkDownload('customer')}
              disabled={!selectedCustomer || bulkDownloading !== ''}
              style={{
                ...secondaryButtonStyle,
                borderColor: '#93c5fd',
                color: '#1d4ed8',
                opacity: !selectedCustomer || bulkDownloading !== '' ? 0.6 : 1,
                cursor: !selectedCustomer || bulkDownloading !== '' ? 'not-allowed' : 'pointer'
              }}
            >
              {bulkDownloading === 'customer'
                ? 'Preparing ZIP...'
                : 'Download All UAT Done (Selected Customer)'}
            </button>

            <button
              type="button"
              onClick={() => handleBulkDownload('asset-type')}
              disabled={!selectedCustomer || !bulkAssetType || bulkDownloading !== ''}
              style={{
                ...secondaryButtonStyle,
                borderColor: '#93c5fd',
                color: '#1d4ed8',
                opacity: !selectedCustomer || !bulkAssetType || bulkDownloading !== '' ? 0.6 : 1,
                cursor: !selectedCustomer || !bulkAssetType || bulkDownloading !== '' ? 'not-allowed' : 'pointer'
              }}
            >
              {bulkDownloading === 'asset-type'
                ? 'Preparing ZIP...'
                : 'Download All UAT Done (Selected Asset Type)'}
            </button>
          </div>

          <div style={{ marginTop: 10 }}>
            <label style={labelStyle}>Asset Type (under selected customer, with UAT done)</label>
            <select
              value={bulkAssetType}
              onChange={(event) => setBulkAssetType(event.target.value)}
              style={inputStyle}
              disabled={!selectedCustomer || bulkDownloading !== ''}
            >
              <option value="">Choose asset type for option 2</option>
              {doneAssetTypesForSelectedCustomer.map((item) => (
                <option key={item.type} value={item.type}>
                  {item.type} ({item.count} UAT done)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={labelStyle}>1. Select Client</label>
            <select
              value={selectedCustomer}
              onChange={(event) => {
                setLockDeepLinkedAsset(false);
                setSelectedCustomer(event.target.value);
              }}
              style={inputStyle}
              disabled={loadingAssets}
            >
              <option value="">{loadingAssets ? 'Loading clients...' : 'Choose client'}</option>
              {customerOptions.map((customer) => (
                <option key={customer} value={customer}>{customer}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>2. Select Branch</label>
            <select
              value={selectedBranch}
              onChange={(event) => {
                setLockDeepLinkedAsset(false);
                setSelectedBranch(event.target.value);
              }}
              style={inputStyle}
              disabled={loadingAssets || !selectedCustomer}
            >
              <option value="">{selectedCustomer ? 'Choose branch' : 'Select client first'}</option>
              {branchOptions.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedCustomer && selectedBranch && (
          <>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>3. Select Asset Type</label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 10
              }}>
                {assetTypeCards.map((typeCard) => {
                  const isActive = selectedAssetType === typeCard.key;
                  return (
                    <button
                      type="button"
                      key={typeCard.key}
                      onClick={() => {
                        setLockDeepLinkedAsset(false);
                        setSelectedAssetType(typeCard.key);
                      }}
                      style={{
                        border: `1px solid ${isActive ? '#2563eb' : '#d1d5db'}`,
                        background: isActive ? '#dbeafe' : '#fff',
                        color: '#111827',
                        borderRadius: 10,
                        padding: '10px 12px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        opacity: typeCard.count === 0 ? 0.7 : 1
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{typeCard.key}</div>
                      <div style={{ fontSize: 12, color: '#4b5563', marginTop: 3 }}>{typeCard.count} asset(s)</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedAssetType && (
              <div style={{ marginTop: 16 }}>
                <label style={labelStyle}>4. Search Asset</label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: '#6b7280' }} />
                  <input
                    value={assetSearch}
                    onChange={(event) => setAssetSearch(event.target.value)}
                    placeholder="Search by serial, tag, item, model or recipient name"
                    style={{ ...inputStyle, paddingLeft: 34 }}
                  />
                </div>

                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ color: '#4b5563', fontSize: 13 }}>
                    {loadingHistory ? 'Loading UAT tracking data...' : `${tableAssets.length} asset(s) shown`}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1f2937', fontSize: 13, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={showOnlyWithUAT}
                      onChange={(event) => setShowOnlyWithUAT(event.target.checked)}
                    />
                    Only with UAT
                  </label>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    border: '1px solid #d1d5db',
                    borderRadius: 10,
                    maxHeight: 320,
                    overflowY: 'auto',
                    background: '#fff'
                  }}
                >
                  {tableAssets.length === 0 ? (
                    <div style={{ padding: '12px 14px', color: '#6b7280' }}>
                      No assets found for this filter.
                    </div>
                  ) : (
                    <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'linear-gradient(90deg, #1e3a8a, #4f46e5)', color: '#fff' }}>
                          <th style={tableHeaderStyle}>#</th>
                          <th style={tableHeaderStyle}>Tag ID</th>
                          <th style={tableHeaderStyle}>Item Name</th>
                          <th style={tableHeaderStyle}>Serial Number</th>
                          <th style={tableHeaderStyle}>Recipient</th>
                          <th style={tableHeaderStyle}>Latest UAT Date</th>
                          <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Action</th>
                          <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>View UAT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableAssets.map((asset, index) => {
                          const isActive = String(selectedAssetId) === String(asset.Asset_ID);
                          return (
                            <tr key={asset.Asset_ID} style={{ background: isActive ? '#dbeafe' : '#fff' }}>
                              <td style={tableCellStyle}>{index + 1}</td>
                              <td style={tableCellStyle}>{asset.Asset_Tag_ID || '-'}</td>
                              <td style={{ ...tableCellStyle, fontWeight: 600 }}>{asset.Item_Name || '-'}</td>
                              <td style={tableCellStyle}>{asset.Asset_Serial_Number || '-'}</td>
                              <td style={tableCellStyle}>{asset.Recipient_Name || asset.latestRecipientName || '-'}</td>
                              <td style={tableCellStyle}>{formatHistoryDate(asset.latestUatDate)}</td>
                              <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedAssetId(String(asset.Asset_ID))}
                                  style={{
                                    border: `1px solid ${isActive ? '#16a34a' : '#93c5fd'}`,
                                    background: isActive ? '#dcfce7' : '#eff6ff',
                                    color: isActive ? '#166534' : '#1d4ed8',
                                    borderRadius: 8,
                                    padding: '6px 10px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  {isActive ? 'Selected' : 'Choose'}
                                </button>
                              </td>
                              <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleViewLatestUat(asset)}
                                  disabled={!asset.latestFileName || viewingAssetId === String(asset.Asset_ID)}
                                  style={{
                                    border: '1px solid #cbd5e1',
                                    background: asset.latestFileName ? '#f8fafc' : '#f3f4f6',
                                    color: asset.latestFileName ? '#1f2937' : '#9ca3af',
                                    borderRadius: 8,
                                    padding: '6px 10px',
                                    fontWeight: 700,
                                    cursor: asset.latestFileName ? 'pointer' : 'not-allowed',
                                    opacity: viewingAssetId === String(asset.Asset_ID) ? 0.7 : 1
                                  }}
                                  title={asset.latestFileName ? 'Open latest generated UAT form' : 'No UAT form available yet'}
                                >
                                  {viewingAssetId === String(asset.Asset_ID) ? 'Opening...' : 'View'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {selectedAsset && (
          <>
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Department</label>
                <input value={recipientDepartment} onChange={(event) => setRecipientDepartment(event.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Contact Number</label>
                <input value={recipientContact} onChange={(event) => setRecipientContact(event.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Contract No</label>
                <input value={contractNo} onChange={(event) => setContractNo(event.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginTop: 16, padding: 12, border: '1px solid #d1d5db', borderRadius: 10, background: '#f9fafb' }}>
              <strong>Hardware:</strong> {selectedAsset.Item_Name} ({selectedAsset.Model})<br />
              <strong>Asset Tag:</strong> {selectedAsset.Asset_Tag_ID || '-'}<br />
              <strong>Serial Number:</strong> {selectedAsset.Asset_Serial_Number || '-'}
            </div>

            <div style={{ marginTop: 14, border: '1px solid #d1d5db', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: '#eff6ff', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <strong style={{ color: '#1f2937' }}>Peripheral Assets</strong>
                  <div style={{ color: '#4b5563', fontSize: 12, marginTop: 2 }}>
                    Existing peripherals for this asset are auto-selected. You can adjust and add more before generating the form.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addCustomPeripheralOption}
                  style={{
                    border: '1px solid #93c5fd',
                    background: '#fff',
                    color: '#1d4ed8',
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  + Add Other Peripheral
                </button>
              </div>

              <div style={{ padding: 10, background: '#fff' }}>
                {peripheralSelections.length === 0 ? (
                  <div style={{ color: '#6b7280', fontSize: 13 }}>No peripheral options available.</div>
                ) : (
                  peripheralSelections.map((entry, index) => (
                    <div
                      key={`peripheral-${index}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 1fr 1fr',
                        gap: 10,
                        alignItems: 'center',
                        padding: '8px 0',
                        borderTop: index === 0 ? 'none' : '1px solid #f1f5f9'
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#111827', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(entry.checked)}
                          onChange={() => togglePeripheralChecked(index)}
                        />
                        Select
                      </label>

                      {entry.isCustom ? (
                        <input
                          value={entry.name}
                          onChange={(event) => updatePeripheralName(index, event.target.value)}
                          placeholder="Peripheral name (e.g. HDMI Cable)"
                          style={inputStyle}
                        />
                      ) : (
                        <input
                          value={entry.name}
                          readOnly
                          style={{ ...inputStyle, background: '#f8fafc', color: '#334155' }}
                        />
                      )}

                      <input
                        value={entry.serial}
                        onChange={(event) => updatePeripheralSerial(index, event.target.value)}
                        placeholder="Peripheral serial no. (optional)"
                        style={inputStyle}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, color: '#111827' }}>Verification Activity</h3>
                <span style={{ color: '#1d4ed8', fontWeight: 600 }}>{checkedCount}/{totalChecklistItems} checked</span>
              </div>

              {checklistTemplate.map((section, sectionIndex) => (
                <div key={section.title} style={{ border: '1px solid #d1d5db', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
                  <div style={{ background: '#eef2ff', padding: '10px 12px', color: '#1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700 }}>{section.title}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const allCheckedInSection = isSectionFullyChecked(sectionIndex, section.items.length);
                        setSectionCheckedState(sectionIndex, section.items.length, !allCheckedInSection);
                      }}
                      style={{
                        border: '1px solid #93c5fd',
                        background: '#fff',
                        color: '#1d4ed8',
                        borderRadius: 999,
                        padding: '5px 10px',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      {isSectionFullyChecked(sectionIndex, section.items.length) ? 'Uncheck All' : 'Check All'}
                    </button>
                  </div>
                  {section.items.map((item, itemIndex) => {
                    const key = `${sectionIndex}-${itemIndex}`;
                    const isChecked = Boolean(results[key]);
                    return (
                      <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 180px', gap: 10, alignItems: 'center', padding: '9px 12px', borderTop: '1px solid #e5e7eb' }}>
                        <span style={{ color: '#111827' }}>{item}</span>
                        <button
                          type="button"
                          onClick={() => toggleResult(sectionIndex, itemIndex)}
                          style={{
                            border: '1px solid',
                            borderColor: isChecked ? '#16a34a' : '#9ca3af',
                            background: isChecked ? '#dcfce7' : '#fff',
                            color: isChecked ? '#166534' : '#374151',
                            borderRadius: 999,
                            padding: '6px 8px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {isChecked ? 'Checked /' : 'Mark Check'}
                        </button>
                        <input
                          placeholder="Remarks (optional)"
                          value={remarks[key] || ''}
                          onChange={(event) => setRemarks((previous) => ({ ...previous, [key]: event.target.value }))}
                          style={inputStyle}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                type="button"
                style={{
                  ...primaryButtonStyle,
                  opacity: canOpenSignature ? 1 : 0.55,
                  cursor: canOpenSignature ? 'pointer' : 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8
                }}
                disabled={!canOpenSignature}
                onClick={() => setShowSignature(true)}
                title={!allChecked ? 'Please check all conditions before submitting' : ''}
              >
                <PenTool size={16} /> Sign & Generate UAT Form
              </button>
            </div>
          </>
        )}
      </div>

      <SignatureDialog
        isOpen={showSignature}
        onClose={() => setShowSignature(false)}
        onConfirm={handleGenerate}
        loading={submitting}
      />

      <SuccessDialog
        isOpen={showSuccessDialog}
        onClose={() => setShowSuccessDialog(false)}
        message={successDialogMessage}
      />

      {!selectedAsset && (
        <div style={{ ...cardStyle, marginTop: 12, textAlign: 'center', color: '#6b7280' }}>
          <CheckCircle2 size={22} style={{ marginBottom: 6 }} />
          {!selectedCustomer
            ? 'Select a client to start UAT.'
            : !selectedBranch
              ? 'Select a branch to continue.'
              : !selectedAssetType
                ? 'Select an asset type to load the asset list.'
                : 'Select one asset to start the UAT checklist.'}
        </div>
      )}

        </div>
    </div>
  );
};

const cardStyle = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  padding: 16,
  boxShadow: '0 6px 16px rgba(0, 0, 0, 0.06)'
};

const inputStyle = {
  width: '100%',
  height: 38,
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  padding: '0 10px',
  fontSize: 14
};

const labelStyle = {
  display: 'block',
  marginBottom: 6,
  color: '#374151',
  fontWeight: 600,
  fontSize: 13
};

const tableHeaderStyle = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 13,
  whiteSpace: 'nowrap'
};

const tableCellStyle = {
  padding: '9px 12px',
  borderTop: '1px solid #e5e7eb',
  color: '#111827',
  fontSize: 13,
  whiteSpace: 'nowrap'
};

const primaryButtonStyle = {
  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '10px 16px',
  fontWeight: 700
};

const secondaryButtonStyle = {
  background: '#fff',
  color: '#1f2937',
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  padding: '10px 16px',
  fontWeight: 600
};

const closeButtonStyle = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: '#6b7280'
};

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(15, 23, 42, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
  padding: 20
};

const dialogStyle = {
  background: '#fff',
  borderRadius: 14,
  padding: 18,
  width: 'min(680px, 100%)',
  boxShadow: '0 15px 35px rgba(0,0,0,0.25)'
};

export default UAT;
