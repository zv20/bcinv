/**
 * Barcode Scanner Component
 * Uses html5-qrcode library for camera scanning
 */

class BarcodeScanner {
  constructor() {
    this.scanner = null;
    this.isScanning = false;
    this.currentAction = null;
    this.continuousMode = false;
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
            <div class="barcode-scanner-header-content">
              <h3 class="barcode-scanner-title">Scan Barcode</h3>
              <div class="barcode-scanner-action-label"></div>
            </div>
            <div class="continuous-toggle">
              <label class="toggle-label">
                <input type="checkbox" id="continuous-scan-toggle" />
                <span class="toggle-slider"></span>
                <span class="toggle-text">Continuous</span>
              </label>
            </div>
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
          
          <div class="barcode-scanner-footer">
            <button class="btn btn-success btn-lg" id="scanner-done-btn">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 20px; height: 20px; margin-right: 8px;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Done
            </button>
          </div>
        </div>
      </div>
      
      <!-- Toast notification -->
      <div class="scanner-toast" id="scanner-toast">
        <span id="scanner-toast-message"></span>
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

    // Done button
    const doneBtn = document.getElementById('scanner-done-btn');
    if (doneBtn) {
      doneBtn.addEventListener('click', () => this.closeScanner());
    }

    // Continuous mode toggle
    const continuousToggle = document.getElementById('continuous-scan-toggle');
    if (continuousToggle) {
      continuousToggle.addEventListener('change', (e) => {
        this.continuousMode = e.target.checked;
        console.log('Continuous mode:', this.continuousMode ? 'ON' : 'OFF');
      });
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

  showToast(message, type = 'success') {
    const toast = document.getElementById('scanner-toast');
    const toastMessage = document.getElementById('scanner-toast-message');
    
    if (toast && toastMessage) {
      toastMessage.textContent = message;
      toast.className = `scanner-toast ${type}`;
      toast.classList.add('show');
      
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  }

  async openScanner(action) {
    this.currentAction = action;
    this.scannerElement.classList.add('active');
    
    console.log('Opening scanner for action:', action);
    
    // Update action label
    const actionLabel = document.querySelector('.barcode-scanner-action-label');
    const actionNames = {
      'add-item': 'Add/Edit Product',
      'adjust-stock': 'Adjust Stock Count',
      'discard-item': 'Discard Item',
      'check-stock': 'Check Item'
    };
    if (actionLabel) {
      actionLabel.textContent = actionNames[action] || 'Scan Item';
    }

    // Reset continuous mode
    const continuousToggle = document.getElementById('continuous-scan-toggle');
    if (continuousToggle) {
      continuousToggle.checked = false;
      this.continuousMode = false;
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
    this.continuousMode = false;
    this.scannerElement.classList.remove('active');
    console.log('Scanner closed');
  }

  async handleScanResult(barcode) {
    console.log('Processing barcode:', barcode, 'for action:', this.currentAction);
    
    // Store action before processing
    const action = this.currentAction;
    const continuous = this.continuousMode;
    
    // Clear manual input
    const manualInput = document.getElementById('manual-barcode-input');
    if (manualInput) {
      manualInput.value = '';
    }
    
    // If NOT continuous mode, pause scanner temporarily
    if (!continuous && this.scanner && this.isScanning) {
      await this.scanner.pause();
    }

    // Process based on action
    try {
      switch(action) {
        case 'add-item':
          await this.handleAddItem(barcode);
          break;
        case 'check-stock':
          await this.handleCheckStock(barcode);
          break;
        case 'discard-item':
          await this.handleDiscardItem(barcode);
          break;
        case 'adjust-stock':
          await this.handleAdjustStock(barcode);
          break;
        default:
          console.error('Unknown action:', action);
      }
      
      // If continuous mode is OFF, close scanner
      if (!continuous) {
        await this.closeScanner();
      } else {
        // Resume scanner for next scan
        if (this.scanner && this.isScanning) {
          await this.scanner.resume();
        }
      }
    } catch (error) {
      console.error('Error processing scan:', error);
      
      // Resume scanner even on error if continuous
      if (continuous && this.scanner && this.isScanning) {
        await this.scanner.resume();
      }
    }
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
      }
      
      const existingProduct = products.find(p => p.sku === barcode || p.barcode === barcode);
      
      if (existingProduct) {
        // Product exists - open EDIT modal
        console.log('Product found, opening EDIT modal:', existingProduct);
        this.showToast(`Editing: ${existingProduct.name}`, 'info');
        
        if (typeof showProducts === 'function') {
          showProducts();
        }
        
        setTimeout(() => {
          if (typeof editProduct === 'function') {
            editProduct(existingProduct);
          }
        }, 300);
        
        return;
      }

      // Product doesn't exist, open ADD modal
      console.log('Product not found, opening ADD modal...');
      this.showToast('Product not found - Add new', 'info');
      
      if (typeof showProducts === 'function') {
        showProducts();
      }
      
      setTimeout(async () => {
        if (typeof showAddProductModal === 'function') {
          await showAddProductModal();
          
          setTimeout(() => {
            const barcodeInput = document.getElementById('addProductSku');
            if (barcodeInput) {
              barcodeInput.value = barcode;
              const nameInput = document.getElementById('addProductName');
              if (nameInput) nameInput.focus();
            }
          }, 500);
        }
      }, 300);
      
    } catch (err) {
      console.error('Error in handleAddItem:', err);
      this.showToast('Error: ' + err.message, 'error');
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
      let products = [];
      if (Array.isArray(data)) {
        products = data;
      } else if (data.products && Array.isArray(data.products)) {
        products = data.products;
      } else if (data.data && Array.isArray(data.data)) {
        products = data.data;
      }
      
      const product = products.find(p => p.sku === barcode || p.barcode === barcode);
      
      if (!product) {
        this.showToast('Product not found!', 'error');
        return;
      }

      this.showToast(`Found: ${product.name}`, 'success');
      
      // Navigate to product detail modal
      if (typeof showProducts === 'function') {
        showProducts();
        
        setTimeout(() => {
          if (typeof showProductDetails === 'function') {
            showProductDetails(product.id);
          }
        }, 500);
      }
      
    } catch (err) {
      console.error('Error in handleCheckStock:', err);
      this.showToast('Error: ' + err.message, 'error');
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
      let products = [];
      if (Array.isArray(data)) {
        products = data;
      } else if (data.products && Array.isArray(data.products)) {
        products = data.products;
      } else if (data.data && Array.isArray(data.data)) {
        products = data.data;
      }
      
      const product = products.find(p => p.sku === barcode || p.barcode === barcode);
      
      if (!product) {
        this.showToast('Product not found!', 'error');
        return;
      }

      // Get existing batches
      const batchResponse = await fetch(`/api/products/${product.id}/batches`);
      const batchData = await batchResponse.json();
      const batches = batchData.batches || [];
      
      // Ask for expiration date
      const expiryDateInput = prompt(`Product: ${product.name}\n\nEnter expiration date (YYYY-MM-DD):`);
      
      if (!expiryDateInput) {
        this.showToast('Adjustment cancelled', 'info');
        return;
      }
      
      const normalizeDate = (val) => {
        if (!val) return null;
        // If it's a Date object
        if (val instanceof Date) {
          return val.toISOString().slice(0, 10);
        }
        // If it's a string like '2026-02-05T00:00:00.000Z' or '2026-02-05'
        return val.toString().slice(0, 10);
      };
      
      const targetDate = normalizeDate(expiryDateInput.trim());
      
      // Check if batch with this date exists (compare only date part)
      const matchingBatch = batches.find(b => normalizeDate(b.expiry_date) === targetDate);
      
      if (matchingBatch) {
        // Batch exists - adjust it
        const newQty = prompt(`Batch found with expiry ${targetDate}\nCurrent quantity: ${matchingBatch.quantity}\n\nEnter new quantity:`);
        
        if (newQty === null) {
          this.showToast('Adjustment cancelled', 'info');
          return;
        }
        
        const reason = prompt('Reason for adjustment:') || 'Inventory count';
        
        // Call adjust API
        const adjustResponse = await fetch('/api/stock/adjust', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batch_id: matchingBatch.id,
            quantity: parseInt(newQty, 10),
            reason: reason,
            notes: `Scanned barcode: ${barcode}`
          })
        });
        
        if (adjustResponse.ok) {
          this.showToast(`✓ Adjusted: ${product.name}`, 'success');
        } else {
          throw new Error('Failed to adjust stock');
        }
      } else {
        // No batch with this date - create new batch
        const qty = prompt(`No batch found with expiry ${targetDate}\n\nEnter quantity for new batch:`);
        
        if (qty === null) {
          this.showToast('Cancelled', 'info');
          return;
        }
        
        // Create new batch
        const createResponse = await fetch(`/api/products/${product.id}/batches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantity: parseInt(qty, 10),
            expiration_date: targetDate,
            notes: `Created via scan - Barcode: ${barcode}`
          })
        });
        
        if (createResponse.ok) {
          this.showToast(`✓ New batch created: ${product.name}`, 'success');
        } else {
          throw new Error('Failed to create batch');
        }
      }
      
    } catch (err) {
      console.error('Error in handleAdjustStock:', err);
      this.showToast('Error: ' + err.message, 'error');
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
      let products = [];
      if (Array.isArray(data)) {
        products = data;
      } else if (data.products && Array.isArray(data.products)) {
        products = data.products;
      } else if (data.data && Array.isArray(data.data)) {
        products = data.data;
      }
      
      const product = products.find(p => p.sku === barcode || p.barcode === barcode);
      
      if (!product) {
        this.showToast('Product not found!', 'error');
        return;
      }

      // Ask if expired or damaged
      const reason = prompt(`Product: ${product.name}\n\nReason for discard:\n1 = Expired\n2 = Damaged`);
      
      if (!reason) {
        this.showToast('Discard cancelled', 'info');
        return;
      }
      
      const reasonText = reason === '1' ? 'Expired' : 'Damaged';
      
      // Ask for date
      const expiryDateInput = prompt(`Enter ${reasonText.toLowerCase()} date (YYYY-MM-DD):`);
      
      if (!expiryDateInput) {
        this.showToast('Discard cancelled', 'info');
        return;
      }
      
      const normalizeDate = (val) => {
        if (!val) return null;
        if (val instanceof Date) {
          return val.toISOString().slice(0, 10);
        }
        return val.toString().slice(0, 10);
      };
      
      const targetDate = normalizeDate(expiryDateInput.trim());
      
      // Get existing batches
      const batchResponse = await fetch(`/api/products/${product.id}/batches`);
      const batchData = await batchResponse.json();
      const batches = batchData.batches || [];
      
      // Find batch with matching date (compare only date part)
      const matchingBatch = batches.find(b => normalizeDate(b.expiry_date) === targetDate);
      
      if (matchingBatch) {
        // Batch exists - discard from it
        const qty = prompt(`Batch found with date ${targetDate}\nCurrent quantity: ${matchingBatch.quantity}\n\nEnter quantity to discard:`);
        
        if (qty === null) {
          this.showToast('Discard cancelled', 'info');
          return;
        }
        
        // Call discard API
        const discardResponse = await fetch('/api/stock/discard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batch_id: matchingBatch.id,
            quantity: parseInt(qty, 10),
            reason: reasonText,
            notes: `Scanned barcode: ${barcode}`
          })
        });
        
        if (discardResponse.ok) {
          this.showToast(`✓ Discarded ${qty} x ${product.name}`, 'success');
        } else {
          throw new Error('Failed to discard stock');
        }
      } else {
        // No batch found - create negative batch for tracking
        const qty = prompt(`No batch with date ${targetDate}\n\nThis will create a negative batch for tracking.\n\nEnter quantity discarded:`);
        
        if (qty === null) {
          this.showToast('Cancelled', 'info');
          return;
        }
        
        // Create batch with negative quantity
        const createResponse = await fetch(`/api/products/${product.id}/batches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantity: -parseInt(qty, 10),
            expiration_date: targetDate,
            notes: `${reasonText} - Never logged. Barcode: ${barcode}`,
            batch_number: `DISCARD-${Date.now()}`
          })
        });
        
        if (createResponse.ok) {
          this.showToast(`✓ Tracked: -${qty} ${product.name}`, 'success');
        } else {
          throw new Error('Failed to create discard record');
        }
      }
      
    } catch (err) {
      console.error('Error in handleDiscardItem:', err);
      this.showToast('Error: ' + err.message, 'error');
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
