import React, { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, AlertCircle, CheckCircle, X, Plus, Package, Building2, ClipboardList, Edit3 } from 'lucide-react';
import { API_URL } from '../config/api';
import apiService from '../services/apiService';
import SearchableDropdown from '../components/SearchableDropdown';
import toast from '../utils/toast';

const EditAsset = () => {
  usePageTitle('Edit Asset');
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('asset');
  
  // Dropdown options state
  const [windowsOptions, setWindowsOptions] = useState([]);
  const [officeOptions, setOfficeOptions] = useState([]);
  const [antivirusOptions, setAntivirusOptions] = useState([]);
  const [softwareOptions, setSoftwareOptions] = useState([]);
  const [softwareOptionsRaw, setSoftwareOptionsRaw] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [modelOptions, setModelOptions] = useState([]);
  const [peripheralTypeOptions, setPeripheralTypeOptions] = useState([]);
  const [branchOptions, setBranchOptions] = useState([]);
  const [softwareLinks, setSoftwareLinks] = useState([]);
  const [newSoftwareSelection, setNewSoftwareSelection] = useState('');
  const [projectAntivirusName, setProjectAntivirusName] = useState('');
  
  // Modal states for adding new options
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'windows', 'office', 'antivirus', 'software', 'category', 'model', or 'peripheral'
  const [newOptionValue, setNewOptionValue] = useState('');
  const [addingOption, setAddingOption] = useState(false);
  
  // Delete peripheral confirmation
  const [showDeletePeripheralModal, setShowDeletePeripheralModal] = useState(false);
  const [peripheralToDelete, setPeripheralToDelete] = useState(null);
  
  // Peripherals state - array of peripheral objects
  const [peripherals, setPeripherals] = useState([]);
  
  const [originalData, setOriginalData] = useState(null);
  const [formData, setFormData] = useState({
    // Asset Info
    Asset_Serial_Number: '',
    Asset_Tag_ID: '',
    Item_Name: '',
    Category: '',
    Model: '',
    Category: '',
    Status: 'Active',
    Windows: '',
    Microsoft_Office: '',
    Antivirus: '',
    Software: '',
    Monthly_Prices: '',
    
    // Customer Info
    Customer_Name: '',
    Customer_Ref_Number: '',
    Branch: '',
    Recipient_Name: '',
    Department: '',
    Position: '',
    
    // Project Info
    Project_Ref_Number: '',
    Warranty: '',
    Start_Date: '',
    End_Date: ''
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Fetch asset data on component mount
  useEffect(() => {
    fetchAssetData();
    fetchDropdownOptions();
  }, [id]);

  // Fetch branches when Customer_Ref_Number changes
  useEffect(() => {
    if (formData.Customer_Ref_Number) {
      fetchBranchesForCustomer(formData.Customer_Ref_Number);
    }
  }, [formData.Customer_Ref_Number]);

  const fetchAssetData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Fetching asset data for editing, ID:', id);
      
      const response = await fetch(`${API_URL}/assets/detail/${id}`, {
        headers: {
          ...getAuthHeaders()
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch asset: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Asset data loaded:', data);
      
      // Extract peripheral data
      const peripheralData = data.Peripherals && data.Peripherals.length > 0 
        ? data.Peripherals.map(p => ({
            Peripheral_ID: p.Peripheral_ID,
            Peripheral_Type_Name: p.Peripheral_Type_Name || '',
            Serial_Code: p.Serial_Code || '',
            Condition: p.Condition || '',
            Remarks: p.Remarks || ''
          }))
        : [];
      
      console.log('📦 Peripheral data:', peripheralData);
      setPeripherals(peripheralData);
      
      // Store original data for comparison
      setOriginalData(data);

      // Build antivirus dropdown based on AV flag and project antivirus name
      const avName = data.Project_Antivirus || data.Antivirus || 'Antivirus';
      setProjectAntivirusName(avName);
      setAntivirusOptions([
        `Yes (${avName})`,
        'No'
      ]);

      // Store linked software list (with IDs and prices)
      setSoftwareLinks(data.SoftwareList || []);
      
      // Populate form with current data
      setFormData({
        Asset_Serial_Number: data.Asset_Serial_Number || '',
        Asset_Tag_ID: data.Asset_Tag_ID || '',
        Item_Name: data.Item_Name || '',
        Category: data.Category || '',
        Model: data.Model || '',
        Category: data.Category || '',
        Status: data.Status || 'Active',
        Windows: data.Windows || '',
        Microsoft_Office: data.Microsoft_Office || '',
        Antivirus: data.AV === 1 ? `Yes (${avName})` : 'No',
        Software: data.Software || '',
        Monthly_Prices: data.Monthly_Prices || '',
        Customer_Name: data.Customer_Name || '',
        Customer_Ref_Number: data.Customer_Ref_Number || '',
        Branch: data.Branch || '',
        Recipient_Name: data.Recipient_Name || '',
        Department: data.Department || '',
        Position: data.Position || '',
        Project_Ref_Number: data.Project_Ref_Number || '',
        Warranty: data.Warranty || '',
        Start_Date: data.Start_Date ? data.Start_Date.split('T')[0] : '',
        End_Date: data.End_Date ? data.End_Date.split('T')[0] : ''
      });
      
    } catch (err) {
      console.error('❌ Error fetching asset:', err);
      setError(err.message || 'Failed to load asset data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Software linkage handlers
  const handleAddSoftware = () => {
    if (!newSoftwareSelection) return;
    const selected = softwareOptionsRaw.find(
      s => String(s.Software_ID) === String(newSoftwareSelection)
    );
    if (!selected) return;
    setSoftwareLinks(prev => {
      if (prev.some(s => s.Software_ID === selected.Software_ID)) return prev;
      return [...prev, {
        Software_ID: selected.Software_ID,
        Software_Name: selected.Software_Name || selected.name || '',
        Price: selected.Price
      }];
    });
    setNewSoftwareSelection('');
  };

  const handleRemoveSoftware = (softwareId) => {
    setSoftwareLinks(prev => prev.filter(s => s.Software_ID !== softwareId));
  };

  // Handler for SearchableDropdown components
  const handleChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Peripheral handlers
  const handleAddPeripheral = () => {
    setPeripherals([...peripherals, {
      Peripheral_Type_Name: '',
      Serial_Code: '',
      Condition: '',
      Remarks: ''
    }]);
  };

  const handleRemovePeripheral = (index) => {
    setPeripheralToDelete(index);
    setShowDeletePeripheralModal(true);
  };
  
  const confirmDeletePeripheral = () => {
    if (peripheralToDelete !== null) {
      setPeripherals(peripherals.filter((_, i) => i !== peripheralToDelete));
      setShowDeletePeripheralModal(false);
      setPeripheralToDelete(null);
    }
  };
  
  const cancelDeletePeripheral = () => {
    setShowDeletePeripheralModal(false);
    setPeripheralToDelete(null);
  };

  const handlePeripheralChange = (index, field, value) => {
    const updatedPeripherals = [...peripherals];
    updatedPeripherals[index][field] = value;
    setPeripherals(updatedPeripherals);
  };

  const fetchDropdownOptions = async () => {
    try {
      console.log('📥 Fetching dropdown options...');
      
      // Fetch Windows versions
      const windowsRes = await fetch(`${API_URL}/options/windows`, {
        headers: {
          ...getAuthHeaders()
        }
      });
      if (windowsRes.ok) {
        const windowsData = await windowsRes.json();
        const windows = (windowsData.data || []).map(w => w.Windows_Version || w.name || '');
        setWindowsOptions(windows);
      }

      // Fetch Office versions
      const officeRes = await fetch(`${API_URL}/options/office`, {
        headers: {
          ...getAuthHeaders()
        }
      });
      if (officeRes.ok) {
        const officeData = await officeRes.json();
        setOfficeOptions(officeData.data || []);
      }

      // Fetch Antivirus options
      const antivirusRes = await fetch(`${API_URL}/options/antivirus`, {
        headers: {
          ...getAuthHeaders()
        }
      });
      if (antivirusRes.ok) {
        const antivirusData = await antivirusRes.json();
        setAntivirusOptions(antivirusData.data || []);
      }

      // Fetch Software options
      const softwareRes = await fetch(`${API_URL}/options/software`, {
        headers: {
          ...getAuthHeaders()
        }
      });
      if (softwareRes.ok) {
        const softwareData = await softwareRes.json();
        const softwareRaw = softwareData.data || [];
        setSoftwareOptionsRaw(softwareRaw);
        const software = softwareRaw.map(s => s.Software_Name || s.name || '');
        setSoftwareOptions(software);
      }

      // Fetch Category options using apiService
      try {
        console.log('📥 Fetching categories...');
        const categoryRes = await apiService.getCategories();
        console.log('✅ Category response:', categoryRes);
        
        if (categoryRes.data && Array.isArray(categoryRes.data)) {
          // Extract category names for the dropdown
          const categories = categoryRes.data.map(cat => cat.Category || cat.name || '');
          console.log('📋 Categories extracted:', categories);
          setCategoryOptions(categories);
        } else {
          console.warn('⚠️ No category data returned:', categoryRes);
          setCategoryOptions([]);
        }
      } catch (err) {
        console.error('❌ Error fetching categories:', err);
        setCategoryOptions([]);
      }

      // Fetch Model options using apiService
      try {
        console.log('📥 Fetching models...');
        const modelRes = await apiService.getModels();
        console.log('✅ Model response:', modelRes);
        
        if (modelRes.data && Array.isArray(modelRes.data)) {
          // Extract model names for the dropdown
          const models = modelRes.data.map(model => model.Model_Name || model.name || '');
          console.log('📋 Models extracted:', models);
          setModelOptions(models);
        } else {
          console.warn('⚠️ No model data returned:', modelRes);
          setModelOptions([]);
        }
      } catch (err) {
        console.error('❌ Error fetching models:', err);
        setModelOptions([]);
      }
      
      // Fetch Peripheral Types using apiService
      try {
        console.log('📥 Fetching peripheral types...');
        const peripheralTypesRes = await apiService.getPeripheralTypes();
        console.log('✅ Peripheral types response:', peripheralTypesRes);
        
        if (peripheralTypesRes.data && Array.isArray(peripheralTypesRes.data)) {
          const types = peripheralTypesRes.data.map(type => type.Peripheral_Type_Name || type.name || '');
          console.log('📋 Peripheral types extracted:', types);
          setPeripheralTypeOptions(types);
        } else {
          console.warn('⚠️ No peripheral type data returned:', peripheralTypesRes);
          setPeripheralTypeOptions([]);
        }
      } catch (err) {
        console.error('❌ Error fetching peripheral types:', err);
        setPeripheralTypeOptions([]);
      }
    } catch (err) {
      console.error('❌ Error fetching dropdown options:', err);
      // Set default options as fallback
      setWindowsOptions(['Windows 10', 'Windows 11', 'Windows Server', 'None']);
      setOfficeOptions(['Office 2019', 'Office 2021', 'Microsoft 365', 'None']);
      setSoftwareOptions([]);
      setModelOptions([]);
    }
  };

  const fetchBranchesForCustomer = async (customerRefNumber) => {
    try {
      console.log('🔍 Fetching branches for customer ref:', customerRefNumber);
      const response = await fetch(`${API_URL}/projects/branches-by-ref/${encodeURIComponent(customerRefNumber)}`, {
        headers: {
          ...getAuthHeaders()
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Branches fetched:', data.data);
        setBranchOptions(data.data || []);
      } else {
        console.warn('Failed to fetch branches:', response.status);
        setBranchOptions([]);
      }
    } catch (err) {
      console.error('Error fetching branches for customer:', err);
      setBranchOptions([]);
    }
  };

  const handleOpenAddModal = (type) => {
    setModalType(type);
    setNewOptionValue('');
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setModalType('');
    setNewOptionValue('');
    setAddingOption(false);
  };

  const handleAddNewOption = async () => {
    if (!newOptionValue.trim()) {
      toast.error('Please enter a value');
      return;
    }

    setAddingOption(true);
    try {
      let endpoint, body;
      
      // Use different endpoint for model, peripheral, and category
      if (modalType === 'model') {
        endpoint = `${API_URL}/models`;
        body = JSON.stringify({ name: newOptionValue.trim() });
      } else if (modalType === 'peripheral') {
        endpoint = `${API_URL}/peripherals/types`;
        body = JSON.stringify({ name: newOptionValue.trim() });
      } else if (modalType === 'category') {
        endpoint = `${API_URL}/categories`;
        body = JSON.stringify({ name: newOptionValue.trim() });
      } else {
        endpoint = `${API_URL}/options/${modalType}`;
        body = JSON.stringify({ value: newOptionValue.trim() });
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: body
      });

      if (!response.ok) {
        throw new Error('Failed to add new option');
      }

      const result = await response.json();
      
      // Update the appropriate state based on type
      if (modalType === 'windows') {
        setWindowsOptions(prev => [...prev, newOptionValue.trim()]);
        setFormData(prev => ({ ...prev, Windows: newOptionValue.trim() }));
      } else if (modalType === 'office') {
        setOfficeOptions(prev => [...prev, newOptionValue.trim()]);
        setFormData(prev => ({ ...prev, Microsoft_Office: newOptionValue.trim() }));
      } else if (modalType === 'antivirus') {
        setAntivirusOptions(prev => [...prev, newOptionValue.trim()]);
        setFormData(prev => ({ ...prev, Antivirus: newOptionValue.trim() }));
      } else if (modalType === 'software') {
        setSoftwareOptions(prev => [...prev, newOptionValue.trim()]);
        setFormData(prev => ({ ...prev, Software: newOptionValue.trim() }));
      } else if (modalType === 'category') {
        setCategoryOptions(prev => [...prev, newOptionValue.trim()]);
        setFormData(prev => ({ ...prev, Category: newOptionValue.trim() }));
      } else if (modalType === 'model') {
        setModelOptions(prev => [...prev, newOptionValue.trim()]);
        setFormData(prev => ({ ...prev, Model: newOptionValue.trim() }));
      } else if (modalType === 'peripheral') {
        setPeripheralTypeOptions(prev => [...prev, newOptionValue.trim()]);
      } else if (modalType === 'category') {
        setCategoryOptions(prev => [...prev, newOptionValue.trim()]);
        setFormData(prev => ({ ...prev, Category: newOptionValue.trim() }));
      }

      handleCloseAddModal();
    } catch (err) {
      console.error('Error adding new option:', err);
      toast.error('Failed to add new option. Please try again.');
    } finally {
      setAddingOption(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.Asset_Serial_Number || !formData.Asset_Tag_ID || !formData.Item_Name) {
      setError('Serial Number, Tag ID, and Item Name are required fields');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      console.log('🔄 Updating asset:', formData);
      console.log('📦 Updating peripherals:', peripherals);
      
      // Include peripherals in the request body
      const updateData = {
        ...formData,
        // Convert Antivirus dropdown value back to AV boolean
        AV: formData.Antivirus.startsWith('Yes') ? 1 : 0,
        peripherals: peripherals.filter(p => 
          p.Peripheral_Type_Name || p.Serial_Code || p.Condition || p.Remarks
        ),
        softwareLinks: softwareLinks.map(s => ({
          Software_ID: s.Software_ID,
          Software_Name: s.Software_Name,
          Price: s.Price
        }))
      };
      
      const response = await fetch(`${API_URL}/assets/id/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(updateData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update asset');
      }
      
      const result = await response.json();
      console.log('✅ Asset updated successfully:', result);
      
      toast.success('Asset updated successfully!');
      
      // Redirect to asset detail page after 1.5 seconds
      setTimeout(() => {
        navigate(`/asset-detail/${id}`);
      }, 1500);
      
    } catch (err) {
      console.error('❌ Error updating asset:', err);
      setError(err.message || 'Failed to update asset');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/assets');
  };

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '1.2rem', color: '#666' }}>Loading asset data...</div>
        </div>
      </div>
    );
  }

  if (error && !formData.Asset_Serial_Number) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <AlertCircle size={48} color="#e74c3c" style={{ marginBottom: '20px' }} />
          <h3 style={{ color: '#e74c3c', marginBottom: '10px' }}>Error Loading Asset</h3>
          <p style={{ color: '#666', marginBottom: '20px' }}>{error}</p>
          <button onClick={() => navigate('/assets')} className="btn btn-primary">
            <ArrowLeft size={16} style={{ marginRight: '5px' }} />
            Back to Assets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px',
        padding: '24px 28px',
        marginBottom: '24px',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
        color: 'white'
      }}>
        <button 
          onClick={handleCancel} 
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
        >
          <ArrowLeft size={16} />
          Back to Assets
        </button>
        <h1 style={{ 
          fontSize: '1.9rem', 
          fontWeight: '700', 
          margin: '0 0 8px 0',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Edit3 size={28} strokeWidth={2.5} />
          Edit Asset
        </h1>
        <p style={{ 
          margin: 0, 
          opacity: 0.95, 
          fontSize: '0.95rem',
          fontWeight: '400'
        }}>
          Update asset information • Asset ID: {id}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          color: '#721c24',
          padding: '15px 20px',
          marginBottom: '20px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={20} />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#721c24'
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)'
        }}>
          <button
            onClick={() => setActiveTab('asset')}
            style={{
              flex: 1,
              padding: '18px 24px',
              border: 'none',
              background: activeTab === 'asset' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
              color: activeTab === 'asset' ? 'white' : '#6c757d',
              fontWeight: activeTab === 'asset' ? '600' : '500',
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              position: 'relative',
              boxShadow: activeTab === 'asset' ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none',
              transform: activeTab === 'asset' ? 'translateY(-2px)' : 'none'
            }}
            onMouseOver={(e) => {
              if (activeTab !== 'asset') {
                e.currentTarget.style.background = 'rgba(102, 126, 234, 0.08)';
              }
            }}
            onMouseOut={(e) => {
              if (activeTab !== 'asset') {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <Package size={18} style={{ marginRight: '6px' }} />
            Asset Info
          </button>
          <button
            onClick={() => setActiveTab('customer')}
            style={{
              flex: 1,
              padding: '18px 24px',
              border: 'none',
              background: activeTab === 'customer' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
              color: activeTab === 'customer' ? 'white' : '#6c757d',
              fontWeight: activeTab === 'customer' ? '600' : '500',
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              position: 'relative',
              boxShadow: activeTab === 'customer' ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none',
              transform: activeTab === 'customer' ? 'translateY(-2px)' : 'none'
            }}
            onMouseOver={(e) => {
              if (activeTab !== 'customer') {
                e.currentTarget.style.background = 'rgba(102, 126, 234, 0.08)';
              }
            }}
            onMouseOut={(e) => {
              if (activeTab !== 'customer') {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <Building2 size={18} style={{ marginRight: '6px' }} />
            Customer Info
          </button>
          <button
            onClick={() => setActiveTab('project')}
            style={{
              flex: 1,
              padding: '18px 24px',
              border: 'none',
              background: activeTab === 'project' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
              color: activeTab === 'project' ? 'white' : '#6c757d',
              fontWeight: activeTab === 'project' ? '600' : '500',
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              position: 'relative',
              boxShadow: activeTab === 'project' ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none',
              transform: activeTab === 'project' ? 'translateY(-2px)' : 'none'
            }}
            onMouseOver={(e) => {
              if (activeTab !== 'project') {
                e.currentTarget.style.background = 'rgba(102, 126, 234, 0.08)';
              }
            }}
            onMouseOut={(e) => {
              if (activeTab !== 'project') {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <ClipboardList size={18} style={{ marginRight: '6px' }} />
            Project Info
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '28px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          {/* Tab 1: Asset Info */}
          {activeTab === 'asset' && (
            <div>
              <h3 style={{ 
                marginTop: 0, 
                marginBottom: '24px', 
                color: '#2c3e50',
                fontSize: '1.3rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                paddingBottom: '12px',
                borderBottom: '2px solid #f0f0f0'
              }}>
                <span style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <Package size={18} strokeWidth={2.5} />
                </span>
                Asset Information
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Row 1: Serial Number | Tag ID */}
                <div className="form-group">
                  <label>Serial Number <span style={{ color: '#e74c3c' }}>*</span></label>
                  <input
                    type="text"
                    name="Asset_Serial_Number"
                    value={formData.Asset_Serial_Number}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Tag ID <span style={{ color: '#e74c3c' }}>*</span></label>
                  <input
                    type="text"
                    name="Asset_Tag_ID"
                    value={formData.Asset_Tag_ID}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                {/* Row 2: Item Name | Status */}
                <div className="form-group">
                  <label>Item Name <span style={{ color: '#e74c3c' }}>*</span></label>
                  <input
                    type="text"
                    name="Item_Name"
                    value={formData.Item_Name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    name="Status"
                    value={formData.Status}
                    onChange={handleInputChange}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Retired">Retired</option>
                  </select>
                </div>

                {/* Row 3: Category | Model */}
                <div className="form-group">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Category</span>
                    <button
                      type="button"
                      onClick={() => handleOpenAddModal('category')}
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '5px 10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                      }}
                      title="Add new Category"
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 3px 6px rgba(16, 185, 129, 0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)';
                      }}
                    >
                      <Plus size={14} /> 
                    </button>
                  </label>
                  <SearchableDropdown
                    options={categoryOptions.map(cat => ({
                      value: cat.Category || cat,
                      label: cat.Category || cat
                    }))}
                    value={formData.Category}
                    onChange={(selectedValue) => handleChange('Category', selectedValue || '')}
                    placeholder={`Type to search or select category... (${categoryOptions.length} available)`}
                    searchPlaceholder="Search categories..."
                    getOptionLabel={(option) => option.label}
                    getOptionValue={(option) => option.value}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Model</span>
                    <button
                      type="button"
                      onClick={() => handleOpenAddModal('model')}
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '5px 10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                      }}
                      title="Add new Model"
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 3px 6px rgba(16, 185, 129, 0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)';
                      }}
                    >
                      <Plus size={14} /> 
                    </button>
                  </label>
                  <select
                    name="Model"
                    value={formData.Model}
                    onChange={handleInputChange}
                  >
                    <option value="">Select Model</option>
                    {modelOptions.map((option, index) => (
                      <option key={index} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Row 4: Windows | Microsoft Office */}
                <div className="form-group">
                  <label>Windows</label>
                  <input
                    type="text"
                    name="Windows"
                    value={formData.Windows}
                    onChange={handleInputChange}
                    placeholder="e.g., Windows 10 Pro"
                  />
                </div>

                <div className="form-group">
                  <label>Microsoft Office</label>
                  <input
                    type="text"
                    name="Microsoft_Office"
                    value={formData.Microsoft_Office}
                    onChange={handleInputChange}
                    placeholder="e.g., Microsoft Office 365"
                  />
                </div>

                {/* Row 5: Antivirus | Monthly Price */}
                <div className="form-group">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Antivirus</span>
                  </label>
                  <select
                    name="Antivirus"
                    value={formData.Antivirus}
                    onChange={handleInputChange}
                  >
                    {antivirusOptions.map((option, index) => (
                      <option key={`av-${option}-${index}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Monthly Price (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="Monthly_Prices"
                    value={formData.Monthly_Prices}
                    onChange={handleInputChange}
                    placeholder="0.00"
                  />
                </div>

                {/* Divider before Software */}
                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e0e0e0', margin: '8px 0 12px 0' }} />

                {/* Row 6: Software (full width) */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Software</span>
                  </label>

                  {/* Add software linkage (dropdown at top) */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
                    <select
                      name="SoftwareAdd"
                      value={newSoftwareSelection}
                      onChange={(e) => setNewSoftwareSelection(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">Select software to link</option>
                      {softwareOptionsRaw.map((option) => (
                        <option key={`swopt-${option.Software_ID}`} value={option.Software_ID}>
                          {option.Software_Name || option.name || 'Untitled'}
                          {option.Price !== undefined && option.Price !== null && option.Price !== ''
                            ? `  (RM ${option.Price})`
                            : ''}
                        </option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleAddSoftware}
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        Link
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal('software')}
                        style={{
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          cursor: 'pointer',
                          fontWeight: '700'
                        }}
                        title="Add new software with price"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Linked software list (below dropdown) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    {softwareLinks.length === 0 && (
                      <div style={{ color: '#666', fontStyle: 'italic' }}>No software linked</div>
                    )}
                    {softwareLinks.map((s) => (
                      <div
                        key={`sw-${s.Software_ID}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          background: '#fafafa'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>{s.Software_Name}</div>
                          {s.Price !== undefined && s.Price !== null && s.Price !== '' && (
                            <div style={{ color: '#666', fontSize: '12px' }}>Price: {s.Price}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSoftware(s.Software_ID)}
                          style={{
                            background: '#f87171',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Peripheral Information Section */}
                <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '20px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingBottom: '12px',
                    borderBottom: '2px solid #f0f0f0',
                    marginBottom: '16px'
                  }}>
                    <h4 style={{
                      color: '#2c3e50',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      Peripheral Details
                      <span style={{
                        fontSize: '0.85rem',
                        fontWeight: '400',
                        color: '#6c757d',
                        fontStyle: 'italic'
                      }}>
                        (Optional)
                      </span>
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddPeripheral}
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 3px 6px rgba(16, 185, 129, 0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)';
                      }}
                    >
                      <Plus size={16} />
                      Add Peripheral
                    </button>
                  </div>
                </div>

                {peripherals.length === 0 ? (
                  <div style={{
                    gridColumn: '1 / -1',
                    textAlign: 'center',
                    padding: '30px',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    color: '#6c757d',
                    fontSize: '14px'
                  }}>
                    No peripherals added. Click "Add Peripheral" to add one.
                  </div>
                ) : (
                  peripherals.map((peripheral, index) => (
                    <React.Fragment key={index}>
                      <div style={{
                        gridColumn: '1 / -1',
                        background: '#f8f9fa',
                        padding: '16px',
                        borderRadius: '8px',
                        marginBottom: '12px',
                        position: 'relative'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '12px'
                        }}>
                          <h5 style={{
                            margin: 0,
                            color: '#495057',
                            fontSize: '0.95rem',
                            fontWeight: '600'
                          }}>
                            Peripheral #{index + 1}
                          </h5>
                          <button
                            type="button"
                            onClick={() => handleRemovePeripheral(index)}
                            style={{
                              background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              fontWeight: '600',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 4px rgba(231, 76, 60, 0.3)'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 3px 6px rgba(231, 76, 60, 0.4)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 4px rgba(231, 76, 60, 0.3)';
                            }}
                          >
                            <X size={14} />
                            Remove
                          </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.9rem' }}>Peripheral Type</label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                              <select
                                value={peripheral.Peripheral_Type_Name}
                                onChange={(e) => handlePeripheralChange(index, 'Peripheral_Type_Name', e.target.value)}
                                style={{ flex: 1 }}
                              >
                                <option value="">Select Peripheral Type</option>
                                {peripheralTypeOptions.map((type, idx) => (
                                  <option key={idx} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleOpenAddModal('peripheral')}
                                style={{
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '0 12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.85rem',
                                  fontWeight: '500',
                                  transition: 'all 0.2s ease',
                                  boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
                                  whiteSpace: 'nowrap'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                  e.currentTarget.style.boxShadow = '0 3px 6px rgba(16, 185, 129, 0.4)';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)';
                                }}
                              >
                                <Plus size={14} />                              
                              </button>
                            </div>
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.9rem' }}>Serial Code</label>
                            <input
                              type="text"
                              value={peripheral.Serial_Code}
                              onChange={(e) => handlePeripheralChange(index, 'Serial_Code', e.target.value)}
                              placeholder="Enter peripheral serial code"
                            />
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.9rem' }}>Condition</label>
                            <select
                              value={peripheral.Condition}
                              onChange={(e) => handlePeripheralChange(index, 'Condition', e.target.value)}
                            >
                              <option value="">Select Condition</option>
                              <option value="Good">Good</option>
                              <option value="Fair">Fair</option>
                              <option value="Poor">Poor</option>
                              <option value="New">New</option>
                            </select>
                          </div>

                          <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                            <label style={{ fontSize: '0.9rem' }}>Remarks</label>
                            <textarea
                              value={peripheral.Remarks}
                              onChange={(e) => handlePeripheralChange(index, 'Remarks', e.target.value)}
                              placeholder="Additional notes about the peripheral"
                              rows="2"
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontFamily: 'inherit',
                                resize: 'vertical'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Customer Info */}
          {activeTab === 'customer' && (
            <div>
              <h3 style={{ 
                marginTop: 0, 
                marginBottom: '24px', 
                color: '#2c3e50',
                fontSize: '1.3rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                paddingBottom: '12px',
                borderBottom: '2px solid #f0f0f0'
              }}>
                <span style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <Building2 size={18} strokeWidth={2.5} />
                </span>
                Customer & Recipient Information
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                <div className="form-group">
                  <label>Customer Name</label>
                  <input
                    type="text"
                    name="Customer_Name"
                    value={formData.Customer_Name}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>Customer Reference</label>
                  <input
                    type="text"
                    name="Customer_Ref_Number"
                    value={formData.Customer_Ref_Number}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Branch / Location</label>
                  <select
                    name="Branch"
                    value={formData.Branch}
                    onChange={handleInputChange}
                    disabled={!formData.Customer_Ref_Number || branchOptions.length === 0}
                  >
                    <option value="">
                      {!formData.Customer_Ref_Number 
                        ? 'Select customer reference first' 
                        : branchOptions.length === 0 
                        ? 'No branches available' 
                        : 'Select Branch'}
                    </option>
                    {branchOptions.map((branch, index) => (
                      <option key={index} value={branch.Branch}>
                        {branch.Branch}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Recipient Name</label>
                  <input
                    type="text"
                    name="Recipient_Name"
                    value={formData.Recipient_Name}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>Position</label>
                  <input
                    type="text"
                    name="Position"
                    value={formData.Position}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Department</label>
                  <input
                    type="text"
                    name="Department"
                    value={formData.Department}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Project Info */}
          {activeTab === 'project' && (
            <div>
              <h3 style={{ 
                marginTop: 0, 
                marginBottom: '24px', 
                color: '#2c3e50',
                fontSize: '1.3rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                paddingBottom: '12px',
                borderBottom: '2px solid #f0f0f0'
              }}>
                <span style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <ClipboardList size={18} strokeWidth={2.5} />
                </span>
                Project Information
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Project Reference Number</label>
                  <input
                    type="text"
                    name="Project_Ref_Number"
                    value={formData.Project_Ref_Number}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Warranty</label>
                  <input
                    type="text"
                    name="Warranty"
                    value={formData.Warranty}
                    onChange={handleInputChange}
                    placeholder="e.g., 3 years manufacturer warranty"
                  />
                </div>

                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    name="Start_Date"
                    value={formData.Start_Date}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    name="End_Date"
                    value={formData.End_Date}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ 
          marginTop: '24px', 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'flex-end' 
        }}>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            style={{
              background: 'linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%)',
              color: '#495057',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              opacity: saving ? 0.6 : 1,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            onMouseOver={(e) => {
              if (!saving) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
              }
            }}
            onMouseOut={(e) => {
              if (!saving) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
              }
            }}
          >
            <X size={16} />
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              background: saving ? '#95a5a6' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              padding: '12px 28px',
              borderRadius: '8px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              boxShadow: saving ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}
            onMouseOver={(e) => {
              if (!saving) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
              }
            }}
            onMouseOut={(e) => {
              if (!saving) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
              }
            }}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Add New Option Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '28px',
            minWidth: '450px',
            maxWidth: '550px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ 
                margin: 0, 
                color: '#2c3e50',
                fontSize: '1.4rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Plus size={24} strokeWidth={2.5} style={{ color: '#10b981' }} />
                Add New {modalType === 'windows' ? 'Windows Version' : modalType === 'office' ? 'Office Version' : modalType === 'antivirus' ? 'Antivirus' : modalType === 'software' ? 'Software' : modalType === 'category' ? 'Category' : modalType === 'peripheral' ? 'Peripheral Type' : modalType === 'category' ? 'Category' : 'Model'}
              </h3>
              <button
                onClick={handleCloseAddModal}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                disabled={addingOption}
              >
                <X size={20} color="#666" />
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#34495e', fontWeight: '500' }}>
                {modalType === 'windows' ? 'Windows Version Name' : modalType === 'office' ? 'Office Version Name' : modalType === 'antivirus' ? 'Antivirus Name' : modalType === 'software' ? 'Software Name' : modalType === 'category' ? 'Category Name' : modalType === 'peripheral' ? 'Peripheral Type Name' : 'Model Name'}
              </label>
              <input
                type="text"
                value={newOptionValue}
                onChange={(e) => setNewOptionValue(e.target.value)}
                placeholder={modalType === 'office' ? 'e.g., Office LTSC 2024' : modalType === 'windows' ? 'e.g., Windows 12' : modalType === 'antivirus' ? 'e.g., Kaspersky Endpoint Security' : modalType === 'software' ? 'e.g., Adobe Acrobat' : modalType === 'category' ? 'e.g., Desktop, Laptop, Server' : modalType === 'peripheral' ? 'e.g., Mouse, Keyboard, Monitor' : 'e.g., Dell OptiPlex 3090, HP ProBook 450 G8'}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddNewOption();
                  }
                }}
                autoFocus
                disabled={addingOption}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCloseAddModal}
                disabled={addingOption}
                style={{
                  background: 'linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%)',
                  color: '#495057',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: addingOption ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  opacity: addingOption ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
                onMouseOver={(e) => {
                  if (!addingOption) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.15)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!addingOption) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                  }
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddNewOption}
                disabled={addingOption || !newOptionValue.trim()}
                style={{
                  background: (addingOption || !newOptionValue.trim()) ? '#95a5a6' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  cursor: (addingOption || !newOptionValue.trim()) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  boxShadow: (addingOption || !newOptionValue.trim()) ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
                onMouseOver={(e) => {
                  if (!addingOption && newOptionValue.trim()) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!addingOption && newOptionValue.trim()) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                  }
                }}
              >
                {addingOption ? 'Adding...' : 'Add Option'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Peripheral Confirmation Modal */}
      {showDeletePeripheralModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '28px',
            minWidth: '450px',
            maxWidth: '500px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ 
                margin: '0 0 12px 0', 
                color: '#e74c3c',
                fontSize: '1.4rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <X size={24} strokeWidth={2.5} />
                Delete Peripheral
              </h3>
              <p style={{ 
                margin: 0, 
                color: '#555',
                fontSize: '1rem',
                lineHeight: '1.5'
              }}>
                Are you sure you want to remove this peripheral? This action cannot be undone.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={cancelDeletePeripheral}
                style={{
                  background: 'linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%)',
                  color: '#495057',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.15)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletePeripheral}
                style={{
                  background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(231, 76, 60, 0.3)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(231, 76, 60, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(231, 76, 60, 0.3)';
                }}
              >
                Delete Peripheral
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditAsset;

