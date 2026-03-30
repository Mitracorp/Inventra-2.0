import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { API_URL } from '../config/api';
import usePageTitle from '../hooks/usePageTitle';
import { ArrowLeft, Calendar, CheckCircle, AlertTriangle, FileText, Package, Search } from 'lucide-react';

const SearchableSelect = ({ value, options, onChange, placeholder }) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        fontSize: '0.95rem',
        background: 'white'
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={String(opt.value)} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};

const pageMeta = {
  total: {
    title: 'All PM Records',
    description: 'All preventive maintenance records',
    icon: <FileText size={20} color="#4f46e5" />
  },
  month: {
    title: 'PM This Month',
    description: 'PM records created in the current month',
    icon: <Calendar size={20} color="#10b981" />
  },
  unsigned: {
    title: 'Unsigned PM1 & PM2',
    description: 'PM1/PM2 records pending recipient signature/completion',
    icon: <AlertTriangle size={20} color="#f59e0b" />
  },
  'one-pm': {
    title: 'Only One PM',
    description: 'Assets with exactly one PM record',
    icon: <FileText size={20} color="#ec4899" />
  },
  'no-pm': {
    title: 'No PM Done',
    description: 'Assets with no PM records yet',
    icon: <Package size={20} color="#6b7280" />
  }
};

const PMOverviewPage = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const meta = pageMeta[type] || pageMeta.total;
  usePageTitle(meta.title);

  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(searchParams.get('customer') || '');
  const [selectedBranch, setSelectedBranch] = useState(searchParams.get('branch') || '');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadCustomers = async () => {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) return;
      const data = await response.json();
      const normalized = (data || []).map((c) => ({
        value: c.Customer_ID,
        label: `${c.Customer_Name} (${c.Customer_Ref_Number})`
      }));
      setCustomers(normalized);
    };

    loadCustomers();
  }, []);

  useEffect(() => {
    const loadBranches = async () => {
      if (!selectedCustomer) {
        setBranches([]);
        setSelectedBranch('');
        setRecords([]);
        return;
      }

      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm/customers/${selectedCustomer}/branches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) return;
      const data = await response.json();
      setBranches((data || []).map((b) => ({ value: b, label: b })));

      if (selectedBranch && !(data || []).includes(selectedBranch)) {
        setSelectedBranch('');
      }
    };

    loadBranches();
  }, [selectedCustomer]);

  useEffect(() => {
    const loadRecords = async () => {
      if (!selectedCustomer || !selectedBranch) {
        setRecords([]);
        return;
      }

      setLoading(true);
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/pm/filter?customerId=${selectedCustomer}&branch=${encodeURIComponent(selectedBranch)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch PM records');
        const data = await response.json();
        setRecords(Array.isArray(data) ? data : []);
      } catch (error) {
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, [selectedCustomer, selectedBranch]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCustomer) params.set('customer', selectedCustomer);
    if (selectedBranch) params.set('branch', selectedBranch);
    setSearchParams(params, { replace: true });
  }, [selectedCustomer, selectedBranch, setSearchParams]);

  const prepared = useMemo(() => {
    const byAsset = new Map();

    records.forEach((record) => {
      const assetId = record.Asset_ID;
      if (!assetId) return;

      if (!byAsset.has(assetId)) {
        byAsset.set(assetId, {
          asset: {
            Asset_ID: record.Asset_ID,
            Asset_Tag_ID: record.Asset_Tag_ID,
            Item_Name: record.Item_Name,
            Asset_Serial_Number: record.Asset_Serial_Number,
            Category: record.Category,
            Recipient_Name: record.Recipient_Name,
            Department: record.Department
          },
          pms: []
        });
      }

      if (record.PM_ID != null) {
        byAsset.get(assetId).pms.push(record);
      }
    });

    const pmRecords = [];
    const assets = [];

    byAsset.forEach(({ asset, pms }) => {
      const sorted = pms.slice().sort((a, b) => new Date(a.PM_Date) - new Date(b.PM_Date));
      sorted.forEach((pm, index) => {
        pmRecords.push({
          ...pm,
          PM_Sequence: index + 1,
          asset
        });
      });

      assets.push({
        ...asset,
        pmCount: sorted.length,
        latestPMDate: sorted.length > 0 ? sorted[sorted.length - 1].PM_Date : null,
        pms: sorted
      });
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let items = [];
    let mode = 'pm';

    if (type === 'total') {
      items = pmRecords;
    } else if (type === 'month') {
      items = pmRecords.filter((pm) => {
        const d = pm.PM_Date ? new Date(pm.PM_Date) : null;
        return d && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      });
    } else if (type === 'unsigned') {
      items = pmRecords.filter((pm) => pm.PM_Sequence <= 2 && (pm.PM_Status || '').toLowerCase() !== 'completed');
    } else if (type === 'one-pm') {
      mode = 'asset';
      items = assets.filter((a) => a.pmCount === 1);
    } else if (type === 'no-pm') {
      mode = 'asset';
      items = assets.filter((a) => a.pmCount === 0);
    } else {
      items = pmRecords;
    }

    const q = search.trim().toLowerCase();
    if (q) {
      items = items.filter((item) => {
        const target = mode === 'pm' ? item.asset : item;
        return (
          (target.Asset_Tag_ID || '').toLowerCase().includes(q) ||
          (target.Item_Name || '').toLowerCase().includes(q) ||
          (target.Asset_Serial_Number || '').toLowerCase().includes(q) ||
          (target.Recipient_Name || '').toLowerCase().includes(q) ||
          (target.Department || '').toLowerCase().includes(q)
        );
      });
    }

    return { mode, items };
  }, [records, search, type]);

  return (
    <div style={{ padding: '0 20px 24px 20px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '18px',
        borderBottom: '3px solid #27ae60',
        paddingBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {meta.icon}
          <div>
            <h2 style={{ margin: 0, color: '#1f2937', fontSize: '1.4rem' }}>{meta.title}</h2>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '0.95rem' }}>{meta.description}</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/maintenance')}
          style={{
            border: 'none',
            borderRadius: '8px',
            padding: '10px 14px',
            fontWeight: '600',
            color: 'white',
            background: '#34495e',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <ArrowLeft size={16} />
          Back To PM Dashboard
        </button>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <SearchableSelect
            value={selectedCustomer}
            options={customers}
            onChange={setSelectedCustomer}
            placeholder="Select customer"
          />
          <SearchableSelect
            value={selectedBranch}
            options={branches}
            onChange={setSelectedBranch}
            placeholder="Select branch"
          />
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', top: '50%', left: '10px', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search asset tag, item, serial, recipient/client..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px 10px 34px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '0.95rem'
              }}
            />
          </div>
        </div>
      </div>

      <div className="card">
        {!selectedCustomer || !selectedBranch ? (
          <div style={{ padding: '40px 10px', textAlign: 'center', color: '#6b7280' }}>
            Select customer and branch to view records.
          </div>
        ) : loading ? (
          <div style={{ padding: '40px 10px', textAlign: 'center', color: '#6b7280' }}>
            Loading records...
          </div>
        ) : prepared.items.length === 0 ? (
          <div style={{ padding: '40px 10px', textAlign: 'center', color: '#6b7280' }}>
            No records found for this view.
          </div>
        ) : prepared.mode === 'pm' ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Asset Tag</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Item</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Recipient</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>PM</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {prepared.items.map((pm) => (
                  <tr key={pm.PM_ID} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '10px' }}>{pm.asset.Asset_Tag_ID || '-'}</td>
                    <td style={{ padding: '10px' }}>{pm.asset.Item_Name || '-'}</td>
                    <td style={{ padding: '10px' }}>{pm.asset.Recipient_Name || '-'}</td>
                    <td style={{ padding: '10px', fontWeight: 700 }}>PM{pm.PM_Sequence}</td>
                    <td style={{ padding: '10px' }}>{pm.PM_Date ? new Date(pm.PM_Date).toLocaleDateString('en-MY') : '-'}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '999px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background: (pm.PM_Status || '').toLowerCase() === 'completed' ? '#dcfce7' : '#ffedd5',
                        color: (pm.PM_Status || '').toLowerCase() === 'completed' ? '#166534' : '#9a3412'
                      }}>
                        {pm.PM_Status || 'In-Process'}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <button
                        onClick={() => navigate(`/maintenance/detail/${pm.PM_ID}`)}
                        style={{
                          border: 'none',
                          borderRadius: '6px',
                          padding: '7px 10px',
                          background: '#2563eb',
                          color: 'white',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        Open PM Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Asset Tag</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Item</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Recipient</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Serial Number</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>PM Count</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Latest PM Date</th>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {prepared.items.map((asset) => (
                  <tr key={asset.Asset_ID} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '10px' }}>{asset.Asset_Tag_ID || '-'}</td>
                    <td style={{ padding: '10px' }}>{asset.Item_Name || '-'}</td>
                    <td style={{ padding: '10px' }}>{asset.Recipient_Name || '-'}</td>
                    <td style={{ padding: '10px' }}>{asset.Asset_Serial_Number || '-'}</td>
                    <td style={{ padding: '10px', fontWeight: 700 }}>{asset.pmCount}</td>
                    <td style={{ padding: '10px' }}>{asset.latestPMDate ? new Date(asset.latestPMDate).toLocaleDateString('en-MY') : '-'}</td>
                    <td style={{ padding: '10px' }}>
                      {asset.pms.length > 0 ? (
                        <button
                          onClick={() => navigate(`/maintenance/detail/${asset.pms[asset.pms.length - 1].PM_ID}`)}
                          style={{
                            border: 'none',
                            borderRadius: '6px',
                            padding: '7px 10px',
                            background: '#2563eb',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          Open Latest PM
                        </button>
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Create from PM dashboard</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {type === 'unsigned' && prepared.mode === 'pm' && prepared.items.length > 0 && (
        <div style={{ marginTop: '12px', color: '#7c2d12', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={16} />
          Open each PM detail to complete recipient signing and final submission.
        </div>
      )}
    </div>
  );
};

export default PMOverviewPage;
