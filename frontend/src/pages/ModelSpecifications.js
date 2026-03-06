import React, { useState, useEffect, useMemo, useCallback } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Cpu, Search, Plus, ArrowLeft, AlertCircle, Package, ChevronDown, ChevronUp } from 'lucide-react';
import Pagination from '../components/Pagination';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

// Loading skeleton component
const SkeletonCard = () => (
  <div className="skeleton-card">
    <div className="skeleton-header">
      <div className="skeleton-title">
        <div className="skeleton-bar skeleton-bar-lg" />
        <div className="skeleton-bar skeleton-bar-md" />
      </div>
      <div className="skeleton-count" />
    </div>
    <div className="skeleton-tags">
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton-tag" />
      ))}
    </div>
  </div>
);

// Memoized card component to prevent unnecessary re-renders
const ModelCard = React.memo(({ model, onClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCardClick = (e) => {
    if (e.target.closest('.expand-button')) {
      return;
    }
    onClick(model.Model_ID);
  };

  const handleToggleExpand = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="model-spec-card" onClick={handleCardClick}>
      <div className="model-spec-header">
        <div className="model-spec-title">
          <h3 className="model-spec-name">
            <Cpu size={20} color="#667eea" />
            {model.Model_Name}
          </h3>
          <div className="model-spec-tags">
            {model.Category_Name && (
              <span className="model-tag model-tag-category">
                {model.Category_Name}
              </span>
            )}
            {model.Customer_Tags && (
              <span className="model-tag model-tag-customer">
                {model.Customer_Tags}
              </span>
            )}
          </div>
        </div>
        <div className={`model-spec-count ${model.Spec_Count > 0 ? 'has-specs' : 'no-specs'}`}>
          {model.Spec_Count}
          <div className="model-spec-count-label">specs</div>
        </div>
      </div>

      {model.specifications && model.specifications.length > 0 ? (
        <div className="spec-overview-section">
          <div className="spec-overview-header">
            <h4 className="spec-overview-title">Specifications Overview</h4>
            <button
              className={`expand-button ${isExpanded ? 'expanded' : 'collapsed'}`}
              onClick={handleToggleExpand}
            >
              {isExpanded ? (
                <>
                  <span>Collapse</span>
                  <ChevronUp size={14} />
                </>
              ) : (
                <>
                  <span>View All ({model.specifications.length})</span>
                  <ChevronDown size={14} />
                </>
              )}
            </button>
          </div>
          
          {isExpanded && (
            <div className="specs-container-expanded">
              {model.specifications.map((spec, index) => (
                <div key={index} className="spec-badge">
                  {spec.Attribute_Name || spec.Attributes_Name}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="no-specs-placeholder">
          <Plus size={20} color="#d97706" style={{ margin: '0 auto 8px' }} />
          <p className="no-specs-text">No specifications yet</p>
          <p className="no-specs-subtext">Click to add specifications</p>
        </div>
      )}
    </div>
  );
});

const ModelSpecifications = () => {
  usePageTitle('Model Specifications');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'Desktop');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const modelSpecsPageOptions = [6, 12, 24, 30];
  
  // Hardcoded categories sorted alphabetically for instant display (no API call needed)
  const categories = ['Desktop', 'IPAD', 'Laptop', 'Notebook', 'Printer', 'Printer Photo', 'Projector', 'Router', 'Scanner', 'Server', 'UPS'];
  
  // Cache for fetched data
  const [dataCache, setDataCache] = useState({});

  // Fetch models when selected category changes
  useEffect(() => {
    if (selectedCategory) {
      // Check cache first
      if (dataCache[selectedCategory]) {
        setModels(dataCache[selectedCategory]);
        setLoading(false);
      } else {
        fetchModelsWithSpecs(selectedCategory);
      }
    }
  }, [selectedCategory]);

  // Debounce search term to reduce filtering operations
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchModelsWithSpecs = async (category) => {
    try {
      setLoading(true);
      setError(null);
      
      const url = `${API_URL}/models/with-specs?category=${encodeURIComponent(category)}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      
      const result = await response.json();
      const data = result.data || [];
      
      // Update models and cache
      setModels(data);
      setDataCache(prev => ({ ...prev, [category]: data }));
    } catch (err) {
      console.error('Error fetching models with specs:', err);
      setError(err.message || 'Failed to load models');
    } finally {
      setLoading(false);
    }
  };

  const handleModelClick = useCallback((modelId) => {
    navigate(`/models/${modelId}/add-specs?category=${encodeURIComponent(selectedCategory)}`);
  }, [navigate, selectedCategory]);

  // Filter models based on search term only (category filtering done by backend)
  const filteredModels = useMemo(() => {
    if (!debouncedSearchTerm) return models;
    return models.filter(model => {
      return model.Model_Name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
             model.Category_Name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    });
  }, [models, debouncedSearchTerm]);

  // Pagination calculations - memoized
  const { totalPages, paginatedModels } = useMemo(() => {
    const total = Math.ceil(filteredModels.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = filteredModels.slice(startIndex, endIndex);
    return { totalPages: total, paginatedModels: paginated };
  }, [filteredModels, currentPage, itemsPerPage]);

  // Reset to page 1 when search or category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedCategory]);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    // Scroll to top of the page when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleItemsPerPageChange = useCallback((newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  }, []);

  return (
    <div style={{ padding: '0' }}>
      {/* Header Section */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '32px',
        marginBottom: '32px',
        borderRadius: '0 0 24px 24px',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <button
            onClick={() => navigate('/assets')}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '12px',
              padding: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            <ArrowLeft color="white" size={24} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{
              margin: 0,
              fontSize: '32px',
              fontWeight: '700',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Cpu size={36} />
              Model Specifications
            </h1>
            <p style={{
              margin: '8px 0 0 0',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '16px'
            }}>
              Manage technical specifications for all models • {models.length} total model{models.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', marginTop: '24px' }}>
          <Search 
            size={20} 
            style={{ 
              position: 'absolute', 
              left: '16px', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: '#9ca3af'
            }} 
          />
          <input
            type="text"
            placeholder="Search by model name or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 16px 14px 48px',
              fontSize: '15px',
              border: 'none',
              borderRadius: '12px',
              outline: 'none',
              background: 'white',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}
          />
        </div>
      </div>

      {/* Category Filter */}
      <div style={{ padding: '0 32px 24px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ 
            fontSize: '14px', 
            fontWeight: '600', 
            color: '#6b7280',
            marginRight: '8px'
          }}>
            Filter by Category:
          </span>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => {
                setSelectedCategory(category);
                setSearchParams({ category });
              }}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                border: selectedCategory === category ? '2px solid #667eea' : '2px solid #e5e7eb',
                borderRadius: '10px',
                background: selectedCategory === category 
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                  : 'white',
                color: selectedCategory === category ? 'white' : '#374151',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: selectedCategory === category 
                  ? '0 4px 12px rgba(102, 126, 234, 0.3)' 
                  : '0 2px 4px rgba(0, 0, 0, 0.05)'
              }}
              onMouseOver={(e) => {
                if (selectedCategory !== category) {
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.15)';
                }
              }}
              onMouseOut={(e) => {
                if (selectedCategory !== category) {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                }
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Content Section */}
      <div style={{ padding: '0 32px 32px' }}>
        {loading ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '24px'
          }}>
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <div style={{
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <AlertCircle color="#dc2626" size={24} />
            <div>
              <strong style={{ color: '#dc2626' }}>Error:</strong>
              <p style={{ margin: '4px 0 0 0', color: '#991b1b' }}>{error}</p>
            </div>
          </div>
        ) : filteredModels.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#6b7280'
          }}>
            <Package size={64} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>
              {searchTerm ? 'No models found' : 'No models available'}
            </h3>
            <p style={{ margin: 0, color: '#9ca3af' }}>
              {searchTerm ? 'Try adjusting your search terms' : 'Add models to get started'}
            </p>
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '24px',
              marginBottom: '32px'
            }}>
              {paginatedModels.map((model) => (
                <ModelCard 
                  key={model.Model_ID} 
                  model={model} 
                  onClick={handleModelClick}
                />
              ))}
          </div>
          
          {/* Pagination */}
          {filteredModels.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={handleItemsPerPageChange}
              totalItems={filteredModels.length}
              itemsPerPageOptions={modelSpecsPageOptions}
            />
          )}
          </>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
};

export default ModelSpecifications;
