import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Mail, Lock, Bell, Shield, Palette, Save, Eye, EyeOff, CheckCircle, Users, Plus, X, Edit, Trash2, PenTool } from 'lucide-react';
import { authenticatedFetch, handleTokenExpiration } from '../utils/authUtils';
import { API_URL } from '../config/api';
import usePageTitle from '../hooks/usePageTitle';
import toast from '../utils/toast';

const AccountSettings = () => {
  usePageTitle('Account Settings');
  const BASE_URL = API_URL.replace('/api/v1', '');
  const [activeTab, setActiveTab] = useState('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updateMessage, setUpdateMessage] = useState({ type: '', text: '' });
  const [allUsers, setAllUsers] = useState([]);
  const [listSortMode, setListSortMode] = useState(() => localStorage.getItem('inventraAccountSettingsSortMode') || 'default');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showPasswordConfirmModal, setShowPasswordConfirmModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [deleteUserName, setDeleteUserName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [actionType, setActionType] = useState(''); // 'edit' or 'delete'
  const [editUserData, setEditUserData] = useState({
    userId: '',
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    department: '',
    role: 'Staff',
    projectName: ''
  });
  const [newUserData, setNewUserData] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    department: '',
    role: 'Staff'
  });

  // New staff signature capture state
  const newUserSigCanvasRef = useRef(null);
  const [isDrawingNewUser, setIsDrawingNewUser] = useState(false);
  const [newUserSignature, setNewUserSignature] = useState('');
  const [hasNewUserSignature, setHasNewUserSignature] = useState(false);

  // Current user signature capture state (Profile tab)
  const profileSigCanvasRef = useRef(null);
  const [isDrawingProfileSig, setIsDrawingProfileSig] = useState(false);
  const [profileSignature, setProfileSignature] = useState('');
  const [hasProfileSignature, setHasProfileSignature] = useState(false);
  const [savingProfileSignature, setSavingProfileSignature] = useState(false);

  // Project Customer role states
  const [customerList, setCustomerList] = useState([]);
  const [selectedProjectName, setSelectedProjectName] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    department: '',
    role: '',
    signPath: ''
  });

  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactorEnabled: false
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    maintenanceReminders: true,
    assetUpdates: true,
    systemAlerts: true,
    weeklyReports: false
  });

  const [themeSettings, setThemeSettings] = useState({
    theme: 'light',
    accentColor: '#3498db',
    compactMode: false,
    sidebarCollapsed: false
  });

  // Fetch user profile on component mount
  useEffect(() => {
    fetchUserProfile();
  }, []);

  // Fetch all users when User Management tab is active
  useEffect(() => {
    if (activeTab === 'users') {
      fetchAllUsers();
    }
  }, [activeTab]);

  // Fetch customer names when Add User modal opens
  useEffect(() => {
    if (showAddUserModal) {
      fetchCustomerNames();
    }
  }, [showAddUserModal]);

  useEffect(() => {
    localStorage.setItem('inventraAccountSettingsSortMode', listSortMode);
  }, [listSortMode]);

  const parseNumeric = (value) => {
    const parsed = parseInt(String(value || '').replace(/[^0-9.-]/g, ''), 10);
    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
  };

  const sortedAllUsers = useMemo(() => {
    if (listSortMode === 'default') return allUsers;

    return [...allUsers].sort((a, b) => {
      const aText = `${a.firstName || ''} ${a.lastName || ''} ${a.username || ''}`.trim().toLowerCase();
      const bText = `${b.firstName || ''} ${b.lastName || ''} ${b.username || ''}`.trim().toLowerCase();

      if (listSortMode === 'alpha-asc') return aText.localeCompare(bText);
      if (listSortMode === 'alpha-desc') return bText.localeCompare(aText);
      if (listSortMode === 'num-asc') return parseNumeric(a.username) - parseNumeric(b.username);
      if (listSortMode === 'num-desc') return parseNumeric(b.username) - parseNumeric(a.username);
      return 0;
    });
  }, [allUsers, listSortMode]);

  const sortedCustomerList = useMemo(() => {
    if (listSortMode === 'default') return customerList;

    return [...customerList].sort((a, b) => {
      const aText = String(a || '').toLowerCase();
      const bText = String(b || '').toLowerCase();

      if (listSortMode === 'alpha-asc') return aText.localeCompare(bText);
      if (listSortMode === 'alpha-desc') return bText.localeCompare(aText);
      if (listSortMode === 'num-asc') return parseNumeric(a) - parseNumeric(b);
      if (listSortMode === 'num-desc') return parseNumeric(b) - parseNumeric(a);
      return 0;
    });
  }, [customerList, listSortMode]);

  // Initialize signature canvas when Add User modal opens
  useEffect(() => {
    if (showAddUserModal && newUserSigCanvasRef.current) {
      const canvas = newUserSigCanvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = 600;
      canvas.height = 200;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      setHasNewUserSignature(false);
      setNewUserSignature('');
    }
  }, [showAddUserModal]);

  useEffect(() => {
    if (activeTab !== 'profile' || !profileSigCanvasRef.current) return;

    const canvas = profileSigCanvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = 600;
    canvas.height = 180;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasProfileSignature(false);
    setProfileSignature('');
  }, [activeTab]);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        const profileInfo = {
          firstName: data.data.firstName || '',
          lastName: data.data.lastName || '',
          email: data.data.email || '',
          username: data.data.username || '',
          department: data.data.department || '',
          role: data.data.role || '',
          signPath: data.data.signPath || ''
        };
        console.log('✅ Setting profile data:', profileInfo);
        setProfileData(profileInfo);
      } else {
        console.error('❌ Profile fetch failed:', data.message);
      }
    } catch (error) {
      console.error('❌ Error fetching profile:', error);
      // Token expiration is already handled by authenticatedFetch
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    // Only fetch if user is admin
    if (!profileData.role || profileData.role.toLowerCase() !== 'admin') {
      return;
    }
    
    setLoadingUsers(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/auth/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setAllUsers(data.data);
      } else {
        console.error('Failed to fetch users:', data.message);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      // Token expiration is already handled by authenticatedFetch
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchCustomerNames = async () => {
    setLoadingCustomers(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/options/customers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      console.log('Customer names response:', data);
      if (data.success) {
        // Extract customer names from objects and remove duplicates
        const customerNames = [...new Set(
          (data.customers || data.data || []).map(item => 
            typeof item === 'string' ? item : item.Customer_Name
          )
        )];
        console.log('Customer list:', customerNames);
        setCustomerList(customerNames);
      } else {
        console.error('Failed to fetch customer names:', data.message);
      }
    } catch (error) {
      console.error('Failed to fetch customer names:', error);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setUpdateMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          email: profileData.email,
          department: profileData.department
        })
      });

      const data = await response.json();
      if (data.success) {
        setUpdateMessage({ type: 'success', text: 'Profile updated successfully!' });
        // Update localStorage with new user info
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        localStorage.setItem('userInfo', JSON.stringify({ ...userInfo, ...data.data }));
      } else {
        setUpdateMessage({ type: 'error', text: data.message || 'Failed to update profile' });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setUpdateMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setUpdateMessage({ type: '', text: '' });

    if (securityData.newPassword !== securityData.confirmPassword) {
      setUpdateMessage({ type: 'error', text: 'New passwords do not match!' });
      return;
    }

    if (securityData.newPassword.length < 6) {
      setUpdateMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: securityData.currentPassword,
          newPassword: securityData.newPassword
        })
      });

      const data = await response.json();
      if (data.success) {
        setUpdateMessage({ type: 'success', text: 'Password changed successfully!' });
        setSecurityData({ 
          ...securityData, 
          currentPassword: '', 
          newPassword: '', 
          confirmPassword: '' 
        });
      } else {
        setUpdateMessage({ type: 'error', text: data.message || 'Failed to change password' });
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setUpdateMessage({ type: 'error', text: 'Failed to change password. Please try again.' });
    }
  };

  const handleNotificationUpdate = () => {
    toast.success('Notification preferences updated!');
  };

  const handleThemeUpdate = () => {
    toast.success('Theme settings updated!');
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setUpdateMessage({ type: '', text: '' });

    // Validate password
    if (newUserData.password.length < 6) {
      setUpdateMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      return;
    }

    // Validate project name selection for Project Customer role
    if (newUserData.role === 'Project Customer' && !selectedProjectName) {
      setUpdateMessage({ type: 'error', text: 'Please select a project name' });
      return;
    }

    // Require signature
    if (!hasNewUserSignature || !newUserSignature) {
      setUpdateMessage({ type: 'error', text: 'Staff signature is required to create a new user' });
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      
      // Use selected project name as role if Project Customer is selected
      const userRole = newUserData.role === 'Project Customer' ? selectedProjectName : newUserData.role;
      
      const response = await fetch(`${API_URL}/auth/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newUserData,
          role: userRole,
          signature: newUserSignature
        })
      });

      const data = await response.json();
      if (data.success) {
        setUpdateMessage({ type: 'success', text: `User "${newUserData.username}" created successfully!` });
        setShowAddUserModal(false);
        setNewUserData({
          username: '',
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          department: '',
          role: 'Staff'
        });
        setSelectedProjectName('');
        setNewUserSignature('');
        setHasNewUserSignature(false);
        // Refresh user list
        fetchAllUsers();
      } else {
        setUpdateMessage({ type: 'error', text: data.message || 'Failed to create user' });
      }
    } catch (error) {
      console.error('Error creating user:', error);
      setUpdateMessage({ type: 'error', text: 'Failed to create user. Please try again.' });
    }
  };

  // Signature drawing handlers for Add User modal
  const startDrawingNewUser = (e) => {
    e.preventDefault();
    const canvas = newUserSigCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawingNewUser(true);
    setHasNewUserSignature(true);
  };

  const drawNewUser = (e) => {
    if (!isDrawingNewUser) return;
    e.preventDefault();
    const canvas = newUserSigCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawingNewUser = () => {
    if (isDrawingNewUser && newUserSigCanvasRef.current) {
      const canvas = newUserSigCanvasRef.current;
      setNewUserSignature(canvas.toDataURL('image/png'));
    }
    setIsDrawingNewUser(false);
  };

  const clearNewUserSignature = () => {
    const canvas = newUserSigCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasNewUserSignature(false);
    setNewUserSignature('');
  };

  const getPointFromEvent = (canvas, e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawingProfileSignature = (e) => {
    e.preventDefault();
    const canvas = profileSigCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { x, y } = getPointFromEvent(canvas, e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawingProfileSig(true);
    setHasProfileSignature(true);
  };

  const drawProfileSignature = (e) => {
    if (!isDrawingProfileSig) return;
    e.preventDefault();
    const canvas = profileSigCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { x, y } = getPointFromEvent(canvas, e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawingProfileSignature = () => {
    if (isDrawingProfileSig && profileSigCanvasRef.current) {
      setProfileSignature(profileSigCanvasRef.current.toDataURL('image/png'));
    }
    setIsDrawingProfileSig(false);
  };

  const clearProfileSignature = () => {
    const canvas = profileSigCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasProfileSignature(false);
    setProfileSignature('');
  };

  const handleSaveProfileSignature = async () => {
    if (!hasProfileSignature || !profileSignature) {
      setUpdateMessage({ type: 'error', text: 'Please draw your signature first.' });
      return;
    }

    try {
      setSavingProfileSignature(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          signature: profileSignature
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to save signature');
      }

      setProfileData((prev) => ({
        ...prev,
        signPath: data.data?.signPath || prev.signPath
      }));

      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      localStorage.setItem('userInfo', JSON.stringify({ ...userInfo, ...(data.data || {}) }));

      setUpdateMessage({ type: 'success', text: 'Staff signature saved. PM and UAT forms will use it automatically.' });
      setHasProfileSignature(false);
      setProfileSignature('');
    } catch (error) {
      setUpdateMessage({ type: 'error', text: error.message || 'Failed to save signature.' });
    } finally {
      setSavingProfileSignature(false);
    }
  };

  const handleEditUser = (user) => {
    setEditUserData({
      userId: user.userId,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department || '',
      role: user.role
    });
    setShowEditUserModal(true);
    setUpdateMessage({ type: '', text: '' });
  };

  const handleEditUserSubmit = (e) => {
    e.preventDefault();
    // Show password confirmation modal
    setActionType('edit');
    setShowEditUserModal(false);
    setShowPasswordConfirmModal(true);
  };

  const handleDeleteUser = (user) => {
    setDeleteUserId(user.userId);
    setDeleteUserName(user.username);
    setShowDeleteConfirmModal(true);
    setUpdateMessage({ type: '', text: '' });
  };

  const handleDeleteConfirm = (e) => {
    e.preventDefault();
    // Show password confirmation modal for delete
    setActionType('delete');
    setShowDeleteConfirmModal(false);
    setShowPasswordConfirmModal(true);
  };

  const handlePasswordConfirm = async (e) => {
    e.preventDefault();
    setUpdateMessage({ type: '', text: '' });

    if (!adminPassword) {
      setUpdateMessage({ type: 'error', text: 'Please enter your password' });
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      
      if (actionType === 'edit') {
        // Update user
        const updateData = {
          username: editUserData.username,
          email: editUserData.email,
          firstName: editUserData.firstName,
          lastName: editUserData.lastName,
          department: editUserData.department,
          // If role is Project Customer, use the selected project name as the role
          role: editUserData.role === 'Project Customer' ? editUserData.projectName : editUserData.role,
          adminPassword: adminPassword
        };
        
        const response = await fetch(`${API_URL}/auth/users/${editUserData.userId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        });

        const data = await response.json();
        if (data.success) {
          setUpdateMessage({ type: 'success', text: `User "${editUserData.username}" updated successfully!` });
          setShowPasswordConfirmModal(false);
          setAdminPassword('');
          setEditUserData({
            userId: '',
            username: '',
            email: '',
            firstName: '',
            lastName: '',
            department: '',
            role: 'Staff',
            projectName: ''
          });
          // Refresh user list
          fetchAllUsers();
        } else {
          setUpdateMessage({ type: 'error', text: data.message || 'Failed to update user' });
        }
      } else if (actionType === 'delete') {
        // Delete user
        const response = await fetch(`${API_URL}/auth/users/${deleteUserId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            adminPassword: adminPassword
          })
        });

        const data = await response.json();
        if (data.success) {
          setUpdateMessage({ type: 'success', text: `User "${deleteUserName}" deleted successfully!` });
          setShowPasswordConfirmModal(false);
          setAdminPassword('');
          setDeleteUserId(null);
          setDeleteUserName('');
          // Refresh user list
          fetchAllUsers();
        } else {
          setUpdateMessage({ type: 'error', text: data.message || 'Failed to delete user' });
        }
      }
    } catch (error) {
      console.error('Error performing action:', error);
      setUpdateMessage({ type: 'error', text: `Failed to ${actionType} user. Please try again.` });
    }
  };

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '30px',
        paddingBottom: '15px',
        borderBottom: '3px solid #3498db',
        marginLeft: '20px',
        marginRight: '20px',
        padding: '0 0 15px 0'
      }}>
        <User size={28} color="#3498db" />
        <div>
          <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.4rem' }}>
            Account Settings
          </h2>
          <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
            Manage your profile and preferences
          </p>
        </div>
      </div>

      {updateMessage.text && (
        <div style={{
          padding: '12px 20px',
          margin: '0 20px 20px',
          borderRadius: '6px',
          background: updateMessage.type === 'success' ? '#d4edda' : '#f8d7da',
          color: updateMessage.type === 'success' ? '#155724' : '#721c24',
          border: `1px solid ${updateMessage.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {updateMessage.type === 'success' && <CheckCircle size={18} />}
          {updateMessage.text}
        </div>
      )}

      <div className="settings-container">
        <div className="settings-sidebar">
          <nav className="settings-nav">
            <button 
              className={`settings-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={20} />
              Profile Information
            </button>
            <button 
              className={`settings-nav-item ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <Shield size={20} />
              Security & Privacy
            </button>
            <button 
              className={`settings-nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <Bell size={20} />
              Notifications
            </button>
            <button 
              className={`settings-nav-item ${activeTab === 'appearance' ? 'active' : ''}`}
              onClick={() => setActiveTab('appearance')}
            >
              <Palette size={20} />
              Appearance
            </button>
            
            {/* Only show User Management tab for Admin users */}
            {profileData.role && profileData.role.toLowerCase() === 'admin' && (
              <button 
                className={`settings-nav-item ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                <Users size={20} />
                User Management
              </button>
            )}
          </nav>
        </div>

        <div className="settings-content">
          {activeTab === 'profile' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Profile Information</h2>
                {profileData.role && (
                  <span style={{
                    padding: '6px 16px',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    background: 
                      profileData.role.toLowerCase() === 'admin' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 
                      profileData.role.toLowerCase() === 'staff' ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' :
                      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}>
                    {profileData.role}
                  </span>
                )}
              </div>
              {loading ? (
                <p>Loading profile...</p>
              ) : (
                <form onSubmit={handleProfileUpdate}>
                  <div className="form-group">
                    <label>Username (Read-only)</label>
                    <input
                      type="text"
                      value={profileData.username}
                      placeholder="Enter username"
                      disabled
                      style={{ background: '#f5f5f5', cursor: 'not-allowed' }}
                    />
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>First Name</label>
                      <input
                        type="text"
                        value={profileData.firstName}
                        onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                        placeholder="Enter first name"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Last Name</label>
                      <input
                        type="text"
                        value={profileData.lastName}
                        onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                        placeholder="Enter last name"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      placeholder="Enter email address"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Department</label>
                    <input
                      type="text"
                      value={profileData.department}
                      onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
                      placeholder="Enter department (optional)"
                    />
                  </div>

                  <div className="form-group" style={{ marginTop: '18px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <PenTool size={16} /> Staff Signature (for PM/UAT auto-submit)
                    </label>

                    {profileData.signPath && (
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', color: '#4b5563', marginBottom: '6px' }}>Current saved signature</div>
                        <img
                          src={`${BASE_URL}/${profileData.signPath}`}
                          alt="Current staff signature"
                          style={{ border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', padding: '6px', maxHeight: '72px' }}
                        />
                      </div>
                    )}

                    <canvas
                      ref={profileSigCanvasRef}
                      style={{
                        width: '100%',
                        maxWidth: '600px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        background: '#fff',
                        touchAction: 'none'
                      }}
                      onMouseDown={startDrawingProfileSignature}
                      onMouseMove={drawProfileSignature}
                      onMouseUp={stopDrawingProfileSignature}
                      onMouseLeave={stopDrawingProfileSignature}
                      onTouchStart={startDrawingProfileSignature}
                      onTouchMove={drawProfileSignature}
                      onTouchEnd={stopDrawingProfileSignature}
                    />

                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={clearProfileSignature}
                        style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#1f2937' }}
                      >
                        Clear Signature
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleSaveProfileSignature}
                        disabled={!hasProfileSignature || savingProfileSignature}
                        style={{ opacity: (!hasProfileSignature || savingProfileSignature) ? 0.6 : 1 }}
                      >
                        {savingProfileSignature ? 'Saving Signature...' : 'Save Staff Signature'}
                      </button>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                      Recipient signatures are still captured per form. Staff signature is auto-applied from this profile setting.
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary">
                    <Save size={16} style={{ marginRight: '5px' }} />
                    Update Profile
                  </button>
                </form>
              )}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="card">
              <h2>Security & Privacy</h2>
              
              <div className="security-section">
                <h3>Change Password</h3>
                <form onSubmit={handlePasswordChange}>
                  <div className="form-group">
                    <label>Current Password</label>
                    <div className="password-field">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={securityData.currentPassword}
                        onChange={(e) => setSecurityData({ ...securityData, currentPassword: e.target.value })}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>New Password</label>
                    <div className="password-field">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={securityData.newPassword}
                        onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Confirm New Password</label>
                    <input
                      type="password"
                      value={securityData.confirmPassword}
                      onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary">
                    Change Password
                  </button>
                </form>
              </div>

              <div className="security-section">
                <h3>Two-Factor Authentication</h3>
                <div className="toggle-setting">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={securityData.twoFactorEnabled}
                      onChange={(e) => setSecurityData({ ...securityData, twoFactorEnabled: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                    Enable Two-Factor Authentication
                  </label>
                  <p className="setting-description">
                    Add an extra layer of security to your account with two-factor authentication.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="card">
              <h2>Notification Preferences</h2>
              
              <div className="notification-settings">
                <div className="toggle-setting">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.emailNotifications}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, emailNotifications: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                    Email Notifications
                  </label>
                  <p className="setting-description">Receive general notifications via email</p>
                </div>

                <div className="toggle-setting">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.maintenanceReminders}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, maintenanceReminders: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                    Maintenance Reminders
                  </label>
                  <p className="setting-description">Get notified about upcoming maintenance schedules</p>
                </div>

                <div className="toggle-setting">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.assetUpdates}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, assetUpdates: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                    Asset Updates
                  </label>
                  <p className="setting-description">Receive notifications when assets are added, modified, or removed</p>
                </div>

                <div className="toggle-setting">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.systemAlerts}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, systemAlerts: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                    System Alerts
                  </label>
                  <p className="setting-description">Important system notifications and security alerts</p>
                </div>

                <div className="toggle-setting">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={notificationSettings.weeklyReports}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, weeklyReports: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                    Weekly Reports
                  </label>
                  <p className="setting-description">Receive weekly summary reports</p>
                </div>

                <button onClick={handleNotificationUpdate} className="btn btn-primary">
                  <Save size={16} style={{ marginRight: '5px' }} />
                  Save Preferences
                </button>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="card">
              <h2>Appearance Settings</h2>
              
              <div className="appearance-settings">
                <div className="form-group">
                  <label>Theme</label>
                  <select
                    value={themeSettings.theme}
                    onChange={(e) => setThemeSettings({ ...themeSettings, theme: e.target.value })}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="auto">Auto (System)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Accent Color</label>
                  <input
                    type="color"
                    value={themeSettings.accentColor}
                    onChange={(e) => setThemeSettings({ ...themeSettings, accentColor: e.target.value })}
                    className="color-picker"
                  />
                </div>

                <div className="toggle-setting">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={themeSettings.compactMode}
                      onChange={(e) => setThemeSettings({ ...themeSettings, compactMode: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                    Compact Mode
                  </label>
                  <p className="setting-description">Use a more compact layout to fit more content on screen</p>
                </div>

                <div className="toggle-setting">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={themeSettings.sidebarCollapsed}
                      onChange={(e) => setThemeSettings({ ...themeSettings, sidebarCollapsed: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                    Collapsed Sidebar
                  </label>
                  <p className="setting-description">Start with sidebar collapsed by default</p>
                </div>

                <button onClick={handleThemeUpdate} className="btn btn-primary">
                  <Save size={16} style={{ marginRight: '5px' }} />
                  Apply Changes
                </button>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="card">
              {profileData.role.toLowerCase() !== 'admin' ? (
                // Non-admin view - restricted access
                <div>
                  <h2 style={{ margin: 0, marginBottom: '20px' }}>User Management</h2>
                  <div style={{
                    padding: '60px 20px',
                    textAlign: 'center',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                    border: '2px dashed #dee2e6'
                  }}>
                    <Shield size={64} style={{ color: '#6c757d', marginBottom: '20px' }} />
                    <h3 style={{ color: '#495057', marginBottom: '10px', fontSize: '1.25rem' }}>
                      Access Restricted
                    </h3>
                    <p style={{ color: '#6c757d', fontSize: '1rem', margin: 0 }}>
                      Only Admin can access this section
                    </p>
                  </div>
                </div>
              ) : (
                // Admin view - full access
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <h2 style={{ margin: 0 }}>User Management</h2>
                      <p style={{ color: '#666', marginTop: '5px', marginBottom: 0 }}>
                        View all registered users in the system
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.9rem', color: '#4b5563', fontWeight: '600' }}>List Order</span>
                      <select
                        value={listSortMode}
                        onChange={(e) => setListSortMode(e.target.value)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          backgroundColor: 'white',
                          fontSize: '0.9rem',
                          color: '#374151',
                          minWidth: '130px'
                        }}
                      >
                        <option value="default">Default</option>
                        <option value="alpha-asc">A-Z</option>
                        <option value="alpha-desc">Z-A</option>
                        <option value="num-asc">0-9</option>
                        <option value="num-desc">9-0</option>
                      </select>
                      <button
                        onClick={() => setShowAddUserModal(true)}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        <Plus size={18} />
                        Add New User
                      </button>
                    </div>
                  </div>
                  
                  {loadingUsers ? (
                    <p>Loading users...</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    marginTop: '10px',
                    fontSize: '0.9rem'
                  }}>
                    <thead>
                      <tr style={{ 
                        borderBottom: '2px solid #e0e0e0',
                        backgroundColor: '#f8f9fa'
                      }}>
                        <th style={{ 
                          padding: '10px 12px', 
                          textAlign: 'left', 
                          fontWeight: '600', 
                          color: '#333',
                          fontSize: '0.85rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          whiteSpace: 'nowrap'
                        }}>Username</th>
                        <th style={{ 
                          padding: '10px 12px', 
                          textAlign: 'left', 
                          fontWeight: '600', 
                          color: '#333',
                          fontSize: '0.85rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          whiteSpace: 'nowrap'
                        }}>Name</th>
                        <th style={{ 
                          padding: '10px 12px', 
                          textAlign: 'left', 
                          fontWeight: '600', 
                          color: '#333',
                          fontSize: '0.85rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          whiteSpace: 'nowrap'
                        }}>Email</th>
                        <th style={{ 
                          padding: '10px 12px', 
                          textAlign: 'left', 
                          fontWeight: '600', 
                          color: '#333',
                          fontSize: '0.85rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          whiteSpace: 'nowrap'
                        }}>Department</th>
                        <th style={{ 
                          padding: '10px 12px', 
                          textAlign: 'center', 
                          fontWeight: '600', 
                          color: '#333',
                          fontSize: '0.85rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          whiteSpace: 'nowrap'
                        }}>Role</th>
                        <th style={{ 
                          padding: '10px 12px', 
                          textAlign: 'left', 
                          fontWeight: '600', 
                          color: '#333',
                          fontSize: '0.85rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          whiteSpace: 'nowrap'
                        }}>Joined</th>
                        <th style={{ 
                          padding: '10px 12px', 
                          textAlign: 'center', 
                          fontWeight: '600', 
                          color: '#333',
                          fontSize: '0.85rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          whiteSpace: 'nowrap'
                        }}>Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedAllUsers.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                            No users found
                          </td>
                        </tr>
                      ) : (
                        sortedAllUsers.map((user) => (
                          <tr key={user.userId} style={{ 
                            borderBottom: '1px solid #f0f0f0',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <td style={{ 
                              padding: '10px 12px',
                              fontWeight: '500',
                              whiteSpace: 'nowrap'
                            }}>{user.username}</td>
                            <td style={{ 
                              padding: '10px 12px',
                              whiteSpace: 'nowrap'
                            }}>{user.firstName} {user.lastName}</td>
                            <td style={{ 
                              padding: '10px 12px',
                              color: '#666',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '200px'
                            }}>{user.email}</td>
                            <td style={{ 
                              padding: '10px 12px',
                              color: '#666',
                              whiteSpace: 'nowrap'
                            }}>{user.department || '-'}</td>
                            <td style={{ 
                              padding: '10px 12px',
                              textAlign: 'center'
                            }}>
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.7rem',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                background: 
                                  user.role.toLowerCase() === 'admin' ? '#e3d5ff' : 
                                  user.role.toLowerCase() === 'staff' ? '#d1ecf1' : 
                                  '#fff3cd',
                                color: 
                                  user.role.toLowerCase() === 'admin' ? '#6b21a8' : 
                                  user.role.toLowerCase() === 'staff' ? '#0c5460' : 
                                  '#856404',
                                whiteSpace: 'nowrap',
                                display: 'inline-block'
                              }}>
                                {user.role}
                              </span>
                            </td>
                            <td style={{ 
                              padding: '10px 12px', 
                              fontSize: '0.85rem', 
                              color: '#666',
                              whiteSpace: 'nowrap'
                            }}>
                              {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              }) : '-'}
                            </td>
                            <td style={{ 
                              padding: '10px 12px',
                              textAlign: 'center'
                            }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => handleEditUser(user)}
                                  style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '8px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                                  }}
                                  title="Edit user"
                                >
                                  <Edit size={16} />
                                </button>
                                
                                <button
                                  onClick={() => handleDeleteUser(user)}
                                  disabled={user.userId === JSON.parse(localStorage.getItem('userInfo') || '{}').userId}
                                  style={{
                                    background: user.userId === JSON.parse(localStorage.getItem('userInfo') || '{}').userId 
                                      ? '#ddd' 
                                      : 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '8px',
                                    color: 'white',
                                    cursor: user.userId === JSON.parse(localStorage.getItem('userInfo') || '{}').userId ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    opacity: user.userId === JSON.parse(localStorage.getItem('userInfo') || '{}').userId ? 0.5 : 1
                                  }}
                                  onMouseEnter={(e) => {
                                    if (user.userId !== JSON.parse(localStorage.getItem('userInfo') || '{}').userId) {
                                      e.currentTarget.style.transform = 'translateY(-2px)';
                                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                                  }}
                                  title={user.userId === JSON.parse(localStorage.getItem('userInfo') || '{}').userId ? "Cannot delete your own account" : "Delete user"}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add New User Modal */}
      {showAddUserModal && profileData.role.toLowerCase() === 'admin' && (
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
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Add New User</h2>
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  setNewUserData({
                    username: '',
                    email: '',
                    password: '',
                    firstName: '',
                    lastName: '',
                    department: '',
                    role: 'Staff'
                  });
                  setSelectedProjectName('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#666'
                }}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddUser} style={{ padding: '24px' }}>
              <div className="form-group">
                <label>Username *</label>
                <input
                  type="text"
                  value={newUserData.username}
                  onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                  placeholder="Enter username"
                  required
                  minLength={3}
                  maxLength={50}
                  pattern="[a-zA-Z0-9_]+"
                  title="Username can only contain letters, numbers, and underscores"
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    value={newUserData.firstName}
                    onChange={(e) => setNewUserData({ ...newUserData, firstName: e.target.value })}
                    placeholder="Enter first name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    value={newUserData.lastName}
                    onChange={(e) => setNewUserData({ ...newUserData, lastName: e.target.value })}
                    placeholder="Enter last name"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div className="form-group">
                <label>Password *</label>
                <div className="password-field">
                  <input
                    type={showNewUserPassword ? 'text' : 'password'}
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    placeholder="Enter password (min. 6 characters)"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                  >
                    {showNewUserPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <small style={{ color: '#666', fontSize: '0.85rem', display: 'block', marginTop: '4px' }}>
                  Minimum 6 characters
                </small>
              </div>

              <div className="form-group">
                <label>Department</label>
                <input
                  type="text"
                  value={newUserData.department}
                  onChange={(e) => setNewUserData({ ...newUserData, department: e.target.value })}
                  placeholder="Enter department (optional)"
                />
              </div>

              <div className="form-group">
                <label>Role *</label>
                <select
                  value={newUserData.role}
                  onChange={(e) => {
                    setNewUserData({ ...newUserData, role: e.target.value });
                    if (e.target.value !== 'Project Customer') {
                      setSelectedProjectName('');
                    }
                  }}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="Staff">Staff</option>
                  <option value="Admin">Admin</option>
                  <option value="Project Customer">Project Customer</option>
                </select>
              </div>

              {/* Project Name dropdown - only show when Project Customer is selected */}
              {newUserData.role === 'Project Customer' && (
                <div className="form-group">
                  <label>Project Name *</label>
                  <select
                    value={selectedProjectName}
                    onChange={(e) => setSelectedProjectName(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">Select a project...</option>
                    {loadingCustomers ? (
                      <option disabled>Loading customers...</option>
                    ) : (
                      sortedCustomerList && sortedCustomerList.length > 0 ? (
                        sortedCustomerList.map((customer, index) => (
                          <option key={index} value={customer}>
                            {customer}
                          </option>
                        ))
                      ) : (
                        <option disabled>No projects available</option>
                      )
                    )}
                  </select>
                </div>
              )}

              {/* Staff Signature Capture */}
              <div style={{
                marginTop: '16px',
                padding: '12px',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                background: '#f8f9fa'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <PenTool size={18} color="#667eea" />
                  <strong>Staff Signature (required)</strong>
                </div>
                <div style={{
                  border: '2px dashed #bdc3c7',
                  borderRadius: '8px',
                  padding: '8px',
                  background: 'white'
                }}>
                  <canvas
                    ref={newUserSigCanvasRef}
                    onMouseDown={startDrawingNewUser}
                    onMouseMove={drawNewUser}
                    onMouseUp={stopDrawingNewUser}
                    onMouseLeave={stopDrawingNewUser}
                    onTouchStart={startDrawingNewUser}
                    onTouchMove={drawNewUser}
                    onTouchEnd={stopDrawingNewUser}
                    style={{ width: '100%', height: 'auto', cursor: 'crosshair', borderRadius: '6px', display: 'block', touchAction: 'none' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <small style={{ color: '#666' }}>Sign using mouse or touch</small>
                    <button
                      type="button"
                      onClick={clearNewUserSignature}
                      style={{
                        padding: '6px 12px',
                        background: hasNewUserSignature ? '#e74c3c' : '#bdc3c7',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: hasNewUserSignature ? 'pointer' : 'not-allowed',
                        opacity: hasNewUserSignature ? 1 : 0.6,
                        display: 'inline-flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      <Trash2 size={14} />
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={!hasNewUserSignature}
                >
                  <Plus size={16} style={{ marginRight: '5px' }} />
                  Add User
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUserModal(false);
                    setNewUserData({
                      username: '',
                      email: '',
                      password: '',
                      firstName: '',
                      lastName: '',
                      department: '',
                      role: 'Staff'
                    });
                    setSelectedProjectName('');
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUserModal && profileData.role.toLowerCase() === 'admin' && (
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
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Edit User Information</h2>
              <button
                onClick={() => {
                  setShowEditUserModal(false);
                  setEditUserData({
                    userId: '',
                    username: '',
                    email: '',
                    firstName: '',
                    lastName: '',
                    department: '',
                    role: 'Staff',
                    projectName: ''
                  });
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#666'
                }}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleEditUserSubmit} style={{ padding: '24px' }}>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={editUserData.username}
                  onChange={(e) => setEditUserData({ ...editUserData, username: e.target.value })}
                  placeholder={editUserData.username}
                  required
                  minLength={3}
                  maxLength={50}
                  pattern="[a-zA-Z0-9_]+"
                  title="Username can only contain letters, numbers, and underscores"
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    value={editUserData.firstName}
                    onChange={(e) => setEditUserData({ ...editUserData, firstName: e.target.value })}
                    placeholder={editUserData.firstName}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    value={editUserData.lastName}
                    onChange={(e) => setEditUserData({ ...editUserData, lastName: e.target.value })}
                    placeholder={editUserData.lastName}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={editUserData.email}
                  onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                  placeholder={editUserData.email}
                  required
                />
              </div>

              <div className="form-group">
                <label>Department</label>
                <input
                  type="text"
                  value={editUserData.department}
                  onChange={(e) => setEditUserData({ ...editUserData, department: e.target.value })}
                  placeholder={editUserData.department || 'Enter department (optional)'}
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select
                  value={editUserData.role}
                  onChange={(e) => {
                    setEditUserData({ ...editUserData, role: e.target.value, projectName: '' });
                    // Fetch customer names if Project Customer is selected
                    if (e.target.value === 'Project Customer') {
                      fetchCustomerNames();
                    }
                  }}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="Staff">Staff</option>
                  <option value="Admin">Admin</option>
                  <option value="Project Customer">Project Customer</option>
                </select>
              </div>

              {/* Conditional Project Name dropdown for Project Customer role */}
              {editUserData.role === 'Project Customer' && (
                <div className="form-group">
                  <label>Project Name *</label>
                  <select
                    value={editUserData.projectName}
                    onChange={(e) => setEditUserData({ ...editUserData, projectName: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">Select a project...</option>
                    {loadingCustomers ? (
                      <option disabled>Loading customers...</option>
                    ) : (
                      sortedCustomerList && sortedCustomerList.length > 0 ? (
                        sortedCustomerList.map((customer, index) => (
                          <option key={index} value={customer}>
                            {customer}
                          </option>
                        ))
                      ) : (
                        <option disabled>No projects available</option>
                      )
                    )}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  <Save size={16} style={{ marginRight: '5px' }} />
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditUserModal(false);
                    setEditUserData({
                      userId: '',
                      username: '',
                      email: '',
                      firstName: '',
                      lastName: '',
                      department: '',
                      role: 'Staff',
                      projectName: ''
                    });
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Confirmation Modal */}
      {showPasswordConfirmModal && profileData.role.toLowerCase() === 'admin' && (
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
          zIndex: 1001
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '450px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Confirm Your Password</h2>
              <button
                onClick={() => {
                  setShowPasswordConfirmModal(false);
                  setAdminPassword('');
                  setShowEditUserModal(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#666'
                }}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handlePasswordConfirm} style={{ padding: '24px' }}>
              <p style={{ 
                color: '#666', 
                marginBottom: '20px',
                fontSize: '0.95rem'
              }}>
                {actionType === 'delete' 
                  ? `Please enter your password to confirm deletion of user "${deleteUserName}". This action cannot be undone.`
                  : `Please enter your password to confirm the changes to user "${editUserData.username}".`
                }
              </p>

              <div className="form-group">
                <label>Your Password</label>
                <div className="password-field">
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                  >
                    {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ 
                    flex: 1,
                    background: actionType === 'delete' ? 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)' : undefined
                  }}
                >
                  <CheckCircle size={16} style={{ marginRight: '5px' }} />
                  {actionType === 'delete' ? 'Confirm Delete' : 'Confirm Update'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordConfirmModal(false);
                    setAdminPassword('');
                    if (actionType === 'edit') {
                      setShowEditUserModal(true);
                    } else {
                      setShowDeleteConfirmModal(true);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && profileData.role.toLowerCase() === 'admin' && (
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
          zIndex: 1001
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '450px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#e74c3c' }}>
                <Trash2 size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Delete User
              </h2>
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setDeleteUserId(null);
                  setDeleteUserName('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#666'
                }}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleDeleteConfirm} style={{ padding: '24px' }}>
              <div style={{
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'start',
                gap: '12px'
              }}>
                <Shield size={24} color="#ff9800" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#856404' }}>
                    Warning: This action cannot be undone
                  </p>
                  <p style={{ margin: 0, color: '#856404', fontSize: '0.9rem' }}>
                    Are you sure you want to delete user "<strong>{deleteUserName}</strong>"? All associated data will be permanently removed.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Trash2 size={16} />
                  Delete User
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirmModal(false);
                    setDeleteUserId(null);
                    setDeleteUserName('');
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSettings;
