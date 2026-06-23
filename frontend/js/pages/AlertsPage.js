import BaseComponent from '../components/BaseComponent.js';
import InventoryTable from '../components/InventoryTable.js';
import AlertBadge from '../components/AlertBadge.js';
import appStore from '../store/Store.js';

/**
 * AlertsPage - View for auditing historical system alerts.
 */
export default class AlertsPage extends BaseComponent {
  constructor(props) {
    super(props);
    this.state = appStore.getState();
    
    this.table = new InventoryTable({
      items: [],
      columns: [
        { 
          key: 'timestamp', 
          label: 'Fecha/Hora', 
          render: (val) => new Date(val).toLocaleString() 
        },
        { 
          key: 'type', 
          label: 'Categoría', 
          render: (val) => `<span class="badge ${val === 'TAG_DESCONOCIDA' ? 'badge-warning' : 'badge-danger'}">${val}</span>`
        },
        { key: 'message', label: 'Descripción' },
        { 
          key: 'status', 
          label: 'Estado', 
          render: () => '<span class="badge badge-success">Auditado</span>' 
        }
      ]
    });

    this.unsubscribe = null;
  }

  onMount() {
    if (!this.unsubscribe) {
      this.unsubscribe = appStore.subscribe((newState) => {
        this.setState(newState);
      });
    }
  }

  render() {
    const { alerts } = this.state;

    return `
      <div class="alerts-page">
        <header style="margin-bottom: 2rem;">
          <h1 style="font-size: 1.5rem; font-weight: 700;">Historial de Alertas</h1>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Registro de incidencias detectadas por el sistema RFID.</p>
        </header>

        <div class="alerts-summary glass" style="display: flex; gap: 2rem; padding: 1.5rem; border-radius: 1rem; margin-bottom: 2rem;">
          <div>
            <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">Total Alertas (Día)</span>
            <span style="font-size: 1.5rem; font-weight: 700;">${alerts.length}</span>
          </div>
        </div>

        ${this.renderTable(alerts)}
      </div>
    `;
  }

  renderTable(alerts) {
    this.table.props.items = alerts;
    return this.table.render();
  }

  dispose() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
