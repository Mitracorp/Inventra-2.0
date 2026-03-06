import React, { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import { Award, Plus, Eye, Trash2, AlertCircle, Loader as LoaderIcon, Edit2 } from 'lucide-react';
import { API_URL } from '../config/api';

const SolutionPrincipal = () => {
  usePageTitle('Solution Principal');
  const navigate = useNavigate();
  const [solutionPrincipals, setSolutionPrincipals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'view'
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    SP_Name: ''
  });

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
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.3s ease'
  };

  const handleHeaderButtonHover = (event, isHover) => {
    const target = event.currentTarget;
    target.style.transform = isHover ? 'translateY(-2px)' : 'translateY(0)';
    target.style.boxShadow = isHover
      ? '0 6px 20px rgba(0, 0, 0, 0.25)'
      : '0 4px 15px rgba(0, 0, 0, 0.2)';
  };

  // Fetch solution principals
  useEffect(() => {
    fetchSolutionPrincipals();
  }, []);

  const fetchSolutionPrincipals = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/solution-principals`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setSolutionPrincipals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching solution principals:', err);
      setError('Failed to load solution principals');
      setSolutionPrincipals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setModalMode('add');
    setFormData({
      SP_Name: ''
    });
    setShowModal(true);
  };

  const handleView = (item) => {
    setModalMode('view');
    setSelectedItem(item);
    setFormData(item);
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    
    if (!formData.SP_Name.trim()) {
      setError('Solution Principal Name is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const method = modalMode === 'add' ? 'POST' : 'PUT';
      const url = modalMode === 'add' 
        ? `${API_URL}/solution-principals`
        : `${API_URL}/solution-principals/${selectedItem.SP_ID}`;

      const token = localStorage.getItem('authToken');
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          SP_Name: formData.SP_Name.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      await fetchSolutionPrincipals();
      setShowModal(false);
    } catch (err) {
      console.error('Error saving solution principal:', err);
      setError(err.message || 'Failed to save solution principal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/solution-principals/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      await fetchSolutionPrincipals();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting solution principal:', err);
      setError(err.message || 'Failed to delete solution principal');
    }
  };

  return (
    <div style={{ padding: '0', backgroundColor: '#f5f7fa', minHeight: '100vh' }}>
      {/* Header with Add Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '30px',
        paddingBottom: '15px',
        borderBottom: '3px solid #f39c12',
        padding: '0 20px 15px 20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Award size={28} color="#f39c12" />
          <div>
            <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.4rem' }}>
              Solution Principal
            </h2>
            <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
              Manage solution principals and their information
            </p>
          </div>
        </div>
        <button
          onClick={handleAddNew}
          onMouseEnter={(e) => handleHeaderButtonHover(e, true)}
          onMouseLeave={(e) => handleHeaderButtonHover(e, false)}
          style={headerButtonStyle}
        >
          <Plus size={20} />
          Add New Solution Principal
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          margin: '0 20px 20px 20px'
        }}>
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '0 20px' }}>
        {loading ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            padding: '60px 40px',
            textAlign: 'center',
            minHeight: 'calc(100vh - 250px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <LoaderIcon size={40} color="#3498db" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#7f8c8d', marginTop: '15px' }}>Loading solution principals...</p>
          </div>
        ) : solutionPrincipals.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            padding: '80px 40px',
            textAlign: 'center',
            minHeight: 'calc(100vh - 250px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Award size={50} color="#bdc3c7" style={{ marginBottom: '20px' }} />
            <h3 style={{ color: '#2c3e50', marginBottom: '10px' }}>No Solution Principals</h3>
            <p style={{ color: '#7f8c8d', marginBottom: '20px' }}>Start by adding your first solution principal</p>
            <button
              onClick={handleAddNew}
              onMouseEnter={(e) => handleHeaderButtonHover(e, true)}
              onMouseLeave={(e) => handleHeaderButtonHover(e, false)}
              style={headerButtonStyle}
            >
              <Plus size={20} />
              Add Solution Principal
            </button>
          </div>
        ) : (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600', color: '#2c3e50' }}>Name</th>
                    <th style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#2c3e50' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {solutionPrincipals.map((item, index) => (
                    <tr
                      key={item.SP_ID || index}
                      style={{
                        borderBottom: '1px solid #eee',
                        backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f4ff'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa'}
                    >
                      <td style={{ padding: '15px', color: '#2c3e50', fontWeight: '500' }}>
                        {item.SP_Name}
                      </td>
                      <td style={{ padding: '15px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => handleView(item)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#3498db',
                            cursor: 'pointer',
                            padding: '5px 10px',
                            fontSize: '14px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'color 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#2980b9'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#3498db'}
                        >
                          <Eye size={16} />
                          View
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(item.SP_ID)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#e74c3c',
                            cursor: 'pointer',
                            padding: '5px 10px',
                            fontSize: '14px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'color 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#c0392b'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#e74c3c'}
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add/View Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }} onClick={() => setShowModal(false)}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{
              color: '#2c3e50',
              marginBottom: '20px',
              fontSize: '1.3rem',
              fontWeight: '600'
            }}>
              {modalMode === 'add' ? 'Add New Solution Principal' : 'View Solution Principal'}
            </h3>

            <form onSubmit={handleSubmitForm}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '500',
                  color: '#2c3e50'
                }}>
                  Solution Principal Name *
                </label>
                <input
                  type="text"
                  name="SP_Name"
                  value={formData.SP_Name}
                  onChange={handleInputChange}
                  disabled={modalMode === 'view'}
                  placeholder="e.g., Dell, HP, Lenovo"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    backgroundColor: modalMode === 'view' ? '#f5f5f5' : 'white'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    backgroundColor: '#f5f5f5',
                    color: '#2c3e50',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {modalMode === 'view' ? 'Close' : 'Cancel'}
                </button>
                {modalMode === 'add' && (
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: submitting ? '#bdc3c7' : '#f39c12',
                      color: 'white',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    {submitting ? 'Adding...' : 'Add Solution Principal'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1001
        }} onClick={() => setDeleteConfirm(null)}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#2c3e50', marginBottom: '15px' }}>Delete Solution Principal?</h3>
            <p style={{ color: '#555', marginBottom: '20px', lineHeight: '1.6' }}>
              Are you sure you want to delete this solution principal? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  backgroundColor: '#f5f5f5',
                  color: '#2c3e50',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default SolutionPrincipal;
