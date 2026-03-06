import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import AddProject from './pages/AddProject';
import EditProject from './pages/EditProject';
import Assets from './pages/Assets';
import AssetDetail from './pages/AssetDetail';
import PreventiveMaintenance from './pages/PreventiveMaintenance';
import PMDetail from './pages/PMDetail';
import PMImport from './pages/PMImport';
import PMSchedule from './pages/PMSchedule';
import AccountSettings from './pages/AccountSettings';
import AuditLog from './pages/AuditLog';
import SolutionPrincipal from './pages/SolutionPrincipal';
import Models from './pages/Models';
import ModelSpecifications from './pages/ModelSpecifications';
import AddModelSpecs from './pages/AddModelSpecs';
import AddAsset from './pages/AddAsset';
import EditAsset from './pages/EditAsset';
import CSVImport from './pages/CSVImport';
import DatabaseTest from './components/DatabaseTest';
import apiService from './services/apiService';
import inactivityMonitor from './utils/inactivityMonitor';
import { isAuthenticated as checkAuth, setupGlobalAuthInterceptor } from './utils/authUtils';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);

  useEffect(() => {
    // Setup global auth interceptor to catch 401 responses everywhere
    setupGlobalAuthInterceptor();
    
    // Check if user is authenticated on app load (checks token expiration)
    console.log('🔍 App.js: Checking authentication on load...');
    const isUserAuthenticated = checkAuth();
    
    if (isUserAuthenticated) {
      console.log('✅ User is authenticated with valid token');
      setIsAuthenticated(true);
      // Start inactivity monitoring
      inactivityMonitor.start();
    } else {
      console.log('❌ User is not authenticated or token expired');
      setIsAuthenticated(false);
      // Token will be cleared by checkAuth() if expired
    }
    
    // Cleanup on unmount
    return () => {
      inactivityMonitor.stop();
    };
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    // Start monitoring user inactivity after login
    inactivityMonitor.start();
  };

  const handleLogout = () => {
    // Stop inactivity monitoring
    inactivityMonitor.stop();
    
    // Clear authentication data
    localStorage.removeItem('authToken');
    localStorage.removeItem('userInfo');
    setIsAuthenticated(false);
    setAssets([]);
    setLoading(true);
  };

  const addAsset = async (assetData) => {
    try {
      const response = await apiService.createAsset(assetData);
      console.log('Asset created:', response);
      // Refresh assets list or add to local state
    } catch (error) {
      console.error('Error creating asset:', error);
    }
  };

  const updateAsset = async (serialNumber, assetData) => {
    try {
      const response = await apiService.updateAsset(serialNumber, assetData);
      console.log('Asset updated:', response);
      // Refresh assets list or update local state
    } catch (error) {
      console.error('Error updating asset:', error);
    }
  };

  const deleteAsset = async (serialNumber) => {
    try {
      const response = await apiService.deleteAsset(serialNumber);
      console.log('Asset deleted:', response);
      // Refresh assets list or remove from local state
    } catch (error) {
      console.error('Error deleting asset:', error);
    }
  };

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {!isAuthenticated ? (
        <Login onLogin={handleLogin} />
      ) : (
        <div className={`app-layout ${isSidebarMinimized ? 'sidebar-minimized' : ''}`}>
          <Sidebar onLogout={handleLogout} onMinimizeChange={setIsSidebarMinimized} />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Navigate to="/assets" replace />} />
              <Route path="/login" element={<Navigate to="/assets" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/add" element={<AddProject />} />
              <Route path="/projects/edit/:id" element={<EditProject />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/assets" element={<Assets onDelete={deleteAsset} />} />
              <Route path="/assets/import" element={<CSVImport />} />
              <Route path="/asset-detail/:assetId" element={<AssetDetail />} />
              <Route path="/maintenance" element={<PreventiveMaintenance assets={assets} />} />
              <Route path="/pm" element={<PreventiveMaintenance assets={assets} />} />
              <Route path="/pm-schedule" element={<PMSchedule />} />
              <Route path="/pm-import" element={<PMImport />} />
              <Route path="/maintenance/detail/:pmId" element={<PMDetail />} />
              <Route path="/models" element={<Models />} />
              <Route path="/models/specs" element={<ModelSpecifications />} />
              <Route path="/models/:modelId/add-specs" element={<AddModelSpecs />} />
              <Route path="/solution-principal" element={<SolutionPrincipal />} />
              <Route path="/settings" element={<AccountSettings />} />
              <Route path="/audit-log" element={<AuditLog />} />
              <Route path="/add-asset" element={<AddAsset onAdd={addAsset} />} />
              <Route path="/edit-asset/:id" element={<EditAsset assets={assets} onUpdate={updateAsset} />} />
              <Route path="/db-test" element={<DatabaseTest />} />
              <Route path="*" element={<Navigate to="/assets" replace />} />
            </Routes>
          </main>
        </div>
      )}
    </Router>
  );
}

export default App;