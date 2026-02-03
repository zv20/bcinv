/**
 * Barcode Scanner Component
 * Uses html5-qrcode library for camera scanning
 */

class BarcodeScanner {
  constructor() {
    this.scanner = null;
    this.isScanning = false;
    this.currentAction = null;
    this.scannerElement = null;
    this.init();
  }

  init() {
    this.createScannerUI();
    this.attachEventListeners();
  }

  createScannerUI() {
    const scannerHTML = `
      <div class="barcode-scanner-overlay">
        <div class="barcode-scanner-container">
          <div class="barcode-scanner-header">
            <button class="barcode-scanner-close" aria-label="Close scanner">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
            <h3 class="barcode-scanner-title">Scan Barcode</h3>
            <div class="barcode-scanner-action-label"></div>
          </div>
          
          <div id="barcode-scanner-reader" class="barcode-scanner-reader"></div>
          
          <div class="barcode-scanner-instructions">
            <p>Position barcode within the frame</p>
            <div class="barcode-scanner-manual">
              <input type="text" 
                     id="manual-barcode-input" 
                     class="form-control" 
                     placeholder="Or enter barcode manually" 
                     autocomplete="off">
              <button class="btn btn-primary" id="manual-barcode-submit">Submit</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', scannerHTML);
    this.scannerElement = document.querySelector('.barcode-scanner-overlay');
  }

  attachEventListeners() {
    // Close button
    const closeBtn = document.querySelector('.barcode-scanner-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeScanner());
    }

    // Manual barcode entry
    const manualInput = document.getElementById('manual-barcode-input');
    const manualSubmit = document.getElementById('manual-barcode-submit');
    
    if (manualSubmit) {
      manualSubmit.addEventListener('click', () => {
        const barcode = manualInput.value.trim();
        if (barcode) {
          this.handleScanResult(barcode);
        }
      });
    }

    if (manualInput) {
      manualInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const barcode = manualInput.value.trim();
          if (barcode) {
            this.handleScanResult(barcode);
          }
        }
      });
    }

    // Listen for camera action events
    document.addEventListener('cameraAction', (e) => {
      this.openScanner(e.detail.action);
    });
  }

  async openScanner(action) {
    this.currentAction = action;
    this.scannerElement.classList.add('active');
    
    console.log('Opening scanner for action:', action);
    
    // Update action label
    const actionLabel = document.querySelector('.barcode-scanner-action-label');
    const actionNames = {
      'add-item': 'Add New Product',
      'check-stock': 'Check Stock Levels',
      'discard-item': 'Discard Expired Item',
      'adjust-stock': 'Adjust Stock Count'
    };
    if (actionLabel) {
      actionLabel.textContent = actionNames[action] || 'Scan Item';
    }

    // Clear manual input
    const manualInput = document.getElementById('manual-barcode-input');
    if (manualInput) {
      manualInput.value = '';
    }

    // Start camera
    await this.startCamera();
  }

  async startCamera() {
    if (this.isScanning) return;

    try {
      // Import html5-qrcode dynamically
      if (typeof Html5Qrcode === 'undefined') {
        console.error('html5-qrcode library not loaded');
        alert('Scanner library not loaded. Please refresh the page.');
        return;
      }

      this.scanner = new Html5Qrcode('barcode-scanner-reader');
      
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.7777778
      };

      await this.scanner.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          console.log('Barcode detected:', decodedText);
          this.handleScanResult(decodedText);
        },
        (errorMessage) => {
          // Scanning errors are normal, ignore them
        }
      );

      this.isScanning = true;
      console.log('Camera started successfully');
    } catch (err) {
      console.error('Error starting camera:', err);
      alert('Unable to access camera. Please check permissions or use manual entry.');
    }
  }

  async closeScanner() {
    if (this.scanner && this.isScanning) {
      try {
        await this.scanner.stop();
        this.scanner.clear();
      } catch (err) {
        console.error('Error stopping camera:', err);
      }
    }

    this.isScanning = false;
    this.scanner = null;
    this.currentAction = null;
    this.scannerElement.classList.remove('active');
    console.log('Scanner closed');
  }

  async handleScanResult(barcode) {
    console.log('Processing barcode:', barcode, 'for action:', this.currentAction);
    
    // Store action before closing
    const action = this.currentAction;
    
    // Stop scanner first
    await this.closeScanner();

    // Small delay to ensure scanner is fully closed
    setTimeout(() => {
      // Process based on action
      switch(action) {
        case 'add-item':
          this.handleAddItem(barcode);
          break;
        case 'check-stock':
          this.handleCheckStock(barcode);
          break;
        case 'discard-item':
          this.handleDiscardItem(barcode);
          break;
        case 'adjust-stock':
          this.handleAdjustStock(barcode);
          break;
        default:
          console.error('Unknown action:', action);
      }
    }, 300);
  }

  async handleAddItem(barcode) {
    console.log('handleAddItem called with barcode:', barcode);
    
    try {
      // Check if product exists
      const response = await fetch(`/api/products?search=${encodeURIComponent(barcode)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
      // Handle different response formats
      let products = [];
      if (Array.isArray(data)) {
        products = data;
      } else if (data.products && Array.isArray(data.products)) {
        products = data.products;
      } else if (data.data && Array.isArray(data.data)) {
        products = data.data;
      } else {
        console.error('Unexpected API response format:', data);
        throw new Error('Invalid API response format');
      }
      
      console.log('Products array:', products);
      
      const existingProduct = products.find(p => p.sku === barcode);
      
      if (existingProduct) {
        alert(`Product "${existingProduct.name}" already exists!\n\nBarcode: ${barcode}`);
        return;
      }

      // Product doesn't exist, open add modal
      console.log('Opening add product modal...');
      
      // Check if function exists
      if (typeof showAddProductModal !== 'function') {
        console.error('showAddProductModal function not found');
        alert('Error: Cannot open add product form. Please refresh the page.');
        return;
      }
      
      // Open modal
      showAddProductModal();
      
      // Wait a bit for modal to render, then fill in barcode
      setTimeout(() => {
        const barcodeInput = document.getElementById('addProductSku');
        if (barcodeInput) {
          barcodeInput.value = barcode;
          console.log('Barcode filled in:', barcode);
          
          // Focus on product name field
          const nameInput = document.getElementById('addProductName');
          if (nameInput) {
            nameInput.focus();
            console.log('Focused on name input');
          }
        } else {
          console.error('Could not find barcode input field');
        }
      }, 500);
      
    } catch (err) {
      console.error('Error in handleAddItem:', err);
      alert('Error checking product: ' + err.message + '\n\nPlease try again or add manually.');
    }
  }

  async handleCheckStock(barcode) {
    console.log('handleCheckStock called with barcode:', barcode);
    
    try {
      const response = await fetch(`/api/products?search=${encodeURIComponent(barcode)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
      // Handle different response formats
      let products = [];
      if (Array.isArray(data)) {
        products = data;
      } else if (data.products && Array.isArray(data.products)) {
        products = data.products;
      } else if (data.data && Array.isArray(data.data)) {
        products = data.data;
      } else {
        console.error('Unexpected API response format:', data);
        throw new Error('Invalid API response format');
      }
      
      const product = products.find(p => p.sku === barcode);
      
      if (!product) {
        alert('Product not found!\n\nBarcode: ' + barcode);
        return;
      }

      // Get stock for this product
      const stockResponse = await fetch(`/api/stock?product_id=${product.id}`);
      
      if (!stockResponse.ok) {
        throw new Error(`HTTP error! status: ${stockResponse.status}`);
      }
      
      const stockData = await stockResponse.json();
      console.log('Stock API Response:', stockData);
      
      // Handle stock response format
      let stock = [];
      if (Array.isArray(stockData)) {
        stock = stockData;
      } else if (stockData.stock && Array.isArray(stockData.stock)) {
        stock = stockData.stock;
      } else if (stockData.data && Array.isArray(stockData.data)) {
        stock = stockData.data;
      }

      let message = `Product: ${product.name}\n`;
      message += `Barcode: ${product.sku}\n\n`;
      
      if (stock.length === 0) {
        message += 'No stock available';
      } else {
        const totalQty = stock.reduce((sum, s) => sum + parseFloat(s.quantity || 0), 0);
        message += `Total Quantity: ${totalQty}\n\n`;
        message += 'Batches:\n';
        stock.forEach(s => {
          message += `- Location: ${s.location_name || 'N/A'}\n`;
          message += `  Qty: ${s.quantity}, Expires: ${s.expiry_date || 'N/A'}\n`;
        });
      }

      alert(message);
      console.log('Stock check complete');
    } catch (err) {
      console.error('Error in handleCheckStock:', err);
      alert('Error checking stock: ' + err.message);
    }
  }

  async handleDiscardItem(barcode) {
    console.log('handleDiscardItem called with barcode:', barcode);
    
    try {
      const response = await fetch(`/api/products?search=${encodeURIComponent(barcode)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle different response formats
      let products = [];
      if (Array.isArray(data)) {
        products = data;
      } else if (data.products && Array.isArray(data.products)) {
        products = data.products;
      } else if (data.data && Array.isArray(data.data)) {
        products = data.data;
      }
      
      const product = products.find(p => p.sku === barcode);
      
      if (!product) {
        alert('Product not found!\n\nBarcode: ' + barcode);
        return;
      }

      // For now, show stock and let user manually discard
      alert(`Product found: ${product.name}\n\nPlease use the Stock page to discard items.`);
      
      if (typeof showStock === 'function') {
        showStock();
      }
    } catch (err) {
      console.error('Error in handleDiscardItem:', err);
      alert('Error: ' + err.message);
    }
  }

  async handleAdjustStock(barcode) {
    console.log('handleAdjustStock called with barcode:', barcode);
    
    try {
      const response = await fetch(`/api/products?search=${encodeURIComponent(barcode)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle different response formats
      let products = [];
      if (Array.isArray(data)) {
        products = data;
      } else if (data.products && Array.isArray(data.products)) {
        products = data.products;
      } else if (data.data && Array.isArray(data.data)) {
        products = data.data;
      }
      
      const product = products.find(p => p.sku === barcode);
      
      if (!product) {
        alert('Product not found!\n\nBarcode: ' + barcode);
        return;
      }

      // For now, navigate to stock page
      alert(`Product found: ${product.name}\n\nPlease use the Stock page to adjust quantities.`);
      
      if (typeof showStock === 'function') {
        showStock();
      }
    } catch (err) {
      console.error('Error in handleAdjustStock:', err);
      alert('Error: ' + err.message);
    }
  }
}

// Initialize scanner when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing barcode scanner...');
    window.barcodeScanner = new BarcodeScanner();
  });
} else {
  console.log('Initializing barcode scanner...');
  window.barcodeScanner = new BarcodeScanner();
}
