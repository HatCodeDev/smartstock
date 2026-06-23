import BaseComponent from './BaseComponent.js';
import apiService from '../services/ApiService.js';
import appStore from '../store/Store.js';
import { CONFIG } from '../config.js';

/**
 * LoginPage - Redesigned premium login component.
 */
export default class LoginPage extends BaseComponent {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: false,
      error: null
    };
  }

  async handleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');

    this.setState({ isLoading: true, error: null });

    try {
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);

      const response = await apiService.post('/auth/login', params);
      
      localStorage.setItem(CONFIG.TOKEN_KEY, response.access_token);
      
      // Hydrate initial data before navigating to dashboard
      let dashboardData = null;
      let cycleStatusData = null;
      let portalStatusData = null;
      
      try {
        const [dashRes, cycleRes, portalRes] = await Promise.all([
          apiService.get('/dashboard').catch(() => null),
          apiService.get('/cycle/status').catch(() => null),
          apiService.get('/portal/status').catch(() => null)
        ]);
        dashboardData = dashRes;
        cycleStatusData = cycleRes;
        portalStatusData = portalRes;
      } catch (e) {
        console.warn('Could not hydrate data on login:', e);
      }

      const newState = { 
        isAuthenticated: true, 
        user: { username, role: 'admin' }
      };

      if (cycleStatusData) {
        newState.ciclo_estado = cycleStatusData.estado;
      }
      if (dashboardData) {
        newState.counters = {
          salidos: dashboardData.total_salidas || 0,
          retornados: dashboardData.total_retornos || 0,
          vendidos_estimado: dashboardData.articulos_en_transito || 0,
          en_bodega: dashboardData.total_en_bodega || 0,
          alertas: dashboardData.alertas_activas || 0
        };
        newState.portalMode = dashboardData.modo_portal || 'APAGADO';
      }
      if (portalStatusData) {
        newState.portalStatus = portalStatusData.status || 'offline';
        if (portalStatusData.modo_portal) newState.portalMode = portalStatusData.modo_portal;
      }
      
      appStore.setState(newState);
      
      window.location.hash = '#/';
    } catch (error) {
      this.setState({ error: error.message, isLoading: false });
    }
  }

  render() {
    const { isLoading, error } = this.state;

    return `
      <div class="auth-wrapper">
        <div class="login-card glass">
          <div class="login-logo">
            <h1 class="logo-text">
              SMART<span class="logo-accent">STOCK</span>
            </h1>
            <p style="color: var(--text-muted); font-size: 0.875rem; margin-top: -0.5rem;">
              Inventory Control System
            </p>
          </div>
          
          <form id="login-form" class="form">
            <div class="form-group">
              <label for="username">Usuario</label>
              <input 
                type="text" 
                id="username" 
                name="username" 
                class="login-input"
                required 
                placeholder="admin" 
                autocomplete="username"
                ${isLoading ? 'disabled' : ''}
              >
            </div>
            
            <div class="form-group" style="margin-top: 1rem;">
              <label for="password">Contraseña</label>
              <input 
                type="password" 
                id="password" 
                name="password" 
                class="login-input"
                required 
                placeholder="••••••••" 
                autocomplete="current-password"
                ${isLoading ? 'disabled' : ''}
              >
            </div>
            
            ${error ? `
              <div class="form-error" style="background: rgba(239, 68, 68, 0.1); padding: 0.75rem; border-radius: 0.5rem; margin-top: 1rem; border: 1px solid rgba(239, 68, 68, 0.2);">
                ${error}
              </div>
            ` : ''}
            
            <button type="submit" class="btn btn-primary btn-block btn-login" style="margin-top: 2rem;" ${isLoading ? 'disabled' : ''}>
              ${isLoading ? `
                <svg class="animate-spin" style="width: 20px; height: 20px; margin-right: 0.5rem;" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Iniciando...
              ` : 'Entrar al Sistema'}
            </button>
          </form>
          
          <div class="login-footer" style="margin-top: 3rem; text-align: center;">
            <p style="font-size: 0.75rem; color: var(--text-muted);">
              &copy; 2026 SmartStock IoT Solutions<br>
              Control de Inventario Textil en Tiempo Real
            </p>
          </div>
        </div>
      </div>
    `;
  }

  onMount() {
    // Reset state in case the instance is reused
    this.state.isLoading = false;
    this.state.error = null;

    const form = this.element.querySelector('#login-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
  }
}
