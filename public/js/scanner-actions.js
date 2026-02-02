/**
 * Scanner Action Workflows
 * Handles the four main camera-based actions:
 * 1. Add Item
 * 2. Check Stock/Expiration
 * 3. Discard Expired
 * 4. Inventory Adjustment
 */

class ScannerActions {
    constructor(scanner) {
        this.scanner = scanner;
        this.currentAction = null;
    }

    /**
     * Show action menu when camera button is pressed
     */
    showActionMenu() {
        const menu = document.createElement('div');
        menu.className = 'scanner-action-menu';
        menu.innerHTML = `
            <div class="action-menu-overlay">
                <div class="action-menu-content">
                    <h2>Scanner Actions</h2>
                    <div class="action-buttons">
                        <button onclick="scannerActions.startAction('addItem')" class="action-btn">
                            <span class="icon">➕</span>
                            <span class="label">Add Item</span>
                        </button>
                        <button onclick="scannerActions.startAction('checkStock')" class="action-btn">
                            <span class="icon">🔍</span>
                            <span class="label">Check Stock</span>
                        </button>
                        <button onclick="scannerActions.startAction('discard')" class="action-btn">
                            <span class="icon">🗑️</span>
                            <span class="label">Discard Expired</span>
                        </button>
                        <button onclick="scannerActions.startAction('adjust')" class="action-btn">
                            <span class="icon">📝</span>
                            <span class="label">Inventory Adjustment</span>
                        </button>
                    </div>
                    <button onclick="scannerActions.closeActionMenu()" class="close-btn">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(menu);
    }

    closeActionMenu() {
        const menu = document.querySelector('.scanner-action-menu');
        if (menu) menu.remove();
    }

    /**
     * Start a specific action
     */
    async startAction(actionType) {
        this.currentAction = actionType;
        this.closeActionMenu();

        // Show scanner overlay
        this.showScannerOverlay(actionType);

        // Initialize scanner
        await this.scanner.init('scanner-preview', (barcode) => {
            this.handleScan(barcode, actionType);
        });

        // Start scanning
        await this.scanner.start();
    }

    /**
     * Show scanner overlay with instructions
     */
    showScannerOverlay(actionType) {
        const titles = {
            addItem: 'Scan to Add Item',
            checkStock: 'Scan to Check Stock',
            discard: 'Scan to Discard',
            adjust: 'Scan for Adjustment'
        };

        const overlay = document.createElement('div');
        overlay.className = 'scanner-overlay';
        overlay.innerHTML = `
            <div class="scanner-header">
                <h2>${titles[actionType]}</h2>
                <button onclick="scannerActions.cancelScan()" class="close-btn">✕</button>
            </div>
            <div id="scanner-preview"></div>
            <div class="scanner-instructions">
                <p>Point camera at barcode</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    /**
     * Handle barcode scan for each action type
     */
    async handleScan(barcode, actionType) {
        switch (actionType) {
            case 'addItem':
                await this.handleAddItem(barcode);
                break;
            case 'checkStock':
                await this.handleCheckStock(barcode);
                break;
            case 'discard':
                await this.handleDiscard(barcode);
                break;
            case 'adjust':
                await this.handleAdjust(barcode);
                break;
        }
    }

    /**
     * Add Item Workflow
     */
    async handleAddItem(barcode) {
        try {
            // Check if item exists
            const response = await fetch(`/api/products/search?q=${encodeURIComponent(barcode)}`);
            const data = await response.json();

            if (data.products && data.products.length > 0) {
                // Item exists
                this.showMessage('Item already exists', 'warning');
                this.showProductDetails(data.products[0]);
            } else {
                // New item - open add form with pre-filled barcode
                this.closeScannerOverlay();
                this.openAddProductForm(barcode);
            }
        } catch (error) {
            this.showMessage('Error checking product', 'error');
        }
    }

    /**
     * Check Stock Workflow
     */
    async handleCheckStock(barcode) {
        try {
            const response = await fetch(`/api/products/search?q=${encodeURIComponent(barcode)}`);
            const data = await response.json();

            if (data.products && data.products.length > 0) {
                this.showProductDetails(data.products[0]);
            } else {
                this.showMessage('Product not found', 'error');
            }
        } catch (error) {
            this.showMessage('Error loading product', 'error');
        }
    }

    /**
     * Discard Expired Workflow
     */
    async handleDiscard(barcode) {
        try {
            const response = await fetch(`/api/products/search?q=${encodeURIComponent(barcode)}`);
            const data = await response.json();

            if (data.products && data.products.length > 0) {
                this.showDiscardForm(data.products[0]);
            } else {
                this.showMessage('Product not found', 'error');
            }
        } catch (error) {
            this.showMessage('Error loading product', 'error');
        }
    }

    /**
     * Inventory Adjustment Workflow
     */
    async handleAdjust(barcode) {
        try {
            const response = await fetch(`/api/products/search?q=${encodeURIComponent(barcode)}`);
            const data = await response.json();

            if (data.products && data.products.length > 0) {
                this.showAdjustmentForm(data.products[0]);
            } else {
                this.showMessage('Product not found', 'error');
            }
        } catch (error) {
            this.showMessage('Error loading product', 'error');
        }
    }

    /**
     * Show product details popup
     */
    showProductDetails(product) {
        const expiryStatus = product.expiration_date ? 
            this.getExpiryStatus(product.expiration_date) : 'No expiration';

        const popup = document.createElement('div');
        popup.className = 'product-details-popup';
        popup.innerHTML = `
            <div class="popup-overlay">
                <div class="popup-content">
                    <h2>${product.name}</h2>
                    <div class="product-info">
                        <p><strong>SKU:</strong> ${product.sku}</p>
                        <p><strong>Barcode:</strong> ${product.barcode || 'N/A'}</p>
                        <p><strong>Stock:</strong> ${product.quantity} ${product.unit}</p>
                        <p><strong>Location:</strong> ${product.location || 'N/A'}</p>
                        <p><strong>Expiration:</strong> <span class="${expiryStatus.class}">${expiryStatus.text}</span></p>
                    </div>
                    <button onclick="this.closest('.product-details-popup').remove(); scannerActions.resumeScan()" class="btn-primary">OK</button>
                </div>
            </div>
        `;
        this.closeScannerOverlay();
        document.body.appendChild(popup);
    }

    /**
     * Show discard confirmation form
     */
    showDiscardForm(product) {
        const popup = document.createElement('div');
        popup.className = 'discard-form-popup';
        popup.innerHTML = `
            <div class="popup-overlay">
                <div class="popup-content">
                    <h2>Discard ${product.name}</h2>
                    <form id="discardForm">
                        <div class="form-group">
                            <label>Current Stock: ${product.quantity} ${product.unit}</label>
                        </div>
                        <div class="form-group">
                            <label>Reason:</label>
                            <select name="reason" required>
                                <option value="expired">Expired</option>
                                <option value="damaged">Damaged</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Quantity to discard:</label>
                            <input type="number" name="quantity" max="${product.quantity}" min="1" required>
                        </div>
                        <div class="form-group">
                            <label>Notes:</label>
                            <textarea name="notes" rows="3"></textarea>
                        </div>
                        <div class="form-buttons">
                            <button type="submit" class="btn-danger">Discard</button>
                            <button type="button" onclick="this.closest('.discard-form-popup').remove()" class="btn-secondary">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        this.closeScannerOverlay();
        document.body.appendChild(popup);

        // Handle form submission
        document.getElementById('discardForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            await this.submitDiscard(product.id, formData);
            popup.remove();
        });
    }

    /**
     * Show inventory adjustment form
     */
    showAdjustmentForm(product) {
        const popup = document.createElement('div');
        popup.className = 'adjustment-form-popup';
        popup.innerHTML = `
            <div class="popup-overlay">
                <div class="popup-content">
                    <h2>Adjust ${product.name}</h2>
                    <form id="adjustmentForm">
                        <div class="form-group">
                            <label>Current Stock: ${product.quantity} ${product.unit}</label>
                        </div>
                        <div class="form-group">
                            <label>New Quantity:</label>
                            <input type="number" name="new_quantity" min="0" value="${product.quantity}" required>
                        </div>
                        <div class="form-group">
                            <label>Reason:</label>
                            <select name="reason" required>
                                <option value="damaged">Damaged</option>
                                <option value="theft">Theft</option>
                                <option value="found">Found/Discovered</option>
                                <option value="correction">Stock Count Correction</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Notes:</label>
                            <textarea name="notes" rows="3"></textarea>
                        </div>
                        <div class="form-buttons">
                            <button type="submit" class="btn-primary">Update</button>
                            <button type="button" onclick="this.closest('.adjustment-form-popup').remove()" class="btn-secondary">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        this.closeScannerOverlay();
        document.body.appendChild(popup);

        // Handle form submission
        document.getElementById('adjustmentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            await this.submitAdjustment(product.id, formData);
            popup.remove();
        });
    }

    /**
     * Submit discard action
     */
    async submitDiscard(productId, formData) {
        try {
            const response = await fetch(`/api/products/${productId}/discard`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quantity: parseInt(formData.get('quantity')),
                    reason: formData.get('reason'),
                    notes: formData.get('notes')
                })
            });

            if (response.ok) {
                this.showMessage('Item discarded successfully', 'success');
            } else {
                this.showMessage('Failed to discard item', 'error');
            }
        } catch (error) {
            this.showMessage('Error discarding item', 'error');
        }
    }

    /**
     * Submit inventory adjustment
     */
    async submitAdjustment(productId, formData) {
        try {
            const response = await fetch(`/api/products/${productId}/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    new_quantity: parseInt(formData.get('new_quantity')),
                    reason: formData.get('reason'),
                    notes: formData.get('notes')
                })
            });

            if (response.ok) {
                this.showMessage('Inventory adjusted successfully', 'success');
            } else {
                this.showMessage('Failed to adjust inventory', 'error');
            }
        } catch (error) {
            this.showMessage('Error adjusting inventory', 'error');
        }
    }

    /**
     * Helper: Get expiry status
     */
    getExpiryStatus(expirationDate) {
        const today = new Date();
        const expiry = new Date(expirationDate);
        const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 0) {
            return { text: 'Expired', class: 'expired' };
        } else if (daysUntilExpiry <= 7) {
            return { text: `${daysUntilExpiry} days`, class: 'expiring-soon' };
        } else {
            return { text: expiry.toLocaleDateString(), class: 'good' };
        }
    }

    /**
     * Helper: Show message
     */
    showMessage(message, type) {
        const msg = document.createElement('div');
        msg.className = `message-toast ${type}`;
        msg.textContent = message;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
    }

    /**
     * Helper: Open add product form
     */
    openAddProductForm(barcode) {
        // This would trigger the existing add product form
        // with the barcode pre-filled
        if (typeof window.openAddProductModal === 'function') {
            window.openAddProductModal(barcode);
        }
    }

    /**
     * Close scanner overlay
     */
    closeScannerOverlay() {
        const overlay = document.querySelector('.scanner-overlay');
        if (overlay) overlay.remove();
        if (this.scanner) {
            this.scanner.stop();
        }
    }

    /**
     * Cancel scan
     */
    cancelScan() {
        this.closeScannerOverlay();
        this.currentAction = null;
    }

    /**
     * Resume scanning after viewing details
     */
    async resumeScan() {
        if (this.currentAction) {
            await this.startAction(this.currentAction);
        }
    }
}

// Global instance
let scannerActions;

// Initialize on page load
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const scanner = new BarcodeScanner();
        scannerActions = new ScannerActions(scanner);
    });
}
