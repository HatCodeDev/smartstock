import BaseComponent from '../components/BaseComponent.js';
import InventoryTable from '../components/InventoryTable.js';
import Pagination from '../components/Pagination.js';
import ProductModal from '../components/ProductModal.js';
import ProductDetailModal from '../components/ProductDetailModal.js';
import apiService from '../services/ApiService.js';

/**
 * InventoryPage - View for managing products and RFID tags.
 */
export default class InventoryPage extends BaseComponent {
  constructor(props) {
    super(props);
    this.state = {
      products: [],
      isLoading: true,
      error: null,
      isModalOpen: false,
      isDetailModalOpen: false,
      selectedProduct: null,
      lastActiveProductId: null,
      searchQuery: '',
      currentPage: 1,
      itemsPerPage: 10,
      stockFilter: 'all',
      isColumnMenuOpen: false,
      columns: [
        { 
          key: 'nombre', 
          label: 'Producto', 
          hidden: false,
          render: (val, item) => `
            <span class="product-detail-trigger" style="color: var(--primary); font-weight: 700; cursor: pointer; border-bottom: 1px dashed var(--primary); transition: all 0.2s;" 
               onclick="window.dispatchEvent(new CustomEvent('show-product-detail', {detail: ${JSON.stringify(item).replace(/"/g, '&quot;')}}))">
              ${val}
            </span>
          `
        },
        { key: 'sku', label: 'SKU', hidden: false },
        { 
          key: 'stock', 
          label: 'Stock Actual', 
          hidden: false, 
          render: (val, item) => {
            const stockMinimo = item.stock_minimo || 5;
            const isCritical = val < stockMinimo;
            
            if (isCritical) {
              return `
                <div style="display: flex; align-items: center; gap: 0.5rem;" title="El stock actual es menor al mínimo seguro de ${stockMinimo}">
                  <strong style="color: var(--danger); font-size: 1.1em;">${val}</strong>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.9;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                </div>
              `;
            }
            return `<strong style="color: var(--primary);">${val}</strong>`;
          }
        },
        {
          key: 'actions',
          label: 'Acciones',
          hidden: false,
          render: (_, item) => `
            <div style="display: flex; justify-content: center;">
              <button class="btn btn-primary glass" style="padding: 0.25rem 0.75rem; font-size: 0.75rem;" 
                      onclick="window.dispatchEvent(new CustomEvent('start-reg', {detail: {id: '${item.id}', name: '${item.nombre}'}}))">
                Vincular Tags
              </button>
            </div>`
        }
      ]
    };

    this.table = new InventoryTable({
      items: [],
      columns: this.state.columns
    });

    this.unsubscribe = null;
    this.isInitialLoadDone = false;
    this.handleStartReg = (e) => this.startRegistration(e.detail.id, e.detail.name);
    this.handleShowDetail = (e) => {
      this.setState({
        isDetailModalOpen: true,
        selectedProduct: e.detail
      });
    };
  }

  async onMount() {
    if (!this.isInitialLoadDone) {
      this.isInitialLoadDone = true; // Set BEFORE calling fetchProducts to prevent recursion loop
      this.fetchProducts();
    }

    // Escuchar evento de inicio de registro (limpiar antes para evitar duplicados)
    window.removeEventListener('start-reg', this.handleStartReg);
    window.addEventListener('start-reg', this.handleStartReg);

    // Escuchar evento de visualización de detalle de producto
    window.removeEventListener('show-product-detail', this.handleShowDetail);
    window.addEventListener('show-product-detail', this.handleShowDetail);

    // Suscribirse al store para ver actualizaciones de registro en tiempo real
    if (!this.unsubscribe) {
      let lastInventoryUpdated = appStore.getState().inventoryUpdated;
      this.unsubscribe = appStore.subscribe((newState) => {
        if (newState.inventoryUpdated !== lastInventoryUpdated) {
          lastInventoryUpdated = newState.inventoryUpdated;
          this.fetchProducts();
        } else {
          this.update();
        }
      });
    }

    // Lógica de búsqueda y foco
    const searchInput = this.element.querySelector('.filter-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.setState({
          searchQuery: e.target.value,
          currentPage: 1 // Resetear a la primera página al buscar
        });
      });

      // Restaurar foco y posición del cursor si estábamos escribiendo
      if (this.state.searchQuery) {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
      }
    }

    // Filtro de Stock (Custom Select)
    const stockDropdown = this.element.querySelector('#stock-filter-dropdown');
    if (stockDropdown) {
      const trigger = stockDropdown.querySelector('.custom-select-trigger');
      const options = stockDropdown.querySelectorAll('.custom-select-option');

      if (trigger) {
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          stockDropdown.classList.toggle('open');
        });
      }

      options.forEach(option => {
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          const newValue = option.dataset.value;
          stockDropdown.classList.remove('open');
          this.setState({ stockFilter: newValue, currentPage: 1 });
        });
      });

      // Cerrar al hacer clic afuera
      const closeDropdownFn = (e) => {
        if (!stockDropdown.contains(e.target)) {
          stockDropdown.classList.remove('open');
        }
      };
      document.addEventListener('click', closeDropdownFn);

      // Cleanup para evitar memory leaks (aunque BaseComponent ya limpia bastante, mejor asegurar)
      this.closeDropdownFn = closeDropdownFn;
    }

    // Toggle de Menú de Columnas
    const colMenuBtn = this.element.querySelector('#column-menu-btn');
    if (colMenuBtn) {
      colMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setState({ isColumnMenuOpen: !this.state.isColumnMenuOpen });
      });
    }

    // Cerrar menú al hacer clic afuera
    if (this.state.isColumnMenuOpen) {
      const closeMenuFn = (e) => {
        const menu = this.element.querySelector('.column-menu-dropdown');
        if (menu && !menu.contains(e.target) && e.target.id !== 'column-menu-btn') {
          this.setState({ isColumnMenuOpen: false });
          document.removeEventListener('click', closeMenuFn);
        }
      };
      document.addEventListener('click', closeMenuFn);
    }

    // Toggle visibilidad de columnas
    const colCheckboxes = this.element.querySelectorAll('.col-toggle-cb');
    colCheckboxes.forEach(cb => {
      cb.addEventListener('change', (e) => {
        const colKey = e.target.dataset.key;
        const newCols = this.state.columns.map(c =>
          c.key === colKey ? { ...c, hidden: !e.target.checked } : c
        );
        this.setState({ columns: newCols });
      });
    });

    // Inicializar listeners de la paginación si existe
    const paginationEl = this.element.querySelector('.pagination-container');
    if (paginationEl && this.pagination) {
      this.pagination.element = paginationEl;
      this.pagination.onMount();
    }

    // Handlers para el modal
    const btnAdd = this.element.querySelector('#btn-add-product');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.setState({ isModalOpen: true }));
    }

    // Initialize modal listeners if it's open
    if (this.state.isModalOpen && this.modal) {
      this.modal.element = this.element.querySelector('#product-modal-overlay');
      if (this.modal.element) {
        this.modal.onMount();
      }
    }

    // Initialize detail modal listeners if it's open
    if (this.state.isDetailModalOpen && this.detailModal) {
      this.detailModal.element = this.element.querySelector('#product-detail-modal-overlay');
      if (this.detailModal.element) {
        this.detailModal.onMount();
      }
    }

    // AUTO-SCROLL: Si acaba de iniciarse una sesión de registro nueva,
    // esperamos al siguiente frame para que el panel esté pintado en el DOM.
    const { registrationSession } = appStore.getState();
    const panel = this.element.querySelector('#registration-panel');
    if (registrationSession && panel && this._lastScrolledSession !== registrationSession.sessionId) {
      this._lastScrolledSession = registrationSession.sessionId;
      setTimeout(() => {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }

  dispose() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.closeDropdownFn) {
      document.removeEventListener('click', this.closeDropdownFn);
    }
    window.removeEventListener('start-reg', this.handleStartReg);
    window.removeEventListener('show-product-detail', this.handleShowDetail);
  }

  async handleSaveProduct(productData) {
    try {
      await apiService.post('/products', productData);
      this.setState({ isModalOpen: false });
      this.fetchProducts();

      // Mostrar notificación de éxito si existe el sistema de toasts
      if (window.showToast) {
        window.showToast('Producto creado exitosamente', 'success');
      } else {
        console.log('✅ Producto creado exitosamente');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      throw error; // Re-throw to be handled by the modal's catch
    }
  }

  async startRegistration(productId, productName) {
    try {
      // 1. Iniciar sesión en backend
      const response = await apiService.post('/tags/scan-batch', { product_id: productId });
      const sessionId = response.session_id;

      // 2. Cambiar modo del portal a REGISTRO
      await apiService.post('/portal/mode', { mode: 'REGISTRO', device_id: 'smartstock-portal-01' });

      // 3. Actualizar estado local
      appStore.setState({
        registrationSession: { productId, productName, sessionId, registeredTags: [], targetCount: 1 },
        portalMode: 'REGISTRO'
      });

      console.log(`🎯 Registro iniciado para: ${productName}`);
    } catch (error) {
      console.error('Error al iniciar registro:', error);
      alert('No se pudo iniciar la sesión de registro');
    }
  }

  async stopRegistration() {
    try {
      // 1. Volver a modo SALIDA
      await apiService.post('/portal/mode', { mode: 'APAGADO', device_id: 'smartstock-portal-01' });

      // 2. Limpiar sesión
      appStore.setState({ registrationSession: null, portalMode: 'APAGADO' });

      // 3. Refrescar tabla
      this.fetchProducts();
    } catch (error) {
      console.error('Error al detener registro:', error);
    }
  }

  async fetchProducts() {
    this.setState({ isLoading: true });
    try {
      const products = await apiService.get('/products');
      // Asegurar que mapeamos stock correctamente si el backend devuelve cantidad_inicial + tags
      // Por ahora confiamos en el campo 'stock' o usamos cantidad_inicial
      const mappedProducts = products.map(p => ({
        ...p,
        stock: p.stock !== undefined ? p.stock : p.cantidad_inicial
      }));
      this.setState({ products: mappedProducts, isLoading: false });
    } catch (error) {
      console.error('Error fetching products:', error);
      this.setState({ error: 'No se pudo cargar el inventario', isLoading: false });
    }
  }

  render() {
    const { products, isLoading, error, isModalOpen, isDetailModalOpen, searchQuery, currentPage, itemsPerPage, stockFilter, isColumnMenuOpen, columns } = this.state;
    const { registrationSession, portalMode, isAuthenticated } = appStore.getState();

    // Guard: Si no está autenticado, no renderizar nada (el ApiService ya redirigirá)
    if (!isAuthenticated) {
      return '<div class="empty-state">Redirigiendo al login...</div>';
    }

    // Filtrado de productos por nombre, SKU y Stock
    const filteredProducts = products.filter(p => {
      const query = searchQuery.toLowerCase();
      const matchSearch = (p.nombre?.toLowerCase().includes(query) || p.sku?.toLowerCase().includes(query));

      let matchStock = true;
      if (stockFilter === 'in-stock') matchStock = p.stock > 0;
      if (stockFilter === 'out-of-stock') matchStock = p.stock === 0;

      return matchSearch && matchStock;
    });

    // Paginación
    const totalItems = filteredProducts.length;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

    const totalProducts = products.length;
    const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);

    return `
      <div class="inventory-page">
        ${registrationSession ? this.renderRegistrationPanel(registrationSession) : ''}
        
        ${isModalOpen ? this.renderModal() : ''}
        ${isDetailModalOpen ? this.renderDetailModal() : ''}
 
        <header class="inventory-header" style="${registrationSession ? 'opacity: 0.5; pointer-events: none;' : ''}">
          <div class="header-titles">
            <h1 class="page-title">Inventario de Productos</h1>
            <p class="page-subtitle" style="margin-bottom: 0.5rem;">Gestión de stock y trazabilidad RFID.</p>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <span class="badge badge-muted" style="text-transform: none; font-size: 0.75rem; padding: 0.2rem 0.6rem; display: inline-flex; align-items: center; gap: 0.35rem;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.8;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line></svg>
                <strong>${totalProducts}</strong> productos
              </span>
              <span class="badge badge-primary" style="text-transform: none; font-size: 0.75rem; padding: 0.2rem 0.6rem; display: inline-flex; align-items: center; gap: 0.35rem;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.8;"><path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3m18 0v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8m18 0H3m4.5 4h9"></path></svg>
                <strong>${totalStock}</strong> unidades en total
              </span>
            </div>
          </div>
          <button class="btn btn-primary" id="btn-add-product">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Nuevo Producto</span>
          </button>
        </header>

        ${!registrationSession ? `
          <div class="inventory-filters-bar glass">
            <div class="search-input-wrapper">
              <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" placeholder="Buscar por nombre o SKU..." class="filter-input" value="${searchQuery}">
            </div>
            
            <div class="filters-actions">
              <div class="custom-select-container" id="stock-filter-dropdown">
                <div class="custom-select-trigger filter-select">
                  <span>${stockFilter === 'in-stock' ? 'Con Stock' : stockFilter === 'out-of-stock' ? 'Sin Stock' : 'Todo el Stock'}</span>
                </div>
                <div class="custom-select-options">
                  <div class="custom-select-option ${stockFilter === 'all' ? 'selected' : ''}" data-value="all">Todo el Stock</div>
                  <div class="custom-select-option ${stockFilter === 'in-stock' ? 'selected' : ''}" data-value="in-stock">Con Stock</div>
                  <div class="custom-select-option ${stockFilter === 'out-of-stock' ? 'selected' : ''}" data-value="out-of-stock">Sin Stock</div>
                </div>
              </div>

              <div class="column-menu-wrapper">
                <button id="column-menu-btn" class="btn btn-secondary glass">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                </button>
                
                ${isColumnMenuOpen ? `
                  <div class="column-menu-dropdown">
                    <h4 style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem; letter-spacing: 0.05em;">Columnas</h4>
                    ${columns.map(col => `
                      <label class="column-toggle-label">
                        <input type="checkbox" class="col-toggle-cb" data-key="${col.key}" ${!col.hidden ? 'checked' : ''}>
                        <span>${col.label}</span>
                      </label>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        ` : ''}

        ${isLoading
        ? '<div class="empty-state glass"><p>Cargando inventario...</p></div>'
        : error
          ? `<div class="empty-state glass"><p style="color: var(--danger);">${error}</p></div>`
          : `
            ${this.renderTable(paginatedProducts)}
            ${!registrationSession ? this.renderPagination(totalItems) : ''}
          `
      }
      </div>
    `;
  }

  renderPagination(totalItems) {
    this.pagination = new Pagination({
      totalItems,
      itemsPerPage: this.state.itemsPerPage,
      currentPage: this.state.currentPage,
      onPageChange: (newPage) => this.setState({ currentPage: newPage })
    });
    return this.pagination.render();
  }

  renderModal() {
    this.modal = new ProductModal({
      onClose: () => this.setState({ isModalOpen: false }),
      onSave: (data) => this.handleSaveProduct(data)
    });
    return this.modal.render();
  }

  renderDetailModal() {
    this.detailModal = new ProductDetailModal({
      product: this.state.selectedProduct,
      onClose: () => this.setState({ isDetailModalOpen: false, selectedProduct: null })
    });
    return this.detailModal.render();
  }

  renderRegistrationPanel(session) {
    const newTags = session.registeredTags.filter(t => t.status === 'new');
    const count = newTags.length;
    const target = session.targetCount || 1;
    const progress = Math.min((count / target) * 100, 100);
    const isComplete = count >= target;

    // Animation logic: only animate if the product ID changed (new session)
    const isNewSession = this.state.lastActiveProductId !== session.productId;
    if (isNewSession) {
      this.state.lastActiveProductId = session.productId;
    }

    // SVG Icons
    const icons = {
      target: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
      scan: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>`,
      check: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="success-icon-animate"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
      tag: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; opacity: 0.5;"><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l8.58-8.58a1 1 0 0 0 0-1.42z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
      plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
      minus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`
    };

    // Expose handlers
    window.updateTarget = (val) => {
      const num = Math.max(1, parseInt(val) || 1);
      appStore.setState({
        registrationSession: { ...appStore.getState().registrationSession, targetCount: num }
      });
    };

    window.adjustTarget = (delta) => {
      const current = appStore.getState().registrationSession.targetCount || 1;
      window.updateTarget(current + delta);
    };

    return `
      <div id="registration-panel" class="registration-panel glass ${isComplete ? 'success' : ''} ${isNewSession ? 'entrance-animation' : ''}">
        <div class="registration-panel-header">
          <div class="registration-info">
            <span class="badge badge-primary" style="margin-bottom: 0.75rem; display: inline-flex; align-items: center; gap: 0.5rem;">
              ${icons.scan}
              MODO REGISTRO
            </span>
            <h2 class="registration-title">${session.productName}</h2>
            <p class="registration-subtitle">Aproxime las etiquetas al lector RFID.</p>
          </div>
          <div class="registration-actions">
            ${isComplete ? icons.check : ''}
            <button class="btn ${isComplete ? 'btn-primary' : 'btn-danger'} registration-stop-btn" onclick="window.stopReg()">
              ${isComplete ? 'Confirmar Registro' : 'Finalizar registro'}
            </button>
          </div>
        </div>

        <div class="registration-progress-container">
          <div class="registration-progress-fill" style="width: ${progress}%"></div>
        </div>

        <div class="registration-stats-row">
          <div class="registration-stat">
            <span class="stat-label">Objetivo</span>
            <div class="stepper-container">
              <button class="stepper-btn" onclick="window.adjustTarget(-1)">${icons.minus}</button>
              <input type="number" class="target-input-minimal" value="${target}" 
                     min="1" onchange="window.updateTarget(this.value)" 
                     onkeyup="if(event.key === 'Enter') window.updateTarget(this.value)">
              <button class="stepper-btn" onclick="window.adjustTarget(1)">${icons.plus}</button>
            </div>
          </div>
          
          <div class="registration-stat" style="border-left: 1px solid rgba(255,255,255,0.05);">
            <span class="stat-label">Nuevas</span>
            <div class="stat-value-group">
              <span class="stat-value" style="color: ${isComplete ? 'var(--success)' : 'var(--text)'}">${count}</span>
              <span class="stat-unit">/ ${target}</span>
            </div>
          </div>
        </div>

        <div class="registration-tags-list">
          ${newTags.length === 0
        ? '<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.85rem; opacity: 0.5;">Esperando lecturas de hardware...</div>'
        : newTags.map(t => `
                <div class="tag-item-new">
                  <div class="tag-item-id">
                    ${icons.tag}
                    <span>${t.epc}</span>
                  </div>
                  <span class="tag-item-status">VINCULADO</span>
                </div>
              `).reverse().join('')
      }
        </div>
        
        ${this.renderConflictsPanel(session)}
      </div>
    `;
  }

  renderConflictsPanel(session) {
    // Agrupar conflictos únicos (usando Map para evitar duplicados en UI)
    const conflictMap = new Map();
    session.registeredTags.filter(t => t.status === 'conflict').forEach(t => {
      conflictMap.set(t.epc, t);
    });

    const conflictTags = Array.from(conflictMap.values());
    if (conflictTags.length === 0) return '';

    // Categorize
    const reassignable = conflictTags.filter(t => t.derived_state === 'reassignable');
    const recyclable = conflictTags.filter(t => t.derived_state === 'recyclable');
    const blockedTransit = conflictTags.filter(t => t.derived_state === 'blocked_transit');
    const blockedReturn = conflictTags.filter(t => t.derived_state === 'blocked_return');

    // Expose conflict resolution handler
    window.resolveConflicts = async () => {
      try {
        const decisions = [];
        // Reassignable: Error original -> deduct
        reassignable.forEach(t => decisions.push({ epc: t.epc, deduct_from_original: true }));
        // Recyclable: Vendido -> do not deduct
        recyclable.forEach(t => decisions.push({ epc: t.epc, deduct_from_original: false }));

        if (decisions.length > 0) {
          await apiService.post('/tags/resolve-conflicts', {
            session_id: appStore.getState().registrationSession.sessionId,
            action: 'reassign_all',
            decisions: decisions
          });
          if (window.showToast) window.showToast('Etiquetas reasignadas exitosamente', 'success');

          // Limpiar conflictos locales y convertirlos en "nuevos" visualmente para que se sumen a la meta
          const currentSession = appStore.getState().registrationSession;
          const updatedTags = currentSession.registeredTags.map(t => {
            if (t.status === 'conflict' && (t.derived_state === 'reassignable' || t.derived_state === 'recyclable')) {
              return { ...t, status: 'new' };
            }
            return t;
          }).filter(t => t.status !== 'conflict'); // Las bloqueadas se descartan visualmente al resolver

          appStore.setState({
            registrationSession: {
              ...currentSession,
              registeredTags: updatedTags
            }
          });
          // NOTA: No llamamos a this.fetchProducts() aquí para mantener la consistencia
          // visual con las etiquetas nuevas. La tabla principal de inventario solo 
          // se actualizará cuando el usuario presione "Finalizar registro".
        }
      } catch (err) {
        console.error('Error al resolver conflictos', err);
        alert('Error al reasignar: ' + (err.response?.data?.detail || err.message));
      }
    };

    // Helper to format origin products
    const getOriginText = (tags) => {
      const products = [...new Set(tags.map(t => t.original_product_name || 'Desconocido'))];
      return products.join(', ');
    };

    return `
      <div class="conflicts-panel" style="margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem;">
        <h4 style="color: var(--warning); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
           Etiquetas en Conflicto (${conflictTags.length})
        </h4>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">Estas etiquetas ya estaban vinculadas a otros productos.</p>
        
        <div style="font-size: 0.8rem; display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
          ${reassignable.length > 0 ? `
            <div style="color: var(--text); padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 6px; border-left: 3px solid var(--text-muted);">
               <strong>${reassignable.length} por Error de Registro:</strong> 
               Pertenecían a <em>${getOriginText(reassignable)}</em>. <br>
               <span style="opacity: 0.7; font-size: 0.75rem;">Se descontarán de su origen y se sumarán a este producto.</span>
            </div>` : ''}
            
          ${recyclable.length > 0 ? `
            <div style="color: var(--success); padding: 0.75rem; background: rgba(0,255,0,0.05); border-radius: 6px; border-left: 3px solid var(--success);">
               <strong>${recyclable.length} Listas para Reciclar:</strong> 
               Eran de <em>${getOriginText(recyclable)}</em> y ya fueron vendidas. <br>
               <span style="opacity: 0.7; font-size: 0.75rem;">Se sumarán a este producto sin afectar otros inventarios.</span>
            </div>` : ''}
            
          ${blockedTransit.length > 0 ? `
            <div style="color: var(--danger); padding: 0.75rem; background: rgba(255,0,0,0.05); border-radius: 6px; border-left: 3px solid var(--danger);">
               <strong>${blockedTransit.length} Bloqueadas (En tránsito):</strong> 
               Pertenecen a <em>${getOriginText(blockedTransit)}</em> y salieron en este turno. Termine el turno primero si desea reasignarlas.
            </div>` : ''}
            
          ${blockedReturn.length > 0 ? `
            <div style="color: var(--danger); padding: 0.75rem; background: rgba(255,0,0,0.05); border-radius: 6px; border-left: 3px solid var(--danger);">
               <strong>${blockedReturn.length} Bloqueadas (Retornadas):</strong> 
               Pertenecían a <em>${getOriginText(blockedReturn)}</em> y están marcadas como devolución. Por seguridad, no pueden reasignarse directamente.
            </div>` : ''}
        </div>
        
        ${(reassignable.length > 0 || recyclable.length > 0) ? `
          <button class="btn btn-primary" onclick="window.resolveConflicts()" style="width: 100%; justify-content: center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            Corregir e Incorporar (${reassignable.length + recyclable.length})
          </button>
        ` : ''}
      </div>
    `;
  }

  renderTable(products) {
    // Expose stop function to window for the onclick handler
    window.stopReg = () => {
      const session = appStore.getState().registrationSession;
      const conflicts = session?.registeredTags?.filter(t => t.status === 'conflict')?.length || 0;

      if (conflicts > 0) {
        if (!confirm(`Tienes ${conflicts} etiqueta(s) en conflicto sin resolver.\n\nSi finalizas ahora, estas etiquetas SERÁN IGNORADAS y no se vincularán a este producto.\n\n¿Deseas finalizar el registro de todos modos?`)) {
          return; // Cancelar el cierre
        }
      }
      this.stopRegistration();
    };
    this.table.props.items = products;
    this.table.props.columns = this.state.columns;
    return this.table.render();
  }
}
