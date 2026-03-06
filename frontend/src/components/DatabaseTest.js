import React, { useState, useEffect } from 'react';
import apiService from '../services/apiService';

const DatabaseTest = () => {
  const [testResults, setTestResults] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const runTests = async () => {
      const results = {};
      
      try {
        // Test 1: Health check
        console.log('Testing health endpoint...');
        const apiUrl = process.env.REACT_APP_API_URL || `${window.location.origin}/api/v1`;
        const healthUrl = apiUrl.replace('/api/v1', '/api/health');
        const healthResponse = await fetch(healthUrl);
        const healthData = await healthResponse.json();
        results.health = { success: true, data: healthData };
      } catch (error) {
        results.health = { success: false, error: error.message };
      }

      try {
        // Test 2: Assets endpoint
        console.log('Testing assets endpoint...');
        const assetsResponse = await apiService.getAllAssets();
        results.assets = { success: true, data: assetsResponse };
      } catch (error) {
        results.assets = { success: false, error: error.message };
      }

      try {
        // Test 3: Dashboard statistics
        console.log('Testing dashboard statistics...');
        const dashboardResponse = await apiService.getDashboardData();
        results.dashboard = { success: true, data: dashboardResponse };
      } catch (error) {
        results.dashboard = { success: false, error: error.message };
      }

      setTestResults(results);
      setLoading(false);
    };

    runTests();
  }, []);

  if (loading) {
    return <div style={{ padding: '20px' }}>Running database connectivity tests...</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>🔬 Database Connection Test Results</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>1. Health Check</h3>
        <div style={{ 
          padding: '10px', 
          backgroundColor: testResults.health?.success ? '#d4edda' : '#f8d7da',
          border: `1px solid ${testResults.health?.success ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '5px' 
        }}>
          <strong>Status:</strong> {testResults.health?.success ? '✅ SUCCESS' : '❌ FAILED'}
          <br />
          <strong>Response:</strong> 
          <pre>{JSON.stringify(testResults.health, null, 2)}</pre>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>2. Assets Endpoint</h3>
        <div style={{ 
          padding: '10px', 
          backgroundColor: testResults.assets?.success ? '#d4edda' : '#f8d7da',
          border: `1px solid ${testResults.assets?.success ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '5px' 
        }}>
          <strong>Status:</strong> {testResults.assets?.success ? '✅ SUCCESS' : '❌ FAILED'}
          <br />
          <strong>Assets Count:</strong> {testResults.assets?.data?.data?.length || 0}
          <br />
          <strong>Response:</strong> 
          <pre style={{ maxHeight: '200px', overflow: 'auto' }}>
            {JSON.stringify(testResults.assets, null, 2)}
          </pre>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>3. Dashboard Statistics</h3>
        <div style={{ 
          padding: '10px', 
          backgroundColor: testResults.dashboard?.success ? '#d4edda' : '#f8d7da',
          border: `1px solid ${testResults.dashboard?.success ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '5px' 
        }}>
          <strong>Status:</strong> {testResults.dashboard?.success ? '✅ SUCCESS' : '❌ FAILED'}
          <br />
          <strong>Total Assets:</strong> {testResults.dashboard?.data?.data?.total || 0}
          <br />
          <strong>Response:</strong> 
          <pre style={{ maxHeight: '200px', overflow: 'auto' }}>
            {JSON.stringify(testResults.dashboard, null, 2)}
          </pre>
        </div>
      </div>

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#e7f3ff', border: '1px solid #bee5eb', borderRadius: '5px' }}>
        <h3>📋 Summary</h3>
        <ul>
          <li>Health Check: {testResults.health?.success ? '✅' : '❌'}</li>
          <li>Assets API: {testResults.assets?.success ? '✅' : '❌'}</li>
          <li>Dashboard API: {testResults.dashboard?.success ? '✅' : '❌'}</li>
        </ul>
        
        {Object.values(testResults).every(test => test.success) ? (
          <p style={{ color: '#28a745', fontWeight: 'bold' }}>
            🎉 All tests passed! Your database connection is working perfectly.
          </p>
        ) : (
          <p style={{ color: '#dc3545', fontWeight: 'bold' }}>
            ⚠️ Some tests failed. Please check the backend server and database connection.
          </p>
        )}
      </div>
    </div>
  );
};

export default DatabaseTest;