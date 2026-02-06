/**
 * Barcode Scanner Component
 * Uses html5-qrcode library for camera scanning
 * Optimized for small printed barcodes with visual detection feedback
 * Features: Flashlight toggle, autofocus, dual-location support, continuous scanning with modal wait
 */

class BarcodeScanner {
  constructor() {
    this.scanner = null;
    this.isScanning = false;
    this.isProcessing = false;
    this.currentAction = null;
    this.continuousMode = false;
    this.flashlightOn = false;
    this.scannerElement = null;
    this.locations = [];
    this.waitingForModalClose = false;
    this.init();
  }

  init() {
    this.createScannerUI();
    this.createModalUI();
    this.attachEventListeners();
    this.loadLocations();
  }

  async loadLocations() {
    try {
      const response = await fetch('/api/locations');
      if (response.ok) {
        const data = await response.json();
        this.locations = data.locations || data || [];
        console.log('Loaded locations:', this.locations);
      }
    } catch (err) {
      console.error('Error loading locations:', err);
    }
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
          </div>

          <!-- Scanner Controls -->
          <div class="scanner-controls">
            <label class="toggle-label">
              <input type="checkbox" id="flashlight-toggle" />
              <span class="toggle-slider"></span>
              <span class="toggle-text">💡 Flash</span>
            </label>
            
            <label class="toggle-label">
              <input type="checkbox" id="continuous-scan-toggle" />
              <span class="toggle-slider"></span>
              <span class="toggle-text">Continuous</span>
            </label>
          </div>
          
          <div id="barcode-scanner-reader" class="barcode-scanner-reader"></div>
          
          <div class="barcode-scanner-tips">
            <p style="font-size: 12px; color: #666; margin: 8px 0;">💡 Tips: Hold phone 6-10 inches away • Bright light • Align barcode horizontally • Keep very steady</p>
          </div>
          
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

      <style>
        .scanner-controls {
          padding: 12px 16px;
          background: #f8f9fa;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          gap: 20px;
          justify-content: center;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          user-select: none;
        }

        .toggle-label input[type="checkbox"] {
          display: none;
        }

        .toggle-slider {
          position: relative;
          width: 40px;
          height: 22px;
          background: #d1d5db;
          border-radius: 11px;
          transition: background 0.2s;
        }

        .toggle-slider::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 18px;
          height: 18px;
          background: white;
          border-radius: 50%;
          transition: transform 0.2s;
        }

        .toggle-label input[type="checkbox"]:checked + .toggle-slider {
          background: #2563eb;
        }

        .toggle-label input[type="checkbox"]:checked + .toggle-slider::after {
          transform: translateX(18px);
        }

        .toggle-text {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
        }

        @media (max-width: 480px) {
          .scanner-controls {
            padding: 10px 12px;
            gap: 16px;
          }

          .toggle-text {
            font-size: 12px;
          }
        }
      </style>
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

      <!-- Location Selector Modal -->
      <div class="scanner-modal-overlay" id="scanner-location-modal">
        <div class="scanner-modal">
          <div class="scanner-modal-header">
            <h3 id="scanner-location-title">Select Location</h3>
          </div>
          <div class="scanner-modal-body">
            <p id="scanner-location-message"></p>
            <select id="scanner-location-select" class="form-control">
              <option value="">Select a location</option>
            </select>
          </div>
          <div class="scanner-modal-footer">
            <button class="btn btn-secondary" id="scanner-location-cancel">Cancel</button>
            <button class="btn btn-primary" id="scanner-location-submit">OK</button>
          </div>
        </div>
      </div>

      <!-- Button Selection Modal -->
      <div class="scanner-modal-overlay" id="scanner-button-modal">
        <div class="scanner-modal">
          <div class="scanner-modal-header">
            <h3 id="scanner-button-title">Select Option</h3>
          </div>
          <div class="scanner-modal-body">
            <p id="scanner-button-message"></p>
            <div id="scanner-button-options" class="button-options"></div>
          </div>
          <div class="scanner-modal-footer">
            <button class="btn btn-secondary" id="scanner-button-cancel">Cancel</button>
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

      .scanner-modal-body input[type="date"],
      .scanner-modal-body select {
        min-height: 44px;
        cursor: pointer;
      }

      .button-options {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .button-option {
        width: 100%;
        padding: 16px;
        background: #f3f4f6;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 500;
        color: #111827;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .button-option:hover {
        background: #e5e7eb;
        border-color: #2563eb;
      }

      .button-option:active {
        transform: scale(0.98);
      }

      .button-option.danger {
        background: #fee2e2;
        border-color: #fecaca;
        color: #991b1b;
      }

      .button-option.danger:hover {
        background: #fecaca;
        border-color: #dc2626;
      }

      .button-option.warning {
        background: #fed7aa;
        border-color: #fdba74;
        color: #9a3412;
      }

      .button-option.warning:hover {
        background: #fdba74;
        border-color: #ea580c;
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
      
      if (!defaultDate) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        defaultDate = `${year}-${month}-${day}`;
      }
      
      input.value = defaultDate;
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

  showLocationModal(title, message, product = null) {
    return new Promise((resolve) => {
      const modal = document.getElementById('scanner-location-modal');
      const titleEl = document.getElementById('scanner-location-title');
      const messageEl = document.getElementById('scanner-location-message');
      const select = document.getElementById('scanner-location-select');
      const submitBtn = document.getElementById('scanner-location-submit');
      const cancelBtn = document.getElementById('scanner-location-cancel');

      titleEl.textContent = title;
      messageEl.textContent = message;
      
      // Build options with smart defaults
      select.innerHTML = '<option value="">Select a location</option>';
      
      // Add product's default locations first (if they exist)
      const addedLocations = new Set();
      
      if (product) {
        if (product.storage_location_id && product.storage_location_name) {
          const option = document.createElement('option');
          option.value = product.storage_location_id;
          option.textContent = `📦 ${product.storage_location_name} (Storage)`;
          option.selected = true; // Default to storage location
          select.appendChild(option);
          addedLocations.add(product.storage_location_id);
        }
        
        if (product.shelf_location_id && product.shelf_location_name) {
          const option = document.createElement('option');
          option.value = product.shelf_location_id;
          option.textContent = `🏪 ${product.shelf_location_name} (Shelf)`;
          select.appendChild(option);
          addedLocations.add(product.shelf_location_id);
          
          // If no storage location, default to shelf
          if (!product.storage_location_id) {
            option.selected = true;
          }
        }
        
        // Add separator if we added any product locations
        if (addedLocations.size > 0) {
          const separator = document.createElement('option');
          separator.disabled = true;
          separator.textContent = '───────────────';
          select.appendChild(separator);
        }
      }
      
      // Add all other locations
      this.locations.forEach(loc => {
        if (!addedLocations.has(loc.id)) {
          const option = document.createElement('option');
          option.value = loc.id;
          option.textContent = loc.name;
          select.appendChild(option);
        }
      });
      
      modal.classList.add('active');
      setTimeout(() => select.focus(), 100);

      const handleSubmit = () => {
        const value = select.value;
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
        select.removeEventListener('keypress', handleKeyPress);
      };

      submitBtn.addEventListener('click', handleSubmit);
      cancelBtn.addEventListener('click', handleCancel);
      select.addEventListener('keypress', handleKeyPress);
    });
  }

  showButtonModal(title, message, buttons) {
    return new Promise((resolve) => {
      const modal = document.getElementById('scanner-button-modal');
      const titleEl = document.getElementById('scanner-button-title');
      const messageEl = document.getElementById('scanner-button-message');
      const optionsContainer = document.getElementById('scanner-button-options');
      const cancelBtn = document.getElementById('scanner-button-cancel');

      titleEl.textContent = title;
      messageEl.textContent = message;
      
      optionsContainer.innerHTML = '';
      
      buttons.forEach(button => {
        const btnEl = document.createElement('button');
        btnEl.className = `button-option ${button.style || ''}`;
        btnEl.innerHTML = `${button.icon || ''} ${button.label}`;
        btnEl.addEventListener('click', () => {
          modal.classList.remove('active');
          cleanup();
          resolve(button.value);
        });
        optionsContainer.appendChild(btnEl);
      });
      
      modal.classList.add('active');

      const handleCancel = () => {
        modal.classList.remove('active');
        cleanup();
        resolve(null);
      };

      const cleanup = () => {
        cancelBtn.removeEventListener('click', handleCancel);
        optionsContainer.innerHTML = '';
      };

      cancelBtn.addEventListener('click', handleCancel);
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

  // Helper to wait for Bootstrap modal to close
  waitForBootstrapModal(modalId) {
    return new Promise((resolve) => {
      const modalElement = document.getElementById(modalId);
      if (!modalElement) {
        resolve();
        return;
      }

      const handleHidden = () => {
        modalElement.removeEventListener('hidden.bs.modal', handleHidden);
        console.log('✓ Bootstrap modal closed:', modalId);
        resolve();
      };

      modalElement.addEventListener('hidden.bs.modal', handleHidden);
      
      // Fallback timeout in case modal is already closed
      setTimeout(() => {
        if (!modalElement.classList.contains('show')) {
          modalElement.removeEventListener('hidden.bs.modal', handleHidden);
          resolve();
        }
      }, 500);
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
        if (this.continuousMode) {
          this.showToast('🔄 Continuous mode ON - Scan multiple items', 'info');
        }
      });
    }

    // Flashlight toggle
    const flashToggle = document.getElementById('flashlight-toggle');
    if (flashToggle) {
      flashToggle.addEventListener('change', async (e) => {
        this.flashlightOn = e.target.checked;
        await this.toggleFlashlight(this.flashlightOn);
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

  async toggleFlashlight(on) {
    if (!this.scanner || !this.isScanning) return;

    try {
      const track = this.scanner.getRunningTrackCameraCapabilities();
      if (track && track.torch) {
        await track.applyConstraints({
          advanced: [{ torch: on }]
        });
        console.log('Flashlight:', on ? 'ON' : 'OFF');
        this.showToast(on ? '💡 Flashlight ON' : 'Flashlight OFF', 'info');
      } else {
        console.log('Flashlight not supported on this device');
        this.showToast('Flashlight not available', 'warning');
        const flashToggle = document.getElementById('flashlight-toggle');
        if (flashToggle) flashToggle.checked = false;
      }
    } catch (err) {
      console.error('Error toggling flashlight:', err);
      this.showToast('Could not control flashlight', 'error');
    }
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

    const continuousToggle = document.getElementById('continuous-scan-toggle');
    if (continuousToggle) {
      continuousToggle.checked = false;
      this.continuousMode = false;
    }

    const flashToggle = document.getElementById('flashlight-toggle');
    if (flashToggle) {
      flashToggle.checked = false;
      this.flashlightOn = false;
    }

    const manualInput = document.getElementById('manual-barcode-input');
    if (manualInput) {
      manualInput.value = '';
    }

    this.isProcessing = false;
    this.waitingForModalClose = false;
    await this.startCamera();
  }

  async startCamera() {
    if (this.isScanning) return;

    try {
      if (typeof Html5Qrcode === 'undefined') {
        console.error('html5-qrcode library not loaded');
        alert('Scanner library not loaded. Please refresh the page.');
        return;
      }

      this.scanner = new Html5Qrcode('barcode-scanner-reader', {
        verbose: false
      });
      
      const config = {
        fps: 20,
        qrbox: { width: 300, height: 150 },
        disableFlip: false,
        videoConstraints: {
          facingMode: 'environment',
          focusMode: 'continuous',
          advanced: [
            { focusMode: 'continuous' },
            { focusDistance: 0 }
          ]
        },
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };

      const cameraConfig = { facingMode: 'environment' };

      console.log('Starting camera with autofocus...');

      await this.scanner.start(
        cameraConfig,
        config,
        (decodedText, decodedResult) => {
          console.log('✅ Barcode detected!', decodedText);
          console.log('Format:', decodedResult.result.format);
          this.handleScanResult(decodedText);
        },
        (errorMessage) => {}
      );

      this.isScanning = true;
      console.log('Camera started with autofocus');
      this.showToast('Camera ready', 'info');
    } catch (err) {
      console.error('Error starting camera:', err);
      
      let errorMsg = 'Unable to access camera. ';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg += 'Please allow camera permissions.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg += 'No camera found.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg += 'Camera in use by another app.';
      } else {
        errorMsg += 'Please use manual entry.';
      }
      
      alert(errorMsg);
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
    this.flashlightOn = false;
    this.waitingForModalClose = false;
    this.scannerElement.classList.remove('active');
    console.log('Scanner closed');
  }

  async handleScanResult(barcode) {
    if (this.isProcessing) {
      console.log('Already processing a scan, ignoring...');
      return;
    }

    console.log('Processing barcode:', barcode, 'for action:', this.currentAction);
    
    this.isProcessing = true;
    const action = this.currentAction;
    const continuous = this.continuousMode;
    
    const manualInput = document.getElementById('manual-barcode-input');
    if (manualInput) {
      manualInput.value = '';
    }
    
    // Pause scanner during action processing
    if (this.scanner && this.isScanning) {
      try {
        await this.scanner.pause();
        console.log('Scanner paused for user interaction');
      } catch (err) {
        console.error('Error pausing scanner:', err);
      }
    }

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
      
      this.isProcessing = false;
      
      if (!continuous) {
        console.log('Single scan mode - closing scanner');
        await this.closeScanner();
      } else {
        console.log('Continuous mode - waiting for modals to close before resuming');
        // Wait a bit for any modals to finish animating
        setTimeout(async () => {
          if (this.scanner && this.isScanning && !this.waitingForModalClose) {
            try {
              await this.scanner.resume();
              console.log('✓ Scanner resumed for next scan');
              this.showToast('Ready for next scan', 'info');
            } catch (err) {
              console.error('Error resuming scanner:', err);
            }
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error processing scan:', error);
      this.isProcessing = false;
      
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
    this.waitingForModalClose = true;
    
    try {
      const response = await fetch(`/api/products?search=${encodeURIComponent(barcode)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
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
        console.log('Product found, opening EDIT modal:', existingProduct);
        this.showToast(`Editing: ${existingProduct.name}`, 'info');
        
        if (typeof showProducts === 'function') {
          showProducts();
        }
        
        setTimeout(() => {
          if (typeof editProduct === 'function') {
            editProduct(existingProduct);
          }
          
          // Wait for edit modal to close in continuous mode
          if (this.continuousMode) {
            this.waitForBootstrapModal('editProductModal').then(() => {
              this.waitingForModalClose = false;
              console.log('Edit modal closed - ready for next scan');
            });
          } else {
            this.waitingForModalClose = false;
          }
        }, 300);
        
        return;
      }

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
          
          // Wait for add modal to close in continuous mode
          if (this.continuousMode) {
            this.waitForBootstrapModal('addProductModal').then(() => {
              this.waitingForModalClose = false;
              console.log('Add modal closed - ready for next scan');
            });
          } else {
            this.waitingForModalClose = false;
          }
        }
      }, 300);
      
    } catch (err) {
      console.error('Error in handleAddItem:', err);
      this.showToast('Error: ' + err.message, 'error');
      this.waitingForModalClose = false;
    }
  }

  async handleCheckStock(barcode) {
    console.log('handleCheckStock called with barcode:', barcode);
    this.waitingForModalClose = true;
    
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
        this.waitingForModalClose = false;
        return;
      }

      this.showToast(`Found: ${product.name}`, 'success');
      
      if (typeof showProducts === 'function') {
        showProducts();
        
        setTimeout(() => {
          if (typeof showProductDetails === 'function') {
            showProductDetails(product.id);
            
            // Wait for product details modal to close in continuous mode
            if (this.continuousMode) {
              this.waitForBootstrapModal('productDetailsModal').then(() => {
                this.waitingForModalClose = false;
                console.log('Product details modal closed - ready for next scan');
              });
            } else {
              this.waitingForModalClose = false;
            }
          } else {
            console.error('showProductDetails function not found');
            this.showToast('Error opening product details', 'error');
            this.waitingForModalClose = false;
          }
        }, 800);
      } else {
        this.waitingForModalClose = false;
      }
      
    } catch (err) {
      console.error('Error in handleCheckStock:', err);
      this.showToast('Error: ' + err.message, 'error');
      this.waitingForModalClose = false;
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

      const batchResponse = await fetch(`/api/products/${product.id}/batches`);
      const batchData = await batchResponse.json();
      const batches = batchData.batches || [];
      
      const expiryDateInput = await this.showDateModal(
        'Adjust Stock',
        `Product: ${product.name}\n\nSelect expiration date:`
      );
      
      if (!expiryDateInput) {
        this.showToast('Adjustment cancelled', 'info');
        return;
      }
      
      const targetDate = expiryDateInput;
      console.log('Target date:', targetDate);
      
      const normalizeDate = (val) => {
        if (!val) return null;
        if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return val;
        }
        const date = new Date(val);
        if (isNaN(date.getTime())) {
          console.error('Invalid date:', val);
          return null;
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const matchingBatch = batches.find(b => {
        const batchDate = normalizeDate(b.expiry_date);
        console.log('Comparing batch date:', b.expiry_date, '→', batchDate, 'with target:', targetDate);
        return batchDate === targetDate;
      });
      
      if (matchingBatch) {
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
        // No matching batch - create new batch with location selector
        const qty = await this.showInputModal(
          'Create New Batch',
          `No batch found with expiry ${targetDate}\n\nEnter quantity for new batch:`,
          'Quantity'
        );
        
        if (qty === null) {
          this.showToast('Cancelled', 'info');
          return;
        }
        
        // Get product details with location info
        const productDetailResponse = await fetch(`/api/products/${product.id}`);
        const productDetail = await productDetailResponse.json();
        
        // Show location selector with product's default locations
        const locationId = await this.showLocationModal(
          'Select Location',
          `Where is this batch stored?`,
          productDetail
        );
        
        if (locationId === null) {
          this.showToast('Cancelled', 'info');
          return;
        }
        
        const createResponse = await fetch(`/api/products/${product.id}/batches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantity: parseInt(qty, 10),
            expiration_date: targetDate,
            location_id: locationId || null,
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

      const reason = await this.showButtonModal(
        'Discard Reason',
        `Product: ${product.name}\n\nWhy are you discarding this item?`,
        [
          { label: '📅 Expired', value: '1', style: 'danger' },
          { label: '⚠️ Damaged', value: '2', style: 'warning' }
        ]
      );
      
      if (!reason) {
        this.showToast('Discard cancelled', 'info');
        return;
      }
      
      const reasonText = reason === '1' ? 'Expired' : 'Damaged';
      
      const expiryDateInput = await this.showDateModal(
        'Discard Date',
        `Select ${reasonText.toLowerCase()} date:`
      );
      
      if (!expiryDateInput) {
        this.showToast('Discard cancelled', 'info');
        return;
      }
      
      const targetDate = expiryDateInput;
      console.log('Target date:', targetDate);
      
      const normalizeDate = (val) => {
        if (!val) return null;
        if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return val;
        }
        const date = new Date(val);
        if (isNaN(date.getTime())) {
          console.error('Invalid date:', val);
          return null;
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const batchResponse = await fetch(`/api/products/${product.id}/batches`);
      const batchData = await batchResponse.json();
      const batches = batchData.batches || [];
      
      const matchingBatch = batches.find(b => {
        const batchDate = normalizeDate(b.expiry_date);
        console.log('Comparing batch date:', b.expiry_date, '→', batchDate, 'with target:', targetDate);
        return batchDate === targetDate;
      });
      
      if (matchingBatch) {
        const qty = await this.showInputModal(
          'Discard Quantity',
          `Batch found with date ${targetDate}\nCurrent quantity: ${matchingBatch.quantity}\n\nEnter quantity to discard:`,
          'Quantity'
        );
        
        if (qty === null) {
          this.showToast('Discard cancelled', 'info');
          return;
        }
        
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
        const qty = await this.showInputModal(
          'Track Discarded Items',
          `No batch with date ${targetDate}\n\nThis will create a negative batch for tracking.\n\nEnter quantity discarded:`,
          'Quantity'
        );
        
        if (qty === null) {
          this.showToast('Cancelled', 'info');
          return;
        }
        
        // Get product details with location info
        const productDetailResponse = await fetch(`/api/products/${product.id}`);
        const productDetail = await productDetailResponse.json();
        
        // Show location selector for discard tracking
        const locationId = await this.showLocationModal(
          'Select Location',
          `Where was this item located?`,
          productDetail
        );
        
        if (locationId === null) {
          this.showToast('Cancelled', 'info');
          return;
        }
        
        const createResponse = await fetch(`/api/products/${product.id}/batches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantity: -parseInt(qty, 10),
            expiration_date: targetDate,
            location_id: locationId || null,
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing barcode scanner...');
    window.barcodeScanner = new BarcodeScanner();
  });
} else {
  console.log('Initializing barcode scanner...');
  window.barcodeScanner = new BarcodeScanner();
}
