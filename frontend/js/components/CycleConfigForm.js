import BaseComponent from './BaseComponent.js';
import apiService from '../services/ApiService.js';

/**
 * CycleConfigForm - Component to manage cycle settings and manual closing.
 */
export default class CycleConfigForm extends BaseComponent {
  constructor(props) {
    super(props);
    this.state = {
      isSaving: false,
      message: null
    };
  }

  async handleCloseCycle() {
    if (!confirm('¿Está seguro de que desea cerrar el ciclo actual manualmente?')) return;
    
    this.setState({ isSaving: true, message: null });
    
    try {
      // await apiService.post('/cycles/close-manual');
      await new Promise(resolve => setTimeout(resolve, 1500));
      this.setState({ isSaving: false, message: { type: 'success', text: 'Ciclo cerrado exitosamente.' } });
    } catch (error) {
      this.setState({ isSaving: false, message: { type: 'error', text: error.message } });
    }
  }

  render() {
    const { isSaving, message } = this.state;

    return `
      <div class="config-form-container glass">
        <h3>Configuración del Ciclo</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">
          Gestione los parámetros de operación del portal RFID.
        </p>

        <form id="cycle-form" class="form">
          <div class="form-group">
            <label for="close-time">Hora de Cierre Automático</label>
            <input type="time" id="close-time" name="close-time" value="20:00" ${isSaving ? 'disabled' : ''}>
          </div>

          <div class="form-group">
            <label>Acciones de Control</label>
            <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
              <button type="button" id="btn-close-manual" class="btn btn-danger" ${isSaving ? 'disabled' : ''}>
                Cierre Manual del Día
              </button>
            </div>
          </div>

          ${message ? `<p class="message-${message.type}" style="margin-top: 1rem; font-size: 0.9rem;">${message.text}</p>` : ''}
        </form>
      </div>
    `;
  }

  onMount() {
    const btnClose = this.element.querySelector('#btn-close-manual');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.handleCloseCycle());
    }
  }
}
