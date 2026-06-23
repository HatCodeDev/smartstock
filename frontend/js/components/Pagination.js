import BaseComponent from './BaseComponent.js';

/**
 * Pagination - Component for navigating through paginated data.
 */
export default class Pagination extends BaseComponent {
  /**
   * @param {Object} props
   * @param {number} props.totalItems - Total number of items
   * @param {number} props.itemsPerPage - Items displayed per page
   * @param {number} props.currentPage - Current active page (1-indexed)
   * @param {Function} props.onPageChange - Callback when page changes
   */
  constructor(props) {
    super(props);
  }

  onMount() {
    const prevBtn = this.element.querySelector('#prev-page');
    const nextBtn = this.element.querySelector('#next-page');

    if (prevBtn && !prevBtn.disabled) {
      prevBtn.addEventListener('click', () => {
        this.props.onPageChange(this.props.currentPage - 1);
      });
    }

    if (nextBtn && !nextBtn.disabled) {
      nextBtn.addEventListener('click', () => {
        this.props.onPageChange(this.props.currentPage + 1);
      });
    }
  }

  render() {
    const { totalItems, itemsPerPage, currentPage } = this.props;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const isFirstPage = currentPage === 1;
    const isLastPage = currentPage === totalPages;

    return `
      <div class="pagination-container glass">
        <div class="pagination-info">
          Mostrando <span class="highlight">${totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> 
          a <span class="highlight">${Math.min(currentPage * itemsPerPage, totalItems)}</span> 
          de <span class="highlight">${totalItems}</span> productos
        </div>
        
        <div class="pagination-controls">
          <button id="prev-page" class="btn-icon glass" ${isFirstPage ? 'disabled' : ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          
          <div class="page-indicator">
            Página <strong>${currentPage}</strong> de <strong>${totalPages}</strong>
          </div>
          
          <button id="next-page" class="btn-icon glass" ${isLastPage ? 'disabled' : ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
      </div>
    `;
  }
}
