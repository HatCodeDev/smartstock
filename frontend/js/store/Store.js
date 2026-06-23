/**
 * Observable Store - A simple Pub/Sub state manager.
 */
class Store {
  constructor(initialState = {}) {
    this.state = initialState;
    this.subscribers = [];
  }

  /**
   * Returns the current state.
   */
  getState() {
    return this.state;
  }

  /**
   * Updates the state and notifies all subscribers.
   * @param {Object} newState 
   */
  setState(newState) {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...newState };
    this.notify(prevState);
  }

  /**
   * Subscribes a callback to state changes.
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  /**
   * Notifies all subscribers of a state change.
   */
  notify(prevState) {
    this.subscribers.forEach(callback => callback(this.state, prevState));
  }
}

// Initial state for SmartStock
const initialState = {
  portalMode: 'APAGADO', // SALIDA, RETORNO, REGISTRO, APAGADO
  portalStatus: 'offline', // online, offline
  ciclo_estado: 'SIN_CICLO', // 'SIN_CICLO' | 'ABIERTO' | 'CERRADO'
  ciclo_en_transito: 0,
  ciclo_fecha: null,
  counters: {
    salidos: 0,
    retornados: 0,
    vendidos_estimado: 0,
    en_bodega: 0
  },
  alerts: [],
  activityHistory: [], // Unified log of movements and alerts
  registrationSession: null, // { productId, productName, registeredTags: [] }
  isConnected: false,
  isAuthenticated: false,
  user: null
};

export { Store };
const appStore = new Store(initialState);
export default appStore;
