import React, { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, AlertCircle, CheckCircle, Cpu, Edit2 } from 'lucide-react';
import toast from '../utils/toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

const AddModelSpecs = () => {
  usePageTitle('Add Model Specifications');
  const navigate = useNavigate();
  const { modelId } = useParams();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category');
  
  const [model, setModel] = useState(null);
  const [existingSpecs, setExistingSpecs] = useState([]);
  const [editingSpec, setEditingSpec] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [specifications, setSpecifications] = useState([
    { attributeName: '', attributeValue: '' }
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchModelDetails();
  }, [modelId]);

  const fetchModelDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/models/${modelId}/with-specs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch model: ${response.statusText}`);
      }
      
      const result = await response.json();
      setModel(result.data);
      setExistingSpecs(result.data.specifications || []);
    } catch (err) {
      console.error('Error fetching model details:', err);
      setError(err.message || 'Failed to load model details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSpecField = () => {
    setSpecifications([...specifications, { attributeName: '', attributeValue: '' }]);
  };

  const handleRemoveSpecField = (index) => {
    const newSpecs = specifications.filter((_, i) => i !== index);
    if (newSpecs.length === 0) {
      newSpecs.push({ attributeName: '', attributeValue: '' });
    }
    setSpecifications(newSpecs);
  };

  const handleSpecChange = (index, field, value) => {
    const newSpecs = [...specifications];
    newSpecs[index][field] = value;
    setSpecifications(newSpecs);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate that at least one spec has both fields filled
    const validSpecs = specifications.filter(
      spec => spec.attributeName.trim() && spec.attributeValue.trim()
    );

    if (validSpecs.length === 0) {
      setError('Please add at least one specification with both name and value');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/models/${modelId}/specs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ specifications: validSpecs })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add specifications');
      }

      const result = await response.json();
      toast.success(`Successfully added ${result.data.length} specification(s)!`);
      
      // Reset form and refresh existing specs
      setSpecifications([{ attributeName: '', attributeValue: '' }]);
      await fetchModelDetails();

      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Error adding specifications:', err);
      setError(err.message || 'Failed to add specifications');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExistingSpec = async (attributeId) => {
    if (!window.confirm('Are you sure you want to delete this specification?')) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/models/${modelId}/specs/${attributeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete specification');
      }

      toast.success('Specification deleted successfully');
      await fetchModelDetails();
    } catch (err) {
      console.error('Error deleting specification:', err);
      setError(err.message || 'Failed to delete specification');
    }
  };

  const handleEditSpec = (spec) => {
    setEditingSpec(spec.Attributes_ID);
    setEditValue(spec.Attributes_Value);
  };

  const handleCancelEdit = () => {
    setEditingSpec(null);
    setEditValue('');
  };

  const handleSaveEdit = async (attributeId) => {
    if (!editValue.trim()) {
      setError('Specification value cannot be empty');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/models/${modelId}/specs/${attributeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ attributeValue: editValue.trim() })
      });

      if (!response.ok) {
        throw new Error('Failed to update specification');
      }

      toast.success('Specification updated successfully');
      setEditingSpec(null);
      setEditValue('');
      await fetchModelDetails();
    } catch (err) {
      console.error('Error updating specification:', err);
      setError(err.message || 'Failed to update specification');
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px' 
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid #f3f4f6',
          borderTop: '4px solid #667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => navigate(category ? `/models/specs?category=${encodeURIComponent(category)}` : '/models/specs')}
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
            <div>
              <h1 style={{
                margin: 0,
                fontSize: '28px',
                fontWeight: '700',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <Cpu size={32} />
                Add New Specifications
              </h1>
              {model?.Category_Name && (
                <p style={{
                  margin: '8px 0 0 0',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: '15px'
                }}>
                  Category: {model.Category_Name}
                </p>
              )}
            </div>
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '12px 24px',
            borderRadius: '12px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.4)'
          }}>
            <div style={{
              fontSize: '18px',
              fontWeight: '700',
              color: 'white',
              textAlign: 'center'
            }}>
              {model?.Model_Name}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 32px 32px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Error Messages */}
        {error && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <AlertCircle color="#dc2626" size={24} />
            <p style={{ margin: 0, color: '#991b1b', fontWeight: '500' }}>{error}</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Add New Specifications Form */}
          <div style={{
            background: 'white',
            border: '2px solid #e5e7eb',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
          }}>
            <h2 style={{
              margin: '0 0 20px 0',
              fontSize: '20px',
              fontWeight: '600',
              color: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Plus size={24} color="#667eea" />
              Add New Specifications
            </h2>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {specifications.map((spec, index) => (
                  <div key={index} style={{
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>
                        Specification #{index + 1}
                      </span>
                      {specifications.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSpecField(index)}
                          style={{
                            background: '#fee2e2',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: '#dc2626',
                            fontSize: '13px',
                            fontWeight: '500'
                          }}
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      )}
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>
                        Attribute Name *
                      </label>
                      <input
                        type="text"
                        value={spec.attributeName}
                        onChange={(e) => handleSpecChange(index, 'attributeName', e.target.value)}
                        placeholder="e.g., Processor, RAM, Storage"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          outline: 'none',
                          transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#667eea'}
                        onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                      />
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>
                        Attribute Value *
                      </label>
                      <input
                        type="text"
                        value={spec.attributeValue}
                        onChange={(e) => handleSpecChange(index, 'attributeValue', e.target.value)}
                        placeholder="e.g., Intel Core i7, 16GB DDR4, 512GB SSD"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          outline: 'none',
                          transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#667eea'}
                        onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddSpecField}
                style={{
                  width: '100%',
                  marginTop: '16px',
                  padding: '12px',
                  background: '#f3f4f6',
                  border: '2px dashed #d1d5db',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  color: '#6b7280',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#e5e7eb';
                  e.currentTarget.style.borderColor = '#9ca3af';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }}
              >
                <Plus size={18} />
                Add Another Specification
              </button>

              <button
                type="submit"
                disabled={saving}
                style={{
                  width: '100%',
                  marginTop: '24px',
                  padding: '14px',
                  background: saving ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: saving ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
                  transition: 'all 0.3s'
                }}
                onMouseOver={(e) => {
                  if (!saving) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = saving ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)';
                }}
              >
                <Save size={20} />
                {saving ? 'Saving...' : 'Save Specifications'}
              </button>
            </form>
          </div>

          {/* Existing Specifications */}
          <div style={{
            background: 'white',
            border: '2px solid #e5e7eb',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            maxHeight: '800px',
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '600',
                color: '#1f2937'
              }}>
                Current Specifications
              </h2>
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
              }}>
                {existingSpecs.length} {existingSpecs.length === 1 ? 'spec' : 'specs'}
              </div>
            </div>

            {existingSpecs.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#9ca3af'
              }}>
                <p style={{ margin: 0, fontSize: '15px' }}>
                  No specifications added yet
                </p>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>
                  Add your first specification using the form
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {existingSpecs.map((spec, index) => (
                  <div key={index} style={{
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#667eea',
                        marginBottom: '6px',
                        textAlign: 'left'
                      }}>
                        {spec.Attribute_Name || spec.Attributes_Name}
                      </div>
                      {editingSpec === spec.Attributes_ID ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          style={{
                            width: '100%',
                            fontSize: '14px',
                            padding: '8px 12px',
                            border: '2px solid #667eea',
                            borderRadius: '6px',
                            outline: 'none',
                            fontWeight: '500'
                          }}
                          autoFocus
                        />
                      ) : (
                        <div style={{
                          fontSize: '14px',
                          color: '#374151',
                          fontWeight: '500',
                          lineHeight: '1.6',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          textAlign: 'left',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {spec.Attributes_Value}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      {editingSpec === spec.Attributes_ID ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(spec.Attributes_ID)}
                            style={{
                              background: '#d1fae5',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#a7f3d0'}
                            onMouseOut={(e) => e.currentTarget.style.background = '#d1fae5'}
                            title="Save changes"
                          >
                            <Save size={16} color="#059669" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            style={{
                              background: '#f3f4f6',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#e5e7eb'}
                            onMouseOut={(e) => e.currentTarget.style.background = '#f3f4f6'}
                            title="Cancel"
                          >
                            <AlertCircle size={16} color="#6b7280" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditSpec(spec)}
                            style={{
                              background: '#dbeafe',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#bfdbfe'}
                            onMouseOut={(e) => e.currentTarget.style.background = '#dbeafe'}
                            title="Edit specification"
                          >
                            <Edit2 size={16} color="#2563eb" />
                          </button>
                          <button
                            onClick={() => handleDeleteExistingSpec(spec.Attributes_ID)}
                            style={{
                              background: '#fee2e2',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#fecaca'}
                            onMouseOut={(e) => e.currentTarget.style.background = '#fee2e2'}
                            title="Delete specification"
                          >
                            <Trash2 size={16} color="#dc2626" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default AddModelSpecs;
