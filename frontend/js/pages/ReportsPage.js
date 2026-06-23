import BaseComponent from '../components/BaseComponent.js';
import apiService from '../services/ApiService.js';
import { CONFIG } from '../config.js';

function truncateText(text, max = 20) {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

/**
 * parseUTCDate - Ensures an ISO timestamp string is parsed as UTC.
 * The backend stores datetimes as naive UTC (no tzinfo), so FastAPI serializes
 * them WITHOUT a trailing 'Z'. Without 'Z', JS treats the string as local time
 * in some runtimes, displaying UTC values directly. Appending 'Z' forces correct
 * UTC interpretation, and toLocaleTimeString then converts to the browser locale.
 */
function parseUTCDate(isoStr) {
  if (!isoStr) return null;
  // Already has timezone info (+HH:MM or Z) — use as-is
  if (/[Z+\-]\d*$/.test(String(isoStr).trim())) return new Date(isoStr);
  // Naive string — treat as UTC
  return new Date(String(isoStr).trim() + 'Z');
}

/**
 * ReportsPage - Premium business analytics page structure for SmartStock.
 * Fully visualizes FP-Growth association rules, Holt-Winters demand projections, and K-Means RFV clustering.
 */
export default class ReportsPage extends BaseComponent {
  constructor(props) {
    super(props);
    this.state = {
      activeTab: 'supply', // 'supply' | 'health' | 'turnos'
      criticalProducts: [],
      trends: [],
      fpGrowthReport: null,
      holtWintersReport: null,
      kmeansReport: null,
      shiftsReport: null,
      selectedMonth: (() => {
        const localDate = new Date();
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
      })(), // "YYYY-MM"
      selectedDayShifts: null,
      selectedDayDate: null,
      isLoading: false,
      error: null,
      isMobile: window.innerWidth <= 768,
      selectedCategory: 'all'
    };

    this.handleResize = this.handleResize.bind(this);
  }

  fetchReportData() {
    this.setState({ isLoading: true, error: null });

    Promise.all([
      apiService.get('/products/critical').catch(err => {
        console.error('Error fetching critical products:', err);
        return [];
      }),
      apiService.get('/reports/trends').catch(err => {
        console.error('Error fetching trends:', err);
        return [];
      }),
      apiService.get('/reports/advanced?tipo=HOLT_WINTERS').catch(err => {
        console.error('Error fetching HOLT_WINTERS report:', err);
        return null;
      }),
      apiService.get('/reports/advanced?tipo=K_MEANS').catch(err => {
        console.error('Error fetching K_MEANS report:', err);
        return null;
      }),
      apiService.get('/reports/products/return-rates').catch(err => {
        console.error('Error fetching return rates:', err);
        return [];
      }),
      apiService.get('/reports/categories/transit-lead-times').catch(err => {
        console.error('Error fetching transit times:', err);
        return [];
      })
    ]).then(([criticalProducts, trends, holtWintersReport, kmeansReport, returnRates, transitTimes]) => {
      this.setState({
        criticalProducts,
        trends,
        fpGrowthReport: null,
        holtWintersReport,
        kmeansReport,
        returnRates,
        transitTimes,
        isLoading: false
      });
    }).catch(err => {
      this.setState({
        isLoading: false,
        error: err.message || 'Error al cargar los datos del reporte'
      });
    });
  }

  fetchShiftsData(month) {
    const targetMonth = month || this.state.selectedMonth;
    this.setState({ isLoading: true, error: null });

    apiService.get(`/reports/shifts?month=${targetMonth}`)
      .then(shiftsReport => {
        this.setState({
          shiftsReport,
          selectedDayShifts: null,
          selectedDayDate: null,
          isLoading: false
        });
      })
      .catch(err => {
        this.setState({
          isLoading: false,
          error: err.message || 'Error al cargar el análisis de turnos'
        });
      });
  }

  handleResize() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile !== this.state.isMobile) {
      this.setState({ isMobile });
    }
  }

  onMount() {
    // Add event listeners to the tabs
    const tabBtns = this.element.querySelectorAll('.reports-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const selectedTab = btn.getAttribute('data-tab');
        if (selectedTab && selectedTab !== this.state.activeTab) {
          this.setState({ activeTab: selectedTab });
          if (selectedTab === 'turnos' && this.state.shiftsReport === null) {
            this.fetchShiftsData();
          }
        }
      });
    });

    // Add event listener to the month picker if present
    const monthPicker = this.element.querySelector('#shifts-month-picker');
    if (monthPicker) {
      monthPicker.addEventListener('change', (e) => {
        this.setState({ selectedMonth: e.target.value });
        this.fetchShiftsData(e.target.value);
      });
    }

    // Add cell click listeners
    const cells = this.element.querySelectorAll('.heatmap-cell:not(.cell-none)');
    cells.forEach(cell => {
      cell.addEventListener('click', () => {
        const dateStr = cell.getAttribute('data-date');
        const dayShifts = (this.state.shiftsReport || []).filter(s => s.fecha === dateStr);
        
        // Remove active class from all cells and add to clicked
        this.element.querySelectorAll('.heatmap-cell').forEach(c => c.classList.remove('active-cell'));
        cell.classList.add('active-cell');

        this.setState({
          selectedDayDate: dateStr,
          selectedDayShifts: dayShifts
        });
      });
    });

    // Add event listener to the export button
    const exportBtn = this.element.querySelector('#export-report-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          // Cambiar estado visual del botón
          exportBtn.disabled = true;
          exportBtn.innerHTML = `
            <div class="loading-spinner" style="border: 2px solid rgba(255, 255, 255, 0.1); border-top: 2px solid var(--text); border-radius: 50%; width: 14px; height: 14px; animation: spin 1s linear infinite; display: inline-block; vertical-align: middle;"></div>
            <span>Generando PDF...</span>
          `;

          const token = localStorage.getItem(CONFIG.TOKEN_KEY);
          const headers = {};
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const url = `${CONFIG.API_BASE_URL}/reports/download/pdf`;
          const response = await fetch(url, {
            method: 'GET',
            headers
          });

          if (!response.ok) {
            throw new Error('No se pudo generar el reporte PDF.');
          }

          const blob = await response.blob();
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = 'Reporte_Analitico_SmartStock.pdf';
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
          console.error(err);
          alert('Error al descargar el reporte analítico: ' + err.message);
        } finally {
          exportBtn.disabled = false;
          exportBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Exportar PDF/CSV</span>
          `;
        }
      });
    }

    // Only fetch on first load if we haven't loaded yet
    if (this.state.activeTab !== 'turnos' && !this.state.holtWintersReport && !this.state.kmeansReport && !this.state.isLoading) {
      this.fetchReportData();
    } else if (this.state.activeTab === 'turnos' && this.state.shiftsReport === null && !this.state.isLoading) {
      this.fetchShiftsData();
    }

    // Resize Listener
    window.addEventListener('resize', this.handleResize);

    // Accordion card collapse/expand handler
    this.element.addEventListener('click', (e) => {
      const header = e.target.closest('.accordion-header');
      if (header) {
        const card = header.closest('.accordion-card');
        if (card) {
          const wasExpanded = card.classList.contains('expanded');
          card.classList.toggle('expanded');
          const arrow = card.querySelector('.accordion-arrow');
          if (arrow) {
            arrow.style.transform = wasExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
          }
        }
      }
    });

    // Product details truncation click listener
    this.element.addEventListener('click', (e) => {
      const truncatedSpan = e.target.closest('.product-name-truncated');
      if (truncatedSpan) {
        const fullName = truncatedSpan.getAttribute('data-full-text');
        const detailModal = this.element.querySelector('#product-detail-modal');
        const detailModalBody = this.element.querySelector('#product-detail-modal-body');
        if (detailModal && detailModalBody) {
          detailModalBody.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <div>
                <span style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; display: block; margin-bottom: 0.25rem;">Nombre Completo:</span>
                <strong style="font-size: 1.2rem; color: var(--text);">${fullName}</strong>
              </div>
            </div>
          `;
          detailModal.style.display = 'flex';
        }
      }
    });

    // Close product details modal
    const closeBtn = this.element.querySelector('#close-product-detail-modal');
    const okBtn = this.element.querySelector('#btn-close-product-detail-modal-ok');
    const detailModal = this.element.querySelector('#product-detail-modal');
    const closeDetailFn = () => {
      if (detailModal) detailModal.style.display = 'none';
    };
    if (closeBtn) closeBtn.addEventListener('click', closeDetailFn);
    if (okBtn) okBtn.addEventListener('click', closeDetailFn);
    if (detailModal) {
      detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal) {
          closeDetailFn();
        }
      });
    }

  }

  dispose() {
    window.removeEventListener('resize', this.handleResize);
  }

  render() {
    const { activeTab, isLoading, error } = this.state;
    const criticalCount = this.state.criticalProducts ? this.state.criticalProducts.length : 0;

    const trendsList = this.state.trends || [];
    let avgTrend = 0;
    if (trendsList.length > 0) {
      avgTrend = trendsList.reduce((acc, t) => acc + t.cambio_pct, 0) / trendsList.length;
      avgTrend = Math.round(avgTrend * 10) / 10;
    }
    const isUpTrend = avgTrend >= 0;
    const trendSign = isUpTrend ? '+' : '';
    const trendColor = isUpTrend ? 'var(--success)' : 'var(--danger)';
    const trendIconClass = isUpTrend ? 'color-success' : 'color-danger';

    return `
      <div class="reports-page" style="animation: fadeIn 0.4s ease-out;">
        <!-- Encabezado de la página -->
        <header class="reports-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h1 style="font-size: 1.875rem; font-weight: 800; letter-spacing: -0.02em; color: var(--text);">Reportes del Negocio</h1>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 0.25rem;">Análisis predictivo e insights de alto valor de forma móvil-friendly.</p>
          </div>
          <button class="btn btn-secondary" id="export-report-btn" style="display: flex; align-items: center; gap: 0.5rem; background: var(--surface); border: 1px solid var(--border); padding: 0.75rem 1.25rem; border-radius: 0.875rem; cursor: pointer; color: var(--text); font-weight: 600; transition: all 0.2s ease;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Exportar PDF/CSV</span>
          </button>
        </header>

        <!-- Fila de Umbrales Críticos / Análisis en Tiempo Real -->
        <div class="reports-critical-row stats-grid" style="margin-bottom: 2rem;">
          <div class="stat-card" style="display: flex; flex-direction: column; justify-content: space-between; background: var(--surface); border: 1px solid var(--border); padding: 1.5rem; border-radius: 1.25rem;">
            <div class="stat-header" style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
              <span class="stat-title" style="color: var(--text-muted); font-size: 0.875rem; font-weight: 600;">Productos en Riesgo de Agotarse</span>
              <div class="stat-icon-wrapper ${criticalCount === 0 ? 'color-success' : 'color-danger'}" style="background: ${criticalCount === 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; padding: 0.5rem; border-radius: 0.75rem; color: ${criticalCount === 0 ? 'var(--success)' : 'var(--danger)'}; display: flex; align-items: center; justify-content: center;">
                ${criticalCount === 0 ? `
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                    <path d="m9 12 2 2 4-4"></path>
                  </svg>
                ` : `
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                `}
              </div>
            </div>
            <div style="margin-top: 1rem;">
              <div class="stat-value" style="color: ${criticalCount === 0 ? 'var(--success)' : 'var(--danger)'}; font-size: 2.25rem; font-weight: 800; line-height: 1.1;">${criticalCount} SKU${criticalCount !== 1 ? 's' : ''}</div>
              <span class="stat-trend" style="color: var(--text-muted); font-weight: normal; margin-top: 0.5rem; font-size: 0.85rem; display: block;">
                ${criticalCount === 0 ? 'Sin riesgos detectados' : 'Requieren reabastecimiento inmediato'}
              </span>
            </div>
          </div>

          <div class="stat-card" style="display: flex; flex-direction: column; justify-content: space-between; background: var(--surface); border: 1px solid var(--border); padding: 1.5rem; border-radius: 1.25rem;">
            <div class="stat-header" style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
              <span class="stat-title" style="color: var(--text-muted); font-size: 0.875rem; font-weight: 600;">Tendencia de Ventas (7d)</span>
              <div class="stat-icon-wrapper ${trendIconClass}" style="background: ${isUpTrend ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; padding: 0.5rem; border-radius: 0.75rem; color: ${trendColor}; display: flex; align-items: center; justify-content: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  ${isUpTrend ? `
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                    <polyline points="17 6 23 6 23 12"></polyline>
                  ` : `
                    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
                    <polyline points="17 18 23 18 23 12"></polyline>
                  `}
                </svg>
              </div>
            </div>
            <div style="margin-top: 1rem;">
              <div class="stat-value" style="color: ${trendColor}; font-size: 2.25rem; font-weight: 800; line-height: 1.1;">${trendSign}${avgTrend}%</div>
              <span class="stat-trend" style="color: var(--text-muted); font-weight: normal; margin-top: 0.5rem; font-size: 0.85rem; display: flex; align-items: center; gap: 0.25rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: ${trendColor};">
                  ${isUpTrend ? '<polyline points="18 15 12 9 6 15"></polyline>' : '<polyline points="6 9 12 15 18 9"></polyline>'}
                </svg>
                Respecto a la semana anterior
              </span>
            </div>
          </div>
        </div>

        <div class="reports-tabs-container" style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border); margin-bottom: 2rem; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none;">
          <button class="reports-tab-btn ${activeTab === 'supply' ? 'active' : ''}" data-tab="supply" style="white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; background: none; border: none; padding: 0.75rem 1.25rem; color: var(--text-muted); font-weight: 600; cursor: pointer; transition: all 0.2s ease; border-bottom: 2px solid transparent;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
            <span>Planificación de Compras</span>
          </button>
          <button class="reports-tab-btn ${activeTab === 'health' ? 'active' : ''}" data-tab="health" style="white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; background: none; border: none; padding: 0.75rem 1.25rem; color: var(--text-muted); font-weight: 600; cursor: pointer; transition: all 0.2s ease; border-bottom: 2px solid transparent;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
              <line x1="6" y1="6" x2="6.01" y2="6"></line>
              <line x1="6" y1="18" x2="6.01" y2="18"></line>
            </svg>
            <span>Salud de Inventario</span>
          </button>
          <button class="reports-tab-btn ${activeTab === 'turnos' ? 'active' : ''}" data-tab="turnos" style="white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; background: none; border: none; padding: 0.75rem 1.25rem; color: var(--text-muted); font-weight: 600; cursor: pointer; transition: all 0.2s ease; border-bottom: 2px solid transparent;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>Auditoría de Turnos</span>
          </button>
        </div>

        <!-- Contenedor Principal (Panel de Contenido) -->
        <div class="reports-tab-content glass" style="padding: 2rem; border-radius: 1.25rem; border: 1px solid var(--border); background: rgba(26, 26, 36, 0.6); backdrop-filter: blur(20px); min-height: 350px; display: flex; flex-direction: column;">
          ${isLoading ? `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex-grow: 1; min-height: 250px; width: 100%;">
              <div class="loading-spinner" style="border: 3px solid rgba(108, 92, 231, 0.1); border-top: 3px solid var(--primary); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 1rem;"></div>
              <span style="color: var(--text-muted); font-weight: 600; font-size: 0.95rem;">Analizando base de datos SmartStock...</span>
            </div>
          ` : error ? `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex-grow: 1; text-align: center; padding: 2rem;">
              <div style="background: rgba(239, 68, 68, 0.1); color: var(--danger); border-radius: 50%; padding: 1rem; margin-bottom: 1rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--text);">Error al cargar análisis</h3>
              <p style="color: var(--text-muted); max-width: 400px; font-size: 0.9rem; margin-bottom: 1.5rem;">${error}</p>
              <button class="btn btn-primary" onclick="window.location.reload();" style="background: var(--primary); border: none; padding: 0.75rem 1.5rem; border-radius: 0.75rem; color: var(--text); font-weight: 600; cursor: pointer;">Reintentar</button>
            </div>
          ` : this.renderTabContent(activeTab)}
        </div>



        <!-- Modal de detalle de producto truncado -->
        <div class="modal-overlay" id="product-detail-modal" style="display: none;">
          <div class="modal-content glass" style="max-width: 400px; width: 90%;">
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; margin-bottom: 1rem;">
              <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text); margin: 0;">Detalle del Producto</h2>
              <button class="btn btn-secondary glass" id="close-product-detail-modal" style="padding: 0.25rem 0.5rem; font-size: 1.25rem; line-height: 1; border: none; background: none; color: var(--text-muted); cursor: pointer;">&times;</button>
            </div>
            <div class="modal-body" id="product-detail-modal-body" style="color: var(--text); font-size: 1rem; line-height: 1.5; padding: 0.5rem 0;">
              <!-- Se llenará dinámicamente -->
            </div>
            <div class="modal-footer" style="margin-top: 1.5rem; display: flex; justify-content: flex-end;">
              <button class="btn btn-primary" id="btn-close-product-detail-modal-ok">Aceptar</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderTabContent(tab) {

    if (tab === 'supply') {
      const report = this.state.holtWintersReport;
      const fechas = report && report.datos && report.datos.fechas ? report.datos.fechas : [];
      const pronosticoTotal = report && report.datos && report.datos.pronostico_total ? report.datos.pronostico_total : [];
      const porCategoria = report && report.datos && report.datos.por_categoria ? report.datos.por_categoria : {};
      const insightHW = report && report.datos ? report.datos.mensaje_inteligente : 'Analizando historial de demanda diaria...';

      // 1. Encontrar ventas máximas proyectadas para escalar la gráfica CSS de forma proporcional
      const maxVal = pronosticoTotal.length > 0 ? Math.max(...pronosticoTotal) : 100;

      // 2. Construir la barra gráfica interactiva 7d
      const barGraphHtml = pronosticoTotal.map((val, idx) => {
        const fechaStr = fechas[idx] || '';
        // Formatear fecha para el tianguis (ej: "Sábado 24")
        let diaNombre = '';
        let diaNumero = '';
        if (fechaStr) {
          const dateObj = new Date(fechaStr + 'T00:00:00');
          diaNombre = dateObj.toLocaleDateString('es-ES', { weekday: 'short' });
          diaNumero = dateObj.getDate();
        }
        
        const pctHeight = Math.max(12, Math.round((val / maxVal) * 100));

        return `
          <div style="display: flex; flex-direction: column; align-items: center; flex: 1; height: 100%; justify-content: flex-end; position: relative;" class="bar-container">
            <!-- Valor en hover -->
            <div style="background: var(--text); border: 1px solid var(--border); padding: 0.25rem 0.5rem; border-radius: 0.5rem; font-size: 0.75rem; font-weight: 800; color: var(--surface); margin-bottom: 0.5rem; pointer-events: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" class="bar-value">
              ${val}
            </div>
            <!-- Columna -->
            <div style="height: ${pctHeight}%; width: 60%; max-width: 32px; background: linear-gradient(180deg, var(--primary) 0%, rgba(108, 92, 231, 0.4) 100%); border-radius: 0.5rem 0.5rem 0 0; transition: all 0.2s ease; cursor: pointer; box-shadow: 0 4px 12px rgba(108, 92, 231, 0.2);" class="bar-column"></div>
            <!-- Etiqueta de Día -->
            <div style="margin-top: 0.75rem; text-align: center; display: flex; flex-direction: column; gap: 0.15rem;">
              <span style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">${diaNombre}</span>
              <span style="font-size: 0.85rem; color: var(--text); font-weight: 800;">${diaNumero}</span>
            </div>
          </div>
        `;
      }).join('');

      // 3. Obtener el volumen acumulado por categoría para la lista de abastecimiento
      const totalCategoriasDemand = [];
      for (const cat in porCategoria) {
        const sumVal = porCategoria[cat].reduce((acc, v) => acc + v, 0);
        totalCategoriasDemand.push({ cat, sumVal });
      }
      totalCategoriasDemand.sort((a, b) => b.sumVal - a.sumVal);
      const maxCatDemand = totalCategoriasDemand.length > 0 ? Math.max(...totalCategoriasDemand.map(c => c.sumVal)) : 100;

      // Filter totalCategoriasDemand by selectedCategory
      const filteredCategoryDemand = this.state.selectedCategory && this.state.selectedCategory !== 'all'
        ? totalCategoriasDemand.filter(c => c.cat === this.state.selectedCategory)
        : totalCategoriasDemand;

      const categoryRowsHtml = filteredCategoryDemand.map(c => {
        const pctWidth = Math.max(10, Math.round((c.sumVal / maxCatDemand) * 100));

        return `
          <div style="display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem 0;">
            <div style="display: flex; justify-content: space-between; font-size: 0.875rem; font-weight: 600;">
              <span style="color: var(--text);">${c.cat}</span>
              <span style="color: var(--primary); font-weight: 700;">${c.sumVal} unidades estimadas</span>
            </div>
            <!-- Barra de Progreso Lineal -->
            <div style="background: rgba(255, 255, 255, 0.05); height: 6px; border-radius: 3px; width: 100%; overflow: hidden;">
              <div style="background: linear-gradient(90deg, var(--primary) 0%, var(--success) 100%); height: 100%; border-radius: 3px; width: ${pctWidth}%; transition: width 0.3s ease;"></div>
            </div>
          </div>
        `;
      }).join('');

      // Category rows for mobile (Accordion Cards)
      const categoryCardsHtml = filteredCategoryDemand.map((c, idx) => {
        const pctWidth = Math.max(10, Math.round((c.sumVal / maxCatDemand) * 100));
        
        let priorityBadgeHtml = '<span class="badge badge-success">Bajo</span>';
        if (c.sumVal > 15) {
          priorityBadgeHtml = '<span class="badge badge-warning">Medio</span>';
        }
        if (c.sumVal > 30) {
          priorityBadgeHtml = '<span class="badge badge-primary">Alto</span>';
        }

        return `
          <div class="accordion-card" data-index="supply-cat-${idx}">
            <div class="accordion-header">
              <div style="display: flex; flex-direction: column; gap: 0.15rem; text-align: left;">
                <strong style="color: var(--text); font-size: 0.95rem;">${c.cat}</strong>
                <span style="font-size: 0.75rem; color: var(--text-muted);">Estimado: ${c.sumVal} unidades</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                ${priorityBadgeHtml}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="accordion-arrow" style="transition: transform 0.2s;"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
            <div class="accordion-details">
              <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.85rem; color: var(--text-muted); text-align: left;">
                <div style="display: flex; justify-content: space-between;">
                  <span>Volumen Sugerido:</span>
                  <strong style="color: var(--text);">${c.sumVal} unidades</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>Nivel de Prioridad:</span>
                  <strong style="color: var(--text);">${c.sumVal > 30 ? 'ALTO REORDEN' : c.sumVal > 15 ? 'MEDIO REORDEN' : 'MANTENER STOCK'}</strong>
                </div>
                <div style="margin-top: 0.25rem;">
                  <span style="display: block; margin-bottom: 0.35rem;">Porcentaje de Demanda Total:</span>
                  <div style="background: rgba(255, 255, 255, 0.05); height: 6px; border-radius: 3px; width: 100%; overflow: hidden;">
                    <div style="background: linear-gradient(90deg, var(--primary) 0%, var(--success) 100%); height: 100%; border-radius: 3px; width: ${pctWidth}%; transition: width 0.3s ease;"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="tab-pane-container" style="animation: fadeIn 0.3s ease-out; display: flex; flex-direction: column; gap: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
            <div style="background: rgba(34, 197, 94, 0.1); padding: 0.75rem; border-radius: 1rem; color: var(--success); display: flex; align-items: center; justify-content: center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                <polyline points="17 6 23 6 23 12"></polyline>
              </svg>
            </div>
            <div>
              <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">Planificación de Compras (Abastecimiento)</h2>
              <p style="color: var(--text-muted); font-size: 0.875rem;">Modelado predictivo de demanda semanal mediante el algoritmo Holt-Winters (Triple Suavizado Exponencial).</p>
            </div>
          </div>

          <!-- Mensaje Inteligente / Insight de Demanda -->
          <div class="alert-box glass" style="border-left: 4px solid var(--warning); padding: 1.25rem; border-radius: 0.875rem; background: rgba(245, 158, 11, 0.03);">
            <div style="display: flex; gap: 0.85rem; align-items: flex-start;">
              <div style="color: var(--warning); display: flex; align-items: center; justify-content: center; margin-top: 0.15rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <div>
                <strong style="color: var(--text); display: block; margin-bottom: 0.25rem; font-size: 0.95rem;">Planificación Predictiva de Stock</strong>
                <span style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.45;">
                  ${insightHW}
                </span>
              </div>
            </div>
          </div>

          <!-- Layout Gráfico -->
          ${fechas.length > 0 ? `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; flex-wrap: wrap; align-items: stretch; margin-top: 0.5rem;" class="supply-grid">
              
              <!-- Tarjeta de Gráfica CSS de Ventas Totales Proyectadas -->
              <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid var(--border); padding: 1.5rem; border-radius: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">
                <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  Proyección Diaria (Próximos 7 Días)
                </h3>
                
                <!-- Bar chart: desktop only -->
                <div class="desktop-only chart-scroll-container">
                  <div style="height: 180px; display: flex; align-items: flex-end; gap: 0.75rem; border-bottom: 2px solid var(--text-muted); padding-bottom: 0.25rem; margin-top: 1rem; padding-top: 1.5rem; min-width: 480px;" class="graph-area">
                    ${barGraphHtml}
                  </div>
                </div>

                <!-- Day-list: mobile only (no overflow) -->
                <div class="mobile-only projection-day-list">
                  ${pronosticoTotal.map((val, idx) => {
                    const fechaStr = fechas[idx] || '';
                    let diaNombre = '';
                    let diaNumero = '';
                    if (fechaStr) {
                      const dateObj = new Date(fechaStr + 'T00:00:00');
                      diaNombre = dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
                      diaNombre = diaNombre.charAt(0).toUpperCase() + diaNombre.slice(1);
                      diaNumero = dateObj.getDate();
                    }
                    const pctWidth = Math.max(10, Math.round((val / maxVal) * 100));
                    const isMax = val === maxVal;
                    return `
                      <div class="projection-day-row">
                        <div class="projection-day-label">
                          <span class="projection-day-name">${diaNombre}</span>
                          <span class="projection-day-num">${diaNumero}</span>
                        </div>
                        <div class="projection-day-bar-wrap">
                          <div class="projection-day-bar" style="width: ${pctWidth}%; background: ${isMax ? 'linear-gradient(90deg, var(--primary), hsl(var(--primary-h, 262), 80%, 65%))' : 'linear-gradient(90deg, rgba(108,92,231,0.7), rgba(108,92,231,0.3))'};"></div>
                        </div>
                        <span class="projection-day-val${isMax ? ' projection-day-val--peak' : ''}">${val}</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- Listado de Abastecimiento por Categoría -->
              <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid var(--border); padding: 1.5rem; border-radius: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text); margin-bottom: 0.25rem;">
                  Lista de Compras Sugerida (Reorden)
                </h3>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem; line-height: 1.4;">
                  *<strong>Reorden:</strong> Cantidad recomendada que deberías comprar a tus proveedores para no quedarte sin inventario esta semana.
                </p>
                
                <!-- Desktop View: List -->
                <div class="desktop-only" style="display: flex; flex-direction: column; gap: 0.25rem; overflow-y: auto; max-height: 250px;">
                  ${categoryRowsHtml}
                </div>

                <!-- Mobile View: Accordion Cards -->
                <div class="mobile-only" style="display: flex; flex-direction: column; gap: 0.5rem; overflow-y: auto; max-height: 250px;">
                  ${categoryCardsHtml}
                </div>
              </div>
            </div>
          ` : `
            <div style="text-align: center; padding: 3rem 1.5rem; background: rgba(0, 0, 0, 0.15); border-radius: 1rem; border: 1px dashed var(--border);">
              <p style="color: var(--text-muted); font-size: 0.9rem;">
                No hay historial de ventas en ciclos cerrados para alimentar el pronóstico Holt-Winters. Complete ciclos diarios para inicializar.
              </p>
            </div>
          `}
        </div>
      `;
    }

    if (tab === 'health') {
      const report = this.state.kmeansReport;
      const clusters = report && report.datos && report.datos.clusters ? report.datos.clusters : [];
      const insightKM = report && report.datos ? report.datos.mensaje_inteligente : 'Procesando matriz RFV...';
      const totalAnalizados = report && report.datos ? report.datos.total_productos_analizados : 0;

      // Filter Return Rates and Transit Lead Times by selectedCategory if any
      const filteredReturnRates = this.state.returnRates
        ? this.state.returnRates.filter(r => !this.state.selectedCategory || this.state.selectedCategory === 'all' || r.categoria === this.state.selectedCategory)
        : [];

      const filteredTransitTimes = this.state.transitTimes
        ? this.state.transitTimes.filter(t => !this.state.selectedCategory || this.state.selectedCategory === 'all' || t.categoria === this.state.selectedCategory)
        : [];

      // Widget 1: Tasa de Retorno (Return Rate)
      const returnRatesTableHtml = `
        <div class="desktop-only" style="overflow-x: auto; width: 100%;">
          <table class="report-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border); color: var(--text-muted); font-weight: 600;">
                <th style="padding: 0.5rem;">Prenda</th>
                <th style="padding: 0.5rem; text-align: right;">SKU</th>
                <th style="padding: 0.5rem; text-align: right;">Tasa</th>
                <th style="padding: 0.5rem; text-align: right;">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${filteredReturnRates.length > 0 ? filteredReturnRates.map(r => {
                const rate = r.return_rate;
                const umbral = r.umbral_retorno_critico || 80.0;
                const isCritical = rate > umbral;
                let barColor = 'var(--success)';
                if (rate > umbral) barColor = 'var(--danger)';
                else if (rate >= umbral * 0.5) barColor = 'var(--warning)';
                return `
                  <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 0.5rem; font-weight: 600;">${r.nombre}</td>
                    <td style="padding: 0.5rem; text-align: right; color: var(--text-muted);">${r.sku || 'N/A'}</td>
                    <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: ${barColor};">${rate}%</td>
                    <td style="padding: 0.5rem; text-align: right;">
                      ${isCritical ? `<span class="badge badge-danger" style="font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 800;">CRÍTICO</span>` : `<span class="badge badge-success" style="font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 800;">ÓPTIMO</span>`}
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted); opacity: 0.5;">No hay tasas de retorno.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      `;

      const returnRatesCardsHtml = `
        <div class="mobile-only" style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${filteredReturnRates.length > 0 ? filteredReturnRates.map(r => {
            const rate = r.return_rate;
            const umbral = r.umbral_retorno_critico || 80.0;
            const isCritical = rate > umbral;
            let barColor = 'var(--success)';
            if (rate > umbral) barColor = 'var(--danger)';
            else if (rate >= umbral * 0.5) barColor = 'var(--warning)';
            return `
              <div class="accordion-card" style="margin-bottom: 0.5rem; border: 1px solid var(--border); padding: 0.85rem; border-radius: 0.75rem; background: rgba(255, 255, 255, 0.01);">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                  <div style="display: flex; flex-direction: column; gap: 0.15rem; text-align: left;">
                    <strong style="color: var(--text); font-size: 0.85rem;">${r.nombre}</strong>
                    <span style="font-size: 0.7rem; color: var(--text-muted);">SKU: ${r.sku || 'N/A'}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <strong style="color: ${barColor}; font-size: 0.85rem;">${rate}%</strong>
                    ${isCritical ? `<span class="badge badge-danger" style="font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 800;">CRÍTICO</span>` : `<span class="badge badge-success" style="font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 800;">ÓPTIMO</span>`}
                  </div>
                </div>
              </div>
            `;
          }).join('') : `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted); opacity: 0.5;">No hay tasas de retorno.</div>
          `}
        </div>
      `;

      // Widget 2: Tiempo de Tránsito (Transit Lead Time)
      const transitTimesTableHtml = `
        <div class="desktop-only" style="overflow-x: auto; width: 100%;">
          <table class="report-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border); color: var(--text-muted); font-weight: 600;">
                <th style="padding: 0.5rem;">Categoría</th>
                <th style="padding: 0.5rem; text-align: right;">Tránsitos</th>
                <th style="padding: 0.5rem; text-align: right;">Tiempo Promedio</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTransitTimes.length > 0 ? filteredTransitTimes.map(t => {
                const hours = t.transit_lead_time_hours;
                const isHigh = hours > 48;
                let leadTimeText = '';
                if (hours >= 24) {
                  const days = (hours / 24).toFixed(1);
                  leadTimeText = `${days} día${days !== '1.0' ? 's' : ''} (${hours} hrs)`;
                } else {
                  leadTimeText = `${hours} horas`;
                }
                return `
                  <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 0.5rem; font-weight: 600;">${t.categoria}</td>
                    <td style="padding: 0.5rem; text-align: right; color: var(--text-muted);">${t.total_transitos_medidos} salidas</td>
                    <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: ${isHigh ? 'var(--warning)' : 'var(--primary)'};">${leadTimeText}</td>
                  </tr>
                `;
              }).join('') : `
                <tr><td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-muted); opacity: 0.5;">No hay tránsitos.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      `;

      const transitTimesCardsHtml = `
        <div class="mobile-only" style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${filteredTransitTimes.length > 0 ? filteredTransitTimes.map(t => {
            const hours = t.transit_lead_time_hours;
            const isHigh = hours > 48;
            let leadTimeText = '';
            if (hours >= 24) {
              const days = (hours / 24).toFixed(1);
              leadTimeText = `${days} día${days !== '1.0' ? 's' : ''} (${hours} hrs)`;
            } else {
              leadTimeText = `${hours} horas`;
            }
            return `
              <div class="transit-card" style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); padding: 0.85rem; border-radius: 0.75rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <div style="display: flex; flex-direction: column; gap: 0.15rem; text-align: left;">
                  <strong style="color: var(--text); font-size: 0.85rem;">${t.categoria}</strong>
                  <span style="font-size: 0.7rem; color: var(--text-muted);">${t.total_transitos_medidos} salidas</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem;">
                  <span style="font-size: 0.85rem; font-weight: 800; color: ${isHigh ? 'var(--warning)' : 'var(--primary)'};">${leadTimeText}</span>
                  ${isHigh ? `<span style="color: var(--warning); font-size: 0.65rem; font-weight: 700;">TRÁNSITO ALTO</span>` : `<span style="color: var(--success); font-size: 0.65rem; font-weight: 700;">FLUIDEZ ÓPTIMA</span>`}
                </div>
              </div>
            `;
          }).join('') : `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted); opacity: 0.5;">No hay tránsitos.</div>
          `}
        </div>
      `;

      // Generar columnas de los tres clusters
      const clustersColumnsHtml = clusters.map(c => {
        // Estilos e íconos premium según el tipo de cluster (determinista por el backend)
        let headerColor = 'var(--text)';
        let badgeBg = 'rgba(255, 255, 255, 0.05)';
        let badgeColor = 'var(--text-muted)';
        let borderGlow = '1px solid var(--border)';
        
        if (c.nombre === 'Alta Rotación') {
          headerColor = 'var(--success)';
          badgeBg = 'rgba(34, 197, 94, 0.1)';
          badgeColor = 'var(--success)';
          borderGlow = '1px solid rgba(34, 197, 94, 0.3)';
        } else if (c.nombre === 'Rotación Media') {
          headerColor = 'var(--primary)';
          badgeBg = 'rgba(108, 92, 231, 0.1)';
          badgeColor = 'var(--primary)';
          borderGlow = '1px solid rgba(108, 92, 231, 0.3)';
        } else if (c.nombre === 'Stock Inactivo') {
          headerColor = 'var(--danger)';
          badgeBg = 'rgba(239, 68, 68, 0.1)';
          badgeColor = 'var(--danger)';
          borderGlow = '1px solid rgba(239, 68, 68, 0.3)';
        }

        const itemsHtml = c.productos.map(p => {
          // Evaluar si tiene stock crítico (RN)
          const isCritical = p.stock < 3; // O cualquier regla dinámica
          const stockColor = isCritical ? 'var(--danger)' : 'var(--text-muted)';
          const stockWeight = isCritical ? '800' : 'normal';

          const shortName = truncateText(p.nombre, 20);
          const nameHtml = p.nombre.length > 20
            ? `<span class="product-name-truncated" data-full-text="${p.nombre.replace(/"/g, '&quot;')}" style="cursor: pointer; text-decoration: underline; color: var(--primary); font-weight: 600;" title="Click para ver nombre completo">${shortName}</span>`
            : `<span style="font-weight: 600; color: var(--text);">${p.nombre}</span>`;

          return `
            <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid var(--border); padding: 0.85rem; border-radius: 0.75rem; display: flex; flex-direction: column; gap: 0.25rem;">
              <div style="display: flex; justify-content: space-between; gap: 0.5rem; align-items: flex-start;">
                <span style="font-size: 0.85rem; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px;">
                  ${nameHtml}
                </span>
                <span style="font-size: 0.85rem; font-weight: 700; color: ${headerColor};">
                  ${p.ventas} uds
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-muted);">
                <span>SKU: ${p.sku || 'N/A'}</span>
                <span style="color: ${stockColor}; font-weight: ${stockWeight};">
                  Stock: ${p.stock}
                </span>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div style="background: rgba(255, 255, 255, 0.01); border-radius: 1.25rem; border: ${borderGlow}; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; flex: 1; min-width: 260px;" class="cluster-col">
            <!-- Cabecera del Clúster -->
            <header style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
              <div>
                <h3 style="font-size: 1.05rem; font-weight: 800; color: ${headerColor};">${c.nombre}</h3>
                <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 0.15rem;" title="Unidades vendidas promedio por producto en este segmento a lo largo del historial del negocio">
                  Ventas Promedio: <strong>${c.metrica_promedio_ventas} uds. (Histórico)</strong>
                </span>
              </div>
              <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 0.35rem 0.65rem; border-radius: 0.5rem; font-size: 0.75rem; font-weight: 800;">
                ${c.productos.length} SKUs
              </span>
            </header>
            
            <!-- Descripción -->
            <p style="color: var(--text-muted); font-size: 0.8rem; line-height: 1.45;">
              ${c.descripcion} <br><small style="display: block; margin-top: 0.5rem; opacity: 0.85; font-style: italic;">* Las ventas promedio indican el total acumulado de unidades vendidas por SKU en este clúster a lo largo del historial del negocio.</small>
            </p>

            <!-- Listado de Productos -->
            <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 350px; overflow-y: auto; padding-right: 2px;">
              ${c.productos.length > 0 ? itemsHtml : `
                <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.8rem;">
                  Sin productos asignados en este segmento.
                </div>
              `}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="tab-pane-container" style="animation: fadeIn 0.3s ease-out; display: flex; flex-direction: column; gap: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
            <div style="background: rgba(239, 68, 68, 0.1); padding: 0.75rem; border-radius: 1rem; color: var(--danger); display: flex; align-items: center; justify-content: center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                <line x1="6" y1="18" x2="6.01" y2="18"></line>
              </svg>
            </div>
            <div>
              <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">Matriz de Rotación y Salud de Catálogo</h2>
              <p style="color: var(--text-muted); font-size: 0.875rem;">Segmentación de productos en 3 grupos óptimos mediante matriz de Recencia, Frecuencia y Volumen (K-Means 3D).</p>
            </div>
          </div>

          <!-- Mensaje Inteligente / Insight de Salud de Catálogo -->
          <div class="alert-box glass" style="border-left: 4px solid var(--danger); padding: 1.25rem; border-radius: 0.875rem; background: rgba(239, 68, 68, 0.03);">
            <div style="display: flex; gap: 0.85rem; align-items: flex-start;">
              <div style="color: var(--danger); display: flex; align-items: center; justify-content: center; margin-top: 0.15rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </div>
              <div>
                <strong style="color: var(--text); display: block; margin-bottom: 0.25rem; font-size: 0.95rem;">Análisis de Liquidez de Inventario</strong>
                <span style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.45;">
                  ${insightKM}
                </span>
              </div>
            </div>
          </div>

          <!-- Columnas de Clusters -->
          ${clusters.length > 0 ? `
            <div style="display: flex; gap: 1.25rem; flex-wrap: wrap; justify-content: stretch; align-items: stretch; margin-top: 0.5rem;" class="clusters-container">
              ${clustersColumnsHtml}
            </div>
          ` : `
            <div style="text-align: center; padding: 3rem 1.5rem; background: rgba(0, 0, 0, 0.15); border-radius: 1rem; border: 1px dashed var(--border);">
              <p style="color: var(--text-muted); font-size: 0.9rem;">
                No hay productos activos suficientes para realizar el agrupamiento K-Means.
              </p>
            </div>
          `}
          
          <!-- Nuevos Widgets Comerciales: Tasa de Retorno y Tiempo de Tránsito -->
          <div style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 2rem; margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1.5rem;" class="new-widgets-grid">
            
            <!-- Widget 1: Tasa de Retorno (Return Rate) -->
            <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid var(--border); padding: 1.5rem; border-radius: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">
              <h3 style="font-size: 1rem; font-weight: 700; color: var(--text); margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--danger);">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                </svg>
                Tasa de Retorno de Exhibición (Exhibition Return Rate)
              </h3>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                Porcentaje de stock en exhibición que retornó a bodega sin venderse (Límite: ${(this.state.returnRates && this.state.returnRates.length > 0 && this.state.returnRates[0].umbral_retorno_critico) || 80.0}%).
              </p>
              
              <div style="max-height: 280px; overflow-y: auto; padding-right: 4px;">
                ${returnRatesTableHtml}
                ${returnRatesCardsHtml}
              </div>
            </div>
            
            <!-- Widget 2: Tiempo de Tránsito (Transit Lead Time) -->
            <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid var(--border); padding: 1.5rem; border-radius: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">
              <h3 style="font-size: 1rem; font-weight: 700; color: var(--text); margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                Tiempo de Tránsito de Ropa
              </h3>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                Promedio de horas o días que las prendas permanecen en la calle con vendedores.
              </p>
              
              <div style="max-height: 280px; overflow-y: auto; padding-right: 4px;">
                ${transitTimesTableHtml}
                ${transitTimesCardsHtml}
              </div>
            </div>
          </div>

          <style>
          @keyframes text-pulse-blink {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(0.95); opacity: 0.5; }
            100% { transform: scale(1); opacity: 1; }
          }
          .text-blink {
            animation: text-pulse-blink 1.5s infinite;
            box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
          }
          .transit-card:hover {
            transform: translateY(-2px);
            border-color: var(--primary) !important;
            background: rgba(108, 92, 231, 0.03) !important;
          }
          @media (max-width: 900px) {
            .new-widgets-grid {
              grid-template-columns: 1fr !important;
              gap: 1.5rem !important;
            }
          }
          </style>

          <!-- Nota de Pie de Página -->
          <footer style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 1rem; font-size: 0.8rem; color: var(--text-muted); margin-top: 1rem;">
            <span>Catálogo activo analizado: <strong>${totalAnalizados} productos</strong></span>
            <span>Estadística RFV calculada deterministamente.</span>
          </footer>
        </div>
      `;
    }

    if (tab === 'turnos') {
      const { selectedMonth, shiftsReport, selectedDayShifts, selectedDayDate } = this.state;
      const year = parseInt(selectedMonth.split('-')[0]);
      const month = parseInt(selectedMonth.split('-')[1]);
      
      const firstDayOffset = new Date(year, month - 1, 1).getDay();
      const daysInMonth = new Date(year, month, 0).getDate();

      let cellsHtml = '';
      
      for (let i = 0; i < firstDayOffset; i++) {
        cellsHtml += `<div class="heatmap-cell cell-none"></div>`;
      }
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = day.toString().padStart(2, '0');
        const dateStr = `${selectedMonth}-${dayStr}`;
        
        const dayShifts = (shiftsReport || []).filter(s => s.fecha === dateStr);
        let cellClass = 'cell-none';
        let alertBadgeHtml = '';
        
        if (dayShifts.length > 0) {
          const hasKpiFailure = dayShifts.some(s => !s.kpi_cumplido);
          cellClass = hasKpiFailure ? 'cell-warning' : 'cell-success';
          
          const totalAlerts = dayShifts.reduce((acc, s) => acc + s.alertas_count, 0);
          if (totalAlerts > 0) {
            alertBadgeHtml = `<span class="cell-alert-badge">${totalAlerts}</span>`;
          }
        }
        
        const isActive = selectedDayDate === dateStr ? 'active-cell' : '';
        
        cellsHtml += `
          <div class="heatmap-cell ${cellClass} ${isActive}" data-date="${dateStr}">
            <span class="cell-number">${day}</span>
            ${alertBadgeHtml}
          </div>
        `;
      }

      let detailPanelHtml = '';
      if (!selectedDayDate) {
        if (shiftsReport && shiftsReport.length === 0) {
          detailPanelHtml = `
            <div class="shift-detail-drawer" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: var(--text-muted); padding: 3rem 2rem;">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem; color: var(--warning); opacity: 0.8;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text); margin-bottom: 0.5rem;">Sin Registros</h3>
              <p style="font-size: 0.875rem; max-width: 250px;">No hay turnos registrados para el mes seleccionado. Intentá con otro mes.</p>
            </div>
          `;
        } else {
          detailPanelHtml = `
            <div class="shift-detail-drawer" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: var(--text-muted); padding: 3rem 2rem;">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem; color: var(--text-muted); opacity: 0.5;">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text); margin-bottom: 0.5rem;">Detalle de Turnos</h3>
              <p style="font-size: 0.875rem; max-width: 250px;">Seleccioná un día del calendario con turnos para ver la auditoría de stock y el cumplimiento de horarios.</p>
            </div>
          `;
        }
      }

      if (selectedDayDate) {
        const formattedDate = new Date(selectedDayDate + 'T00:00:00').toLocaleDateString('es-ES', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });

        if (selectedDayShifts && selectedDayShifts.length > 0) {
          // Desktop: rich audit cards (replaces cramped table)
          const shiftsTableHtml = `
            <div class="desktop-only shift-audit-cards">
              ${selectedDayShifts.map(s => {
                const creadoTime = s.creado_en ? parseUTCDate(s.creado_en).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'N/A';
                const cerradoTime = s.cerrado_en ? parseUTCDate(s.cerrado_en).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Activo';

                let durationText = 'Activo';
                if (s.duracion_segundos) {
                  const hours = Math.floor(s.duracion_segundos / 3600);
                  const mins = Math.floor((s.duracion_segundos % 3600) / 60);
                  durationText = `${hours}h ${mins}m`;
                }

                let badgeClass = 'badge-compliant';
                let statusText = 'KPI CUMPLIDO';
                let statusColor = 'var(--success)';
                if (s.estado === 'ABIERTO') {
                  badgeClass = 'badge-active';
                  statusText = 'TURNO ACTIVO';
                  statusColor = 'var(--primary)';
                } else if (!s.kpi_cumplido) {
                  badgeClass = 'badge-warning';
                  statusText = 'CIERRE FORZADO';
                  statusColor = 'var(--warning)';
                }

                const netMovement = s.salidas - s.retornos;

                // Observations for forced-close
                const failReasons = [];
                if (!s.kpi_cumplido) {
                  if (s.cierre_automatico) failReasons.push('Cierre automático por límite diario (Scheduler).');
                  if (s.duracion_segundos && s.duracion_segundos >= 12 * 3600) failReasons.push('El turno excedió las 12 horas reglamentarias.');
                }

                const alertItemsHtml = s.alertas && s.alertas.length > 0
                  ? `<div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem;">
                      ${s.alertas.map(a => `
                        <div class="alert-subcard">
                          <span style="color: var(--danger); flex-shrink: 0; display: flex; align-items: flex-start; padding-top: 2px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="12" y1="8" x2="12" y2="12"></line>
                              <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                          </span>
                          <div style="text-align: left; min-width: 0;">
                            <strong style="color: var(--text); font-size: 0.75rem; display: block;">${a.tipo}</strong>
                            <span style="color: var(--text-muted); font-size: 0.75rem; line-height: 1.35;">${a.descripcion}</span>
                          </div>
                        </div>
                      `).join('')}
                    </div>`
                  : `<p style="font-size: 0.8rem; color: var(--text-muted); font-style: italic; margin-top: 0.75rem;">Sin incidentes reportados en este turno.</p>`;

                return `
                  <div class="shift-audit-card-desktop" style="background: rgba(26, 26, 36, 0.65); border: 1px solid var(--border); border-left: 4px solid ${statusColor}; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);">
                    <!-- Card header -->
                    <div class="sacd-header">
                      <div class="sacd-title-group">
                        <span class="sacd-id">Turno #${s.id}</span>
                        <span class="sacd-time">${creadoTime} → ${cerradoTime} hs &nbsp;·&nbsp; ${durationText}</span>
                      </div>
                      <span class="${badgeClass}">${statusText}</span>
                    </div>

                    <!-- KPI strip -->
                    <div class="sacd-kpi-strip">
                      <div class="sacd-kpi">
                        <span class="sacd-kpi-label">Salidas</span>
                        <span class="sacd-kpi-value" style="color: var(--primary);">${s.salidas}</span>
                      </div>
                      <div class="sacd-kpi-divider"></div>
                      <div class="sacd-kpi">
                        <span class="sacd-kpi-label">Retornos</span>
                        <span class="sacd-kpi-value" style="color: var(--success);">${s.retornos}</span>
                      </div>
                      <div class="sacd-kpi-divider"></div>
                      <div class="sacd-kpi">
                        <span class="sacd-kpi-label">Ventas Estimadas</span>
                        <span class="sacd-kpi-value" style="color: ${netMovement >= 0 ? 'var(--text)' : 'var(--danger)'};">${Math.abs(netMovement)} uds</span>
                      </div>
                    </div>

                    <!-- Alerts / Observations -->
                    <div class="sacd-alerts-section">
                      <strong style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">
                        ${s.alertas && s.alertas.length > 0 ? `${s.alertas.length} Incidente${s.alertas.length > 1 ? 's' : ''}` : 'Incidentes'}
                      </strong>
                      ${alertItemsHtml}
                      ${failReasons.length > 0 ? `
                        <div style="margin-top: 0.75rem; background: rgba(245,158,11,0.05); border: 1px solid rgba(245,158,11,0.15); border-radius: 0.6rem; padding: 0.65rem 0.9rem;">
                          <strong style="color: var(--warning); font-size: 0.72rem; display: block; margin-bottom: 0.25rem;">Observaciones de Horario</strong>
                          <span style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.4;">${failReasons.join('<br>')}</span>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;

          const shiftsCardsHtml = `
            <div class="mobile-only" style="display: flex; flex-direction: column; gap: 0.75rem; width: 100%;">
              ${selectedDayShifts.map((s, idx) => {
                const creadoTime = s.creado_en ? parseUTCDate(s.creado_en).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'N/A';
                const cerradoTime = s.cerrado_en ? parseUTCDate(s.cerrado_en).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Activo';
                
                let durationText = 'Activo';
                if (s.duracion_segundos) {
                  const hours = Math.floor(s.duracion_segundos / 3600);
                  const mins = Math.floor((s.duracion_segundos % 3600) / 60);
                  durationText = `${hours}h ${mins}m`;
                }

                let badgeClass = 'badge-compliant';
                let statusText = 'KPI CUMPLIDO';
                let reasonsHtml = '';

                if (s.estado === 'ABIERTO') {
                  badgeClass = 'badge-active';
                  statusText = 'TURNO ACTIVO';
                } else if (!s.kpi_cumplido) {
                  badgeClass = 'badge-warning';
                  statusText = 'CIERRE FORZADO';
                  
                  const failReasons = [];
                  if (s.cierre_automatico) failReasons.push('Cierre automático por límite de tiempo diario (Scheduler).');
                  if (s.duracion_segundos && s.duracion_segundos >= 12 * 3600) failReasons.push('El turno excedió las 12 horas reglamentarias de actividad.');
                  
                  reasonsHtml = `
                    <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.15); border-radius: 0.75rem; padding: 0.75rem 1rem; margin-top: 0.5rem;">
                      <strong style="color: var(--warning); font-size: 0.75rem; display: block; margin-bottom: 0.25rem;">Observaciones de Horario:</strong>
                      <span style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.35;">${failReasons.join('<br>')}</span>
                    </div>
                  `;
                }

                const alertItemsHtml = s.alertas && s.alertas.length > 0 
                  ? s.alertas.map(a => `
                      <div class="alert-subcard">
                        <span style="color: var(--danger); font-size: 0.85rem; display: flex; align-items: center; justify-content: center; margin-top: 2px;">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                          </svg>
                        </span>
                        <div style="text-align: left;">
                          <strong style="color: var(--text); font-size: 0.75rem; display: block;">${a.tipo}</strong>
                          <span style="color: var(--text-muted); font-size: 0.75rem; line-height: 1.3;">${a.descripcion}</span>
                        </div>
                      </div>
                    `).join('')
                  : `<span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">Sin incidentes reportados en este turno.</span>`;

                return `
                  <div class="accordion-card" data-index="shift-audit-${idx}">
                    <div class="accordion-header">
                      <div style="display: flex; flex-direction: column; gap: 0.15rem; text-align: left;">
                        <strong style="color: var(--text); font-size: 0.95rem;">Turno #${s.id}</strong>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">${creadoTime} - ${cerradoTime} hs (${durationText})</span>
                      </div>
                      <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="${badgeClass}">${statusText}</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="accordion-arrow" style="transition: transform 0.2s;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </div>
                    </div>
                    <div class="accordion-details">
                      <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.85rem; color: var(--text-muted); text-align: left;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; text-align: center; font-size: 0.75rem; margin-bottom: 0.5rem;">
                          <div style="background: rgba(255,255,255,0.02); padding: 0.5rem; border-radius: 0.5rem;">
                            <span style="color: var(--text-muted); display: block;">Salidas</span>
                            <strong style="color: var(--primary); font-size: 0.85rem;">${s.salidas} uds</strong>
                          </div>
                          <div style="background: rgba(255,255,255,0.02); padding: 0.5rem; border-radius: 0.5rem;">
                            <span style="color: var(--text-muted); display: block;">Retornos</span>
                            <strong style="color: var(--success); font-size: 0.85rem;">${s.retornos} uds</strong>
                          </div>
                          <div style="background: rgba(255,255,255,0.02); padding: 0.5rem; border-radius: 0.5rem;">
                            <span style="color: var(--text-muted); display: block;">Ventas Estimadas</span>
                            <strong style="color: var(--text); font-size: 0.85rem;">${s.salidas - s.retornos} uds</strong>
                          </div>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                          <strong style="color: var(--text); font-size: 0.8rem; display: block;">Registro de Incidentes/Auditoría:</strong>
                          ${alertItemsHtml}
                        </div>

                        ${reasonsHtml}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;

          detailPanelHtml = `
            <div class="shift-detail-drawer" style="animation: fadeIn 0.3s ease-out;">
              <header style="border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
                <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text); text-transform: capitalize;">${formattedDate}</h3>
                <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 0.15rem;">Turnos registrados: <strong>${selectedDayShifts.length}</strong></span>
              </header>
              <div style="display: flex; flex-direction: column; gap: 1rem; max-height: 480px; overflow-y: auto; padding-right: 4px; margin-top: 0.5rem;">
                ${shiftsTableHtml}
                ${shiftsCardsHtml}
              </div>
            </div>
          `;
        } else {
          detailPanelHtml = `
            <div class="shift-detail-drawer" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: var(--text-muted); padding: 3rem 2rem;">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem; color: var(--text-muted); opacity: 0.4;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
              </svg>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text); margin-bottom: 0.5rem; text-transform: capitalize;">${formattedDate}</h3>
              <p style="font-size: 0.875rem; max-width: 250px;">No se registraron turnos ni movimientos de inventario en este día.</p>
            </div>
          `;
        }
      }

      return `
        <div class="tab-pane-container" style="animation: fadeIn 0.3s ease-out; display: flex; flex-direction: column; gap: 1.5rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div style="background: rgba(108, 92, 231, 0.1); padding: 0.75rem; border-radius: 1rem; color: var(--primary); display: flex; align-items: center; justify-content: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <div>
                <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">Auditoría de Turnos y Cumplimiento</h2>
                <p style="color: var(--text-muted); font-size: 0.875rem;">Control de horarios, balance de stock por turnos y visualización heatmap de incidentes.</p>
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">Mes:</span>
              <input type="month" id="shifts-month-picker" class="filter-select" value="${selectedMonth}" style="min-height: 38px; padding: 0.4rem 0.75rem; border-radius: 0.6rem; border: 1px solid var(--border); font-size: 0.875rem;">
            </div>
          </div>

          <div class="heatmap-container">
            <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border); padding: 1.5rem; border-radius: 1.25rem;">
              <div class="heatmap-grid" style="grid-template-rows: auto auto;">
                <div class="heatmap-day-header">Dom</div>
                <div class="heatmap-day-header">Lun</div>
                <div class="heatmap-day-header">Mar</div>
                <div class="heatmap-day-header">Mié</div>
                <div class="heatmap-day-header">Jue</div>
                <div class="heatmap-day-header">Vie</div>
                <div class="heatmap-day-header">Sáb</div>
                ${cellsHtml}
              </div>
              
              <div style="display: flex; gap: 1rem; margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1rem; flex-wrap: wrap; font-size: 0.75rem; color: var(--text-muted);">
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                  <span style="width: 12px; height: 12px; border-radius: 3px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); display: inline-block;"></span>
                  <span>Sin turnos</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                  <span style="width: 12px; height: 12px; border-radius: 3px; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); display: inline-block;"></span>
                  <span>Turnos Completados</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                  <span style="width: 12px; height: 12px; border-radius: 3px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); display: inline-block;"></span>
                  <span>Cierre Forzado / Advertencias</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                  <span style="display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 50%; background: var(--danger); color: white; font-size: 0.6rem; font-weight: bold; line-height: 1;">!</span>
                  <span>Badge Alerta (Incidentes)</span>
                </div>
              </div>
            </div>

            ${detailPanelHtml}
          </div>
        </div>
      `;
    }

    return '';
  }
}
