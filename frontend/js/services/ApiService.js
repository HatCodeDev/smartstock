import { CONFIG } from '../config.js';
import appStore from '../store/Store.js';

/**
 * ApiService - Wrapper for fetch with JWT handling and interceptors.
 */
class ApiService {
  /**
   * Performs a generic HTTP request.
   * @param {string} endpoint - API endpoint (relative to API_BASE_URL)
   * @param {Object} options - Fetch options
   */
  async request(endpoint, options = {}) {
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;
    
    // Interceptor: Add Authorization header
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    const isFormData = options.body instanceof URLSearchParams;
    
    const headers = {
      ...options.headers,
    };

    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
      body: (isFormData || !options.body) ? options.body : JSON.stringify(options.body)
    };

    try {
      const response = await fetch(url, config);

      // Interceptor: Handle 401 Unauthorized
      if (response.status === 401) {
        this.handleUnauthorized();
        throw new Error('Sesión expirada. Por favor, inicie sesión nuevamente.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error: ${response.status} ${response.statusText}`);
      }

      // Handle empty responses (like 204 No Content)
      if (response.status === 204) return null;

      return await response.json();
    } catch (error) {
      console.error(`❌ API Error [${url}]:`, error.message);
      throw error;
    }
  }

  /**
   * Helper for GET requests.
   */
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  /**
   * Helper for POST requests.
   */
  async post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body,
    });
  }

  /**
   * Helper for PUT requests.
   */
  async put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body,
    });
  }

  /**
   * Helper for DELETE requests.
   */
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  /**
   * Performs a manual logout.
   */
  logout() {
    this.handleUnauthorized();
  }

  /**
   * Handle 401 Unauthorized errors.
   */
  handleUnauthorized() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    appStore.setState({ 
      isAuthenticated: false, 
      user: null,
      isConnected: false 
    });
    // If not already at login, redirect or let MainLayout handle it
    if (window.location.hash !== '#/login') {
      window.location.hash = '#/'; // MainLayout will show Login if unauthenticated
    }
  }
}

const apiService = new ApiService();
export default apiService;
