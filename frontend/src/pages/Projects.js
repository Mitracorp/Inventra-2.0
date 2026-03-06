import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Plus, Eye, Edit, Trash2, Users, Calendar, Package, Award, Shield, Wrench, Clock, CheckCircle, XCircle, AlertCircle, FolderOpen } from 'lucide-react';
import { API_URL } from '../config/api';
import usePageTitle from '../hooks/usePageTitle';
import toast from '../utils/toast';

const Projects = () => {
  usePageTitle('Projects');
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, project: null });
  const [deleting, setDeleting] = useState(false);
  const [userRole, setUserRole] = useState('');
  
  // New states for deletion flow
  const [deletionPreview, setDeletionPreview] = useState(null);
  const [deletionStep, setDeletionStep] = useState('preview'); // 'preview', 'password', 'deleting'
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Get user role from localStorage
  useEffect(() => {
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo);
        setUserRole(user.role || '');
      } catch (error) {
        setUserRole('');
      }
    }
  }, []);

  // Helper function to check if user is customer-type role
  const isCustomerRole = () => {
    if (!userRole) return false;
    const roleLower = userRole.toLowerCase();
    return roleLower !== 'admin' && roleLower !== 'staff';
  };

  // Fetch projects from API
  const fetchProjects = async () => {
    console.log('🔄 Starting Projects API call to Node.js backend');
    
    try {
      // Use direct fetch with correct API endpoint
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/projects`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const responseData = await response.json();
      console.log('✅ Projects API response:', responseData);
      
      // Extract projects array from response (handle both old and new format)
      const projects = responseData.data || responseData || [];
      console.log('✅ Projects found:', projects.length);
      setProjects(projects);
    } catch (error) {
      console.error('❌ Error fetching projects:', error);
      console.error('❌ Error details:', error.message);
      setProjects([]);
    } finally {
      console.log('⏰ Projects API call completed, loading set to false');
      setLoading(false);
    }
  };

  // Fetch projects when component mounts
  useEffect(() => {
    fetchProjects();
  }, []);

  // Handle delete button click - show confirmation with preview
  const handleDeleteClick = async (project) => {
    setDeleteConfirm({ show: true, project });
    setDeletionStep('preview');
    setPassword('');
    setPasswordError('');
    setLoadingPreview(true);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/projects/${project.Project_ID}/deletion-preview`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load deletion preview');
      }
      
      const preview = await response.json();
      setDeletionPreview(preview);
    } catch (error) {
      console.error('Error loading deletion preview:', error);
      toast.error('Failed to load deletion information');
      setDeleteConfirm({ show: false, project: null });
    } finally {
      setLoadingPreview(false);
    }
  };

  // Handle proceed to password step
  const handleProceedToPassword = () => {
    setDeletionStep('password');
    setPasswordError('');
  };

  // Handle password verification and deletion
  const handleConfirmDelete = async () => {
    if (!deleteConfirm.project) return;
    if (!password) {
      setPasswordError('Password is required');
      return;
    }

    setDeleting(true);
    setPasswordError('');
    
    try {
      const token = localStorage.getItem('authToken');
      
      // Step 1: Verify password
      const verifyResponse = await fetch(`${API_URL}/auth/verify-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password })
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(errorData.message || 'Incorrect password');
      }

      // Step 2: Delete project
      setDeletionStep('deleting');
      const response = await fetch(`${API_URL}/projects/${deleteConfirm.project.Project_ID}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete project');
      }

      const result = await response.json();
      console.log('Project deleted successfully:', result);
      
      toast.success(`Project deleted successfully! Removed ${result.deletedAssets} assets, ${result.deletedPMRecords} PM records, and ${result.deletedPeripherals} peripherals.`);
      
      // Refresh the project list
      await fetchProjects();
      
      // Close the confirmation dialog
      setDeleteConfirm({ show: false, project: null });
      setDeletionPreview(null);
      setPassword('');
    } catch (error) {
      console.error('Error deleting project:', error);
      if (error.message.includes('password')) {
        setPasswordError(error.message);
        setDeletionStep('password'); // Go back to password step
      } else {
        toast.error(`Failed to delete project: ${error.message}`);
      }
    } finally {
      setDeleting(false);
    }
  };

  // Handle cancel delete
  const handleCancelDelete = () => {
    setDeleteConfirm({ show: false, project: null });
    setDeletionPreview(null);
    setPassword('');
    setPasswordError('');
    setDeletionStep('preview');
  };

  // Create status based on end date
  const getProjectStatus = (endDate) => {
    if (!endDate) return 'Unknown';
    const today = new Date();
    const projectEndDate = new Date(endDate);
    return projectEndDate >= today ? 'Active' : 'Completed';
  };

  // Filter projects by search term and status
  const filteredProjects = projects
    .filter(project => {
      // Search filter
      const matchesSearch = (
        (project.Customer_Name && project.Customer_Name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (project.Project_Title && project.Project_Title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (project.Project_Ref_Number && project.Project_Ref_Number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (project.Solution_Principal && project.Solution_Principal.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      
      // Status filter
      const projectStatus = getProjectStatus(project.End_Date);
      const matchesStatus = !statusFilter || projectStatus === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

  const statuses = ['Active', 'Completed', 'Unknown'];

  const getStatusColor = (status) => {
    const colors = {
      'Active': { bg: '#d4edda', text: '#155724' },
      'Completed': { bg: '#e2e3e5', text: '#383d41' },
      'Unknown': { bg: '#f8f9fa', text: '#495057' }
    };
    return colors[status] || { bg: '#f8f9fa', text: '#495057' };
  };

  // Show loading state
  if (loading) {
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
          padding: '30px 20px 15px 20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FolderOpen size={28} color="#667eea" />
            <div>
              <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.4rem' }}>
                Projects
              </h2>
              <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
                Manage all projects
              </p>
            </div>
          </div>
          <div className="actions">
            <button 
              className="btn btn-primary" 
              onClick={() => navigate('/projects/add')} 
              disabled={isCustomerRole()}
              title={isCustomerRole() ? 'Customer accounts cannot add new projects' : 'Add a new project'}
            >
              <Plus size={16} style={{ marginRight: '5px' }} />
              Add New Project
            </button>
          </div>
        </div>
        <div className="card">
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            Loading projects...
          </div>
        </div>
        </div>
    );
  }

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
          <FolderOpen size={28} color="#667eea" />
          <div>
            <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.4rem' }}>
              Projects
            </h2>
            <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
              Total Projects: <strong>{projects.length}</strong> | Active: <strong>{projects.filter(p => getProjectStatus(p.End_Date) === 'Active').length}</strong>
            </p>
          </div>
        </div>
        <div className="actions">
          <button 
            className="btn btn-primary" 
            onClick={() => !isCustomerRole() && navigate('/projects/add')}
            disabled={isCustomerRole()}
            title={isCustomerRole() ? 'Customer accounts cannot add new projects' : 'Add a new project'}
            style={{
              background: isCustomerRole() ? '#cccccc' : 'white',
              color: isCustomerRole() ? '#666' : '#667eea',
              border: 'none',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '600',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.3s ease',
              cursor: isCustomerRole() ? 'not-allowed' : 'pointer',
              opacity: isCustomerRole() ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!isCustomerRole()) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.25)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isCustomerRole()) {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
              }
            }}
          >
            <Plus size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Add New Project
          </button>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
      {/* Full Width Search and Content Section */}
      <div style={{ padding: '0 20px', width: '100%', boxSizing: 'border-box' }}>
        {/* Search and Filter Section */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '25px',
          marginBottom: '30px',
          boxShadow: '0 2px 15px rgba(0, 0, 0, 0.08)',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', width: '100%' }}>
            {/* Search Bar */}
            <div style={{ flex: '1', minWidth: '300px', position: 'relative' }}>
              <Search 
                size={20} 
                style={{ 
                  position: 'absolute', 
                  left: '15px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: '#9ca3af' 
                }} 
              />
              <input
                type="text"
                placeholder="Search by customer, project title, ref number, or solution principal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 45px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  fontSize: '15px',
                  transition: 'all 0.3s ease',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '200px' }}>
              <Filter size={20} style={{ color: '#667eea' }} />
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  flex: 1,
                  padding: '12px 15px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  fontSize: '15px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="">All Status</option>
                {statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '60px 40px',
            textAlign: 'center',
            boxShadow: '0 2px 15px rgba(0, 0, 0, 0.08)'
          }}>
            <Package size={64} style={{ color: '#d1d5db', marginBottom: '20px' }} />
            <h3 style={{ color: '#6b7280', marginBottom: '10px' }}>No Projects Found</h3>
            <p style={{ color: '#9ca3af' }}>
              {searchTerm ? 'Try adjusting your search criteria' : 'Get started by adding your first project'}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: '25px',
            marginBottom: '40px'
          }}>
            {filteredProjects.map(project => {
              const projectStatus = getProjectStatus(project.End_Date);
              const statusConfig = {
                'Active': { 
                  icon: CheckCircle, 
                  bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  iconColor: '#10b981'
                },
                'Completed': { 
                  icon: CheckCircle, 
                  bg: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                  iconColor: '#6b7280'
                },
                'Unknown': { 
                  icon: AlertCircle, 
                  bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  iconColor: '#f59e0b'
                }
              };
              const config = statusConfig[projectStatus];
              const StatusIcon = config.icon;

              return (
                <div 
                  key={project.Project_ID}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 15px rgba(0, 0, 0, 0.08)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    border: '1px solid #f3f4f6',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 15px rgba(0, 0, 0, 0.08)';
                  }}
                >
                  {/* Card Header with Gradient */}
                  <div style={{
                    background: config.bg,
                    padding: '25px 25px 20px 25px',
                    color: 'white',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '20px',
                      right: '20px',
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      borderRadius: '20px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      backdropFilter: 'blur(10px)'
                    }}>
                      <StatusIcon size={14} />
                      {projectStatus}
                    </div>
                    <h3 style={{
                      margin: '0 0 10px 0',
                      fontSize: '20px',
                      fontWeight: '700',
                      paddingRight: '100px',
                      lineHeight: '1.3'
                    }}>
                      {project.Customer_Name || 'No Customer'}
                    </h3>
                    <p style={{
                      margin: '0 0 8px 0',
                      fontSize: '13px',
                      opacity: 0.85,
                      fontWeight: '400',
                      lineHeight: '1.5',
                      paddingRight: '100px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxHeight: '3em'
                    }}>
                      {project.Project_Title || 'No Project Title'}
                    </p>
                    <p style={{
                      margin: 0,
                      fontSize: '12px',
                      opacity: 0.75,
                      fontWeight: '500'
                    }}>
                      Ref: {project.Project_Ref_Number || 'N/A'}
                    </p>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '25px' }}>
                    {/* Info Grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '12px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '10px'
                      }}>
                        <Calendar size={18} style={{ color: '#667eea', marginTop: '2px', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>
                            Duration
                          </div>
                          <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>
                            {project.Start_Date ? new Date(project.Start_Date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'} 
                            {' → '}
                            {project.End_Date ? new Date(project.End_Date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '12px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '10px'
                      }}>
                        <Users size={18} style={{ color: '#10b981', marginTop: '2px', flexShrink: 0 }} />
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>
                            Solution Principal
                          </div>
                          <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>
                            {(() => {
                              if (!project.Solution_Principals) return 'Not Assigned';
                              
                              // Parse the concatenated solution principals
                              // Format: "SP_Name1|Support_Type1||SP_Name2|Support_Type2"
                              const spList = project.Solution_Principals.split('||').filter(Boolean);
                              
                              if (spList.length === 0) return 'Not Assigned';
                              
                              return (
                                <div style={{ 
                                  display: 'flex', 
                                  gap: '6px',
                                  flexWrap: 'nowrap',
                                  overflow: 'hidden'
                                }}>
                                  {spList.map((sp, idx) => {
                                    const [name] = sp.split('|'); // Only get the name, ignore support type
                                    return (
                                      <span key={idx} style={{ 
                                        display: 'inline-block',
                                        fontWeight: '600', 
                                        color: '#10b981',
                                        backgroundColor: '#ffffff',
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        border: '1px solid #d1fae5',
                                        fontSize: '13px',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0
                                      }}>
                                        {name}
                                      </span>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '12px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '10px'
                      }}>
                        <Shield size={18} style={{ color: '#ef4444', marginTop: '2px', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>
                            Antivirus
                          </div>
                          <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>
                            {project.Antivirus || 'Not Specified'}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '12px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '10px'
                      }}>
                        <Award size={18} style={{ color: '#f59e0b', marginTop: '2px', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>
                            Warranty
                          </div>
                          <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>
                            {project.Warranty || 'No Warranty'}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '12px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '10px',
                        minHeight: '70px'
                      }}>
                        <Wrench size={18} style={{ color: '#8b5cf6', marginTop: '2px', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>
                            Preventive Maintenance
                          </div>
                          <div style={{ 
                            fontSize: '14px', 
                            color: '#1f2937', 
                            fontWeight: '500',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: '1.4',
                            maxHeight: '4.2em'
                          }}>
                            {project.Preventive_Maintenance || 'Not Scheduled'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{
                      marginTop: '20px',
                      paddingTop: '20px',
                      borderTop: '1px solid #f3f4f6',
                      display: 'flex',
                      gap: '10px'
                    }}>
                      <button 
                        onClick={() => navigate(`/projects/${project.Project_ID}`)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          backgroundColor: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#5568d3'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#667eea'}
                      >
                        <Eye size={16} />
                        View
                      </button>
                      <button 
                        onClick={() => navigate(`/projects/edit/${project.Project_ID}`)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
                      >
                        <Edit size={16} />
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(project)}
                        style={{
                          padding: '10px 16px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      </div>

      {/* Delete Confirmation Modal - Enhanced */}
      {deleteConfirm.show && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '40px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 75px rgba(239, 68, 68, 0.4)',
            border: '3px solid #ef4444',
            animation: 'slideUp 0.3s ease'
          }}>
            {/* Header with Icon */}
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              border: '4px solid #fee2e2'
            }}>
              <AlertCircle size={45} style={{ color: '#dc2626' }} />
            </div>
            
            <h2 style={{ 
              marginTop: 0, 
              marginBottom: '10px', 
              color: '#dc2626',
              fontSize: '28px',
              fontWeight: '800',
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              ⚠️ DANGER ZONE ⚠️
            </h2>
            
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: '20px', 
              color: '#1f2937',
              fontSize: '22px',
              fontWeight: '700',
              textAlign: 'center'
            }}>
              Delete Project Permanently
            </h3>
            
            {/* Preview Step */}
            {deletionStep === 'preview' && (
              <>
                {loadingPreview ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      border: '4px solid #f3f4f6',
                      borderTop: '4px solid #ef4444',
                      borderRadius: '50%',
                      margin: '0 auto 15px',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>Loading deletion information...</p>
                  </div>
                ) : (
                  <>
                    {deleteConfirm.project && deletionPreview && (
                      <>
                        {/* Project Info */}
                        <div style={{
                          backgroundColor: '#f9fafb',
                          padding: '20px',
                          borderRadius: '12px',
                          marginBottom: '20px',
                          border: '2px solid #e5e7eb'
                        }}>
                          <p style={{ 
                            margin: '0 0 10px 0', 
                            fontSize: '16px',
                            color: '#1f2937',
                            fontWeight: '600'
                          }}>
                            <strong>Customer:</strong> {deleteConfirm.project.Customer_Name || 'Unknown'}
                          </p>
                          <p style={{ 
                            margin: '0 0 10px 0', 
                            fontSize: '15px',
                            color: '#374151'
                          }}>
                            <strong>Project:</strong> {deleteConfirm.project.Project_Title || 'No Title'}
                          </p>
                          <p style={{ 
                            margin: 0, 
                            fontSize: '14px',
                            color: '#6b7280'
                          }}>
                            <strong>Ref Number:</strong> {deleteConfirm.project.Project_Ref_Number}
                          </p>
                        </div>
                        
                        {/* Critical Warning */}
                        <div style={{
                          backgroundColor: '#7f1d1d',
                          padding: '20px',
                          borderRadius: '12px',
                          marginBottom: '20px',
                          border: '2px solid #991b1b'
                        }}>
                          <p style={{ 
                            margin: '0 0 12px 0', 
                            color: '#fef2f2', 
                            fontSize: '16px',
                            fontWeight: '700',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                          }}>
                            <AlertCircle size={22} />
                            CRITICAL WARNING
                          </p>
                          <p style={{ 
                            margin: 0, 
                            color: '#fecaca', 
                            fontSize: '14px',
                            lineHeight: '1.6'
                          }}>
                            This action is <strong>PERMANENT</strong> and <strong>CANNOT BE UNDONE</strong>. 
                            All data associated with this project will be permanently deleted from the database.
                          </p>
                        </div>
                        
                        {/* What Will Be Deleted */}
                        <div style={{
                          backgroundColor: '#fef2f2',
                          padding: '20px',
                          borderRadius: '12px',
                          marginBottom: '25px',
                          border: '2px solid #fecaca'
                        }}>
                          <h4 style={{ 
                            margin: '0 0 15px 0', 
                            color: '#991b1b',
                            fontSize: '16px',
                            fontWeight: '700'
                          }}>
                            📋 The following will be permanently deleted:
                          </h4>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between',
                              padding: '10px',
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              border: '1px solid #fee2e2'
                            }}>
                              <span style={{ color: '#374151', fontWeight: '600' }}>🗄️ Assets</span>
                              <span style={{ color: '#dc2626', fontWeight: '700', fontSize: '16px' }}>
                                {deletionPreview.counts.assets}
                              </span>
                            </div>
                            
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between',
                              padding: '10px',
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              border: '1px solid #fee2e2'
                            }}>
                              <span style={{ color: '#374151', fontWeight: '600' }}>🔧 PM Records</span>
                              <span style={{ color: '#dc2626', fontWeight: '700', fontSize: '16px' }}>
                                {deletionPreview.counts.pmRecords}
                              </span>
                            </div>
                            
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between',
                              padding: '10px',
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              border: '1px solid #fee2e2'
                            }}>
                              <span style={{ color: '#374151', fontWeight: '600' }}>🖨️ Peripherals</span>
                              <span style={{ color: '#dc2626', fontWeight: '700', fontSize: '16px' }}>
                                {deletionPreview.counts.peripherals}
                              </span>
                            </div>
                            
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between',
                              padding: '10px',
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              border: '1px solid #fee2e2'
                            }}>
                              <span style={{ color: '#374151', fontWeight: '600' }}>💾 Software Links</span>
                              <span style={{ color: '#dc2626', fontWeight: '700', fontSize: '16px' }}>
                                {deletionPreview.counts.softwareLinks}
                              </span>
                            </div>
                            
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between',
                              padding: '10px',
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              border: '1px solid #fee2e2'
                            }}>
                              <span style={{ color: '#374151', fontWeight: '600' }}>👥 Customers</span>
                              <span style={{ color: '#dc2626', fontWeight: '700', fontSize: '16px' }}>
                                {deletionPreview.counts.customers}
                              </span>
                            </div>
                            
                            <div style={{ 
                              marginTop: '10px',
                              padding: '15px',
                              backgroundColor: '#991b1b',
                              borderRadius: '8px',
                              textAlign: 'center'
                            }}>
                              <span style={{ color: '#fef2f2', fontWeight: '700', fontSize: '18px' }}>
                                📊 TOTAL RECORDS: {
                                  deletionPreview.counts.assets + 
                                  deletionPreview.counts.pmRecords + 
                                  deletionPreview.counts.peripherals + 
                                  deletionPreview.counts.softwareLinks + 
                                  deletionPreview.counts.customers + 
                                  1 // The project itself
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                    
                    <div style={{ 
                      display: 'flex', 
                      gap: '12px',
                      justifyContent: 'stretch'
                    }}>
                      <button 
                        onClick={handleCancelDelete}
                        style={{
                          flex: 1,
                          padding: '16px 24px',
                          backgroundColor: '#f3f4f6',
                          color: '#1f2937',
                          border: 'none',
                          borderRadius: '12px',
                          fontSize: '16px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#e5e7eb'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleProceedToPassword}
                        style={{
                          flex: 1,
                          padding: '16px 24px',
                          backgroundColor: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '12px',
                          fontSize: '16px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#b91c1c'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#dc2626'}
                      >
                        I Understand, Continue →
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
            
            {/* Password Step */}
            {deletionStep === 'password' && (
              <>
                <div style={{
                  backgroundColor: '#fef2f2',
                  padding: '20px',
                  borderRadius: '12px',
                  marginBottom: '25px',
                  border: '2px solid #fecaca'
                }}>
                  <p style={{ 
                    margin: '0 0 15px 0', 
                    color: '#991b1b', 
                    fontSize: '15px',
                    fontWeight: '600',
                    lineHeight: '1.6'
                  }}>
                    🔐 To proceed with this critical deletion, please enter your account password to confirm your identity.
                  </p>
                  
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    Your Password *
                  </label>
                  
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError('');
                    }}
                    placeholder="Enter your password"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '14px',
                      border: passwordError ? '2px solid #dc2626' : '2px solid #d1d5db',
                      borderRadius: '10px',
                      fontSize: '15px',
                      marginBottom: '8px',
                      boxSizing: 'border-box',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => {
                      if (!passwordError) e.target.style.borderColor = '#667eea';
                    }}
                    onBlur={(e) => {
                      if (!passwordError) e.target.style.borderColor = '#d1d5db';
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && password) {
                        handleConfirmDelete();
                      }
                    }}
                  />
                  
                  {passwordError && (
                    <p style={{
                      margin: '8px 0 0 0',
                      color: '#dc2626',
                      fontSize: '14px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <XCircle size={16} />
                      {passwordError}
                    </p>
                  )}
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  gap: '12px',
                  justifyContent: 'stretch'
                }}>
                  <button 
                    onClick={handleCancelDelete}
                    disabled={deleting}
                    style={{
                      flex: 1,
                      padding: '16px 24px',
                      backgroundColor: '#f3f4f6',
                      color: '#1f2937',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: deleting ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      opacity: deleting ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => !deleting && (e.target.style.backgroundColor = '#e5e7eb')}
                    onMouseLeave={(e) => !deleting && (e.target.style.backgroundColor = '#f3f4f6')}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleConfirmDelete}
                    disabled={deleting || !password}
                    style={{
                      flex: 1,
                      padding: '16px 24px',
                      backgroundColor: deleting || !password ? '#9ca3af' : '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '16px',
                      fontWeight: '700',
                      cursor: deleting || !password ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!deleting && password) e.target.style.backgroundColor = '#b91c1c';
                    }}
                    onMouseLeave={(e) => {
                      if (!deleting && password) e.target.style.backgroundColor = '#dc2626';
                    }}
                  >
                    {deleting ? 'Verifying & Deleting...' : 'Confirm Delete'}
                  </button>
                </div>
              </>
            )}
            
            {/* Deleting Step */}
            {deletionStep === 'deleting' && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  border: '6px solid #fee2e2',
                  borderTop: '6px solid #dc2626',
                  borderRadius: '50%',
                  margin: '0 auto 20px',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <p style={{ 
                  color: '#1f2937', 
                  fontSize: '18px',
                  fontWeight: '600',
                  marginBottom: '8px'
                }}>
                  Deleting Project...
                </p>
                <p style={{ 
                  color: '#6b7280', 
                  fontSize: '14px'
                }}>
                  Please wait while we remove all related records
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;