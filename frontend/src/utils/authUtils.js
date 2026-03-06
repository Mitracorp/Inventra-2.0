/**
 * Authentication utility functions
 */
import { jwtDecode } from 'jwt-decode';
import toast from './toast';

/**
 * Check if JWT token is expired
 */
export const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    const decoded = jwtDecode(token);
    const currentTime = Date.now() / 1000; // Convert to seconds
    
    // Check if token has expired (with 30 second buffer)
    return decoded.exp < currentTime;
  } catch (error) {
    console.error('Error decoding token:', error);
    return true; // Treat invalid tokens as expired
  }
};

/**
 * Check if user is authenticated (has valid, non-expired token)
 */
export const isAuthenticated = () => {
  const token = localStorage.getItem('authToken');
  
  if (!token) return false;
  
  // Check if token is expired
  if (isTokenExpired(token)) {
    // Token exists but is expired - clear it
    console.log('🔐 Token found but expired - auto logout');
    handleTokenExpiration('Your session has expired. Please log in again.');
    return false;
  }
  
  return true;
};

/**
 * Get the current auth token
 */
export const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

// Flag to prevent multiple simultaneous logouts
let isLoggingOut = false;

/**
 * Handle token expiration - clear storage and redirect to login
 */
export const handleTokenExpiration = (message = 'Your session has expired. Please log in again.') => {
  // Prevent multiple simultaneous logout attempts
  if (isLoggingOut) {
    console.log('⏭️ Logout already in progress, skipping...');
    return;
  }
  
  isLoggingOut = true;
  console.error('🔐 Token expired or invalid - logging out');
  
  // Clear all authentication data
  localStorage.removeItem('authToken');
  localStorage.removeItem('userInfo');
  
  // Show toast notification instead of alert
  toast.warn(message);
  
  // Small delay to ensure toast is visible before redirect
  setTimeout(() => {
    window.location.href = '/login';
    isLoggingOut = false; // Reset flag after redirect
  }, 100);
};

/**
 * Check if response indicates authentication failure
 */
export const isAuthError = (response) => {
  return response.status === 401 || response.status === 403;
};

/**
 * Handle API response with automatic token expiration detection
 * @param {Response} response - Fetch API response object
 * @returns {Promise} - Parsed JSON response
 */
export const handleAuthResponse = async (response) => {
  // Check for authentication errors
  if (isAuthError(response)) {
    handleTokenExpiration();
    throw new Error('Authentication failed');
  }

  const data = await response.json();
  
  // Check if response message indicates token issues
  if (!data.success && data.message) {
    const tokenKeywords = ['token', 'expired', 'unauthorized', 'authentication'];
    const hasTokenIssue = tokenKeywords.some(keyword => 
      data.message.toLowerCase().includes(keyword)
    );
    
    if (hasTokenIssue) {
      handleTokenExpiration();
      throw new Error('Token expired');
    }
  }
  
  return data;
};

/**
 * Make authenticated API request with automatic token handling
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options (method, body, etc.)
 * @returns {Promise} - API response data
 */
export const authenticatedFetch = async (url, options = {}) => {
  const token = getAuthToken();
  
  if (!token) {
    handleTokenExpiration('Please login to continue.');
    throw new Error('No auth token');
  }
  
  // Add auth header
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  try {
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    return await handleAuthResponse(response);
  } catch (error) {
    // If error message contains token-related keywords, handle expiration
    if (error.message && error.message.toLowerCase().includes('token')) {
      handleTokenExpiration();
    }
    throw error;
  }
};

/**
 * Logout user - clear storage and redirect to login
 */
export const logout = () => {
  localStorage.clear();
  window.location.href = '/login';
};

/**
 * Setup global fetch interceptor to handle 401 responses automatically
 * Call this once at app startup
 */
export const setupGlobalAuthInterceptor = () => {
  const originalFetch = window.fetch;
  
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    
    // Check if response is 401 Unauthorized
    if (response.status === 401) {
      console.error('🚫 401 Unauthorized - Session expired');
      handleTokenExpiration('Your session has expired. Please log in again.');
      // Return the response anyway to prevent errors
      return response;
    }
    
    return response;
  };
  
  console.log('✅ Global auth interceptor installed');
};
