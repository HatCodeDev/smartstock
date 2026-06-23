import BaseComponent from './BaseComponent.js';

/**
 * StatCard - Atomic component for displaying summary statistics.
 */
export default class StatCard extends BaseComponent {
  /**
   * @param {Object} props
   * @param {string} props.title - Title of the statistic
   * @param {string|number} props.value - Current value
   * @param {string} props.icon - SVG or icon name
   * @param {string} props.trend - Optional trend indicator (e.g. "+5%")
   * @param {string} props.color - Theme color (primary, success, warning, danger)
   */
  constructor(props) {
    super(props);
  }

  render() {
    const { title, value, icon = '', trend = '', color = 'primary' } = this.props;
    
    return `
      <div class="stat-card glass">
        <div class="stat-header">
          <span class="stat-title">${title}</span>
          <div class="stat-icon-wrapper color-${color}">
            ${icon}
          </div>
        </div>
        <div class="stat-body">
          <h2 class="stat-value">${value}</h2>
          ${trend ? `<span class="stat-trend">${trend}</span>` : ''}
        </div>
      </div>
    `;
  }
}
