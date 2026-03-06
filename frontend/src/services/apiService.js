// API Service for handling all API calls
class ApiService {
  constructor() {
    // Use Node.js backend
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';
    this.token = localStorage.getItem('authToken');
  }

  // Development helper - get a valid token for testing
  async setDevelopmentToken() {
    // Skipping token generation since login is in mock mode
    console.log('Token generation bypassed - login is in mock mode');
    return true;
  }

  // Set authentication token
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  // Get authentication token
  getToken() {
    return this.token || localStorage.getItem('authToken');
  }

  // Generic method to handle API requests
  async makeRequest(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    try {
      const url = `${this.baseURL}/${endpoint}`;
      const response = await fetch(url, {
        headers,
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'API request failed');
      }

      return {
        data: data.data,
        meta: data.meta,
        success: data.success,
        message: data.message
      };
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  // Authentication methods
  async login(email, password) {
    const response = await this.makeRequest('auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    if (response.data?.token) {
      this.setToken(response.data.token);
    }
    
    return response;
  }

  async register(userData) {
    const response = await this.makeRequest('auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    
    if (response.data?.token) {
      this.setToken(response.data.token);
    }
    
    return response;
  }

  async logout() {
    this.setToken(null);
  }

  async getProfile() {
    return this.makeRequest('auth/profile');
  }

  async updateProfile(profileData) {
    return this.makeRequest('auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  }

  // Dashboard specific methods
  async getDashboardData() {
    return this.makeRequest('assets/statistics');
  }

  async getRecentActivity(limit = 10) {
    return this.makeRequest(`activity/recent?limit=${limit}`);
  }

  // Asset methods
  async getAllAssets(page = 1, limit = 10, filters = {}) {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...filters
    });
    
    return this.makeRequest(`assets?${queryParams}`);
  }

  async getAsset(serialNumber) {
    return this.makeRequest(`assets/${serialNumber}`);
  }

  async createAsset(assetData) {
    return this.makeRequest('assets', {
      method: 'POST',
      body: JSON.stringify(assetData)
    });
  }

  async updateAsset(serialNumber, assetData) {
    return this.makeRequest(`assets/${serialNumber}`, {
      method: 'PUT',
      body: JSON.stringify(assetData)
    });
  }

  async updateAssetById(assetId, assetData) {
    return this.makeRequest(`assets/id/${assetId}`, {
      method: 'PUT',
      body: JSON.stringify(assetData)
    });
  }

  async getAssetById(assetId) {
    return this.makeRequest(`assets/id/${assetId}`);
  }

  // Direct methods for asset endpoints that don't follow the standard response format
  async updateAssetByIdDirect(assetId, assetData) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };

    console.log('Request headers:', headers);
    console.log('Request URL:', `${this.baseURL}/assets/id/${assetId}`);
    console.log('Request body:', assetData);

    const url = `${this.baseURL}/assets/id/${assetId}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(assetData)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('Error response:', errorData);
      throw new Error(errorData?.error || errorData?.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async getAssetByIdDirect(assetId) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };

    const url = `${this.baseURL}/assets/id/${assetId}`;
    const response = await fetch(url, {
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async deleteAsset(serialNumber) {
    return this.makeRequest(`assets/${serialNumber}`, {
      method: 'DELETE'
    });
  }

  async deleteAssetById(assetId) {
    try {
      const token = this.getToken();
      const url = `${this.baseURL}/assets/id/${assetId}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || errorData?.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Delete Asset Error:', error);
      throw error;
    }
  }

  async validateImportAssets(assets) {
    try {
      console.log('📡 API: Calling validate-import with', assets.length, 'assets');
      console.log('📡 API: First asset:', assets[0]);
      
      const url = `${this.baseURL}/assets/validate-import`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assets })
      });

      console.log('📡 API: Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('📡 API: Error response data:', errorData);
        console.error('📡 API: Full error:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(errorData?.message || errorData?.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📡 API: Validation response:', data);
      return data;
    } catch (error) {
      console.error('❌ API: Validation Error:', error);
      console.error('❌ API: Error stack:', error.stack);
      throw error;
    }
  }

  async bulkImportAssets(assets, upsert = false) {
    try {
      const url = `${this.baseURL}/assets/bulk-import`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assets, upsert })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || errorData?.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data; // Return the data directly without checking for success field
    } catch (error) {
      console.error('Bulk Import Error:', error);
      throw error;
    }
  }

  // Project methods
  async getAllProjects(page = 1, limit = 10, filters = {}) {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...filters
    });
    
    return this.makeRequest(`projects?${queryParams}`);
  }

  async getProject(projectId) {
    return this.makeRequest(`projects/${projectId}`);
  }

  async createProject(projectData) {
    return this.makeRequest('projects', {
      method: 'POST',
      body: JSON.stringify(projectData)
    });
  }

  async updateProject(projectId, projectData) {
    return this.makeRequest(`projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(projectData)
    });
  }

  async deleteProject(projectId) {
    return this.makeRequest(`projects/${projectId}`, {
      method: 'DELETE'
    });
  }

  // Legacy methods for backward compatibility (now pointing to Node backend)
  async getProducts() {
    return this.getAllAssets();
  }

  async getProjects() {
    return this.getAllProjects();
  }

  // Inventory methods
  async getInventoryByProject(projectId) {
    return this.makeRequest(`inventory/project/${projectId}`);
  }

  async updateInventoryWithAsset(projectId, customerId, assetId) {
    return this.makeRequest('inventory/update-asset', {
      method: 'POST',
      body: JSON.stringify({ projectId, customerId, assetId })
    });
  }

  // Customer methods
  async getCustomersByProject(projectId) {
    return this.makeRequest(`customers/project/${projectId}`);
  }

  // Enhanced project methods for Add Asset feature
  async getProjectByReference(refNum) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };

    const url = `${this.baseURL}/projects/reference/${encodeURIComponent(refNum)}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async getBranchesByCustomer(customerName) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };

    const url = `${this.baseURL}/projects/branches/${encodeURIComponent(customerName)}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Enhanced asset creation with complete details
  async createAssetWithDetails(assetData) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };

    console.log('Creating asset with details:', assetData);

    const url = `${this.baseURL}/assets/create-with-details`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(assetData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || errorData?.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Methods to fetch dropdown data
  async getCategories() {
    const headers = {
      'Content-Type': 'application/json',
    };

    const url = `${this.baseURL}/categories`;
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error('Failed to fetch categories');
      return await response.json();
    } catch (error) {
      console.warn('Categories endpoint not available, using fallback data');
      // Return fallback data if endpoint doesn't exist
      return {
        data: [
          { Category_ID: 1, Category: 'Desktop' },
          { Category_ID: 2, Category: 'Printer' },
          { Category_ID: 3, Category: 'Laptop' },
          { Category_ID: 4, Category: 'Server' }
        ]
      };
    }
  }

  async getModels() {
    const headers = {
      'Content-Type': 'application/json',
    };

    const url = `${this.baseURL}/models`;
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error('Failed to fetch models');

      // Some endpoints return an array, others wrap in { data }
      const data = await response.json();
      return Array.isArray(data) ? { data } : data;
    } catch (error) {
      console.warn('Models endpoint not available, using fallback data');
      // Return fallback data if endpoint doesn't exist
      return {
        data: [
          { Model_ID: 1, Model: 'Dell OptiPlex All-in-One Plus 7420' },
          { Model_ID: 2, Model: 'HP Color LaserJet Enterprise MFP M480f' },
          { Model_ID: 3, Model: 'Lenovo ThinkPad X1 Carbon' },
          { Model_ID: 4, Model: 'Dell PowerEdge R740' }
        ]
      };
    }
  }

  async getPeripheralTypes() {
    const headers = {
      'Content-Type': 'application/json',
    };

    const url = `${this.baseURL}/peripherals/types`;
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error('Failed to fetch peripheral types');
      return await response.json();
    } catch (error) {
      console.warn('Peripheral types endpoint not available, using fallback data');
      // Return fallback data if endpoint doesn't exist
      return {
        data: [
          { Peripheral_Type_ID: 1, Peripheral_Type_Name: 'Keyboard' },
          { Peripheral_Type_ID: 2, Peripheral_Type_Name: 'Mouse' },
          { Peripheral_Type_ID: 3, Peripheral_Type_Name: 'Monitor' },
          { Peripheral_Type_ID: 4, Peripheral_Type_Name: 'Ethernet Cable' },
          { Peripheral_Type_ID: 5, Peripheral_Type_Name: 'Power Cable' }
        ]
      };
    }
  }

  // ========== HYBRID CATEGORY & PERIPHERAL METHODS ==========

  /**
   * Get all categories with hybrid support
   */
  async getCategories() {
    const headers = {
      'Content-Type': 'application/json',
    };

    const url = `${this.baseURL}/categories`;
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error('Failed to fetch categories');
      return await response.json();
    } catch (error) {
      console.warn('Categories endpoint not available, using fallback data');
      return {
        success: true,
        data: [
          { id: 1, name: 'Desktop', Category_ID: 1, Category: 'Desktop' },
          { id: 2, name: 'Printer', Category_ID: 2, Category: 'Printer' },
          { id: 3, name: 'Laptop', Category_ID: 3, Category: 'Laptop' },
          { id: 4, name: 'Server', Category_ID: 4, Category: 'Server' }
        ],
        fallback: true
      };
    }
  }

  /**
   * Search categories by name
   */
  async searchCategories(query) {
    const headers = {
      'Content-Type': 'application/json',
    };

    const url = `${this.baseURL}/categories/search?q=${encodeURIComponent(query)}`;
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error('Failed to search categories');
      return await response.json();
    } catch (error) {
      console.warn('Category search endpoint not available');
      // Fallback to client-side filtering
      const categories = await this.getCategories();
      const filtered = categories.data.filter(cat => 
        cat.name.toLowerCase().includes(query.toLowerCase())
      );
      return { success: true, data: filtered };
    }
  }

  /**
   * Get or create category (hybrid functionality)
   */
  async getOrCreateCategory(name) {
    const headers = {
      'Content-Type': 'application/json',
    };

    const url = `${this.baseURL}/categories/get-or-create`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name })
      });
      
      if (!response.ok) throw new Error('Failed to get or create category');
      return await response.json();
    } catch (error) {
      console.error('Failed to get or create category:', error);
      throw error;
    }
  }

  /**
   * Get all categories with hybrid format support
   */
  async getCategoriesHybrid() {
    const headers = {
      'Content-Type': 'application/json',
    };

    const url = `${this.baseURL}/categories`;
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error('Failed to fetch categories');
      return await response.json();
    } catch (error) {
      console.warn('Categories endpoint not available, using fallback data');
      return {
        success: true,
        data: [
          { id: 1, name: 'Desktop', Category_ID: 1, Category: 'Desktop' },
          { id: 2, name: 'Printer', Category_ID: 2, Category: 'Printer' },
          { id: 3, name: 'Laptop', Category_ID: 3, Category: 'Laptop' },
          { id: 4, name: 'Server', Category_ID: 4, Category: 'Server' }
        ]
      };
    }
  }

  /**
   * Search categories by name
   */
  async searchCategories(query) {
    const headers = {
      'Content-Type': 'application/json',
    };

    const url = `${this.baseURL}/categories/search?q=${encodeURIComponent(query)}`;
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error('Failed to search categories');
      return await response.json();
    } catch (error) {
      console.error('Failed to search categories:', error);
      throw error;
    }
  }

  /**
   * Create new category explicitly
   */
  async createCategory(name) {
    const headers = {
      'Content-Type': 'application/json',
    };

    const url = `${this.baseURL}/categories`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name })
      });
      
      if (!response.ok) throw new Error('Failed to create category');
      return await response.json();
    } catch (error) {
      console.error('Failed to create category:', error);
      throw error;
    }
  }

  /**
   * Get all peripheral types with hybrid support
   */
  async getPeripheralTypesHybrid() {
    const headers = {
      'Content-Type': 'application/json',
    };

    const url = `${this.baseURL}/peripherals/types`;
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error('Failed to fetch peripheral types');
      return await response.json();
    } catch (error) {
      console.warn('Peripheral types endpoint not available, using fallback data');
      return {
        success: true,
        data: [
          { id: 1, name: 'Keyboard', Peripheral_Type_ID: 1, Peripheral_Type_Name: 'Keyboard' },
          { id: 2, name: 'Mouse', Peripheral_Type_ID: 2, Peripheral_Type_Name: 'Mouse' },
          { id: 3, name: 'Monitor', Peripheral_Type_ID: 3, Peripheral_Type_Name: 'Monitor' },
          { id: 4, name: 'Ethernet Cable', Peripheral_Type_ID: 4, Peripheral_Type_Name: 'Ethernet Cable' },
          { id: 5, name: 'Power Cable', Peripheral_Type_ID: 5, Peripheral_Type_Name: 'Power Cable' }
        ],
        fallback: true
      };
    }
  }

  /**
   * Search peripheral types by name
   */
  async searchPeripheralTypes(query) {
    const headers = {
      'Content-Type': 'application/json',
    };

    const url = `${this.baseURL}/peripherals/types/search?q=${encodeURIComponent(query)}`;
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error('Failed to search peripheral types');
      return await response.json();
    } catch (error) {
      console.warn('Peripheral type search endpoint not available');
      // Fallback to client-side filtering
      const types = await this.getPeripheralTypesHybrid();
      const filtered = types.data.filter(type => 
        type.name.toLowerCase().includes(query.toLowerCase())
      );
      return { success: true, data: filtered };
    }
  }

  /**
   * Get or create peripheral type (hybrid functionality)
   */
  async getOrCreatePeripheralType(name) {
    const headers = {
      'Content-Type': 'application/json',
    };

    const url = `${this.baseURL}/peripherals/types/get-or-create`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name })
      });
      
      if (!response.ok) throw new Error('Failed to get or create peripheral type');
      return await response.json();
    } catch (error) {
      console.error('Failed to get or create peripheral type:', error);
      throw error;
    }
  }

  /**
   * Create peripheral for asset
   */
  async createPeripheral(peripheralData) {
    const headers = {
      'Content-Type': 'application/json',
    };

    const url = `${this.baseURL}/peripherals`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(peripheralData)
      });
      
      if (!response.ok) throw new Error('Failed to create peripheral');
      return await response.json();
    } catch (error) {
      console.error('Failed to create peripheral:', error);
      throw error;
    }
  }

  // ========== HYBRID MODEL METHODS ==========

  /**
   * Get all models with hybrid support
   */
  async getModelsHybrid() {
    const headers = {
      'Content-Type': 'application/json',
    };

    const url = `${this.baseURL}/models`;
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error('Failed to fetch models');
      return await response.json();
    } catch (error) {
      console.warn('Models endpoint not available, using fallback data');
      return {
        success: true,
        data: [
          { id: 1, name: 'Dell OptiPlex All-in-One Plus 7420', Model_ID: 1, Model: 'Dell OptiPlex All-in-One Plus 7420' },
          { id: 2, name: 'HP Color LaserJet Enterprise MFP M480f', Model_ID: 2, Model: 'HP Color LaserJet Enterprise MFP M480f' },
          { id: 3, name: 'Lenovo ThinkPad X1 Carbon', Model_ID: 3, Model: 'Lenovo ThinkPad X1 Carbon' },
          { id: 4, name: 'Dell PowerEdge R740', Model_ID: 4, Model: 'Dell PowerEdge R740' }
        ],
        fallback: true
      };
    }
  }

  /**
   * Search models by name
   */
  async searchModels(query) {
    const headers = {
      'Content-Type': 'application/json',
    };

    const url = `${this.baseURL}/models/search?q=${encodeURIComponent(query)}`;
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error('Failed to search models');
      return await response.json();
    } catch (error) {
      console.warn('Model search endpoint not available');
      // Fallback to client-side filtering
      const models = await this.getModelsHybrid();
      const filtered = models.data.filter(model => 
        model.name.toLowerCase().includes(query.toLowerCase())
      );
      return { success: true, data: filtered };
    }
  }

  /**
   * Get or create model (hybrid functionality)
   */
  async getOrCreateModel(name) {
    const headers = {
      'Content-Type': 'application/json',
    };

    const url = `${this.baseURL}/models/get-or-create`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name })
      });
      
      if (!response.ok) throw new Error('Failed to get or create model');
      return await response.json();
    } catch (error) {
      console.error('Failed to get or create model:', error);
      throw error;
    }
  }

  /**
   * Create new model explicitly
   */
  async createModel(name) {
    const headers = {
      'Content-Type': 'application/json',
    };

    const url = `${this.baseURL}/models`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name })
      });
      
      if (!response.ok) throw new Error('Failed to create model');
      return await response.json();
    } catch (error) {
      console.error('Failed to create model:', error);
      throw error;
    }
  }

  async getRecipients() {
    const headers = {
      'Content-Type': 'application/json',
    };

    const url = `${this.baseURL}/recipients`;
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error('Failed to fetch recipients');
      return await response.json();
    } catch (error) {
      console.warn('Recipients endpoint not available, returning empty array');
      return { data: [] };
    }
  }

  // ==================== HISTORY LOG METHODS ====================

  /**
   * Get history logs with pagination
   * @param {number} page - Page number (default: 1)
   * @param {number} limit - Records per page (default: 100)
   */
  async getHistoryLogs(page = 1, limit = 100) {
    try {
      const response = await this.makeRequest(`history-log?page=${page}&limit=${limit}`, {
        method: 'GET'
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch history logs:', error);
      throw error;
    }
  }

  /**
   * Create a history log entry (for testing purposes)
   */
  async createHistoryLog(logData) {
    try {
      const response = await this.makeRequest('history-log', {
        method: 'POST',
        body: JSON.stringify(logData)
      });
      return response;
    } catch (error) {
      console.error('Failed to create history log:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
const apiService = new ApiService();
export default apiService;