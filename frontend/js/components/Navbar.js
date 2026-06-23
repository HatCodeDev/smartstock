import BaseComponent from './BaseComponent.js';
import appStore from '../store/Store.js';
import apiService from '../services/ApiService.js';

/**
 * Navbar - Top bar component with status indicators.
 */
export default class Navbar extends BaseComponent {
  constructor(props) {
    super(props);
    this.unsubscribe = null;
  }

  render() {
    const { isConnected, portalMode, portalStatus } = appStore.getState();

    // Determine badge class for portal mode
    let modeClass = 'badge-primary';
    if (portalMode === 'RETORNO') modeClass = 'badge-success';
    if (portalMode === 'REGISTRO') modeClass = 'badge-warning';
    if (portalMode === 'APAGADO') modeClass = 'badge-muted';

    const isRegistrationMode = portalMode === 'REGISTRO';

    const isPortalOnline = portalStatus === 'online';
    const modeLabel = portalMode || 'APAGADO';

    return `
      <nav class="navbar">
        <div class="navbar-left">
          <button class="sidebar-toggle" id="toggle-sidebar" aria-label="Toggle Sidebar" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0.5rem;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div class="custom-select-container hide-on-mobile" id="nav-mode-dropdown">
            <div class="badge ${modeClass} mode-select custom-select-trigger" ${isRegistrationMode ? 'data-disabled="true"' : ''}>
              <span>Modo: ${modeLabel.charAt(0) + modeLabel.slice(1).toLowerCase()}</span>
            </div>
            <div class="custom-select-options">
              <div class="custom-select-option ${portalMode === 'SALIDA' ? 'selected' : ''}" data-value="SALIDA">
                Salida
                ${portalMode === 'SALIDA' ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
              </div>
              <div class="custom-select-option ${portalMode === 'RETORNO' ? 'selected' : ''}" data-value="RETORNO">
                Retorno
                ${portalMode === 'RETORNO' ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
              </div>
              <div class="custom-select-option ${portalMode === 'APAGADO' ? 'selected' : ''}" data-value="APAGADO">
                Apagado
                ${portalMode === 'APAGADO' ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
              </div>
              ${isRegistrationMode ? `
                <div class="custom-select-option selected" data-value="REGISTRO" data-disabled="true">
                  Registro
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
        
        <div class="navbar-right" style="display: flex; align-items: center; gap: 1rem;">
          <div id="connection-indicator" class="hide-on-mobile" style="display: flex; align-items: center; gap: 1rem; font-size: 0.8rem;">
            <div style="display: flex; align-items: center; gap: 0.25rem;">
              
            </div>
            <div style="display: flex; align-items: center; gap: 0.25rem;">
              <span class="dot ${isPortalOnline ? 'dot-online' : 'dot-offline'}"></span>
              <span class="hide-on-mobile" style="color: ${isPortalOnline ? 'var(--success)' : 'var(--warning)'};">
                ${isPortalOnline ? 'Portal Activo' : 'Portal Inactivo'}
              </span>
            </div>
          </div>
          
          <div class="user-profile" style="display: flex; align-items: center; gap: 0.5rem;">
            <div style="width: 32px; height: 32px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.8rem;">
              A
            </div>
            <div class="hide-on-mobile" style="display: flex; flex-direction: column;">
              <span style="font-size: 0.8rem; font-weight: 500;">Admin</span>
            </div>
          </div>
        </div>
      </nav>
    `;
  }

  onMount() {
    // Subscribe to Store updates
    if (!this.unsubscribe) {
      this.unsubscribe = appStore.subscribe((state, prevState) => {
        // Only update if relevant status changed to avoid unnecessary re-renders
        if (state.isConnected !== prevState.isConnected ||
          state.portalMode !== prevState.portalMode ||
          state.portalStatus !== prevState.portalStatus) {
          this.update();
        }
      });
    }

    const toggleBtn = this.element.querySelector('#toggle-sidebar');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const layout = document.querySelector('.layout-container');
        if (layout) {
          if (window.innerWidth <= 768) {
            layout.classList.toggle('sidebar-open');
          } else {
            layout.classList.toggle('sidebar-collapsed');
          }
        }
      });
    }

    const modeDropdown = this.element.querySelector('#nav-mode-dropdown');
    if (modeDropdown) {
      const trigger = modeDropdown.querySelector('.custom-select-trigger');
      const options = modeDropdown.querySelectorAll('.custom-select-option');

      // Toggle dropdown
      if (trigger && trigger.getAttribute('data-disabled') !== 'true') {
        this.triggerHandler = (e) => {
          e.stopPropagation();
          modeDropdown.classList.toggle('open');
        };
        trigger.addEventListener('click', this.triggerHandler);
      }

      // Handle option selection
      options.forEach(option => {
        option.addEventListener('click', async () => {
          if (option.getAttribute('data-disabled') === 'true') return;

          const newMode = option.dataset.value;
          modeDropdown.classList.remove('open');

          try {
            await apiService.post('/portal/mode', {
              mode: newMode,
              device_id: 'smartstock-portal-01'
            });
            console.log(`🚀 (Desktop) Modo cambiado a ${newMode}`);
          } catch (error) {
            console.error('❌ Error al cambiar modo:', error);
            this.update();
          }
        });
      });

      // Close on outside click
      this.outsideClickHandler = (e) => {
        if (!modeDropdown.contains(e.target)) {
          modeDropdown.classList.remove('open');
        }
      };
      document.addEventListener('click', this.outsideClickHandler);
    }
  }

  update() {
    if (!this.element) return;

    const state = appStore.getState();
    const isPortalOnline = state.portalStatus === 'online';
    const isRegistrationMode = state.portalMode === 'REGISTRO';

    // Update WS Dot and Text
    const wsDot = this.element.querySelector('#connection-indicator > div:nth-child(1) .dot');
    const wsText = this.element.querySelector('#connection-indicator > div:nth-child(1) span:nth-child(2)');
    if (wsDot && wsText) {
      wsDot.className = `dot ${state.isConnected ? 'dot-online' : 'dot-offline'}`;
      wsText.style.color = state.isConnected ? 'var(--success)' : 'var(--danger)';
      wsText.textContent = state.isConnected ? 'WebSocket' : 'Sin WS';
    }

    // Update Portal Dot and Text
    const portalDot = this.element.querySelector('#connection-indicator > div:nth-child(2) .dot');
    const portalText = this.element.querySelector('#connection-indicator > div:nth-child(2) span:nth-child(2)');
    if (portalDot && portalText) {
      portalDot.className = `dot ${isPortalOnline ? 'dot-online' : 'dot-offline'}`;
      portalText.style.color = isPortalOnline ? 'var(--success)' : 'var(--warning)';
      portalText.textContent = isPortalOnline ? 'Portal Activo' : 'Portal Inactivo';
    }

    // Update Mode Dropdown
    const modeDropdown = this.element.querySelector('#nav-mode-dropdown');
    if (modeDropdown) {
      const trigger = modeDropdown.querySelector('.custom-select-trigger');
      if (trigger) {
        let modeClass = 'badge-primary';
        if (state.portalMode === 'RETORNO') modeClass = 'badge-success';
        if (state.portalMode === 'REGISTRO') modeClass = 'badge-warning';
        if (state.portalMode === 'APAGADO') modeClass = 'badge-muted';

        trigger.className = `badge ${modeClass} mode-select custom-select-trigger`;
        if (isRegistrationMode) {
          trigger.setAttribute('data-disabled', 'true');
        } else {
          trigger.removeAttribute('data-disabled');
        }

        const modeLabel = state.portalMode || 'APAGADO';
        const span = trigger.querySelector('span');
        if (span) span.textContent = `Modo: ${modeLabel.charAt(0) + modeLabel.slice(1).toLowerCase()}`;
      }

      // Update options
      const options = modeDropdown.querySelectorAll('.custom-select-option');
      options.forEach(opt => {
        const val = opt.getAttribute('data-value');
        if (val === state.portalMode) {
          opt.classList.add('selected');
          if (!opt.querySelector('svg')) {
            opt.innerHTML += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
          }
        } else {
          opt.classList.remove('selected');
          const svg = opt.querySelector('svg');
          if (svg) svg.remove();
        }
      });
    }
  }

  dispose() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler);
    }
  }
}
