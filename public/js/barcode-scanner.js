/**
 * Barcode Scanner Component
 * Uses html5-qrcode library for camera scanning
 */

class BarcodeScanner {
  constructor() {
    this.scanner = null;
    this.isScanning = false;
    this.isProcessing = false; // Prevent multiple simultaneous scans
    this.currentAction = null;
    this.continuousMode = false;
    this.scannerElement = null;
    this.init();
  }

  init() {
    this.createScannerUI();
    this.createModalUI();
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

  createModalUI() {
    const modalHTML = `
      <!-- Custom Input Modal -->
      <div class="scanner-modal-overlay" id="scanner-input-modal">
        <div class="scanner-modal">
          <div class="scanner-modal-header">
            <h3 id="scanner-modal-title">Input Required</h3>
          </div>
          <div class="scanner-modal-body">
            <p id="scanner-modal-message"></p>
            <input type="text" id="scanner-modal-input" class="form-control" placeholder="">
          </div>
          <div class="scanner-modal-footer">
            <button class="btn btn-secondary" id="scanner-modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="scanner-modal-submit">OK</button>
          </div>
        </div>
      </div>

      <!-- Date Picker Modal -->
      <div class="scanner-modal-overlay" id="scanner-date-modal">
        <div class="scanner-modal">
          <div class="scanner-modal-header">
            <h3 id="scanner-date-title">Select Date</h3>
          </div>
          <div class="scanner-modal-body">
            <p id="scanner-date-message"></p>
            <input type="date" id="scanner-date-input" class="form-control">
          </div>
          <div class="scanner-modal-footer">
            <button class="btn btn-secondary" id="scanner-date-cancel">Cancel</button>
            <button class="btn btn-primary" id="scanner-date-submit">OK</button>
          </div>
        </div>
      </div>

      <!-- Custom Confirm Modal -->
      <div class="scanner-modal-overlay" id="scanner-confirm-modal">
        <div class="scanner-modal">
          <div class="scanner-modal-header">
            <h3 id="scanner-confirm-title">Confirm</h3>
          </div>
          <div class="scanner-modal-body">
            <p id="scanner-confirm-message"></p>
          </div>
          <div class="scanner-modal-footer">
            <button class="btn btn-secondary" id="scanner-confirm-no">No</button>
            <button class="btn btn-primary" id="scanner-confirm-yes">Yes</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add modal styles
    const style = document.createElement('style');
    style.textContent = `
      .scanner-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 6000;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .scanner-modal-overlay.active {
        display: flex;
      }

      .scanner-modal {
        background: white;
        border-radius: 12px;
        max-width: 400px;
        width: 100%;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        animation: modalSlideIn 0.3s ease-out;
      }

      @keyframes modalSlideIn {
        from {
          transform: translateY(-20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      .scanner-modal-header {
        padding: 20px;
        border-bottom: 1px solid #e5e7eb;
      }

      .scanner-modal-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #111827;
      }

      .scanner-modal-body {
        padding: 20px;
      }

      .scanner-modal-body p {
        margin: 0 0 16px 0;
        color: #374151;
        line-height: 1.5;
        white-space: pre-line;
      }

      .scanner-modal-body .form-control {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 16px;
      }

      .scanner-modal-body .form-control:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
      }

      .scanner-modal-body input[type="date"] {
        min-height: 44px;
        cursor: pointer;
      }

      .scanner-modal-footer {
        padding: 16px 20px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }

      .scanner-modal-footer .btn {
        padding: 10px 20px;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .scanner-modal-footer .btn-secondary {
        background: #f3f4f6;
        color: #374151;
        border: none;
      }

      .scanner-modal-footer .btn-secondary:hover {
        background: #e5e7eb;
      }

      .scanner-modal-footer .btn-primary {
        background: #2563eb;
        color: white;
        border: none;
      }

      .scanner-modal-footer .btn-primary:hover {
        background: #1d4ed8;
      }
    `;
    document.head.appendChild(style);
  }

  showInputModal(title, message, placeholder = '', defaultValue = '') {
    return new Promise((resolve) => {
      const modal = document.getElementById('scanner-input-modal');
      const titleEl = document.getElementById('scanner-modal-title');
      const messageEl = document.getElementById('scanner-modal-message');
      const input = document.getElementById('scanner-modal-input');
      const submitBtn = document.getElementById('scanner-modal-submit');
      const cancelBtn = document.getElementById('scanner-modal-cancel');

      titleEl.textContent = title;
      messageEl.textContent = message;
      input.placeholder = placeholder;
      input.value = defaultValue;
      modal.classList.add('active');
      
      setTimeout(() => input.focus(), 100);

      const handleSubmit = () => {
        const value = input.value.trim();
        modal.classList.remove('active');
        cleanup();
        resolve(value || null);
      };

      const handleCancel = () => {
        modal.classList.remove('active');
        cleanup();
        resolve(null);
      };

      const handleKeyPress = (e) => {
        if (e.key === 'Enter') handleSubmit();
        if (e.key === 'Escape') handleCancel();
      };

      const cleanup = () => {
        submitBtn.removeEventListener('click', handleSubmit);
        cancelBtn.removeEventListener('click', handleCancel);
        input.removeEventListener('keypress', handleKeyPress);
      };

      submitBtn.addEventListener('click', handleSubmit);
      cancelBtn.addEventListener('click', handleCancel);
      input.addEventListener('keypress', handleKeyPress);
    });
  }

  showDateModal(title, message, defaultDate = '') {
    return new Promise((resolve) => {
      const modal = document.getElementById('scanner-date-modal');
      const titleEl = document.getElementById('scanner-date-title');
      const messageEl = document.getElementById('scanner-date-message');
      const input = document.getElementById('scanner-date-input');
      const submitBtn = document.getElementById('scanner-date-submit');
      const cancelBtn = document.getElementById('scanner-date-cancel');

      titleEl.textContent = title;
      messageEl.textContent = message;
      
      // Set default date (today if not provided)
      if (!defaultDate) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        defaultDate = `${year}-${month}-${day}`;
      }
      
      input.value = defaultDate;
      modal.classList.add('active');
      
      // Auto-focus triggers calendar on mobile
      setTimeout(() => input.focus(), 100);

      const handleSubmit = () => {
        const value = input.value.trim();
        modal.classList.remove('active');
        cleanup();
        resolve(value || null);
      };

      const handleCancel = () => {
        modal.classList.remove('active');
        cleanup();
        resolve(null);
      };

      const handleKeyPress = (e) => {
        if (e.key === 'Enter') handleSubmit();
        if (e.key === 'Escape') handleCancel();
      };

      const cleanup = () => {
        submitBtn.removeEventListener('click', handleSubmit);
        cancelBtn.removeEventListener('click', handleCancel);
        input.removeEventListener('keypress', handleKeyPress);
      };

      submitBtn.addEventListener('click', handleSubmit);
      cancelBtn.addEventListener('click', handleCancel);
      input.addEventListener('keypress', handleKeyPress);
    });
  }

  showConfirmModal(title, message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('scanner-confirm-modal');
      const titleEl = document.getElementById('scanner-confirm-title');
      const messageEl = document.getElementById('scanner-confirm-message');
      const yesBtn = document.getElementById('scanner-confirm-yes');
      const noBtn = document.getElementById('scanner-confirm-no');

      titleEl.textContent = title;
      messageEl.textContent = message;
      modal.classList.add('active');

      const handleYes = () => {
        modal.classList.remove('active');
        cleanup();
        resolve(true);
      };

      const handleNo = () => {
        modal.classList.remove('active');
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        yesBtn.removeEventListener('click', handleYes);
        noBtn.removeEventListener('click', handleNo);
      };

      yesBtn.addEventListener('click', handleYes);
      noBtn.addEventListener('click', handleNo);
    });
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

    // Reset processing flag
    this.isProcessing = false;

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
    this.isProcessing = false;
    this.scanner = null;
    this.currentAction = null;
    this.continuousMode = false;
    this.scannerElement.classList.remove('active');
    console.log('Scanner closed');
  }

  async handleScanResult(barcode) {
    // Prevent processing if already handling a scan
    if (this.isProcessing) {
      console.log('Already processing a scan, ignoring...');
      return;
    }

    console.log('Processing barcode:', barcode, 'for action:', this.currentAction);
    
    // Set processing flag immediately
    this.isProcessing = true;
    
    // Store action before processing
    const action = this.currentAction;
    const continuous = this.continuousMode;
    
    // Clear manual input
    const manualInput = document.getElementById('manual-barcode-input');
    if (manualInput) {
      manualInput.value = '';
    }
    
    // STOP scanner during user interaction (critical for preventing loop)
    if (this.scanner && this.isScanning) {
      try {
        await this.scanner.pause();
        console.log('Scanner paused for user interaction');
      } catch (err) {
        console.error('Error pausing scanner:', err);
      }
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
      
      // Reset processing flag after completion
      this.isProcessing = false;
      
      // If continuous mode is OFF, close scanner
      if (!continuous) {
        await this.closeScanner();
      } else {
        // Resume scanner for next scan only if continuous mode ON
        if (this.scanner && this.isScanning) {
          try {
            await this.scanner.resume();
            console.log('Scanner resumed for continuous mode');
          } catch (err) {
            console.error('Error resuming scanner:', err);
          }
        }
      }
    } catch (error) {
      console.error('Error processing scan:', error);
      this.isProcessing = false;
      
      // Resume scanner even on error if continuous
      if (continuous && this.scanner && this.isScanning) {
        try {
          await this.scanner.resume();
        } catch (err) {
          console.error('Error resuming scanner:', err);
        }
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
          } else {
            console.error('showProductDetails function not found');
            this.showToast('Error opening product details', 'error');
          }
        }, 800);
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
      
      // Ask for expiration date using DATE PICKER
      const expiryDateInput = await this.showDateModal(
        'Adjust Stock',
        `Product: ${product.name}\n\nSelect expiration date:`
      );
      
      if (!expiryDateInput) {
        this.showToast('Adjustment cancelled', 'info');
        return;
      }
      
      const normalizeDate = (val) => {
        if (!val) return null;
        // Convert to Date object first for consistent handling
        let date;
        if (val instanceof Date) {
          date = val;
        } else {
          date = new Date(val);
        }
        
        // Check if valid date
        if (isNaN(date.getTime())) {
          console.error('Invalid date:', val);
          return null;
        }
        
        // Format as YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
      };
      
      const targetDate = normalizeDate(expiryDateInput.trim());
      console.log('Target date:', targetDate);
      
      // Check if batch with this date exists (compare only date part)
      const matchingBatch = batches.find(b => {
        const batchDate = normalizeDate(b.expiry_date);
        console.log('Comparing batch date:', b.expiry_date, '→', batchDate, 'with target:', targetDate);
        return batchDate === targetDate;
      });
      
      if (matchingBatch) {
        // Batch exists - adjust it
        const newQty = await this.showInputModal(
          'Adjust Batch',
          `Batch found with expiry ${targetDate}\nCurrent quantity: ${matchingBatch.quantity}\n\nEnter new quantity:`,
          'Quantity'
        );
        
        if (newQty === null) {
          this.showToast('Adjustment cancelled', 'info');
          return;
        }
        
        const reason = await this.showInputModal(
          'Adjustment Reason',
          'Reason for adjustment:',
          'e.g., Inventory count'
        );
        
        // Call adjust API
        const adjustResponse = await fetch('/api/stock/adjust', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batch_id: matchingBatch.id,
            quantity: parseInt(newQty, 10),
            reason: reason || 'Inventory count',
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
        const qty = await this.showInputModal(
          'Create New Batch',
          `No batch found with expiry ${targetDate}\n\nEnter quantity for new batch:`,
          'Quantity'
        );
        
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

      // Ask if expired or damaged using custom modal
      const reason = await this.showInputModal(
        'Discard Reason',
        `Product: ${product.name}\n\nReason for discard:\n1 = Expired\n2 = Damaged`,
        '1 or 2'
      );
      
      if (!reason) {
        this.showToast('Discard cancelled', 'info');
        return;
      }
      
      const reasonText = reason === '1' ? 'Expired' : 'Damaged';
      
      // Ask for date using DATE PICKER
      const expiryDateInput = await this.showDateModal(
        'Discard Date',
        `Select ${reasonText.toLowerCase()} date:`
      );
      
      if (!expiryDateInput) {
        this.showToast('Discard cancelled', 'info');
        return;
      }
      
      const normalizeDate = (val) => {
        if (!val) return null;
        let date;
        if (val instanceof Date) {
          date = val;
        } else {
          date = new Date(val);
        }
        
        if (isNaN(date.getTime())) {
          console.error('Invalid date:', val);
          return null;
        }
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
      };
      
      const targetDate = normalizeDate(expiryDateInput.trim());
      console.log('Target date:', targetDate);
      
      // Get existing batches
      const batchResponse = await fetch(`/api/products/${product.id}/batches`);
      const batchData = await batchResponse.json();
      const batches = batchData.batches || [];
      
      // Find batch with matching date (compare only date part)
      const matchingBatch = batches.find(b => {
        const batchDate = normalizeDate(b.expiry_date);
        console.log('Comparing batch date:', b.expiry_date, '→', batchDate, 'with target:', targetDate);
        return batchDate === targetDate;
      });
      
      if (matchingBatch) {
        // Batch exists - discard from it
        const qty = await this.showInputModal(
          'Discard Quantity',
          `Batch found with date ${targetDate}\nCurrent quantity: ${matchingBatch.quantity}\n\nEnter quantity to discard:`,
          'Quantity'
        );
        
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
        const qty = await this.showInputModal(
          'Track Discarded Items',
          `No batch with date ${targetDate}\n\nThis will create a negative batch for tracking.\n\nEnter quantity discarded:`,
          'Quantity'
        );
        
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
