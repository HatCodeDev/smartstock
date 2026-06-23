import BaseComponent from './BaseComponent.js';
import apiService from '../services/ApiService.js';

/**
 * Sidebar - Left navigation component.
 */
export default class Sidebar extends BaseComponent {
  render() {
    return `
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="logo">
            <span class="logo-text" style="font-weight: 800; font-size: 1.5rem; color: var(--text);">
              <span class="logo-full"><span style="color: var(--primary);">SMART</span>STOCK</span>
              <span class="logo-short"><span style="color: var(--primary);">S</span>T</span>
            </span>
          </div>
        </div>
        
        <nav aria-label="Navegación Principal">
          <ul class="nav-list">
            <li>
              <a href="#/" class="nav-link active" aria-current="page" data-route="#/">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="7" height="9"></rect>
                  <rect x="14" y="3" width="7" height="5"></rect>
                  <rect x="14" y="12" width="7" height="9"></rect>
                  <rect x="3" y="16" width="7" height="5"></rect>
                </svg>
                <span>Dashboard</span>
              </a>
            </li>
            <li>
              <a href="#/inventario" class="nav-link" data-route="#/inventario">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3"></path>
                  <path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"></path>
                  <path d="M4 12h16"></path>
                </svg>
                <span>Inventario</span>
              </a>
            </li>
            <li>
              <a href="#/alertas" class="nav-link" data-route="#/alertas">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <span>Alertas</span>
              </a>
            </li>
            <li>
              <a href="#/reportes" class="nav-link" data-route="#/reportes">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                <span>Reportes</span>
              </a>
            </li>
          </ul>
        </nav>
        
        <div class="sidebar-footer">
          <a href="#/configuracion" class="nav-link" aria-label="Configuración" data-route="#/configuracion" style="margin-bottom: 0.5rem;">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>Configuración</span>
          </a>
          
          <button class="nav-link nav-link-logout" id="logout-btn" style="width: 100%; border: none; cursor: pointer; text-align: left;">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    `;
  }

  onMount() {
    const logoutBtn = this.element.querySelector('#logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
          apiService.logout();
        }
      });
    }

    // Active link management based on hash change
    this.boundUpdateActiveLink = () => {
      const hash = window.location.hash || '#/';
      this.element.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('data-route') === hash) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
      // Close sidebar on mobile after navigating
      if (window.innerWidth <= 768) {
        const layout = document.querySelector('.layout-container');
        if (layout) layout.classList.remove('sidebar-open');
      }
    };

    window.addEventListener('hashchange', this.boundUpdateActiveLink);
    this.boundUpdateActiveLink(); // initial call
  }

  dispose() {
    if (this.boundUpdateActiveLink) {
      window.removeEventListener('hashchange', this.boundUpdateActiveLink);
    }
  }
}
