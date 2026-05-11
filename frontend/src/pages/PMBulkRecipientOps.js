import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckSquare, PenTool, Search, Users } from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';
import SignatureModal from '../components/SignatureModal';
import { API_URL } from '../config/api';
import toast from '../utils/toast';

const PMBulkRecipientOps = () => {
  usePageTitle('Bulk PM & Sign');
  const navigate = useNavigate();
  const location = useLocation();

  const [recipients, setRecipients] = useState([]);
  const [recipientId, setRecipientId] = useState('');
  const [recipientData, setRecipientData] = useState(null);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [loadingRecipientData, setLoadingRecipientData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedPmIds, setSelectedPmIds] = useState([]);
  const [showBulkSignModal, setShowBulkSignModal] = useState(false);
  const [submittingBulkSign, setSubmittingBulkSign] = useState(false);

  const token = localStorage.getItem('authToken');

  useEffect(() => {
    const fetchRecipients = async () => {
      try {
        setLoadingRecipients(true);
        const response = await fetch(`${API_URL}/pm/recipients-summary`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Failed to load recipients');
        }

        setRecipients(payload.data || []);
      } catch (error) {
        toast.error(error.message || 'Failed to load recipients');
      } finally {
        setLoadingRecipients(false);
      }
    };

    if (token) {
      fetchRecipients();
    }
  }, [token]);

  useEffect(() => {
    const fetchRecipientData = async () => {
      if (!recipientId) {
        setRecipientData(null);
        setSelectedPmIds([]);
        return;
      }

      try {
        setLoadingRecipientData(true);
        const response = await fetch(`${API_URL}/pm/recipient/${recipientId}/assets`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Failed to load recipient assets');
        }

        setRecipientData(payload.data);
        setSelectedPmIds([]);
      } catch (error) {
        toast.error(error.message || 'Failed to load recipient data');
      } finally {
        setLoadingRecipientData(false);
      }
    };

    if (token) {
      fetchRecipientData();
    }
  }, [recipientId, token]);

  const filteredAssets = useMemo(() => {
    const assets = recipientData?.assets || [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return assets;

    return assets.filter((asset) => {
      return (
        String(asset.Asset_Tag_ID || '').toLowerCase().includes(q) ||
        String(asset.Asset_Serial_Number || '').toLowerCase().includes(q) ||
        String(asset.Item_Name || '').toLowerCase().includes(q) ||
        String(asset.Category || '').toLowerCase().includes(q)
      );
    });
  }, [recipientData, searchQuery]);

  const filteredUnsignedPMs = useMemo(() => {
    const rows = recipientData?.unsignedPMs || [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => {
      return (
        String(row.Asset_Tag_ID || '').toLowerCase().includes(q) ||
        String(row.Asset_Serial_Number || '').toLowerCase().includes(q) ||
        String(row.Item_Name || '').toLowerCase().includes(q)
      );
    });
  }, [recipientData, searchQuery]);

  const togglePmSelection = (pmId) => {
    setSelectedPmIds((prev) => {
      if (prev.includes(pmId)) {
        return prev.filter((id) => id !== pmId);
      }
      return [...prev, pmId];
    });
  };
  const toggleSelectAllUnsignedPMs = () => {
    const visibleIds = filteredUnsignedPMs.map((pm) => Number(pm.PM_ID));
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedPmIds.includes(id));
    setSelectedPmIds(allSelected ? [] : visibleIds);
  };

  const handleConfirmBulkSign = async (payload) => {
    try {
      setSubmittingBulkSign(true);
      const signatureBase64 = typeof payload === 'string' ? payload : payload.signature;
      const bagiPihak = (typeof payload === 'object' && payload.onBehalf && payload.name)
        ? `${payload.name}\\${payload.department || '-'}`
        : undefined;

      const response = await fetch(`${API_URL}/pm/bulk-sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          pmIds: selectedPmIds,
          signature: signatureBase64,
          ...(bagiPihak ? { bagiPihak } : {})
        })
      });

      const payloadData = await response.json();
      if (!response.ok || !payloadData.success) {
        throw new Error(payloadData.error || 'Bulk signing failed');
      }

      toast.success(payloadData.message || 'Bulk sign completed');
      setShowBulkSignModal(false);

      const refreshResponse = await fetch(`${API_URL}/pm/recipient/${recipientId}/assets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const refreshPayload = await refreshResponse.json();
      if (refreshResponse.ok && refreshPayload.success) {
        setRecipientData(refreshPayload.data);
        setSelectedPmIds([]);
      }
    } catch (error) {
      toast.error(error.message || 'Bulk sign failed');
      throw error;
    } finally {
      setSubmittingBulkSign(false);
    }
  };

  const openPmDetail = (pmId) => {
    const fromPath = `${location.pathname}${location.search}`;
    const detailPath = `/maintenance/detail/${pmId}?returnTo=${encodeURIComponent(fromPath)}`;
    navigate(detailPath, { state: { from: fromPath } });
  };

  return (
    <div style={{ padding: '0 20px 24px 20px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '18px',
        borderBottom: '3px solid #2563eb',
        paddingBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Users size={24} color="#2563eb" />
          <div>
            <h2 style={{ margin: 0, color: '#1f2937', fontSize: '1.4rem' }}>Bulk PM & Bulk Sign By Recipient</h2>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '0.95rem' }}>
              Select one recipient to handle PM and signing for all assigned assets in one place.
            </p>
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

      <div className="card" style={{ marginBottom: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <select
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.95rem',
              background: 'white'
            }}
          >
            <option value="">Select recipient</option>
            {recipients.map((recipient) => (
              <option key={recipient.Recipients_ID} value={recipient.Recipients_ID}>
                {recipient.Recipient_Name} ({recipient.Department || 'No Department'}) - {recipient.Asset_Count} asset(s)
              </option>
            ))}
          </select>

          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', top: '50%', left: '10px', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search asset tag, serial, item..."
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

        {loadingRecipients && (
          <div style={{ marginTop: '10px', color: '#6b7280' }}>Loading recipients...</div>
        )}
      </div>

      {recipientData && (
        <>
          <div className="card" style={{ marginBottom: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
              <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '12px' }}>
                <div style={{ color: '#1e3a8a', fontSize: '0.85rem', fontWeight: 700 }}>Recipient</div>
                <div style={{ color: '#1f2937', fontSize: '1rem', fontWeight: 700 }}>{recipientData.recipient?.Recipient_Name}</div>
              </div>
              <div style={{ background: '#ecfeff', borderRadius: '10px', padding: '12px' }}>
                <div style={{ color: '#0f766e', fontSize: '0.85rem', fontWeight: 700 }}>Assets</div>
                <div style={{ color: '#1f2937', fontSize: '1.4rem', fontWeight: 800 }}>{recipientData.assets?.length || 0}</div>
              </div>
              <div style={{ background: '#fff7ed', borderRadius: '10px', padding: '12px' }}>
                <div style={{ color: '#9a3412', fontSize: '0.85rem', fontWeight: 700 }}>Unsigned PMs</div>
                <div style={{ color: '#1f2937', fontSize: '1.4rem', fontWeight: 800 }}>{recipientData.unsignedPMs?.length || 0}</div>
              </div>
            </div>
          </div>

          {/* Bulk PM Creation removed - only bulk signing is available now */}

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, color: '#1f2937', fontSize: '1.05rem' }}>Bulk Sign Unsigned PMs</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={toggleSelectAllUnsignedPMs}
                  style={{ border: '1px solid #cbd5e1', background: 'white', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', fontWeight: 600 }}
                >
                  <CheckSquare size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  {filteredUnsignedPMs.length > 0 && filteredUnsignedPMs.every((pm) => selectedPmIds.includes(Number(pm.PM_ID))) ? 'Unselect All' : 'Select All'}
                </button>
                <button
                  onClick={() => setShowBulkSignModal(true)}
                  disabled={selectedPmIds.length === 0 || submittingBulkSign}
                  style={{
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'white',
                    background: selectedPmIds.length === 0 || submittingBulkSign ? '#94a3b8' : '#16a34a',
                    cursor: selectedPmIds.length === 0 || submittingBulkSign ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <PenTool size={14} />
                  Bulk Sign Selected PMs
                </button>
              </div>
            </div>

            {loadingRecipientData ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>Loading recipient records...</div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: '320px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Select</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Asset Tag</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Item</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>PM</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnsignedPMs.map((pm) => {
                      const id = Number(pm.PM_ID);
                      return (
                        <tr key={pm.PM_ID} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '8px' }}>
                            <input
                              type="checkbox"
                              checked={selectedPmIds.includes(id)}
                              onChange={() => togglePmSelection(id)}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>{pm.Asset_Tag_ID || '-'}</td>
                          <td style={{ padding: '8px' }}>{pm.Item_Name || '-'}</td>
                          <td style={{ padding: '8px', fontWeight: 700 }}>PM{pm.PM_Sequence}</td>
                          <td style={{ padding: '8px' }}>{pm.PM_Date || '-'}</td>
                          <td style={{ padding: '8px' }}>
                            <button
                              onClick={() => openPmDetail(pm.PM_ID)}
                              style={{
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 10px',
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
                      );
                    })}
                    {filteredUnsignedPMs.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '18px', color: '#6b7280' }}>
                          No unsigned PM records for this recipient.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <SignatureModal
        isOpen={showBulkSignModal}
        onClose={() => setShowBulkSignModal(false)}
        onConfirm={handleConfirmBulkSign}
        pmId={`Bulk x${selectedPmIds.length}`}
      />
    </div>
  );
};

export default PMBulkRecipientOps;
