import BaseComponent from './BaseComponent.js';
import Navbar from './Navbar.js';
import Sidebar from './Sidebar.js';
import StatusBar from './StatusBar.js';
import LoginPage from './LoginPage.js';
import appStore from '../store/Store.js';

/**
 * MainLayout - Top-level orchestrator for the application layout.
 */
export default class MainLayout extends BaseComponent {
  constructor(props) {
    super(props);
    this.navbar = new Navbar();
    this.sidebar = new Sidebar();
    this.statusBar = new StatusBar();
    this.loginPage = new LoginPage();
    this.currentPage = null;
    this.unsubscribe = null;
  }

  render() {
    const { isAuthenticated } = appStore.getState();

    if (!isAuthenticated) {
      return '<div class="auth-wrapper"><div id="login-target"></div></div>';
    }

    return `
      <div class="layout-container">
        <!-- Sidebar overlay for mobile -->
        <div class="sidebar-overlay" id="sidebar-overlay"></div>

        <!-- Sidebar placeholder -->
        <div id="sidebar-target"></div>
        
        <!-- Status Bar for mobile -->
        <div id="statusbar-target"></div>
        
        <!-- Navbar placeholder -->
        <div id="navbar-target"></div>
        
        <!-- Main content area -->
        <main class="main-content">
          <div id="router-view"></div>
        </main>
      </div>
    `;
  }

  onMount() {
    const { isAuthenticated } = appStore.getState();

    if (!isAuthenticated) {
      const loginTarget = this.element.querySelector('#login-target');
      if (loginTarget) {
        this.loginPage.mount(loginTarget);
        loginTarget.replaceWith(this.loginPage.element);
      }
    } else {
      // Mount static parts
      const sidebarTarget = this.element.querySelector('#sidebar-target');
      const navbarTarget = this.element.querySelector('#navbar-target');
      const statusbarTarget = this.element.querySelector('#statusbar-target');
      
      if (sidebarTarget) {
        this.sidebar.mount(sidebarTarget);
        sidebarTarget.replaceWith(this.sidebar.element);
      }
      
      if (statusbarTarget) {
        this.statusBar.mount(statusbarTarget);
        statusbarTarget.replaceWith(this.statusBar.element);
      }
      
      if (navbarTarget) {
        this.navbar.mount(navbarTarget);
        navbarTarget.replaceWith(this.navbar.element);
      }

      // Initial route
      this.handleRouting();
    }
    
    // Store bound function for removal
    this.boundHandleRouting = this.handleRouting.bind(this);
    window.addEventListener('hashchange', this.boundHandleRouting);

    // Subscribe to store for reactive auth changes
    this.unsubscribe = appStore.subscribe((state, prevState) => {
      if (state.isAuthenticated !== prevState.isAuthenticated) {
        this.update(); 
      }
    });

    // Handle mobile sidebar interactions
    const layout = this.element.classList.contains('layout-container') 
      ? this.element 
      : this.element.querySelector('.layout-container');

    if (layout) {
      // Direct overlay click
      const overlay = this.element.querySelector('#sidebar-overlay');
      if (overlay) {
        overlay.addEventListener('click', (e) => {
          e.stopPropagation();
          layout.classList.remove('sidebar-open');
        });
      }

      // Fallback: Click anywhere else in the layout container (outside sidebar)
      layout.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && layout.classList.contains('sidebar-open')) {
          const sidebar = this.element.querySelector('.sidebar');
          const toggleBtn = document.querySelector('#toggle-sidebar');
          
          // Close if click is NOT on sidebar and NOT on toggle button
          if (sidebar && !sidebar.contains(e.target) && toggleBtn && !toggleBtn.contains(e.target)) {
            layout.classList.remove('sidebar-open');
          }
        }
      });
    }
  }

  dispose() {
    console.log('🧹 MainLayout Cleaning up...');
    
    // Cleanup global listeners
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    
    if (this.boundHandleRouting) {
      window.removeEventListener('hashchange', this.boundHandleRouting);
    }

    // Deep cleanup of sub-components
    const components = [this.navbar, this.sidebar, this.statusBar, this.loginPage, this.currentPage];
    components.forEach(comp => {
      if (comp && typeof comp.dispose === 'function') {
        comp.dispose();
      }
    });
  }

  async handleRouting() {
    const hash = window.location.hash || '#/';
    const viewTarget = this.element.querySelector('#router-view');
    if (!viewTarget) return;

    // Dispose old page if exists
    if (this.currentPage && this.currentPage.dispose) {
      this.currentPage.dispose();
    }

    viewTarget.innerHTML = '<div class="empty-state glass"><p>Cargando módulo...</p></div>';
    
    try {
      let PageClass;
      
      if (hash === '#/' || hash === '') {
        const module = await import('../pages/DashboardPage.js');
        PageClass = module.default;
      } else if (hash === '#/inventario') {
        const module = await import('../pages/InventoryPage.js');
        PageClass = module.default;
      } else if (hash === '#/alertas') {
        const module = await import('../pages/AlertsPage.js');
        PageClass = module.default;
      } else if (hash === '#/configuracion') {
        const module = await import('../pages/ConfigPage.js');
        PageClass = module.default;
      } else if (hash === '#/reportes') {
        const module = await import('../pages/ReportsPage.js');
        PageClass = module.default;
      }

      if (PageClass) {
        viewTarget.innerHTML = '';
        this.currentPage = new PageClass();
        this.currentPage.mount(viewTarget);
      } else {
        viewTarget.innerHTML = `<div class="empty-state glass"><h2>Página ${hash} en desarrollo</h2></div>`;
      }
    } catch (error) {
      console.error('🚀 Lazy Loading Error:', error);
      viewTarget.innerHTML = `<div class="empty-state glass"><p style="color: var(--danger);">Error al cargar el módulo: ${error.message}</p></div>`;
    }
  }
}
