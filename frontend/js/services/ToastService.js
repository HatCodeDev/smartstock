/**
 * Toast - Singleton service for displaying non-blocking notifications.
 */
class Toast {
  constructor() {
    this.container = null;
    this.createContainer();
  }

  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  }

  /**
   * Show a notification
   * @param {string} message 
   * @param {string} type - 'info' | 'success' | 'warning' | 'danger'
   * @param {number} duration - ms
   */
  show(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Add icon based on type
    const icons = {
      info: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
      success: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
      warning: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
      danger: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" aria-label="Cerrar notificación">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    `;

    this.container.appendChild(toast);

    // Animation: Enter
    requestAnimationFrame(() => {
      toast.classList.add('toast-visible');
    });

    // Auto-remove
    const timer = setTimeout(() => this.remove(toast), duration);

    // Manual close
    toast.querySelector('.toast-close').onclick = () => {
      clearTimeout(timer);
      this.remove(toast);
    };
  }

  remove(toast) {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-exit');
    toast.addEventListener('transitionend', () => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, { once: true });
  }

  success(msg) { this.show(msg, 'success'); }
  error(msg) { this.show(msg, 'danger'); }
  warning(msg) { this.show(msg, 'warning'); }
  info(msg) { this.show(msg, 'info'); }
}

const toastService = new Toast();
export default toastService;
