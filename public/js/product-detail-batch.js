/**
 * Product Detail Batch UI
 * Displays and manages batches in product detail view
 * Sprint 4 - Issue #1
 */

class ProductDetailBatch {
    constructor(productId) {
        this.productId = productId;
        this.batchManager = new BatchManager();
        this.batchOperations = new BatchOperations();
        this.container = null;
    }

    /**
     * Initialize batch UI in product detail
     */
    async init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Batch container not found');
            return;
        }

        await this.render();
        this.attachEventListeners();
    }

    /**
     * Render batch section
     */
    async render() {
        this.container.innerHTML = '<div class="batch-loading"><div class="batch-loading-spinner"></div><p>Loading batches...</p></div>';

        try {
            // Load batches
            const batches = await this.batchManager.loadBatches(this.productId);
            const summary = await this.batchOperations.getBatchSummary(this.productId);

            // Build HTML
            let html = `
                <div class="batch-section">
                    <h3>
                        Batch/Lot Tracking
                        <span class="fifo-badge">FIFO</span>
                        <button class="btn-add-batch" id="btnAddBatch">
                            + Add Batch
                        </button>
                    </h3>
            `;

            // Summary
            if (summary) {
                html += `
                    <div class="batch-summary">
                        <div class="batch-summary-item">
                            <span class="label">Total Batches</span>
                            <span class="value">${summary.totalBatches}</span>
                        </div>
                        <div class="batch-summary-item">
                            <span class="label">Total Quantity</span>
                            <span class="value">${summary.totalQuantity}</span>
                        </div>
                        <div class="batch-summary-item">
                            <span class="label">Expiring Soon</span>
                            <span class="value" style="color: #856404;">${summary.expiringSoon}</span>
                        </div>
                        <div class="batch-summary-item">
                            <span class="label">Expired</span>
                            <span class="value" style="color: #721c24;">${summary.expired}</span>
                        </div>
                    </div>
                `;
            }

            // Add Batch Form (hidden by default)
            html += this.renderAddBatchForm();

            // Batch List
            if (batches.length === 0) {
                html += `
                    <div class="batch-empty">
                        <div class="batch-empty-icon">📦</div>
                        <div class="batch-empty-text">No batches yet</div>
                        <p>Click "Add Batch" to create your first batch</p>
                    </div>
                `;
            } else {
                html += this.renderBatchTable(batches);
            }

            html += '</div>';
            this.container.innerHTML = html;

        } catch (error) {
            console.error('Error rendering batches:', error);
            this.container.innerHTML = `
                <div class="batch-section">
                    <p style="color: red;">Error loading batches: ${error.message}</p>
                </div>
            `;
        }
    }

    /**
     * Render add batch form
     */
    renderAddBatchForm() {
        return `
            <div class="batch-form" id="batchForm">
                <h4>Add New Batch</h4>
                <div class="batch-form-group">
                    <label for="batchNumber">Batch Number</label>
                    <input type="text" id="batchNumber" placeholder="Auto-generated if empty">
                </div>
                <div class="batch-form-group">
                    <label for="batchQuantity">Quantity *</label>
                    <input type="number" id="batchQuantity" required min="1">
                </div>
                <div class="batch-form-group">
                    <label for="batchExpiration">Expiration Date</label>
                    <input type="date" id="batchExpiration">
                </div>
                <div class="batch-form-actions">
                    <button class="btn-cancel" id="btnCancelBatch">Cancel</button>
                    <button class="btn-save" id="btnSaveBatch">Save Batch</button>
                </div>
            </div>
        `;
    }

    /**
     * Render batch table
     */
    renderBatchTable(batches) {
        // Sort by expiration (FIFO)
        const sorted = [...batches].sort((a, b) => 
            new Date(a.expiration_date || '9999-12-31') - new Date(b.expiration_date || '9999-12-31')
        );

        let html = `
            <table class="batch-table">
                <thead>
                    <tr>
                        <th>Batch #</th>
                        <th>Quantity</th>
                        <th>Received</th>
                        <th>Expiration</th>
                        <th>Days Left</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        sorted.forEach((batch, index) => {
            const status = this.getBatchStatus(batch.expiration_date);
            const isFirst = index === 0;
            
            html += `
                <tr class="batch-row ${status.class}">
                    <td>
                        ${batch.batch_number || 'N/A'}
                        ${isFirst ? '<span class="fifo-badge">NEXT</span>' : ''}
                    </td>
                    <td><strong>${batch.quantity}</strong></td>
                    <td>${batch.received_date ? new Date(batch.received_date).toLocaleDateString() : 'N/A'}</td>
                    <td>${batch.expiration_date ? new Date(batch.expiration_date).toLocaleDateString() : 'No expiration'}</td>
                    <td>${status.daysLeft >= 0 ? status.daysLeft : 'N/A'}</td>
                    <td><span class="status-badge ${status.class}">${status.text}</span></td>
                    <td>
                        <button class="btn-discard-batch" data-batch-id="${batch.id}" title="Discard this batch">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        return html;
    }

    /**
     * Get batch status
     */
    getBatchStatus(expirationDate) {
        if (!expirationDate) {
            return { text: 'No Expiration', class: 'good', daysLeft: -1 };
        }

        const today = new Date();
        const expiry = new Date(expirationDate);
        const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

        if (daysLeft < 0) {
            return { text: 'Expired', class: 'expired', daysLeft: 0 };
        } else if (daysLeft <= 7) {
            return { text: 'Expiring Soon', class: 'warning', daysLeft };
        } else {
            return { text: 'Good', class: 'good', daysLeft };
        }
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Add batch button
        const btnAddBatch = document.getElementById('btnAddBatch');
        if (btnAddBatch) {
            btnAddBatch.addEventListener('click', () => this.showAddBatchForm());
        }

        // Cancel batch button
        const btnCancelBatch = document.getElementById('btnCancelBatch');
        if (btnCancelBatch) {
            btnCancelBatch.addEventListener('click', () => this.hideAddBatchForm());
        }

        // Save batch button
        const btnSaveBatch = document.getElementById('btnSaveBatch');
        if (btnSaveBatch) {
            btnSaveBatch.addEventListener('click', () => this.handleSaveBatch());
        }

        // Discard batch buttons
        const discardButtons = document.querySelectorAll('.btn-discard-batch');
        discardButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const batchId = e.target.dataset.batchId;
                this.handleDiscardBatch(batchId);
            });
        });
    }

    /**
     * Show add batch form
     */
    showAddBatchForm() {
        const form = document.getElementById('batchForm');
        if (form) {
            form.classList.add('active');
        }
    }

    /**
     * Hide add batch form
     */
    hideAddBatchForm() {
        const form = document.getElementById('batchForm');
        if (form) {
            form.classList.remove('active');
            // Clear form
            document.getElementById('batchNumber').value = '';
            document.getElementById('batchQuantity').value = '';
            document.getElementById('batchExpiration').value = '';
        }
    }

    /**
     * Handle save batch
     */
    async handleSaveBatch() {
        const quantity = document.getElementById('batchQuantity').value;
        const batchNumber = document.getElementById('batchNumber').value;
        const expiration = document.getElementById('batchExpiration').value;

        if (!quantity || parseInt(quantity) <= 0) {
            alert('Please enter a valid quantity');
            return;
        }

        const result = await this.batchOperations.addStock(this.productId, quantity, {
            batchNumber: batchNumber || null,
            expirationDate: expiration || null
        });

        if (result.success) {
            this.hideAddBatchForm();
            await this.render();
            // Trigger product refresh if needed
            if (window.loadProducts) {
                window.loadProducts();
            }
        } else {
            alert('Error adding batch: ' + result.error);
        }
    }

    /**
     * Handle discard batch
     */
    async handleDiscardBatch(batchId) {
        if (!confirm('Are you sure you want to discard this batch?')) {
            return;
        }

        const reason = prompt('Reason for discarding:', 'Expired');
        if (!reason) return;

        const result = await this.batchOperations.discardBatch(this.productId, batchId, reason);

        if (result.success) {
            await this.render();
            // Trigger product refresh
            if (window.loadProducts) {
                window.loadProducts();
            }
        } else {
            alert('Error discarding batch: ' + result.error);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductDetailBatch;
}
