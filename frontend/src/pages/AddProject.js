import React, { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, Calendar, FileText, User, Shield, Wrench, Building2, MapPin, X } from 'lucide-react';
import { API_URL } from '../config/api';
import SearchableDropdown from '../components/SearchableDropdown';

const AddProject = () => {
  usePageTitle('Add Project');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [project, setProject] = useState({
    Project_Ref_Number: '',
    Project_Title: '',
    Warranty: '',
    Preventive_Maintenance: '',
    PM_Frequency: 2,
    Start_Date: '',
    End_Date: '',
    Antivirus: ''
  });
  
  // Customer information
  const [customer, setCustomer] = useState({
    Customer_Ref_Number: '',
    Customer_Name: ''
  });
  
  // Branches as an array
  const [branches, setBranches] = useState(['']);
  const [branchInput, setBranchInput] = useState('');

  // Solution Principals
  const [solutionPrincipals, setSolutionPrincipals] = useState([]);
  const [selectedSolutionPrincipals, setSelectedSolutionPrincipals] = useState([]);

  // Fetch solution principals on mount
  useEffect(() => {
    fetchSolutionPrincipals();
  }, []);

  const fetchSolutionPrincipals = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/solution-principals`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Solution Principals fetched:', data);
        setSolutionPrincipals(data || []);
      }
    } catch (error) {
      console.error('Error fetching solution principals:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate branches
    const validBranches = branches.filter(b => b.trim() !== '');
    if (validBranches.length === 0) {
      setError('Please add at least one branch');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        project,
        customer: {
          ...customer,
          branches: validBranches
        },
        solution_principals: selectedSolutionPrincipals // Array of SP_IDs
      };
      
      console.log('Submitting project data:', payload);
      
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Server error' }));
        console.error('Server error response:', errorData);
        throw new Error(errorData.error || errorData.message || `Server error: ${response.status}`);
      }

      const newProject = await response.json();
      console.log('Project created successfully:', newProject);
      
      // Navigate back to projects page
      navigate('/projects');
    } catch (error) {
      console.error('Error creating project:', error);
      setError(error.message || 'Failed to create project. Please try again. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setProject({ ...project, [e.target.name]: e.target.value });
  };

  const handleCustomerChange = (e) => {
    setCustomer({ ...customer, [e.target.name]: e.target.value });
  };

  const addBranch = () => {
    if (branchInput.trim() !== '') {
      setBranches([...branches, branchInput.trim()]);
      setBranchInput('');
    }
  };

  const removeBranch = (index) => {
    setBranches(branches.filter((_, i) => i !== index));
  };

  const handleSolutionPrincipalSelect = (spId) => {
    if (spId && !selectedSolutionPrincipals.includes(spId)) {
      setSelectedSolutionPrincipals([...selectedSolutionPrincipals, spId]);
    }
  };

  const removeSolutionPrincipal = (spId) => {
    setSelectedSolutionPrincipals(selectedSolutionPrincipals.filter(id => id !== spId));
  };

  const getSelectedSPName = (spId) => {
    const sp = solutionPrincipals.find(s => s.SP_ID === spId);
    return sp ? sp.SP_Name : 'Unknown';
  };

  const handleBranchKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addBranch();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => navigate('/projects')} className="btn btn-secondary" style={{ marginRight: '15px' }}>
          <ArrowLeft size={16} />
        </button>
        <h1 className="page-title">Add New Project</h1>
      </div>

      {error && (
        <div style={{
          padding: '15px',
          marginBottom: '20px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '8px',
          color: '#c00'
        }}>
          {error}
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit}>
          {/* Customer Information Section */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: '20px', 
              paddingBottom: '10px', 
              borderBottom: '2px solid #4CAF50',
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <Building2 size={20} />
              Customer Information
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label>
                  <FileText size={16} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                  Customer Reference Number *
                </label>
                <input
                  type="text"
                  name="Customer_Ref_Number"
                  value={customer.Customer_Ref_Number}
                  onChange={handleCustomerChange}
                  placeholder="e.g., M24051"
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  <Building2 size={16} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                  Customer Name *
                </label>
                <input
                  type="text"
                  name="Customer_Name"
                  value={customer.Customer_Name}
                  onChange={handleCustomerChange}
                  placeholder="Enter customer name"
                  required
                />
              </div>
            </div>

            {/* Branches Section */}
            <div className="form-group" style={{ marginTop: '20px' }}>
              <label>
                <MapPin size={16} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Branches * (Press Enter or click Add to add multiple branches)
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={branchInput}
                  onChange={(e) => setBranchInput(e.target.value)}
                  onKeyPress={handleBranchKeyPress}
                  placeholder="e.g., Putrajaya"
                />
                <button 
                  type="button" 
                  onClick={addBranch}
                  className="btn btn-secondary"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Add Branch
                </button>
              </div>
              
              {/* Display added branches */}
              {branches.filter(b => b.trim() !== '').length > 0 && (
                <div style={{ 
                  marginTop: '15px', 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '10px' 
                }}>
                  {branches.map((branch, index) => 
                    branch.trim() !== '' && (
                      <div 
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          backgroundColor: '#e8f5e9',
                          border: '1px solid #4CAF50',
                          borderRadius: '20px',
                          fontSize: '14px'
                        }}
                      >
                        <MapPin size={14} color="#4CAF50" />
                        <span>{branch}</span>
                        <button
                          type="button"
                          onClick={() => removeBranch(index)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <X size={16} color="#666" />
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Solution Principal Section */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: '20px', 
              paddingBottom: '10px', 
              borderBottom: '2px solid #9C27B0',
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <User size={20} />
              Solution Principal
            </h3>
            
            <div className="form-group">
              <label>
                <User size={16} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Select Solution Principals
              </label>
              <SearchableDropdown
                options={solutionPrincipals
                  .filter(sp => !selectedSolutionPrincipals.includes(sp.SP_ID))
                  .map(sp => ({
                    value: sp.SP_ID,
                    label: sp.SP_Name
                  }))}
                value=""
                onChange={(selectedValue) => handleSolutionPrincipalSelect(selectedValue)}
                placeholder="Type to search and select solution principals..."
                searchPlaceholder="Search solution principals..."
                getOptionLabel={(option) => option.label}
                getOptionValue={(option) => option.value}
                clearable={false}
              />
              
              {/* Display selected solution principals */}
              {selectedSolutionPrincipals.length > 0 && (
                <div style={{ 
                  marginTop: '15px', 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '10px' 
                }}>
                  {selectedSolutionPrincipals.map((spId) => (
                    <div 
                      key={spId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        backgroundColor: '#f3e5f5',
                        border: '1px solid #9C27B0',
                        borderRadius: '20px',
                        fontSize: '14px'
                      }}
                    >
                      <User size={14} color="#9C27B0" />
                      <span>{getSelectedSPName(spId)}</span>
                      <button
                        type="button"
                        onClick={() => removeSolutionPrincipal(spId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <X size={16} color="#666" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Project Information Section */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: '20px', 
              paddingBottom: '10px', 
              borderBottom: '2px solid #2196F3',
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <FileText size={20} />
              Project Information
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="form-group">
              <label>
                <FileText size={16} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Project Reference Number *
              </label>
              <input
                type="text"
                name="Project_Ref_Number"
                value={project.Project_Ref_Number}
                onChange={handleChange}
                placeholder="e.g., PRJ-2024-001"
                required
              />
            </div>

            <div className="form-group">
              <label>
                <FileText size={16} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Project Title *
              </label>
              <input
                type="text"
                name="Project_Title"
                value={project.Project_Title}
                onChange={handleChange}
                placeholder="Enter project title"
                required
              />
            </div>

            <div className="form-group">
              <label>
                <Shield size={16} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Antivirus
              </label>
              <input
                type="text"
                name="Antivirus"
                value={project.Antivirus}
                onChange={handleChange}
                placeholder="e.g., Kaspersky, McAfee, Norton"
              />
            </div>

            <div className="form-group">
              <label>
                <Shield size={16} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Warranty
              </label>
              <input
                type="text"
                name="Warranty"
                value={project.Warranty}
                onChange={handleChange}
                placeholder="e.g., 2 Years Extended"
              />
            </div>

            <div className="form-group">
              <label>
                <Wrench size={16} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Preventive Maintenance
              </label>
              <input
                type="text"
                name="Preventive_Maintenance"
                value={project.Preventive_Maintenance}
                onChange={handleChange}
                placeholder="e.g., Quarterly Service"
              />
            </div>

            <div className="form-group">
              <label>
                <Calendar size={16} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                PM Frequency (per year) *
              </label>
              <select
                name="PM_Frequency"
                value={project.PM_Frequency}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '1rem'
                }}
              >
                <option value="1">Once per year (Annual)</option>
                <option value="2">Twice per year (Bi-annual / Every 6 months)</option>
                <option value="4">Quarterly (Every 3 months)</option>
                <option value="6">Every 2 months</option>
                <option value="12">Monthly</option>
              </select>
              <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '5px', display: 'block' }}>
                Determines how often PM should be scheduled from the start date
              </small>
            </div>

            <div className="form-group">
              <label>
                <Calendar size={16} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Start Date *
              </label>
              <input
                type="date"
                name="Start_Date"
                value={project.Start_Date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>
                <Calendar size={16} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                End Date *
              </label>
              <input
                type="date"
                name="End_Date"
                value={project.End_Date}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #e0e0e0' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Save size={16} style={{ marginRight: '5px' }} />
              {loading ? 'Saving...' : 'Save Project'}
            </button>
            <button 
              type="button" 
              onClick={() => navigate('/projects')} 
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', fontSize: '14px', color: '#666' }}>
        <strong>Note:</strong> Project ID will be automatically generated by the system. Fields marked with * are required.
      </div>
    </div>
  );
};

export default AddProject;
