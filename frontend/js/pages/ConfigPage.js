import BaseComponent from '../components/BaseComponent.js';
import apiService from '../services/ApiService.js';
import toastService from '../services/ToastService.js';

export default class ConfigPage extends BaseComponent {
  constructor(props) {
    super(props);
    this.state = {
      config: null,
      loading: true
    };
  }

  async onMount() {
    if (this.state.loading) {
      try {
        const config = await apiService.get('/config');
        this.setState({ config, loading: false });
      } catch (error) {
        toastService.show('Error al cargar configuración', 'danger');
        this.setState({ loading: false });
      }
      return;
    }

    // Bind events
    const toggleCierre = this.element.querySelector('#toggle-cierre');
    const inputHora = this.element.querySelector('#input-hora');

    if (toggleCierre) {
      toggleCierre.addEventListener('change', (e) => {
        this.updateConfig('cierre_auto_habilitado', e.target.checked);
      });
    }

    if (inputHora) {
      inputHora.addEventListener('change', (e) => {
        if (e.target.value) {
          this.updateConfig('hora_cierre_auto', e.target.value);
        }
      });
    }
  }

  async updateConfig(key, value) {
    try {
      const payload = { [key]: value };
      const updated = await apiService.put('/config', payload);
      this.setState({ config: updated });
      toastService.show('Configuración guardada', 'success');
    } catch (error) {
      toastService.show('Error al guardar', 'danger');
      // Recargar para restaurar valor
      const config = await apiService.get('/config');
      this.setState({ config });
    }
  }

  render() {
    if (this.state.loading) {
      return `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Cargando...</div>`;
    }

    if (!this.state.config) {
      return `<div style="padding: 2rem; text-align: center; color: var(--danger);">No se pudo cargar la configuración.</div>`;
    }

    const { hora_cierre_auto, cierre_auto_habilitado } = this.state.config;

    return `
      <div class="config-page" style="max-width: 800px; margin: 0 auto; animation: slideDownFade 0.4s ease-out forwards;">
        <header style="margin-bottom: 2rem;">
          <h1 style="font-size: 1.8rem; font-weight: 700; margin-bottom: 0.25rem;">Configuración</h1>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Ajustes del sistema y automatizaciones.</p>
        </header>

        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- Cierre Automático -->
          <div class="glass" style="padding: 1.5rem; border-radius: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
              <div>
                <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  Cierre Automático
                </h3>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">
                  Si te olvidás de hacer el corte manual, el sistema lo hará por vos a esta hora y descontará el stock automáticamente.
                </p>
              </div>
              <label style="position: relative; display: inline-block; width: 50px; height: 28px; flex-shrink: 0;">
                <input type="checkbox" id="toggle-cierre" ${cierre_auto_habilitado ? 'checked' : ''} style="opacity: 0; width: 0; height: 0; position: absolute;">
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${cierre_auto_habilitado ? 'var(--primary)' : 'var(--border)'}; transition: .4s; border-radius: 34px;">
                  <span style="position: absolute; content: ''; height: 20px; width: 20px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; transform: ${cierre_auto_habilitado ? 'translateX(22px)' : 'translateX(0)'};"></span>
                </span>
              </label>
            </div>
            
            <div style="display: flex; align-items: center; gap: 1rem; opacity: ${cierre_auto_habilitado ? '1' : '0.5'}; pointer-events: ${cierre_auto_habilitado ? 'auto' : 'none'}; transition: 0.3s;">
              <label for="input-hora" style="font-size: 0.95rem; font-weight: 500;">Hora de ejecución:</label>
              <input type="time" id="input-hora" value="${hora_cierre_auto}" style="background: var(--background); border: 1px solid var(--border); color: var(--text); padding: 0.5rem 1rem; border-radius: 0.5rem; font-family: inherit; font-size: 1rem; outline: none; cursor: pointer;">
            </div>
          </div>

          <!-- El panel de Alertas de Tiempo Excedido fue removido por requerimiento de negocio. -->

        </div>
      </div>
    `;
  }
}
