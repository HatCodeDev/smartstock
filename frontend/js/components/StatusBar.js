import BaseComponent from './BaseComponent.js';
import appStore from '../store/Store.js';
import apiService from '../services/ApiService.js';

/**
 * StatusBar - Mobile-only status bar that appears above the header.
 */
export default class StatusBar extends BaseComponent {
  constructor(props) {
    super(props);
    this.unsubscribe = null;
  }

  render() {
    const { isConnected, portalMode, portalStatus, isAuthenticated, ciclo_estado } = appStore.getState();

    // Only render if authenticated
    if (!isAuthenticated) return '';

    const isPortalOnline = portalStatus === 'online';

    // Determine mode style
    let modeLabel = portalMode || 'APAGADO';
    let modeClass = 'mode-salida';
    if (portalMode === 'RETORNO') modeClass = 'mode-retorno';
    if (portalMode === 'REGISTRO') modeClass = 'mode-registro';
    if (portalMode === 'APAGADO') modeClass = 'mode-apagado';

    const isRegistrationMode = portalMode === 'REGISTRO';
    const isCycleClosed = ciclo_estado !== 'ABIERTO';

    // Si el ciclo está cerrado, forzamos la apariencia y estado a APAGADO (bloqueado)
    if (isCycleClosed) {
      modeClass = 'mode-apagado';
    }

    return `
      <div class="status-bar-mobile">
        <div class="status-bar-left">
          <select class="status-badge ${modeClass} mode-select" id="mobile-mode-selector" ${(isRegistrationMode || isCycleClosed) ? 'disabled' : ''} style="font-size: 0.65rem;">
            ${isCycleClosed ? '<option value="APAGADO" selected>APAGADO (Turno Cerrado)</option>' : `
              <option value="SALIDA" ${portalMode === 'SALIDA' ? 'selected' : ''}>SALIDA</option>
              <option value="RETORNO" ${portalMode === 'RETORNO' ? 'selected' : ''}>RETORNO</option>
              <option value="APAGADO" ${portalMode === 'APAGADO' ? 'selected' : ''}>APAGADO</option>
              ${isRegistrationMode ? '<option value="REGISTRO" selected disabled>REGISTRO</option>' : ''}
            `}
          </select>
        </div>
        <div class="status-bar-right">
          <div class="status-indicator">
            
          </div>
          <div class="status-indicator">
            <span class="dot ${isPortalOnline ? 'dot-online' : 'dot-offline'}"></span>
            <span class="status-text">Portal</span>
          </div>
        </div>
      </div>
    `;
  }

  onMount() {
    if (!this.unsubscribe) {
      this.unsubscribe = appStore.subscribe((state, prevState) => {
        if (state.isConnected !== prevState.isConnected ||
          state.portalMode !== prevState.portalMode ||
          state.portalStatus !== prevState.portalStatus ||
          state.isAuthenticated !== prevState.isAuthenticated ||
          state.ciclo_estado !== prevState.ciclo_estado) {
          this.update();
        }
      });
    }

    const modeSelector = this.element.querySelector('#mobile-mode-selector');
    if (modeSelector) {
      modeSelector.addEventListener('change', async (e) => {
        const newMode = e.target.value;
        try {
          await apiService.post('/portal/mode', {
            mode: newMode,
            device_id: 'smartstock-portal-01'
          });
          console.log(`🚀 (Mobile) Modo cambiado a ${newMode}`);
        } catch (error) {
          console.error('❌ Error al cambiar modo:', error);
          this.update();
        }
      });
    }
  }

  update() {
    if (!this.element) return;

    const state = appStore.getState();
    const isPortalOnline = state.portalStatus === 'online';
    const isRegistrationMode = state.portalMode === 'REGISTRO';
    const isCycleClosed = state.ciclo_estado !== 'ABIERTO';

    // Update WS Dot
    const wsDot = this.element.querySelector('.status-bar-right .status-indicator:nth-child(1) .dot');
    if (wsDot) {
      wsDot.className = `dot ${state.isConnected ? 'dot-online' : 'dot-offline'}`;
    }

    // Update Portal Dot
    const portalDot = this.element.querySelector('.status-bar-right .status-indicator:nth-child(2) .dot');
    if (portalDot) {
      portalDot.className = `dot ${isPortalOnline ? 'dot-online' : 'dot-offline'}`;
    }

    // Update Select Mode
    const modeSelector = this.element.querySelector('#mobile-mode-selector');
    if (modeSelector) {
      modeSelector.disabled = isRegistrationMode || isCycleClosed;

      let modeClass = 'mode-salida';
      if (state.portalMode === 'RETORNO') modeClass = 'mode-retorno';
      if (state.portalMode === 'REGISTRO') modeClass = 'mode-registro';
      if (state.portalMode === 'APAGADO' || isCycleClosed) modeClass = 'mode-apagado';

      modeSelector.className = `status-badge ${modeClass} mode-select`;

      if (isCycleClosed) {
        modeSelector.innerHTML = '<option value="APAGADO" selected>APAGADO (Turno Cerrado)</option>';
      } else {
        modeSelector.innerHTML = `
          <option value="SALIDA" ${state.portalMode === 'SALIDA' ? 'selected' : ''}>SALIDA</option>
          <option value="RETORNO" ${state.portalMode === 'RETORNO' ? 'selected' : ''}>RETORNO</option>
          <option value="APAGADO" ${state.portalMode === 'APAGADO' ? 'selected' : ''}>APAGADO</option>
          ${isRegistrationMode ? '<option value="REGISTRO" selected disabled>REGISTRO</option>' : ''}
        `;
      }
    }
  }

  dispose() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
