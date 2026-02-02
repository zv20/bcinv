/**
 * Product Search Module
 * Handles real-time search functionality for both desktop and mobile
 */

class ProductSearch {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || '/api/products/search';
    this.debounceMs = options.debounceMs || 300;
    this.minChars = options.minChars || 2;
    this.debounceTimer = null;
    this.cache = new Map();
    this.init();
  }

  init() {
    // Check if mobile
    this.isMobile = window.innerWidth < 768;
    
    if (this.isMobile) {
      this.initMobileSearch();
    } else {
      this.initDesktopSearch();
    }
  }

  initMobileSearch() {
    // Create mobile search overlay
    const overlayHTML = `
      <div class="search-overlay">
        <div class="search-header">
          <button class="search-back-btn" aria-label="Back">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <div class="search-input-wrapper">
            <input type="text" class="search-input" placeholder="Search products..." autocomplete="off">
          </div>
        </div>
        <div class="search-results"></div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', overlayHTML);

    this.overlay = document.querySelector('.search-overlay');
    this.searchInput = this.overlay.querySelector('.search-input');
    this.resultsContainer = this.overlay.querySelector('.search-results');
    this.backBtn = this.overlay.querySelector('.search-back-btn');

    // Event listeners
    this.backBtn.addEventListener('click', () => this.closeMobileSearch());
    this.searchInput.addEventListener('input', (e) => this.handleInput(e.target.value));
    
    // Listen for open search event
    document.addEventListener('openSearch', () => this.openMobileSearch());
  }

  initDesktopSearch() {
    // TODO: Implement desktop search dropdown (Sprint 1)
    console.log('Desktop search initialization (to be implemented)');
  }

  openMobileSearch() {
    this.overlay.classList.add('active');
    this.searchInput.focus();
  }

  closeMobileSearch() {
    this.overlay.classList.remove('active');
    this.searchInput.value = '';
    this.resultsContainer.innerHTML = '';
  }

  handleInput(query) {
    clearTimeout(this.debounceTimer);

    if (query.length < this.minChars) {
      this.resultsContainer.innerHTML = '';
      return;
    }

    // Show loading state
    this.showLoading();

    // Debounce search
    this.debounceTimer = setTimeout(() => {
      this.performSearch(query);
    }, this.debounceMs);
  }

  async performSearch(query) {
    try {
      // Check cache first
      const cacheKey = query.toLowerCase();
      if (this.cache.has(cacheKey)) {
        this.displayResults(this.cache.get(cacheKey), query);
        return;
      }

      // Fetch from API
      const response = await fetch(`${this.apiUrl}?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      // Cache results
      this.cache.set(cacheKey, data.results);

      // Display results
      this.displayResults(data.results, query);
    } catch (error) {
      console.error('Search error:', error);
      this.showError('Search failed. Please try again.');
    }
  }

  displayResults(results, query) {
    if (results.length === 0) {
      this.resultsContainer.innerHTML = `
        <div class="search-empty">
          <p>No results found for "${this.escapeHtml(query)}"</p>
        </div>
      `;
      return;
    }

    const resultsHTML = results.map(item => `
      <div class="search-result-item" data-product-id="${item.id}">
        <div class="search-result-info">
          <div class="search-result-name">${this.highlightMatch(item.name, query)}</div>
          <div class="search-result-meta">
            ${item.sku ? `SKU: ${item.sku}` : ''}
            ${item.barcode ? ` • ${item.barcode}` : ''}
            ${item.department_name ? ` • ${item.department_name}` : ''}
          </div>
        </div>
        <div class="search-result-stock">
          ${item.total_stock} ${item.unit || 'units'}
        </div>
      </div>
    `).join('');

    this.resultsContainer.innerHTML = resultsHTML;

    // Add click handlers
    this.resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const productId = item.dataset.productId;
        this.onResultClick(productId);
      });
    });
  }

  onResultClick(productId) {
    // Emit event for result click
    const event = new CustomEvent('searchResultClick', { detail: { productId } });
    document.dispatchEvent(event);

    console.log(`Product clicked: ${productId}`);
    // TODO: Navigate to product details
    
    if (this.isMobile) {
      this.closeMobileSearch();
    }
  }

  showLoading() {
    this.resultsContainer.innerHTML = `
      <div class="search-empty">
        <p>Searching...</p>
      </div>
    `;
  }

  showError(message) {
    this.resultsContainer.innerHTML = `
      <div class="search-empty">
        <p style="color: var(--danger-color);">${this.escapeHtml(message)}</p>
      </div>
    `;
  }

  highlightMatch(text, query) {
    if (!query) return this.escapeHtml(text);
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return this.escapeHtml(text).replace(regex, '<mark>$1</mark>');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  clearCache() {
    this.cache.clear();
  }
}

// Initialize search when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.productSearch = new ProductSearch();
  });
} else {
  window.productSearch = new ProductSearch();
}
