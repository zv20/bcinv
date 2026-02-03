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
          this.handleScanResult(decodedText);
        },
        (errorMessage) => {
          // Scanning errors are normal, ignore them
        }
      );

      this.isScanning = true;
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
  }

  async handleScanResult(barcode) {
    // Stop scanner
    await this.closeScanner();

    // Process based on action
    switch(this.currentAction) {
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
    }
  }

  async handleAddItem(barcode) {
    // Check if product exists
    try {
      const response = await fetch(`/api/products?search=${encodeURIComponent(barcode)}`);
      const products = await response.json();
      
      const existingProduct = products.find(p => p.sku === barcode);
      
      if (existingProduct) {
        alert(`Product "${existingProduct.name}" already exists!`);
        return;
      }

      // Open add product modal with barcode pre-filled
      if (typeof showAddProductModal === 'function') {
        showAddProductModal();
        setTimeout(() => {
          const barcodeInput = document.getElementById('addProductSku');
          if (barcodeInput) {
            barcodeInput.value = barcode;
            // Focus on product name field
            const nameInput = document.getElementById('addProductName');
            if (nameInput) nameInput.focus();
          }
        }, 100);
      }
    } catch (err) {
      console.error('Error checking product:', err);
      alert('Error checking product. Please try again.');
    }
  }

  async handleCheckStock(barcode) {
    try {
      const response = await fetch(`/api/products?search=${encodeURIComponent(barcode)}`);
      const products = await response.json();
      
      const product = products.find(p => p.sku === barcode);
      
      if (!product) {
        alert('Product not found!');
        return;
      }

      // Get stock for this product
      const stockResponse = await fetch(`/api/stock?product_id=${product.id}`);
      const stock = await stockResponse.json();

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
    } catch (err) {
      console.error('Error checking stock:', err);
      alert('Error checking stock. Please try again.');
    }
  }

  async handleDiscardItem(barcode) {
    try {
      const response = await fetch(`/api/products?search=${encodeURIComponent(barcode)}`);
      const products = await response.json();
      
      const product = products.find(p => p.sku === barcode);
      
      if (!product) {
        alert('Product not found!');
        return;
      }

      // For now, show stock and let user manually discard
      // TODO: Could enhance this with a mobile-optimized discard modal
      alert(`Product found: ${product.name}\n\nPlease use the Stock page to discard items.`);
      
      if (typeof showStock === 'function') {
        showStock();
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Error processing request. Please try again.');
    }
  }

  async handleAdjustStock(barcode) {
    try {
      const response = await fetch(`/api/products?search=${encodeURIComponent(barcode)}`);
      const products = await response.json();
      
      const product = products.find(p => p.sku === barcode);
      
      if (!product) {
        alert('Product not found!');
        return;
      }

      // For now, navigate to stock page
      // TODO: Could enhance this with a mobile-optimized adjust modal
      alert(`Product found: ${product.name}\n\nPlease use the Stock page to adjust quantities.`);
      
      if (typeof showStock === 'function') {
        showStock();
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Error processing request. Please try again.');
    }
  }
}

// Initialize scanner when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.barcodeScanner = new BarcodeScanner();
  });
} else {
  window.barcodeScanner = new BarcodeScanner();
}
