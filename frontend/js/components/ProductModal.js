import BaseComponent from './BaseComponent.js';

/**
 * ProductModal - Component for adding a new product.
 */
export default class ProductModal extends BaseComponent {
  constructor(props) {
    super(props);
    this.state = {
      isSaving: false,
      error: null
    };
  }

  render() {
    const { isSaving, error } = this.state;

    return `
      <div class="modal-overlay" id="product-modal-overlay">
        <div class="modal-content glass">
          <header class="modal-header">
            <h2 style="font-size: 1.5rem;">Nuevo Producto</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Complete los datos básicos para registrar la mercancía.
            </p>
          </header>

          <form id="product-form" class="form modal-form">
            <div class="form-group">
              <label for="nombre">Nombre del Producto *</label>
              <input type="text" id="nombre" name="nombre" placeholder="Ej: Blusa Seda Azul" required ${isSaving ? 'disabled' : ''}>
            </div>

            <div class="form-group">
              <label for="sku">SKU / Referencia</label>
              <input type="text" id="sku" name="sku" placeholder="Ej: BLU-SDA-001" ${isSaving ? 'disabled' : ''}>
            </div>

            <div class="form-group">
              <label for="categoria">Categoría</label>
              <input type="text" id="categoria" name="categoria" placeholder="Ej: Damas / Blusas" ${isSaving ? 'disabled' : ''}>
            </div>

            <div class="form-group">
              <label for="stock_minimo">Stock Mínimo (Alerta de Reorden) *</label>
              <input type="number" id="stock_minimo" name="stock_minimo" placeholder="Ej: 5" min="1" value="5" required ${isSaving ? 'disabled' : ''}>
            </div>

            <div class="form-group modal-note-box">
              <p>
                <strong style="color: var(--primary);">Nota:</strong> El stock inicial será 0. Para agregar stock, pase las etiquetas RFID por el portal en modo Registro.
              </p>
            </div>

            ${error ? `<p class="form-error">${error}</p>` : ''}

            <footer class="modal-footer">
              <button type="button" class="btn btn-secondary modal-cancel-btn" id="btn-cancel" ${isSaving ? 'disabled' : ''}>
                Cancelar
              </button>
              <button type="submit" class="btn btn-primary modal-save-btn" ${isSaving ? 'disabled' : ''}>
                ${isSaving ? 'Guardando...' : 'Guardar Producto'}
              </button>
            </footer>
          </form>
        </div>
      </div>
    `;
  }

  onMount() {
    const form = this.element.querySelector('#product-form');
    const btnCancel = this.element.querySelector('#btn-cancel');
    const overlay = this.element.querySelector('#product-modal-overlay');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = {
          nombre: formData.get('nombre'),
          sku: formData.get('sku') || null,
          categoria: formData.get('categoria') || 'Sin categoría',
          stock_minimo: parseInt(formData.get('stock_minimo'), 10) || 5,
          cantidad_inicial: 0 // Tag-driven inventory
        };
        
        if (this.props.onSave) {
          this.setState({ isSaving: true, error: null });
          this.props.onSave(data)
            .catch(err => {
              this.setState({ isSaving: false, error: err.message || 'Error al guardar el producto' });
            });
        }
      });
    }

    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        if (this.props.onClose) this.props.onClose();
      });
    }

    // Close on overlay click
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay && this.props.onClose && !this.state.isSaving) {
          this.props.onClose();
        }
      });
    }
  }
}
