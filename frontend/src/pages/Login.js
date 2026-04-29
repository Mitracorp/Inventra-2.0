import React, { useCallback, useEffect, useState } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { User, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { PublicClientApplication } from '@azure/msal-browser';
import MitracorpLogo from '../assets/MitracorpLogo_full.png';

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

const Login = ({ onLogin }) => {
  usePageTitle('Login');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [msLoading, setMsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const exchangeMicrosoftToken = useCallback(async (idToken) => {
    const candidateApiUrls = Array.from(new Set([
      process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1',
      'http://localhost:5000/api/v1'
    ]));

    let response = null;
    let lastError = null;

    for (const apiUrl of candidateApiUrls) {
      try {
        response = await fetch(`${apiUrl}/auth/microsoft-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ idToken })
        });

        if (response.ok) {
          const data = await response.json();
          if (!data.success) {
            throw new Error(data.message || 'Microsoft authentication failed');
          }

          localStorage.setItem('authToken', data.data.token);
          localStorage.setItem('userInfo', JSON.stringify(data.data.user));
          onLogin();
          return true;
        }

        lastError = `HTTP ${response.status}`;
      } catch (error) {
        lastError = error.message;
        continue;
      }
    }

    throw new Error(lastError || 'Unable to reach Microsoft login endpoint');
  }, [onLogin]);

  useEffect(() => {
    const handleRedirectLogin = async () => {
      if (!msalInstance) {
        return;
      }

      const hasAuthCode = window.location.hash.includes('code=');
      const loginInProgress = sessionStorage.getItem('msalLoginInProgress') === 'true';

      if (!hasAuthCode && !loginInProgress) {
        return;
      }

      try {
        console.log('🔄 Login page handling Microsoft redirect...');
        await msalInstance.initialize();
        const loginResult = await msalInstance.handleRedirectPromise();
        sessionStorage.removeItem('msalLoginInProgress');

        if (!loginResult?.idToken) {
          return;
        }

        await exchangeMicrosoftToken(loginResult.idToken);
      } catch (error) {
        sessionStorage.removeItem('msalLoginInProgress');
        console.error('❌ Login redirect handling failed:', error);
        setError(error.message || 'Microsoft login failed. Please try again.');
      } finally {
        setMsLoading(false);
      }
    };

    handleRedirectLogin();
  }, []);

  const candidateApiUrls = Array.from(new Set([
    process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1',
    'http://localhost:5000/api/v1'
  ]));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let response = null;
      let lastNetworkError = null;

      for (const apiUrl of candidateApiUrls) {
        try {
          response = await fetch(`${apiUrl}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password
            })
          });
          break;
        } catch (networkError) {
          lastNetworkError = networkError;
        }
      }

      if (!response) {
        throw lastNetworkError || new Error('Unable to reach login endpoint');
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        const responseText = await response.text().catch(() => '');
        throw new Error(responseText || `Unexpected server response (status ${response.status})`);
      }

      if (data.success) {
        // Store token and user info in localStorage
        localStorage.setItem('authToken', data.data.token);
        localStorage.setItem('userInfo', JSON.stringify(data.data.user));
        onLogin();
      } else {
        setError(data.message || 'Invalid email or password');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    if (!msalInstance) {
      setError('Azure login is not configured. Set REACT_APP_AZURE_CLIENT_ID in frontend env.');
      return;
    }

    setError('');
    setMsLoading(true);

    try {
      await msalInstance.initialize();
      sessionStorage.setItem('msalLoginInProgress', 'true');
      
      // Use loginRedirect instead of loginPopup to avoid COOP header issues on localhost
      await msalInstance.loginRedirect({
        scopes: ['openid', 'profile', 'email', 'User.Read'],
        prompt: 'select_account'
      });
    } catch (err) {
      sessionStorage.removeItem('msalLoginInProgress');
      console.error('Microsoft login error:', err);
      setError(err.message || 'Microsoft login failed. Please try again.');
      setMsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <img src={MitracorpLogo} alt="Mitracorp logo" className="login-logo" />
        <h1 className="login-brand-title">Inventra</h1>
        <div className="login-title-divider" />
        <h2 className="login-title">Inventory Management System</h2>
        {error && (
          <div style={{
            padding: '12px',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '6px',
            color: '#c33',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-username">
              <User size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Username
            </label>
            <input
              id="login-username"
              name="username"
              autoComplete="username"
              type="text"
              value={credentials.username}
              onChange={(e) => setCredentials({...credentials, username: e.target.value})}
              placeholder="Enter your username"
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">
              <Lock size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                name="password"
                autoComplete="current-password"
                type={showPassword ? "text" : "password"}
                value={credentials.password}
                onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                placeholder="Enter your password"
                required
                disabled={loading}
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#666'
                }}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div style={{
          margin: '16px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#777'
        }}>
          <div style={{ flex: 1, height: '1px', background: '#ddd' }} />
          <span style={{ fontSize: '13px' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: '#ddd' }} />
        </div>

        <button
          type="button"
          className="btn"
          onClick={handleMicrosoftLogin}
          disabled={msLoading}
          style={{
            width: '100%',
            border: '1px solid #cfd8e3',
            background: '#fff',
            color: '#1f2937',
            padding: '10px 14px',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: msLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="7" height="7" fill="#F79C1D" />
            <rect x="10" y="1" width="7" height="7" fill="#7FBA00" />
            <rect x="1" y="10" width="7" height="7" fill="#00A4EF" />
            <rect x="10" y="10" width="7" height="7" fill="#FFB900" />
          </svg>
          {msLoading ? 'Connecting to Microsoft...' : 'Continue with Microsoft'}
        </button>
      </div>
    </div>
  );
};

export default Login;