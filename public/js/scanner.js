/**
 * Barcode Scanner Integration
 * Uses html5-qrcode library for camera-based scanning
 */

class BarcodeScanner {
    constructor() {
        this.scanner = null;
        this.isScanning = false;
        this.onScanCallback = null;
        this.scannerElement = null;
    }

    /**
     * Initialize the scanner
     * @param {string} elementId - ID of the HTML element to render scanner
     * @param {function} onScan - Callback function when barcode is scanned
     */
    async init(elementId, onScan) {
        this.scannerElement = elementId;
        this.onScanCallback = onScan;

        try {
            // Import Html5Qrcode from CDN (loaded in HTML)
            if (typeof Html5Qrcode === 'undefined') {
                throw new Error('html5-qrcode library not loaded');
            }

            this.scanner = new Html5Qrcode(elementId);
            return true;
        } catch (error) {
            console.error('Scanner initialization failed:', error);
            this.showError('Camera not supported on this device');
            return false;
        }
    }

    /**
     * Start scanning
     */
    async start() {
        if (this.isScanning) return;

        try {
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };

            await this.scanner.start(
                { facingMode: "environment" }, // Use back camera
                config,
                this.onScanSuccess.bind(this),
                this.onScanFailure.bind(this)
            );

            this.isScanning = true;
        } catch (error) {
            console.error('Failed to start scanner:', error);
            
            if (error.name === 'NotAllowedError') {
                this.showError('Camera permission denied. Please allow camera access.');
            } else if (error.name === 'NotFoundError') {
                this.showError('No camera found on this device.');
            } else {
                this.showError('Failed to start camera: ' + error.message);
            }
        }
    }

    /**
     * Stop scanning
     */
    async stop() {
        if (!this.isScanning) return;

        try {
            await this.scanner.stop();
            this.isScanning = false;
        } catch (error) {
            console.error('Failed to stop scanner:', error);
        }
    }

    /**
     * Handle successful scan
     */
    onScanSuccess(decodedText, decodedResult) {
        // Stop scanner temporarily to prevent multiple scans
        this.stop();

        // Vibrate if supported
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }

        // Call the callback function
        if (this.onScanCallback) {
            this.onScanCallback(decodedText, decodedResult);
        }
    }

    /**
     * Handle scan failures (called continuously, so we ignore it)
     */
    onScanFailure(error) {
        // Ignore - this is called when no QR code is in view
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'scanner-error';
        errorDiv.innerHTML = `
            <p>${message}</p>
            <button onclick="this.parentElement.remove()">Close</button>
        `;
        document.body.appendChild(errorDiv);
    }

    /**
     * Request camera permissions
     */
    static async requestPermissions() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            // Stop the stream immediately - we just wanted to request permission
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            console.error('Permission denied:', error);
            return false;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BarcodeScanner;
}
