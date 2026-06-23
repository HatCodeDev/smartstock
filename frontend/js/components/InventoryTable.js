import BaseComponent from './BaseComponent.js';

/**
 * InventoryTable - Component for displaying a list of products/tags.
 */
export default class InventoryTable extends BaseComponent {
  /**
   * @param {Object} props
   * @param {Array} props.items - List of objects to display
   * @param {Array} props.columns - Column definitions [{ key, label, render }]
   */
  constructor(props) {
    super(props);
  }

  render() {
    const { items = [], columns = [] } = this.props;

    if (items.length === 0) {
      return `
        <div class="empty-state glass">
          <p>No hay datos para mostrar.</p>
        </div>
      `;
    }

    const visibleColumns = columns.filter(col => !col.hidden);

    return `
      <div class="table-container glass">
        <table class="data-table">
          <thead>
            <tr>
              ${visibleColumns.map(col => `<th>${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                ${visibleColumns.map(col => `
                  <td data-label="${col.label}">${col.render ? col.render(item[col.key], item) : (item[col.key] || '-')}</td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}
