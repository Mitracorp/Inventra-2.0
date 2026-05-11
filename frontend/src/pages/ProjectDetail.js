import React, { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Building2, MapPin, FileText, Calendar, Shield, 
  Wrench, User, Package, Eye, Edit, Trash2, Printer, Monitor, Search 
} from 'lucide-react';
import { API_URL } from '../config/api';
import Pagination from '../components/Pagination';
import toast from '../utils/toast';

const ProjectDetail = () => {
  usePageTitle('Project Details');
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [assets, setAssets] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    fetchProjectDetails();
  }, [id]);

  useEffect(() => {
    if (selectedBranch) {
      fetchAssetsByBranch(selectedBranch);
    } else {
      fetchAllProjectAssets();
    }
    setCurrentPage(1); // Reset to first page when branch changes
  }, [selectedBranch]);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch project details
      const token = localStorage.getItem('authToken');
      const projectResponse = await fetch(`${API_URL}/projects/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!projectResponse.ok) throw new Error('Failed to fetch project');
      const projectData = await projectResponse.json();
      setProject(projectData);

      // Fetch branches for this project from inventory
      const inventoryResponse = await fetch(`${API_URL}/inventory/project/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (inventoryResponse.ok) {
        const inventoryData = await inventoryResponse.json();
        
        // Extract unique branches
        const uniqueBranches = [...new Set(inventoryData.map(item => item.Branch))];
        setBranches(uniqueBranches);
      }

      // Fetch all assets for this project
      fetchAllProjectAssets();
      
    } catch (error) {
      console.error('Error fetching project details:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllProjectAssets = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const inventoryResponse = await fetch(`${API_URL}/inventory/project/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!inventoryResponse.ok) throw new Error('Failed to fetch assets');
      
      const inventoryData = await inventoryResponse.json();
      
      // Filter out records with NULL Asset_ID
      const assetsWithData = inventoryData.filter(item => item.Asset_ID !== null);
      setAssets(assetsWithData);
    } catch (error) {
      console.error('Error fetching assets:', error);
      setAssets([]);
    }
  };

  const fetchAssetsByBranch = async (branch) => {
    try {
      const token = localStorage.getItem('authToken');
      const inventoryResponse = await fetch(`${API_URL}/inventory/project/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!inventoryResponse.ok) throw new Error('Failed to fetch assets');
      
      const inventoryData = await inventoryResponse.json();
      
      // Filter by branch and exclude NULL Asset_ID
      const filteredAssets = inventoryData.filter(
        item => item.Branch === branch && item.Asset_ID !== null
      );
      setAssets(filteredAssets);
    } catch (error) {
      console.error('Error fetching assets:', error);
      setAssets([]);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleDeleteAsset = async (assetId) => {
    if (window.confirm('Are you sure you want to delete this asset?')) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/assets/${assetId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          toast.success('Asset deleted successfully');
          // Refresh assets list
          if (selectedBranch) {
            fetchAssetsByBranch(selectedBranch);
          } else {
            fetchAllProjectAssets();
          }
        } else {
          throw new Error('Failed to delete asset');
        }
      } catch (error) {
        console.error('Error deleting asset:', error);
        toast.error('Failed to delete asset');
      }
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ fontSize: '18px', color: '#666' }}>Loading project details...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ fontSize: '18px', color: '#ef4444' }}>Error: {error || 'Project not found'}</p>
        <button 
          onClick={() => navigate('/projects')}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Back to Projects
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '0' }}>
      {/* Header with Back Button */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '30px 20px',
        marginBottom: '30px',
        borderRadius: '0 0 20px 20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <button
                onClick={() => navigate('/projects')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '15px',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
              >
                <ArrowLeft size={18} />
                Back to Projects
              </button>
            </div>
            
            <button
              onClick={() => navigate(`/projects/edit/${id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
            >
              <Edit size={18} />
              Edit Project
            </button>
          </div>
          
          <h1 style={{ 
            color: 'white', 
            margin: '0',
            fontSize: '32px',
            fontWeight: '700'
          }}>
            {project.Customer_Name || 'Project Details'}
          </h1>
          {project.Company_Full_Name && project.Company_Full_Name !== project.Customer_Name && (
            <p style={{
              color: 'rgba(255, 255, 255, 0.92)',
              margin: '8px 0 0 0',
              fontSize: '16px',
              fontWeight: '500',
              maxWidth: '900px'
            }}>
              {project.Company_Full_Name}
            </p>
          )}
          {project.Customer_Ref_Number && (
            <p style={{ 
              color: 'rgba(255, 255, 255, 0.9)', 
              margin: '8px 0 0 0',
              fontSize: '16px'
            }}>
              Customer Ref: <strong>{project.Customer_Ref_Number}</strong>
            </p>
          )}
      </div>

      <div style={{ padding: '0 20px', width: '100%', boxSizing: 'border-box' }}>
        {/* Branch Selector */}
        {branches.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px 25px',
            marginBottom: '25px',
            boxShadow: '0 2px 15px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '15px'
          }}>
            <MapPin size={20} style={{ color: '#667eea' }} />
            <label style={{ 
              fontSize: '15px', 
              fontWeight: '600',
              color: '#1f2937',
              minWidth: 'fit-content'
            }}>
              Filter by Branch:
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 15px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '15px',
                backgroundColor: 'white',
                cursor: 'pointer',
                outline: 'none',
                maxWidth: '300px'
              }}
            >
              <option value="">All Branches</option>
              {branches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>
        )}

        {/* Project Information Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '30px',
          marginBottom: '30px',
          boxShadow: '0 2px 15px rgba(0, 0, 0, 0.08)'
        }}>
          <h2 style={{
            margin: '0 0 25px 0',
            fontSize: '24px',
            fontWeight: '700',
            color: '#1f2937',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <FileText size={24} style={{ color: '#667eea' }} />
            Project Information
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {/* Project Title + Reference row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '3fr 1fr',
              gap: '20px',
              gridColumn: '1 / -1'
            }}>
              {/* Project Title */}
              <div style={{
                padding: '20px',
                backgroundColor: '#f9fafb',
                borderRadius: '12px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  fontWeight: '600',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Project Title
                </div>
                <div style={{
                  fontSize: '16px',
                  color: '#1f2937',
                  fontWeight: '500',
                  lineHeight: '1.6'
                }}>
                  {project.Project_Title || 'N/A'}
                </div>
              </div>

              {/* Project Ref Number */}
              <div style={{
                padding: '18px',
                backgroundColor: '#f9fafb',
                borderRadius: '12px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '8px'
                }}>
                  <Package size={18} style={{ color: '#667eea' }} />
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    Project Reference
                  </div>
                </div>
                <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '500' }}>
                  {project.Project_Ref_Number || 'N/A'}
                </div>
              </div>
            </div>

            {/* Solution Principal */}
            <div style={{
              gridColumn: '1 / -1',
              padding: '18px',
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '12px'
              }}>
                <User size={18} style={{ color: '#10b981' }} />
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}>
                  Solution Principal
                </div>
              </div>
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: '0'
              }}>
                {project.Solution_Principals && project.Solution_Principals.trim() !== '' ? (
                  <div style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: '#ffffff'
                  }}>
                    {project.Solution_Principals.split('||').map((sp, index) => {
                      const [name, supportType] = sp.split('|');
                      return (
                        <div key={index} style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(120px, auto) 1fr',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '12px 16px',
                          backgroundColor: index % 2 === 0 ? '#f9fafb' : 'white',
                          borderBottom: index < project.Solution_Principals.split('||').length - 1 ? '1px solid #e5e7eb' : 'none'
                        }}>
                          <div style={{
                            fontSize: '15px',
                            color: '#9C27B0',
                            fontWeight: '600',
                            whiteSpace: 'nowrap'
                          }}>
                            {name}
                          </div>
                          <div style={{
                            fontSize: '14px',
                            color: '#6b7280',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            {supportType && supportType.trim() !== '' ? (
                              <div style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                backgroundColor: '#d1fae5',
                                color: '#065f46',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '500'
                              }}>
                                {supportType}
                              </div>
                            ) : (
                              <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                                No support type specified
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '15px', color: '#9ca3af', fontStyle: 'italic' }}>
                    No solution principals assigned
                  </div>
                )}
              </div>
            </div>

            {/* Warranty */}
            <div style={{
              padding: '18px',
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '8px'
              }}>
                <Shield size={18} style={{ color: '#f59e0b' }} />
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}>
                  Warranty
                </div>
              </div>
              <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '500' }}>
                {project.Warranty || 'N/A'}
              </div>
            </div>

            {/* Preventive Maintenance */}
            <div style={{
              padding: '18px',
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '8px'
              }}>
                <Wrench size={18} style={{ color: '#8b5cf6' }} />
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}>
                  Preventive Maintenance
                </div>
              </div>
              <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '500' }}>
                {project.Preventive_Maintenance || 'N/A'}
              </div>
            </div>

            {/* Start Date */}
            <div style={{
              padding: '18px',
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '8px'
              }}>
                <Calendar size={18} style={{ color: '#3b82f6' }} />
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}>
                  Start Date
                </div>
              </div>
              <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '500' }}>
                {formatDate(project.Start_Date)}
              </div>
            </div>

            {/* End Date */}
            <div style={{
              padding: '18px',
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '8px'
              }}>
                <Calendar size={18} style={{ color: '#ef4444' }} />
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}>
                  End Date
                </div>
              </div>
              <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '500' }}>
                {formatDate(project.End_Date)}
              </div>
            </div>
          </div>
        </div>

        {/* Assets Section */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '30px',
          marginBottom: '40px',
          boxShadow: '0 2px 15px rgba(0, 0, 0, 0.08)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '25px'
          }}>
            <h2 style={{
              margin: '0',
              fontSize: '24px',
              fontWeight: '700',
              color: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <Monitor size={24} style={{ color: '#667eea' }} />
              Project Assets ({assets.filter(asset => {
                const searchLower = searchTerm.toLowerCase();
                return (
                  asset.Asset_Serial_Number?.toLowerCase().includes(searchLower) ||
                  asset.Asset_Tag_ID?.toLowerCase().includes(searchLower) ||
                  asset.Item_Name?.toLowerCase().includes(searchLower) ||
                  asset.Category?.toLowerCase().includes(searchLower) ||
                  asset.Model?.toLowerCase().includes(searchLower) ||
                  asset.Branch?.toLowerCase().includes(searchLower) ||
                  asset.Recipient_Name?.toLowerCase().includes(searchLower) ||
                  asset.Department?.toLowerCase().includes(searchLower)
                );
              }).length})
            </h2>
          </div>

          {/* Search Box */}
          <div style={{
            marginBottom: '20px',
            position: 'relative'
          }}>
            <Search size={20} style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af'
            }} />
            <input
              type="text"
              placeholder="Search assets by serial number, tag ID, item name, category, model, branch, recipient, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px 12px 48px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '15px',
                transition: 'border-color 0.3s ease',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          {assets.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#9ca3af'
            }}>
              <Package size={64} style={{ margin: '0 auto 20px', opacity: 0.3 }} />
              <p style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                No Assets Found
              </p>
              <p style={{ fontSize: '14px' }}>
                {selectedBranch 
                  ? `No assets assigned to ${selectedBranch} branch yet.`
                  : 'No assets assigned to this project yet.'}
              </p>
            </div>
          ) : assets.filter(asset => {
            const searchLower = searchTerm.toLowerCase();
            return (
              asset.Asset_Serial_Number?.toLowerCase().includes(searchLower) ||
              asset.Asset_Tag_ID?.toLowerCase().includes(searchLower) ||
              asset.Item_Name?.toLowerCase().includes(searchLower) ||
              asset.Category?.toLowerCase().includes(searchLower) ||
              asset.Model?.toLowerCase().includes(searchLower) ||
              asset.Branch?.toLowerCase().includes(searchLower) ||
              asset.Recipient_Name?.toLowerCase().includes(searchLower) ||
              asset.Department?.toLowerCase().includes(searchLower)
            );
          }).length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#9ca3af'
            }}>
              <Search size={64} style={{ margin: '0 auto 20px', opacity: 0.3 }} />
              <p style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                No Results Found
              </p>
              <p style={{ fontSize: '14px' }}>
                No assets match your search "{searchTerm}". Try different keywords.
              </p>
            </div>
          ) : (() => {
            // Filter assets based on search
            const filteredAssets = assets.filter(asset => {
              const searchLower = searchTerm.toLowerCase();
              return (
                asset.Asset_Serial_Number?.toLowerCase().includes(searchLower) ||
                asset.Asset_Tag_ID?.toLowerCase().includes(searchLower) ||
                asset.Item_Name?.toLowerCase().includes(searchLower) ||
                asset.Category?.toLowerCase().includes(searchLower) ||
                asset.Model?.toLowerCase().includes(searchLower) ||
                asset.Branch?.toLowerCase().includes(searchLower) ||
                asset.Recipient_Name?.toLowerCase().includes(searchLower) ||
                asset.Department?.toLowerCase().includes(searchLower)
              );
            });

            // Calculate pagination
            const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const paginatedAssets = filteredAssets.slice(startIndex, endIndex);

            return (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'separate',
                    borderSpacing: '0',
                    fontSize: '14px'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <th style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontWeight: '600',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Serial Number
                        </th>
                        <th style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontWeight: '600',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Tag ID
                        </th>
                        <th style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontWeight: '600',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Item Name
                        </th>
                        <th style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontWeight: '600',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Category
                        </th>
                        <th style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontWeight: '600',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Model
                        </th>
                        <th style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontWeight: '600',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Branch
                        </th>
                        <th style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontWeight: '600',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Recipient Name
                        </th>
                        <th style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontWeight: '600',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Department
                        </th>
                        <th style={{
                          padding: '12px 16px',
                          textAlign: 'center',
                          fontWeight: '600',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Status
                        </th>
                        <th style={{
                          padding: '12px 16px',
                          textAlign: 'center',
                          fontWeight: '600',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAssets.map((asset, index) => (
                        <tr 
                          key={asset.Asset_ID}
                          style={{
                            backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb',
                            transition: 'background-color 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#f9fafb'}
                        >
                          <td style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: '500', color: '#1f2937' }}>
                            {asset.Asset_Serial_Number || 'N/A'}
                          </td>
                          <td style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                            {asset.Asset_Tag_ID || 'N/A'}
                          </td>
                          <td style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', color: '#1f2937', fontWeight: '500' }}>
                            {asset.Item_Name || 'N/A'}
                          </td>
                          <td style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                            {asset.Category || 'N/A'}
                          </td>
                          <td style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                            {asset.Model || 'N/A'}
                          </td>
                          <td style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                            {asset.Branch || 'N/A'}
                          </td>
                          <td style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', color: '#1f2937', fontWeight: '500' }}>
                            {asset.Recipient_Name || 'N/A'}
                          </td>
                          <td style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                            {asset.Department || 'N/A'}
                          </td>
                          <td style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600',
                              backgroundColor: asset.Status === 'Active' ? '#d1fae5' : '#fee2e2',
                              color: asset.Status === 'Active' ? '#065f46' : '#991b1b'
                            }}>
                              {asset.Status || 'Unknown'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button
                                onClick={() => navigate(`/asset-detail/${asset.Asset_ID}`)}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: '#667eea',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#5568d3'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = '#667eea'}
                              >
                                <Eye size={14} />
                                View
                              </button>
                              <button
                                onClick={() => navigate(`/edit-asset/${asset.Asset_ID}`)}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: '#10b981',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
                              >
                                <Edit size={14} />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteAsset(asset.Asset_ID)}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                              >
                                <Trash2 size={14} />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Component */}
                <div style={{ marginTop: '20px' }}>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    itemsPerPage={itemsPerPage}
                    onItemsPerPageChange={setItemsPerPage}
                    totalItems={filteredAssets.length}
                  />
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
