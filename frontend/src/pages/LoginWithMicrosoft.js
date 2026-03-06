import React, { useState } from 'react';
import { User, Lock } from 'lucide-react';
import { API_URL } from '../config/api';
import { PublicClientApplication } from '@azure/msal-browser';
import apiService from '../services/apiService';
import usePageTitle from '../hooks/usePageTitle';

const msalConfig = {
  auth: {
    clientId: "YOUR_CLIENT_ID", // Replace with your Azure AD App Client ID
    authority: "https://login.microsoftonline.com/YOUR_TENANT_ID", // Replace with your Tenant ID or 'common' for multi-tenant
    redirectUri: process.env.REACT_APP_REDIRECT_URI || window.location.origin,
  },
};

const msalInstance = new PublicClientApplication(msalConfig);

const Login = ({ onLogin }) => {
  usePageTitle('Login');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleManualLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Use email for login since backend expects email
      const response = await apiService.login(credentials.username, credentials.password);
      console.log('Login successful:', response);
      onLogin();
    } catch (error) {
      console.error('Login failed:', error);
      setError(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    try {
      // For development, use the dev-token endpoint as fallback
      const response = await fetch('${API_URL}/auth/dev-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get development token');
      }

      const data = await response.json();
      console.log('Dev token response:', data);

      if (data.success && data.data?.token) {
        apiService.setToken(data.data.token);
        alert(`Welcome ${data.data.user.username} (Development Mode)`);
        onLogin();
      } else {
        throw new Error('Invalid token response');
      }
    } catch (err) {
      console.error('Microsoft login failed:', err);
      alert('Login failed. Please try manual login or check if the backend is running.');
    }
  };

  return (
    <div className="login-container" style={styles.container}>
      <div className="login-card" style={styles.card}>
        <h2 className="login-title" style={styles.title}>Inventory Management System</h2>

        <form onSubmit={handleManualLogin}>
          <div className="form-group" style={styles.group}>
            <label style={styles.label}>
              <User size={16} style={styles.icon} /> Email
            </label>
            <input
              type="email"
              value={credentials.username}
              onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
              placeholder="Enter email"
              required
              style={styles.input}
            />
          </div>

          <div className="form-group" style={styles.group}>
            <label style={styles.label}>
              <Lock size={16} style={styles.icon} /> Password
            </label>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              placeholder="Enter password"
              required
              style={styles.input}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" className="btn btn-primary" style={styles.loginButton} disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div style={styles.divider}>OR</div>

        <button onClick={handleMicrosoftLogin} style={styles.microsoftButton}>
          Login with Microsoft
        </button>
      </div>
    </div>
  );
};

// --- Inline styles (optional, can replace with CSS file) ---
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: '#f3f4f6',
  },
  card: {
    background: '#fff',
    padding: '40px',
    borderRadius: '12px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '400px',
  },
  title: {
    textAlign: 'center',
    marginBottom: '20px',
  },
  group: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontWeight: '600',
    marginBottom: '6px',
  },
  icon: {
    marginRight: '8px',
    verticalAlign: 'middle',
  },
  input: {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #ccc',
  },
  loginButton: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  divider: {
    textAlign: 'center',
    margin: '16px 0',
    color: '#888',
    fontWeight: '500',
  },
  microsoftButton: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#0078D4',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  error: {
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    padding: '8px',
    borderRadius: '4px',
    marginBottom: '16px',
    fontSize: '14px',
  },
};

export default Login;

