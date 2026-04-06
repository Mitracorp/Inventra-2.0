import React, { useState, useEffect, useMemo } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import { Cpu, Plus, Search, Package, ArrowLeft, X, Filter, AlertCircle, RefreshCw } from 'lucide-react';
import { API_URL } from '../config/api';

const Models = () => {
  usePageTitle('Models');
  const navigate = useNavigate();
  const [models, setModels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [listSortMode, setListSortMode] = useState(() => localStorage.getItem('inventraModelsSortMode') || 'default');
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelSpecs, setModelSpecs] = useState([]);
  const [loadingSpecs, setLoadingSpecs] = useState(false);

  useEffect(() => {
    fetchModels();
    fetchCategories();
  }, []);

  useEffect(() => {
    localStorage.setItem('inventraModelsSortMode', listSortMode);
  }, [listSortMode]);

  const fetchModels = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/models`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      const modelsArray = Array.isArray(data) ? data : (data.data || []);
      setModels(modelsArray);
    } catch (err) {
      console.error('Error fetching models:', err);
      setError(err.message || 'Failed to load models');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/categories`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        const categoriesArray = Array.isArray(data) ? data : (data.data || []);
        setCategories(categoriesArray);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchModelSpecs = async (modelId) => {
    try {
      setLoadingSpecs(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/models/${modelId}/specs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const specsArray = Array.isArray(data) ? data : (data.data || []);
        setModelSpecs(specsArray);
      } else {
        setModelSpecs([]);
      }
    } catch (err) {
      console.error('Error fetching model specs:', err);
      setModelSpecs([]);
    } finally {
      setLoadingSpecs(false);
    }
  };

  const handleViewDetails = (model) => {
    setSelectedModel(model);
    fetchModelSpecs(model.Model_ID);
  };

  const closeModal = () => {
    setSelectedModel(null);
    setModelSpecs([]);
  };

  // Filter models based on search term and category
  const filteredModels = models.filter(model => {
    const matchesSearch = model.Model_Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         model.Category_Name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || model.Category_ID === parseInt(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  const compareText = (a, b) => String(a || '').toLowerCase().localeCompare(String(b || '').toLowerCase());
  const parseNumeric = (value) => {
    const parsed = parseInt(String(value || '').replace(/[^0-9.-]/g, ''), 10);
    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
  };

  const sortedCategories = useMemo(() => {
    if (listSortMode === 'default') return categories;

    return [...categories].sort((a, b) => {
      const aText = a.Category;
      const bText = b.Category;

      if (listSortMode === 'alpha-asc') return compareText(aText, bText);
      if (listSortMode === 'alpha-desc') return compareText(bText, aText);
      if (listSortMode === 'num-asc') return parseNumeric(aText) - parseNumeric(bText);
      if (listSortMode === 'num-desc') return parseNumeric(bText) - parseNumeric(aText);
      return 0;
    });
  }, [categories, listSortMode]);

  const sortedFilteredModels = useMemo(() => {
    if (listSortMode === 'default') return filteredModels;

    return [...filteredModels].sort((a, b) => {
      const aText = a.Model_Name || a.Category_Name || '';
      const bText = b.Model_Name || b.Category_Name || '';

      if (listSortMode === 'alpha-asc') return compareText(aText, bText);
      if (listSortMode === 'alpha-desc') return compareText(bText, aText);
      if (listSortMode === 'num-asc') return parseNumeric(a.Model_ID) - parseNumeric(b.Model_ID);
      if (listSortMode === 'num-desc') return parseNumeric(b.Model_ID) - parseNumeric(a.Model_ID);
      return 0;
    });
  }, [filteredModels, listSortMode]);

  return (
    <div style={{ padding: '0' }}>
      {/* Header Section with Gradient */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '30px 20px',
        marginBottom: '30px',
        borderRadius: '0 0 20px 20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px',
          width: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                padding: '10px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
              title="Go back"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 style={{ 
                color: 'white', 
                margin: '0 0 10px 0',
                fontSize: '32px',
                fontWeight: '700'
              }}>
                Model Management
              </h1>
              <p style={{ 
                color: 'rgba(255, 255, 255, 0.9)', 
                margin: 0,
                fontSize: '16px'
              }}>
                View and manage all device models and their specifications
              </p>
            </div>
          </div>
          <div className="actions">
            <button 
              className="btn btn-primary" 
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                color: '#667eea',
                border: 'none',
                fontWeight: '600',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px'
              }}
            >
              <Plus size={16} />
              Add New Model
            </button>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div style={{ padding: '0 20px', width: '100%', boxSizing: 'border-box' }}>
        {/* Search and Filter Bar */}
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          marginBottom: '25px'
        }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
              <Search size={20} style={{ 
                position: 'absolute', 
                left: '15px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: '#666' 
              }} />
              <input
                type="text"
                placeholder="Search models by name or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 45px',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
              />
            </div>

            {/* Category Filter */}
            <div style={{ position: 'relative', minWidth: '200px' }}>
              <Filter size={18} style={{ 
                position: 'absolute', 
                left: '15px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: '#666',
                pointerEvents: 'none',
                zIndex: 1
              }} />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 45px',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'white',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
              >
                <option value="">All Categories</option>
                {sortedCategories.map(cat => (
                  <option key={cat.Category_ID} value={cat.Category_ID}>
                    {cat.Category}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '220px' }}>
              <span style={{ color: '#4b5563', fontSize: '14px', fontWeight: '600' }}>List Order</span>
              <select
                value={listSortMode}
                onChange={(e) => setListSortMode(e.target.value)}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'white',
                  boxSizing: 'border-box'
                }}
              >
                <option value="default">Default</option>
                <option value="alpha-asc">A-Z</option>
                <option value="alpha-desc">Z-A</option>
                <option value="num-asc">0-9</option>
                <option value="num-desc">9-0</option>
              </select>
            </div>

            {/* Clear Filters */}
            {(searchTerm || selectedCategory) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('');
                }}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#f8f9fa',
                  color: '#666',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e9ecef';
                  e.currentTarget.style.borderColor = '#dee2e6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                  e.currentTarget.style.borderColor = '#e9ecef';
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid #f3f4f6',
              borderTopColor: '#667eea',
              borderRadius: '50%',
              margin: '0 auto 20px',
              animation: 'spin 1s linear infinite'
            }} />
            <p style={{ color: '#666', fontSize: '16px' }}>Loading models...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            border: '1px solid #fee'
          }}>
            <p style={{ color: '#e74c3c', fontSize: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <AlertCircle size={20} />
              Error: {error}
            </p>
            <button 
              onClick={fetchModels}
              style={{
                padding: '10px 20px',
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '0 auto'
              }}
            >
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        )}

        {/* Models Grid */}
        {!loading && !error && (
          <div>
            {sortedFilteredModels.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: '20px',
                marginBottom: '30px'
              }}>
                {sortedFilteredModels.map((model) => (
                  <div
                    key={model.Model_ID}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '20px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.3s ease',
                      border: '2px solid transparent'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(102, 126, 234, 0.2)';
                      e.currentTarget.style.borderColor = '#667eea';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}
                  >
                    {/* Card Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '15px',
                      paddingBottom: '15px',
                      borderBottom: '2px solid #f0f4ff'
                    }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Cpu size={24} color="white" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{
                          margin: '0 0 4px 0',
                          fontSize: '18px',
                          fontWeight: '600',
                          color: '#2c3e50',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {model.Model_Name}
                        </h3>
                        <p style={{
                          margin: 0,
                          fontSize: '13px',
                          color: '#7f8c8d',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          ID: {model.Model_ID}
                        </p>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div style={{ marginBottom: '15px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 12px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px'
                      }}>
                        <Package size={16} color="#667eea" />
                        <div style={{ flex: 1 }}>
                          <span style={{
                            fontSize: '12px',
                            color: '#7f8c8d',
                            display: 'block',
                            marginBottom: '2px'
                          }}>
                            Category
                          </span>
                          <span style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#2c3e50'
                          }}>
                            {model.Category_Name || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div style={{
                      display: 'flex',
                      gap: '10px',
                      paddingTop: '15px',
                      borderTop: '1px solid #e9ecef'
                    }}>
                      <button
                        onClick={() => handleViewDetails(model)}
                        style={{
                          flex: 1,
                          padding: '8px 16px',
                          backgroundColor: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '600',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5a67d8'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#667eea'}
                      >
                        View Details
                      </button>
                      <button
                        style={{
                          flex: 1,
                          padding: '8px 16px',
                          backgroundColor: 'white',
                          color: '#667eea',
                          border: '2px solid #667eea',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '600',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f0f4ff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                backgroundColor: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
              }}>
                <Cpu size={64} color="#cbd5e0" style={{ marginBottom: '20px' }} />
                <h3 style={{ color: '#2c3e50', marginBottom: '10px' }}>No Models Found</h3>
                <p style={{ color: '#7f8c8d', marginBottom: '20px' }}>
                  {searchTerm || selectedCategory ? 'No models match your filter criteria.' : 'Get started by adding your first model.'}
                </p>
                <button
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Plus size={16} />
                  Add First Model
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Model Details Modal */}
      {selectedModel && (
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
            borderRadius: '16px',
            padding: '0',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '25px 30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: '16px 16px 0 0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Cpu size={28} color="white" />
                </div>
                <div>
                  <h2 style={{ 
                    margin: '0 0 5px 0', 
                    color: 'white',
                    fontSize: '22px',
                    fontWeight: '600'
                  }}>
                    {selectedModel.Model_Name}
                  </h2>
                  <p style={{ 
                    margin: 0, 
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: '14px'
                  }}>
                    {selectedModel.Category_Name}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              padding: '30px',
              overflowY: 'auto',
              flex: 1
            }}>
              <h3 style={{
                margin: '0 0 20px 0',
                fontSize: '18px',
                fontWeight: '600',
                color: '#2c3e50',
                borderBottom: '2px solid #f0f4ff',
                paddingBottom: '10px'
              }}>
                Specifications
              </h3>

              {loadingSpecs ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid #f3f4f6',
                    borderTopColor: '#667eea',
                    borderRadius: '50%',
                    margin: '0 auto 15px',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <p style={{ color: '#666', fontSize: '14px' }}>Loading specifications...</p>
                </div>
              ) : modelSpecs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {modelSpecs.map((spec, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '15px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        border: '1px solid #e9ecef'
                      }}
                    >
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#495057',
                        flex: 1
                      }}>
                        {spec.Attributes_Name}:
                      </span>
                      <span style={{
                        fontSize: '14px',
                        color: '#2c3e50',
                        fontWeight: '500',
                        flex: 1,
                        textAlign: 'right'
                      }}>
                        {spec.Attributes_Value || 'N/A'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px dashed #dee2e6'
                }}>
                  <Package size={48} color="#cbd5e0" style={{ marginBottom: '15px' }} />
                  <p style={{ color: '#7f8c8d', margin: 0, fontSize: '14px' }}>
                    No specifications available for this model
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '20px 30px',
              borderTop: '1px solid #e9ecef',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={closeModal}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f8f9fa',
                  color: '#495057',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spinning animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Models;
