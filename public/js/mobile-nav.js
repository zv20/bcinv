/**
 * Mobile Bottom Navigation Component
 */

class MobileNav {
  constructor() {
    this.currentPage = 'dashboard';
    this.cameraMenu = null;
    this.cameraMenuOverlay = null;
    this.init();
  }

  init() {
    this.render();
    this.attachEventListeners();
    this.updateActiveState();
  }

  render() {
    const navHTML = `
      <nav class="mobile-nav">
        <a href="#dashboard" class="mobile-nav-item" data-page="dashboard">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>
          <span>Home</span>
        </a>
        
        <a href="#search" class="mobile-nav-item" data-page="search">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <span>Search</span>
        </a>
        
        <a href="#camera" class="mobile-nav-item camera-btn" data-page="camera">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          <span>Scan</span>
        </a>
        
        <a href="#inventory" class="mobile-nav-item" data-page="inventory">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
          </svg>
          <span>Stock</span>
        </a>
        
        <a href="#settings" class="mobile-nav-item" data-page="settings">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          <span>Settings</span>
        </a>
      </nav>
    `;

    // Append to body if not exists
    if (!document.querySelector('.mobile-nav')) {
      document.body.insertAdjacentHTML('beforeend', navHTML);
    }

    // Render camera action menu
    this.renderCameraMenu();
  }

  renderCameraMenu() {
    const menuHTML = `
      <div class="camera-menu-overlay"></div>
      <div class="camera-menu">
        <h3 class="camera-menu-title">Scan Barcode</h3>
        
        <div class="camera-action-item" data-action="add-item">
          <div class="camera-action-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
          </div>
          <div class="camera-action-text">
            <h4>Add Item</h4>
            <p>Scan barcode to add new product</p>
          </div>
        </div>
        
        <div class="camera-action-item" data-action="check-stock">
          <div class="camera-action-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <div class="camera-action-text">
            <h4>Check Stock</h4>
            <p>View item details and expiration</p>
          </div>
        </div>
        
        <div class="camera-action-item" data-action="discard-item">
          <div class="camera-action-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </div>
          <div class="camera-action-text">
            <h4>Discard Expired</h4>
            <p>Remove expired items from inventory</p>
          </div>
        </div>
        
        <div class="camera-action-item" data-action="adjust-stock">
          <div class="camera-action-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </div>
          <div class="camera-action-text">
            <h4>Adjust Stock</h4>
            <p>Manual count with reason tracking</p>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', menuHTML);
    this.cameraMenu = document.querySelector('.camera-menu');
    this.cameraMenuOverlay = document.querySelector('.camera-menu-overlay');
  }

  attachEventListeners() {
    // Navigation item clicks
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        
        if (page === 'camera') {
          this.openCameraMenu();
        } else if (page === 'search') {
          this.openSearchOverlay();
        } else {
          this.navigateTo(page);
        }
      });
    });

    // Camera menu overlay click to close
    if (this.cameraMenuOverlay) {
      this.cameraMenuOverlay.addEventListener('click', () => {
        this.closeCameraMenu();
      });
    }

    // Camera action item clicks
    document.querySelectorAll('.camera-action-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        this.handleCameraAction(action);
      });
    });
  }

  navigateTo(page) {
    this.currentPage = page;
    this.updateActiveState();
    
    // Emit custom event for page change
    const event = new CustomEvent('mobileNavChange', { detail: { page } });
    document.dispatchEvent(event);
  }

  updateActiveState() {
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.page === this.currentPage) {
        item.classList.add('active');
      }
    });
  }

  openCameraMenu() {
    this.cameraMenu.classList.add('active');
    this.cameraMenuOverlay.classList.add('active');
  }

  closeCameraMenu() {
    this.cameraMenu.classList.remove('active');
    this.cameraMenuOverlay.classList.remove('active');
  }

  openSearchOverlay() {
    const event = new CustomEvent('openSearch');
    document.dispatchEvent(event);
  }

  handleCameraAction(action) {
    this.closeCameraMenu();
    
    // Emit event for camera action
    const event = new CustomEvent('cameraAction', { detail: { action } });
    document.dispatchEvent(event);

    console.log(`Camera action: ${action}`);
    // TODO: Implement camera scanner in Sprint 2
  }
}

// Initialize mobile nav when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.mobileNav = new MobileNav();
  });
} else {
  window.mobileNav = new MobileNav();
}
