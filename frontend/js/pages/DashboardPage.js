import BaseComponent from '../components/BaseComponent.js';
import StatCard from '../components/StatCard.js';
import AlertBadge from '../components/AlertBadge.js';
import appStore from '../store/Store.js';
import apiService from '../services/ApiService.js';
import toastService from '../services/ToastService.js';

/**
 * DashboardPage - Main monitoring view for real-time counters and alerts.
 */
export default class DashboardPage extends BaseComponent {
  constructor(props) {
    super(props);
    this.state = appStore.getState();

    // Icons (SVG)
    this.icons = {
      out: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>',
      in: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
      sale: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
      stock: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3m18 0v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8m18 0H3m4.5 4h9"/></svg>'
    };

    // Subscribe to Store will be handled in onMount
    this.unsubscribe = null;
    this.state.averageReport = null;
    this.hasFetchedAverages = false;
  }

  fetchAverages() {
    if (this.state.ciclo_estado === 'ABIERTO' && !this.hasFetchedAverages) {
      this.hasFetchedAverages = true;
      apiService.get('/reports/averages')
        .then(data => {
          this.state.averageReport = data;
          const el = document.querySelector('.dashboard-page');
          if (el) {
            this.setState(this.state);
          }
        })
        .catch(err => {
          this.hasFetchedAverages = false;
          console.error('Error fetching weekday averages:', err);
        });
    }
  }

  updateCountersUI(counters) {
    this.state.counters = counters;
    const elSalidos = this.element.querySelector('#stat-salidos');
    const elRetornados = this.element.querySelector('#stat-retornados');
    const elVentas = this.element.querySelector('#stat-ventas');
    const elBodega = this.element.querySelector('#stat-bodega');

    if (elSalidos) elSalidos.textContent = counters.salidos || 0;
    if (elRetornados) elRetornados.textContent = counters.retornados || 0;
    if (elVentas) elVentas.textContent = counters.vendidos_estimado || 0;
    if (elBodega) elBodega.textContent = counters.en_bodega || 0;
  }

  updateActivityHistoryUI(history) {
    this.state.activityHistory = history;
    const listEl = this.element.querySelector('.alerts-list');
    if (listEl) {
      if (history && history.length > 0) {
        listEl.innerHTML = history.map(item => this.renderActivityRow(item)).join('');
      } else {
        listEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; padding: 2rem; text-align: center;">Sin actividad reciente.</p>';
      }
    }
  }

  renderAverageBanner() {
    const report = this.state.averageReport;
    if (!report) return '';

    const { dia_semana, promedio_historico, ventas_hoy, diferencia_pct } = report;
    const isUp = diferencia_pct >= 0;
    const absPct = Math.abs(diferencia_pct);
    const colorClass = isUp ? 'var(--success)' : 'var(--danger)';
    const trendText = isUp ? 'arriba' : 'abajo';
    const arrow = isUp ? '↑' : '↓';

    return `
      <div class="average-banner glass" style="margin-bottom: 1.5rem; padding: 1.2rem; border-radius: 1rem; display: flex; align-items: center; justify-content: space-between; border-left: 4px solid ${colorClass};">
        <div style="display: flex; align-items: center; gap: 0.8rem;">
          <div style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: ${isUp ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${colorClass}; font-size: 1.2rem; font-weight: bold;">
            ${arrow}
          </div>
          <div style="text-align: left;">
            <p style="margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--text);">
              Rendimiento del Día: <span style="color: ${colorClass}; font-weight: 700;">${absPct}% ${trendText}</span> que un ${dia_semana} promedio.
            </p>
            <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted);">
              Hoy llevás ${ventas_hoy} unidades vs un promedio histórico de ${promedio_historico} unidades para este día.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  onMount() {
    if (!this.unsubscribe) {
      let lastActivity = appStore.getState().activityHistory;
      let lastCounters = appStore.getState().counters;
      let lastCiclo = appStore.getState().ciclo_estado;
      let lastMode = appStore.getState().portalMode;

      this.unsubscribe = appStore.subscribe((newState) => {
        // Only update if critical UI elements changed to avoid loops and flickers
        if (
          newState.activityHistory !== lastActivity ||
          newState.counters !== lastCounters ||
          newState.ciclo_estado !== lastCiclo ||
          newState.portalMode !== lastMode
        ) {
          const cycleJustOpened = newState.ciclo_estado === 'ABIERTO' && lastCiclo !== 'ABIERTO';

          if (newState.ciclo_estado !== lastCiclo || newState.portalMode !== lastMode) {
            // Full re-render on layout change
            lastActivity = newState.activityHistory;
            lastCounters = newState.counters;
            lastCiclo = newState.ciclo_estado;
            lastMode = newState.portalMode;

            if (cycleJustOpened) {
              this.hasFetchedAverages = false;
            }

            this.setState(newState);

            if (cycleJustOpened) {
              this.fetchAverages();
            }
          } else {
            // Fine-grained updates
            if (newState.counters !== lastCounters) {
              this.updateCountersUI(newState.counters);
              lastCounters = newState.counters;
            }
            if (newState.activityHistory !== lastActivity) {
              this.updateActivityHistoryUI(newState.activityHistory);
              lastActivity = newState.activityHistory;
            }
          }
        }
      });
    }

    // Bind methods
    this.handleCycleClose = this.handleCycleClose.bind(this);
    window.handleCycleClose = this.handleCycleClose; // Expose for inline onclick

    this.handleCycleStart = this.handleCycleStart.bind(this);
    window.handleCycleStart = this.handleCycleStart; // Expose for inline onclick

    // Timer para refrescar los tiempos relativos de la actividad de forma granular
    this.timeUpdateTimer = setInterval(() => {
      const timeElements = this.element.querySelectorAll('.activity-time');
      timeElements.forEach(el => {
        const ts = parseInt(el.getAttribute('data-timestamp'));
        if (ts) {
          const textEl = el.querySelector('span');
          if (textEl) {
            textEl.textContent = this.getRelativeTime(ts);
          }
        }
      });
    }, 60000); // Cada minuto

    if (this.state.ciclo_estado === 'ABIERTO' && !this.hasFetchedAverages) {
      this.fetchAverages();
    }
  }

  render() {
    const { counters, alerts } = this.state;

    return `
      <div class="dashboard-page">
        <header class="dashboard-header">
          <div class="dashboard-title-group">
            <h1>Resumen del Sistema</h1>
            <p>Monitoreo en tiempo real de entradas y salidas.</p>
          </div>
          <div class="dashboard-actions">
            ${this.state.ciclo_estado === 'ABIERTO' ? `
              <button class="btn btn-danger" onclick="window.handleCycleClose()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                <span>Realizar Corte del Día</span>
              </button>
            ` : ''}
            
            <button class="btn btn-secondary" onclick="window.location.hash='#/reportes'">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <span>Generar Reporte</span>
            </button>
          </div>
        </header>

        ${this.state.ciclo_estado !== 'ABIERTO' ? `
          <div class="empty-state-card glass">
            <div class="empty-state-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <h2>Sistema en Pausa (Turno Cerrado)</h2>
            <p>El inventario está protegido. El portal ignorará cualquier lectura hasta que inicies formalmente el turno.</p>
            <button class="btn btn-primary btn-lg" onclick="window.handleCycleStart()" style="display: inline-flex; align-items: center; gap: 0.5rem; justify-content: center;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              <span>Iniciar Nuevo Turno</span>
            </button>
          </div>
        ` : `
          ${this.renderAverageBanner()}
          <div class="stats-grid">
            ${this.renderStatCards(counters)}
          </div>

          <section class="activity-section glass">
            <div class="section-header">
              <h3>Actividad Reciente</h3>
              <a href="#/alertas">Ver todo</a>
            </div>
            <div class="alerts-list">
              ${this.state.activityHistory && this.state.activityHistory.length > 0
          ? this.state.activityHistory.map(item => this.renderActivityRow(item)).join('')
          : '<p style="color: var(--text-muted); font-size: 0.9rem; padding: 2rem; text-align: center;">Sin actividad reciente.</p>'
        }
            </div>
          </section>
        `}
      </div>
    `;
  }

  renderStatCards(counters) {
    // We can render them as strings directly for performance in the initial version
    const cards = [
      { id: 'stat-salidos', title: 'Salidos Hoy', value: counters.salidos || 0, icon: this.icons.out, color: 'primary' },
      { id: 'stat-retornados', title: 'Retornados', value: counters.retornados || 0, icon: this.icons.in, color: 'success' },
      { id: 'stat-ventas', title: 'Ventas Est.', value: counters.vendidos_estimado || 0, icon: this.icons.sale, color: 'warning' },
      { id: 'stat-bodega', title: 'En Bodega', value: counters.en_bodega || 0, icon: this.icons.stock, color: 'primary' }
    ];

    return cards.map(c => `
      <div class="stat-card glass">
        <div class="stat-header">
          <span class="stat-title">${c.title}</span>
          <div class="stat-icon-wrapper color-${c.color}">
            ${c.icon}
          </div>
        </div>
        <div class="stat-body">
          <h2 class="stat-value" id="${c.id}">${c.value}</h2>
          ${c.trend ? `<span class="stat-trend">${c.trend}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  renderActivityRow(item) {
    let iconSvg, bgColor, textColor, badgeClass, badgeLabel;

    if (item.type === 'alert') {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      bgColor = 'rgba(239, 68, 68, 0.15)'; // var(--danger) transparent
      textColor = '#ef4444';
      badgeClass = 'badge-danger';
      badgeLabel = 'ALERTA';
    } else if (item.type === 'move-out') {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>';
      bgColor = 'rgba(59, 130, 246, 0.15)'; // var(--primary) transparent
      textColor = '#3b82f6';
      badgeClass = 'badge-primary';
      badgeLabel = 'SALIDA';
    } else {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>';
      bgColor = 'rgba(16, 185, 129, 0.15)'; // var(--success) transparent
      textColor = '#10b981';
      badgeClass = 'badge-success';
      badgeLabel = 'RETORNO';
    }

    return `
      <div class="activity-row" style="display: flex; align-items: flex-start; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid var(--border);">
        <div style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px; background: ${bgColor}; color: ${textColor}; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          ${iconSvg}
        </div>
        <div style="flex: 1; padding-top: 2px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <p style="font-size: 0.95rem; font-weight: 600; margin: 0; color: var(--text);">${item.title}</p>
            <span class="badge ${badgeClass}" style="font-size: 0.65rem; padding: 3px 8px; border-radius: 6px; font-weight: 600; letter-spacing: 0.5px;">${badgeLabel}</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 6px 0; line-height: 1.4;">${item.description}</p>
          <span class="activity-time" data-timestamp="${item.timestamp}" style="font-size: 0.75rem; color: var(--text-muted); opacity: 0.7; display: flex; align-items: center; gap: 4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>${this.getRelativeTime(item.timestamp)}</span>
          </span>
        </div>
      </div>
    `;
  }

  getRelativeTime(timestamp) {
    if (!timestamp || typeof timestamp === 'string') return timestamp; // Fallback for old strings

    const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    const elapsedMs = timestamp - Date.now();
    const elapsedSec = Math.round(elapsedMs / 1000);
    const elapsedMin = Math.round(elapsedSec / 60);
    const elapsedHour = Math.round(elapsedMin / 60);

    if (Math.abs(elapsedSec) < 60) {
      return rtf.format(elapsedSec, 'second');
    } else if (Math.abs(elapsedMin) < 60) {
      return rtf.format(elapsedMin, 'minute');
    } else if (Math.abs(elapsedHour) < 24) {
      return rtf.format(elapsedHour, 'hour');
    } else {
      const elapsedDay = Math.round(elapsedHour / 24);
      return rtf.format(elapsedDay, 'day');
    }
  }

  handleCycleStart() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'glass';
    modal.style.cssText = 'padding: 2rem; max-width: 400px; width: 90%; border-radius: 1rem; text-align: center; animation: slideDownFade 0.3s ease-out;';
    
    modal.innerHTML = `
      <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(59, 130, 246, 0.1); color: var(--primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      </div>
      <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">¿Iniciar Nuevo Turno?</h3>
      <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1.5rem;">
        Esto habilitará las lecturas del portal y pondrá los contadores a cero. Asegúrate de que el personal esté listo.
      </p>
      <div style="display: flex; gap: 1rem;">
        <button id="btn-cancel-start" class="btn btn-secondary" style="flex: 1;">Cancelar</button>
        <button id="btn-confirm-start" class="btn btn-primary" style="flex: 1;">Sí, Iniciar Turno</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const closeModal = () => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    };
    
    document.getElementById('btn-cancel-start').addEventListener('click', closeModal);
    
    document.getElementById('btn-confirm-start').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.innerHTML = 'Iniciando...';
      btn.disabled = true;
      document.getElementById('btn-cancel-start').disabled = true;
      
      try {
        await apiService.post('/cycle/start');
        
        const [dashData, portalStatus] = await Promise.all([
          apiService.get('/dashboard').catch(() => null),
          apiService.get('/portal/status').catch(() => null)
        ]);

        const mappedCounters = dashData ? {
          salidos: dashData.total_salidas || 0,
          retornados: dashData.total_retornos || 0,
          vendidos_estimado: dashData.articulos_en_transito || 0,
          en_bodega: dashData.total_en_bodega || 0,
          alertas: dashData.alertas_activas || 0
        } : { salidos: 0, retornados: 0, vendidos_estimado: 0, articulos_en_transito: 0, en_bodega: 0 };

        appStore.setState({
          ciclo_estado: 'ABIERTO',
          counters: mappedCounters,
          activityHistory: [],
          portalMode: portalStatus?.modo_portal || 'APAGADO',
          portalStatus: portalStatus?.status || 'offline'
        });

        toastService.show('Turno iniciado exitosamente', 'success');
        closeModal();
      } catch (error) {
        btn.innerHTML = 'Sí, Iniciar Turno';
        btn.disabled = false;
        document.getElementById('btn-cancel-start').disabled = false;
        toastService.show(error.message || 'Error al iniciar turno', 'danger');
      }
    });
  }

  handleCycleClose() {
    const { counters } = this.state;
    const enTransito = counters.vendidos_estimado || counters.articulos_en_transito || 0;

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);';

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'glass';
    modal.style.cssText = 'background: var(--surface); padding: 2rem; border-radius: 1rem; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);';

    modal.innerHTML = `
      <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(239, 68, 68, 0.1); color: var(--danger); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text);">Confirmar Corte de Día</h3>
      <p style="font-size: 0.95rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 1.5rem;">
        Tenés <strong style="color: var(--danger);">${enTransito}</strong> artículos fuera del local. Al hacer el corte, estos artículos se considerarán vendidos y se descontarán definitivamente del stock físico.
      </p>
      <div style="display: flex; gap: 1rem;">
        <button id="btn-cancel-close" class="btn btn-secondary" style="flex: 1;">Cancelar</button>
        <button id="btn-confirm-close" class="btn btn-danger" style="flex: 1; background: var(--danger);">Sí, Cortar Día</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Bind events
    const closeModal = () => {
      document.body.removeChild(overlay);
    };

    document.getElementById('btn-cancel-close').addEventListener('click', closeModal);

    document.getElementById('btn-confirm-close').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.innerHTML = 'Cortando...';
      btn.disabled = true;
      document.getElementById('btn-cancel-close').disabled = true;

      try {
        await apiService.post('/cycle/close');
        // El store se actualizará por el evento WebSocket 'CYCLE_CLOSED'
        closeModal();
      } catch (error) {
        btn.innerHTML = 'Sí, Cortar Día';
        btn.disabled = false;
        document.getElementById('btn-cancel-close').disabled = false;
        toastService.show(error.message || 'Error al cerrar el ciclo', 'danger');
      }
    });
  }

  dispose() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.timeUpdateTimer) {
      clearInterval(this.timeUpdateTimer);
      this.timeUpdateTimer = null;
    }
    delete window.handleCycleClose;
  }
}
