import BaseComponent from './BaseComponent.js';
import apiService from '../services/ApiService.js';

/**
 * ProductDetailModal - Component for displaying a premium, interactive view of product details,
 * RFID tags list, and Return Rate metrics.
 */
export default class ProductDetailModal extends BaseComponent {
  /**
   * @param {Object} props
   * @param {Object} props.product - The product object to display detail for
   * @param {Function} props.onClose - Callback when modal is closed
   */
  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      tags: [],
      returnRate: 0.0,
      excedeUmbral: false,
      umbral: 80.0,
      error: null,
      isInitialFetchDone: false
    };
  }

  async fetchData() {
    try {
      const [tags, returnRates] = await Promise.all([
        apiService.get(`/products/${this.props.product.id}/tags`),
        apiService.get('/reports/products/return-rates')
      ]);
      
      const myRateObj = returnRates.find(r => r.id === this.props.product.id) || { 
        return_rate: 0.0, 
        excede_umbral: false, 
        umbral_retorno_critico: 80.0 
      };

      this.setState({
        tags,
        returnRate: myRateObj.return_rate,
        excedeUmbral: myRateObj.excede_umbral,
        umbral: myRateObj.umbral_retorno_critico,
        isLoading: false,
        isInitialFetchDone: true
      });
    } catch (err) {
      console.error('Error fetching product detail metrics:', err);
      this.setState({ 
        error: 'No se pudieron cargar las métricas y etiquetas del producto.', 
        isLoading: false,
        isInitialFetchDone: true
      });
    }
  }

  async unlinkTag(epc) {
    if (!confirm(`¿Estás seguro de que querés desvincular la etiqueta RFID ${epc}? Esta acción la desactivará y ajustará el stock.`)) {
      return;
    }
    try {
      await apiService.delete(`/tags/${epc}`);
      if (window.showToast) {
        window.showToast('Etiqueta desvinculada exitosamente', 'success');
      }
      
      // Volver a cargar los datos del producto
      this.fetchData();
      
      // Disparar actualización global del inventario
      appStore.setState({ inventoryUpdated: Date.now() });
    } catch (err) {
      console.error('Error unlinking tag:', err);
      alert('Error al desvincular la etiqueta: ' + (err.response?.data?.detail || err.message));
    }
  }

  render() {
    const { product, onClose } = this.props;
    const { isLoading, tags, returnRate, excedeUmbral, umbral, error, isInitialFetchDone } = this.state;

    const isExceso = returnRate > umbral;
    // Colores para la tasa de retorno
    let colorClass = 'success';
    let returnRateColor = 'var(--success)';
    if (isExceso) {
      colorClass = 'danger';
      returnRateColor = 'var(--danger)';
    } else if (returnRate >= umbral * 0.5) {
      colorClass = 'warning';
      returnRateColor = 'var(--warning)';
    }

    // Calcular circunferencia para el gráfico circular SVG
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (Math.min(returnRate, 100) / 100) * circumference;

    return `
      <div class="modal-overlay" id="product-detail-modal-overlay">
        <div class="modal-content glass product-detail-modal-content" style="max-width: 750px; padding: 2rem;">
          <header class="modal-header" style="position: relative; margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
              <div>
                <span class="badge badge-secondary" style="margin-bottom: 0.5rem; text-transform: uppercase;">
                  ${product.categoria || 'Sin categoría'}
                </span>
                <h2 style="font-size: 1.75rem; font-weight: 800; color: var(--text);">${product.nombre}</h2>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem;">
                  SKU: <strong style="color: var(--text);">${product.sku || 'Sin SKU'}</strong>
                </p>
              </div>
              <button class="btn btn-secondary glass close-detail-btn" id="btn-close-detail" style="padding: 0.5rem; border-radius: 50%; min-width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </header>

          ${isLoading && !isInitialFetchDone ? `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; gap: 1rem;">
              <div class="spinner"></div>
              <p style="color: var(--text-muted); font-size: 0.9rem;">Obteniendo información de trazabilidad...</p>
            </div>
          ` : error ? `
            <div class="empty-state glass" style="padding: 2.5rem; border-color: rgba(239, 68, 68, 0.2);">
              <p style="color: var(--danger); font-weight: 600;">${error}</p>
              <button class="btn btn-secondary glass" onclick="window.retryFetchDetail()" style="margin-top: 1rem;">Reintentar</button>
            </div>
          ` : `
            <div class="product-detail-grid">
              
              <!-- Left Column: Metrics & Alerts -->
              <div class="product-detail-left">
                
                <!-- Stock card -->
                <div class="detail-card glass">
                  <span class="card-label">Inventario Físico</span>
                  <div style="display: flex; align-items: baseline; gap: 0.5rem; margin-top: 0.5rem;">
                    <span style="font-size: 2.5rem; font-weight: 900; color: ${product.stock < product.stock_minimo ? 'var(--danger)' : 'var(--primary)'};">${product.stock}</span>
                    <span style="color: var(--text-muted); font-size: 0.85rem;">prendas en stock</span>
                  </div>
                  <div style="margin-top: 0.75rem; font-size: 0.8rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.75rem; display: flex; justify-content: space-between; color: var(--text-muted);">
                    <span>Mínimo requerido:</span>
                    <strong style="color: var(--text);">${product.stock_minimo} unidades</strong>
                  </div>
                  ${product.stock < product.stock_minimo ? `
                    <div style="margin-top: 0.75rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); padding: 0.5rem; border-radius: 6px; color: var(--danger); font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 0.35rem;">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      STOCK BAJO EL MÍNIMO REQUERIDO
                    </div>
                  ` : ''}
                </div>

                <!-- Return Rate Widget -->
                <div class="detail-card glass return-rate-widget-card" style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.75rem; position: relative; overflow: hidden;">
                  <span class="card-label" style="align-self: flex-start;">Tasa de Retorno de Exhibición</span>
                  
                  <div class="svg-gauge-container" style="position: relative; width: 130px; height: 130px; margin-top: 0.5rem;">
                    <svg width="130" height="130" viewBox="0 0 120 120" style="transform: rotate(-90deg);">
                      <!-- Background circle -->
                      <circle cx="60" cy="60" r="${radius}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="10"></circle>
                      <!-- Progress circle -->
                      <circle cx="60" cy="60" r="${radius}" fill="none" stroke="${returnRateColor}" stroke-width="10"
                              stroke-dasharray="${circumference}" stroke-dashoffset="${strokeDashoffset}"
                              stroke-linecap="round" style="transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1);"></circle>
                    </svg>
                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                      <span style="font-size: 1.75rem; font-weight: 900; color: var(--text);">${returnRate}%</span>
                      <span style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Retorno</span>
                    </div>
                  </div>

                  <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                    Porcentaje de stock en exhibición que retornó a bodega sin venderse. Umbral tolerado: <strong>${umbral}%</strong>.
                  </p>

                  ${isExceso ? `
                    <div class="pulse-alert-critical text-blink" style="width: 100%; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); padding: 0.65rem 0.5rem; border-radius: 8px; color: var(--danger); font-size: 0.75rem; font-weight: 800; text-align: center; letter-spacing: 0.02em;">
                      ¡RETORNO CRÍTICO SUPERADO!
                    </div>
                  ` : `
                    <div style="width: 100%; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); padding: 0.5rem; border-radius: 8px; color: var(--success); font-size: 0.75rem; font-weight: 700; text-align: center;">
                      TASA DENTRO DEL LÍMITE SEGURO
                    </div>
                  `}
                </div>

              </div>

              <!-- Right Column: RFID Tags List -->
              <div class="product-detail-right glass">
                <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--text); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
                  <span style="display: inline-flex; align-items: center; gap: 0.4rem;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);"><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l8.58-8.58a1 1 0 0 0 0-1.42z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                    Trazabilidad RFID (${tags.length})
                  </span>
                  <span style="font-size: 0.75rem; font-weight: normal; color: var(--text-muted);">EPC Único</span>
                </h3>
                
                <div class="detail-tags-list-container" style="max-height: 290px; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 0.5rem;">
                  ${tags.length === 0 ? `
                    <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted); font-size: 0.85rem; opacity: 0.5; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                      No hay etiquetas vinculadas a este artículo.
                    </div>
                  ` : tags.map(t => `
                    <div class="detail-tag-item" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.65rem 0.85rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s ease;">
                      <div style="display: flex; flex-direction: column; gap: 0.15rem;">
                        <code style="color: var(--text); font-family: monospace; font-size: 0.8rem; font-weight: 600;">${t.epc}</code>
                        <span style="font-size: 0.65rem; color: var(--text-muted);">Asignado: ${t.asignada_en ? new Date(t.asignada_en).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      <button class="btn-unlink-tag" onclick="window.unlinkProductTag('${t.epc}')" title="Desvincular etiqueta RFID del producto">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        <span>Desvincular</span>
                      </button>
                    </div>
                  `).join('')}
                </div>
              </div>

            </div>
          `}
        </div>
      </div>

      <style>
      .product-detail-modal-content {
        animation: pd-scale-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
      @keyframes pd-scale-up {
        from { transform: scale(0.9); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      .product-detail-grid {
        display: grid;
        grid-template-columns: 260px 1fr;
        gap: 1.5rem;
        width: 100%;
      }
      .product-detail-left {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .product-detail-right {
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 1rem;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
      }
      .detail-card {
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 1rem;
        padding: 1.25rem;
      }
      .card-label {
        font-size: 0.725rem;
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .btn-unlink-tag {
        background: transparent;
        border: 1px solid rgba(239, 68, 68, 0.2);
        color: rgba(239, 68, 68, 0.85);
        padding: 0.25rem 0.6rem;
        border-radius: 6px;
        font-size: 0.7rem;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        transition: all 0.2s ease;
      }
      .btn-unlink-tag:hover {
        background: rgba(239, 68, 68, 0.08);
        border-color: var(--danger);
        color: var(--danger);
        transform: translateY(-1px);
      }
      .detail-tag-item:hover {
        background: rgba(255,255,255,0.04) !important;
        border-color: rgba(255,255,255,0.08) !important;
      }
      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid rgba(255, 255, 255, 0.05);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      @keyframes pd-pulse-blink {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(0.98); opacity: 0.7; }
        100% { transform: scale(1); opacity: 1; }
      }
      .text-blink {
        animation: pd-pulse-blink 1.5s infinite;
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
      }
      @media (max-width: 700px) {
        .product-detail-grid {
          grid-template-columns: 1fr !important;
        }
      }
      </style>
    `;
  }

  onMount() {
    const btnClose = this.element.querySelector('#btn-close-detail');
    const overlay = this.element.querySelector('#product-detail-modal-overlay');

    if (btnClose) {
      btnClose.addEventListener('click', () => {
        if (this.props.onClose) this.props.onClose();
      });
    }

    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay && this.props.onClose) {
          this.props.onClose();
        }
      });
    }

    // Expose handlers in window to resolve scoping issues inside template HTML strings
    window.unlinkProductTag = (epc) => this.unlinkTag(epc);
    window.retryFetchDetail = () => this.fetchData();

    // Trigger data fetching on mount
    if (!this.state.isInitialFetchDone) {
      this.fetchData();
    }
  }

  dispose() {
    delete window.unlinkProductTag;
    delete window.retryFetchDetail;
  }
}
