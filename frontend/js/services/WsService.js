import { CONFIG } from '../config.js';
import appStore from '../store/Store.js';

/**
 * WsService - Singleton for managing WebSocket connection with reconnection and heartbeat.
 */
class WsService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseDelay = 1000; // 1s
    this.heartbeatInterval = 30000; // 30s
    this.heartbeatTimer = null;
    this.isManuallyClosed = false;
    // Listen for auth changes to connect/disconnect
    appStore.subscribe((state, prevState) => {
      if (state.isAuthenticated && !prevState.isAuthenticated) {
        console.log('🔑 Auth detected, connecting WebSocket...');
        this.connect();
      } else if (!state.isAuthenticated && prevState.isAuthenticated) {
        console.log('🔒 Auth lost, closing WebSocket...');
        this.close();
      }
    });
  }

  /**
   * Initializes the connection.
   */
  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return; // Already connecting or connected
    }

    this.isManuallyClosed = false;
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    
    if (!token) {
      console.warn('⚠️ No token found, WebSocket connection deferred.');
      // Intentar reconexión automática en 5 segundos
      setTimeout(() => this.reconnect(), 5000);
      return;
    }

    const url = `${CONFIG.WS_BASE_URL}${token ? `?token=${token}` : ''}`;
    
    console.log(`🔌 Connecting to WebSocket: ${CONFIG.WS_BASE_URL}`);
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log('✅ WebSocket Connected');
      this.reconnectAttempts = 0;
      appStore.setState({ isConnected: true });
      this.startHeartbeat();
    };

    this.socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.socket.onclose = (event) => {
      appStore.setState({ isConnected: false });
      this.stopHeartbeat();
      
      if (!this.isManuallyClosed) {
        console.warn(`⚠️ WebSocket Closed (Code: ${event.code}). Attempting reconnection...`);
        this.reconnect();
      }
    };

    this.socket.onerror = (error) => {
      console.error('❌ WebSocket Error:', error);
    };
  }

  /**
   * Reconnection logic with exponential backoff.
   */
  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached.');
      return;
    }

    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    if (!token) {
      // Si no hay token, esperar y reintentar
      console.warn('⚠️ No token found, retrying in 5s...');
      setTimeout(() => this.reconnect(), 5000);
      return;
    }

    const delay = Math.min(this.baseDelay * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`🔄 Retrying in ${delay / 1000}s... (Attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(), delay);
  }

  /**
   * Handles incoming messages and updates the Store.
   */
  handleMessage(rawData) {
    try {
      const data = JSON.parse(rawData);
      console.log('📥 WS Message:', data);

      // Routing logic based on message type
      switch (data.type) {
        case 'COUNTER_UPDATE':
          // Actualizar contadores y log de actividad
          if (data.payload.counters) {
            const prevState = appStore.getState();
            
            // Construir el texto agrupado para la descripción
            let descriptionText = 'Movimiento detectado en portal principal';
            let titleText = `${data.payload.modo}: ${data.payload.eventos_creados} unidades`;
            
            if (data.payload.articulos_movidos && data.payload.articulos_movidos.length > 0) {
              const arts = data.payload.articulos_movidos;
              let parts = arts.slice(0, 2).map(a => `${a.cantidad}x ${a.nombre}`);
              let diff = arts.length - 2;
              
              if (diff > 0) {
                parts.push(`${diff} artículo${diff > 1 ? 's' : ''} más`);
              }
              descriptionText = parts.join(', ');
              
              if (data.payload.eventos_creados > 0) {
                 const isSalida = data.payload.modo === 'SALIDA';
                 titleText = `${isSalida ? 'Salida' : 'Retorno'} de ${data.payload.eventos_creados} artículo${data.payload.eventos_creados > 1 ? 's' : ''}`;
              }
            }

            if (data.payload.eventos_creados > 0) {
              const newEntry = {
                id: data.payload.batch_id || Date.now(),
                type: data.payload.modo === 'SALIDA' ? 'move-out' : 'move-in',
                title: titleText,
                timestamp: Date.now(),
                description: descriptionText
              };
              
              appStore.setState({ 
                counters: data.payload.counters,
                activityHistory: [newEntry, ...prevState.activityHistory].slice(0, 20)
              });
            } else {
              // Solo actualizar contadores, sin registro de actividad
              appStore.setState({ counters: data.payload.counters });
            }
          }
          break;
        case 'REGISTRATION_UPDATE':
          const currentSession = appStore.getState().registrationSession;
          if (currentSession) {
            // Unimos los nuevos resultados con los anteriores y deduplicamos
            const newTags = data.payload.registro_resultados || [];
            
            // Usamos Map para mantener la última actualización de cada EPC
            const map = new Map();
            // Primero las viejas (las más viejas al final)
            [...currentSession.registeredTags].reverse().forEach(t => map.set(t.epc, t));
            
            // Luego las nuevas (si ya estaba como 'new', no la degradamos a 'duplicate')
            newTags.reverse().forEach(t => {
               const existing = map.get(t.epc);
               if (existing && existing.status === 'new' && t.status === 'duplicate') {
                  // Mantener status 'new' para que no desaparezca del contador en la UI
                  map.set(t.epc, existing);
               } else {
                  map.set(t.epc, t);
               }
            });
            
            // Reconstruimos la lista preservando el orden más reciente primero
            const mergedTags = Array.from(map.values()).reverse().slice(0, 50);

            appStore.setState({ 
              registrationSession: {
                ...currentSession,
                registeredTags: mergedTags
              }
            });
          }
          break;
        case 'CYCLE_STARTED':
          appStore.setState({
            ciclo_estado: data.payload.estado,
            counters: { salidos: 0, retornados: 0, vendidos_estimado: 0, en_bodega: appStore.getState().counters.en_bodega || 0 },
            activityHistory: []
          });
          import('./ToastService.js').then(module => {
            module.default.show('Nuevo turno iniciado.', 'success');
          });
          break;
        case 'CYCLE_CLOSED':
          appStore.setState({
            ciclo_estado: 'CERRADO',
            ciclo_en_transito: 0,
            counters: {
              salidos: data.payload.salidos || data.payload.summary?.salidos || 0,
              retornados: data.payload.retornados || data.payload.summary?.retornados || 0,
              vendidos_estimado: 0,
              en_bodega: appStore.getState().counters.en_bodega
            },
            inventoryUpdated: Date.now() // Trigger fetchProducts on all Inventory pages
          });
          import('./ToastService.js').then(module => {
            module.default.show(
              `Corte realizado. ${data.payload.vendidos_final || data.payload.summary?.vendidos_final || 0} artículos descontados del stock.`,
              'success'
            );
          });
          break;
        case 'PORTAL_MODE_CHANGED':
          const prevMode = appStore.getState().portalMode;
          appStore.setState({ portalMode: data.payload });
          if (prevMode === 'REGISTRO' && data.payload !== 'REGISTRO') {
            appStore.setState({ inventoryUpdated: Date.now() });
          }
          break;
        case 'INVENTORY_UPDATED':
          appStore.setState({ inventoryUpdated: Date.now() });
          break;
        case 'PORTAL_STATUS':
          appStore.setState({ portalStatus: data.payload.status });
          break;
        case 'ALERT':
          const currentAlerts = appStore.getState().alerts;
          const currentActivity = appStore.getState().activityHistory;
          
          const normalizedAlert = {
            id: data.payload.id || Date.now(),
            type: data.payload.type,
            message: data.payload.message,
            timestamp: data.payload.timestamp || Date.now()
          };

          const alertEntry = {
            id: normalizedAlert.id,
            type: 'alert',
            title: normalizedAlert.type,
            timestamp: normalizedAlert.timestamp,
            description: normalizedAlert.message
          };

          appStore.setState({ 
            alerts: [normalizedAlert, ...currentAlerts].slice(0, 50),
            activityHistory: [alertEntry, ...currentActivity].slice(0, 20)
          });
          break;
        case 'BATCH_ERROR':
          console.error('❌ Error processing RFID Batch:', data.payload.error);
          break;
        case 'PONG':
          // Heartbeat acknowledged
          break;
        default:
          console.warn('❓ Unknown WS message type:', data.type);
      }
    } catch (error) {
      console.error('❌ Error parsing WS message:', error);
    }
  }

  /**
   * Sends data to the server.
   */
  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.error('❌ Cannot send message: WebSocket is not open.');
    }
  }

  /**
   * Closes the connection manually.
   */
  close() {
    this.isManuallyClosed = true;
    if (this.socket) {
      this.socket.close();
    }
  }

  /**
   * Heartbeat to keep connection alive.
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'PING' });
    }, this.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

const wsService = new WsService();
export default wsService;
