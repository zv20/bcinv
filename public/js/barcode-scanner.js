/**
 * Barcode Scanner Component
 * Uses html5-qrcode library for camera scanning
 * Optimized for small printed barcodes with visual detection feedback
 * Features: Flashlight toggle, autofocus
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

  // Rest of methods remain the same...
  createModalUI() { /* keeping existing code */ }
  attachEventListeners() { /* keeping existing code */ }
  // ... all other methods unchanged
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.barcodeScanner = new BarcodeScanner();
  });
} else {
  window.barcodeScanner = new BarcodeScanner();
}
