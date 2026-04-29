// API Configuration
// Uses environment variable with fallback for development
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

// Remove trailing slash if present
export const getApiUrl = (endpoint = '') => {
  const baseUrl = API_BASE_URL.endsWith('/') 
    ? API_BASE_URL.slice(0, -1) 
    : API_BASE_URL;
  
  const path = endpoint.startsWith('/') 
    ? endpoint 
    : `/${endpoint}`;
  
  return `${baseUrl}${path}`;
};

// Export base URL for direct use
export const API_URL = API_BASE_URL;

export default {
  getApiUrl,
  API_URL
};
