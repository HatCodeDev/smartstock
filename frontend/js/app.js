import '../css/style.css';
import appStore from './store/Store.js';
import wsService from './services/WsService.js';
import apiService from './services/ApiService.js';
import toastService from './services/ToastService.js';
import MainLayout from './components/MainLayout.js';
import { CONFIG } from './config.js';

/**
 * SmartStock App Entry Point
 */
async function init() {
  console.log('🚀 SmartStock Frontend Initialized');
  
  // Expose for testing
  window.appStore = appStore;
  
  // Check for existing session
  const token = localStorage.getItem(CONFIG.TOKEN_KEY);
  if (token) {
    try {
      let dashboardData = null;
      let cycleStatusData = null;
      let portalStatusData = null;
      let activityData = null;
      try {
        const [dashRes, cycleRes, portalRes, activityRes] = await Promise.all([
          apiService.get('/dashboard').catch(err => {
            if (err.message.includes('No hay ciclo') || err.message.includes('404')) return null;
            throw err;
          }),
          apiService.get('/cycle/status').catch(err => {
            console.warn('Could not fetch cycle status:', err);
            return null;
          }),
          apiService.get('/portal/status').catch(() => null),
          apiService.get('/dashboard/activity').catch(() => null)
        ]);
        dashboardData = dashRes;
        cycleStatusData = cycleRes;
        portalStatusData = portalRes;
        activityData = activityRes;
      } catch (err) {
        throw err;
      }
      
      const newState = { 
        isAuthenticated: true, 
        user: { username: 'admin', role: 'admin' }
      };

      if (cycleStatusData) {
        newState.ciclo_estado = cycleStatusData.estado;
        newState.ciclo_en_transito = cycleStatusData.en_transito;
        newState.ciclo_fecha = cycleStatusData.fecha;
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

      // Hidratar estado del portal desde /portal/status
      if (portalStatusData) {
        newState.portalStatus = portalStatusData.status || 'offline';
        // portalMode desde portal/status tiene prioridad sobre el del dashboard
        if (portalStatusData.modo_portal) {
          newState.portalMode = portalStatusData.modo_portal;
        }
      }

      // Hidratar actividad y alertas
      if (activityData && activityData.history) {
        newState.activityHistory = activityData.history;
        newState.alerts = activityData.alerts || [];
      }
      
      appStore.setState(newState);
      
      // Initialize WebSocket connection only if authenticated
      wsService.connect();
    } catch (error) {
      console.warn('⚠️ Session invalid or expired:', error.message);
      // apiService.handleUnauthorized() was called inside apiService.request
    }
  }

  // Register Service Worker for PWA
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && !isLocalhost) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('📦 PWA: Service Worker Registered', reg.scope))
        .catch(err => console.error('📦 PWA: Registration Failed', err));
    });
  }

  // Mount Main Layout
  const root = document.getElementById('app');
  if (root) {
    root.innerHTML = '';
    const layout = new MainLayout();
    layout.mount(root);
  }

  // Fallback sync: Ensure mobile UI catches up if WebSocket connected before the layout was fully attached
  setTimeout(() => {
    if (wsService.socket && wsService.socket.readyState === WebSocket.OPEN && !appStore.getState().isConnected) {
      console.log('🔄 Sincronizando estado del WebSocket (Fallback)');
      appStore.setState({ isConnected: true });
    }
  }, 500);

  // Reactive Toast Notifications for Alerts
  // Inicializar con la longitud actual para no disparar toasts de alertas pasadas (hidratadas)
  let lastAlertCount = appStore.getState().alerts.length;
  appStore.subscribe((state) => {
    if (state.alerts.length > lastAlertCount) {
      const newAlert = state.alerts[0]; // Assuming newest is at the top
      if (newAlert) {
        toastService.show(
          newAlert.message, 
          newAlert.type === 'TAG_DESCONOCIDA' ? 'warning' : 'danger'
        );
      }
      lastAlertCount = state.alerts.length;
    }
  });

  // Subscribe to store changes for debugging
  appStore.subscribe((state) => {
    console.log('🔔 State Updated:', state);
  });
}

document.addEventListener('DOMContentLoaded', init);
