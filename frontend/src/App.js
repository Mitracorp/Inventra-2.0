import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { PublicClientApplication } from '@azure/msal-browser';
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
import PMBulkRecipientOps from './pages/PMBulkRecipientOps';
import PMSchedule from './pages/PMSchedule';
import PMOverviewPage from './pages/PMOverviewPage';
import PMReports from './pages/PMReports';
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

const azureClientId = process.env.REACT_APP_AZURE_CLIENT_ID;
const azureAuthority = process.env.REACT_APP_AZURE_AUTHORITY || 'https://login.microsoftonline.com/common';
const azureRedirectUri = process.env.REACT_APP_AZURE_REDIRECT_URI || window.location.origin;

const msalInstance = azureClientId ? new PublicClientApplication({
  auth: {
    clientId: azureClientId,
    authority: azureAuthority,
    redirectUri: azureRedirectUri
  },
  cache: {
    cacheLocation: 'sessionStorage'
  }
}) : null;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      // Step 0: Initialize MSAL if configured
      if (msalInstance) {
        try {
          await msalInstance.initialize();
          console.log('✅ MSAL initialized');
        } catch (err) {
          console.error('❌ MSAL initialization error:', err);
        }
      }

      // Step 1: ALWAYS try to handle Microsoft redirect callback (whether flag is set or not)
      // This handles the case where user comes back from Microsoft auth
      if (msalInstance) {
        try {
          console.log('🔄 Checking for Microsoft auth redirect...');
          const loginResult = await msalInstance.handleRedirectPromise();
          
          if (loginResult) {
            console.log('✅ Microsoft auth redirect detected, processing token...');
            sessionStorage.removeItem('msalLoginInProgress');
            
            const idToken = loginResult.idToken;
            if (!idToken) {
              throw new Error('Microsoft login did not return an ID token');
            }

            // Send token to backend
            const candidateApiUrls = Array.from(new Set([
              process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1',
              'http://localhost:5000/api/v1'
            ]));

            console.log('📤 Sending idToken to backend...');
            let response = null;
            let lastError = null;
            
            for (const apiUrl of candidateApiUrls) {
              try {
                response = await fetch(`${apiUrl}/auth/microsoft-login`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idToken })
                });
                
                if (response.ok) {
                  const data = await response.json();
                  console.log('✅ Backend response:', data);
                  
                  if (data.success) {
                    localStorage.setItem('authToken', data.data.token);
                    localStorage.setItem('userInfo', JSON.stringify(data.data.user));
                    setIsAuthenticated(true);
                    inactivityMonitor.start();
                    console.log('✅ User logged in successfully via Microsoft');
                    return; // Early exit on success
                  } else {
                    lastError = data.message || 'Backend returned success=false';
                    console.error('❌ Backend error:', lastError);
                  }
                } else {
                  lastError = `HTTP ${response.status}`;
                }
                break; // Try next URL only on network error
              } catch (e) {
                lastError = e.message;
                console.warn(`⚠️  API URL failed: ${apiUrl} - ${lastError}`);
                continue; // Try next URL
              }
            }
            
            if (!response || !response.ok) {
              throw new Error(`Backend authentication failed: ${lastError}`);
            }
          } else {
            console.log('ℹ️  No Microsoft redirect detected');
          }
        } catch (err) {
          console.error('❌ Error handling Microsoft redirect:', err);
          sessionStorage.removeItem('msalLoginInProgress');
        }
      }

      // Step 2: Setup global auth interceptor to catch 401 responses everywhere
      setupGlobalAuthInterceptor();
      
      // Step 3: Check if user is already authenticated on app load (checks token expiration)
      console.log('🔍 App.js: Checking authentication on load...');
      const isUserAuthenticated = checkAuth();
      
      if (isUserAuthenticated) {
        console.log('✅ User is authenticated with valid token');
        setIsAuthenticated(true);
        inactivityMonitor.start();
      } else {
        console.log('ℹ️  User is not authenticated');
        setIsAuthenticated(false);
      }
    };

    initializeApp();
    
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
              <Route path="/maintenance/overview/:type" element={<PMOverviewPage />} />
              <Route path="/pm-import" element={<PMImport />} />
              <Route path="/pm-bulk-recipient" element={<PMBulkRecipientOps />} />
              <Route path="/pm-reports" element={<PMReports />} />
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