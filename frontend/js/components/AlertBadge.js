import BaseComponent from './BaseComponent.js';

/**
 * AlertBadge - Atomic component for displaying alert categories.
 */
export default class AlertBadge extends BaseComponent {
  render() {
    const { type = 'INFO', label = 'Normal' } = this.props;
    
    let badgeClass = 'badge-primary';
    if (type === 'WARNING' || type === 'TAG_DESCONOCIDA') badgeClass = 'badge-warning';
    if (type === 'CRITICAL') badgeClass = 'badge-danger';
    if (type === 'SUCCESS') badgeClass = 'badge-success';

    return `<span class="badge ${badgeClass}">${label || type}</span>`;
  }
}
