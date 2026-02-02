/**
 * Batch/Lot Tracking Manager
 * Manages multiple batches per product with FIFO logic
 */

class BatchManager {
    constructor() {
        this.batches = [];
    }

    /**
     * Load batches for a product
     */
    async loadBatches(productId) {
        try {
            const response = await fetch(`/api/products/${productId}/batches`);
            const data = await response.json();
            this.batches = data.batches || [];
            return this.batches;
        } catch (error) {
            console.error('Error loading batches:', error);
            return [];
        }
    }

    /**
     * Add new batch
     */
    async addBatch(productId, batchData) {
        try {
            const response = await fetch(`/api/products/${productId}/batches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batchData)
            });
            
            if (response.ok) {
                await this.loadBatches(productId);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error adding batch:', error);
            return false;
        }
    }

    /**
     * Display batches in UI
     */
    displayBatches(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (this.batches.length === 0) {
            container.innerHTML = '<p>No batches found</p>';
            return;
        }

        // Sort by expiration date (FIFO)
        const sortedBatches = [...this.batches].sort((a, b) => 
            new Date(a.expiration_date) - new Date(b.expiration_date)
        );

        const html = `
            <table class="batch-table">
                <thead>
                    <tr>
                        <th>Batch #</th>
                        <th>Quantity</th>
                        <th>Expiration</th>
                        <th>Days Left</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedBatches.map(batch => this.renderBatchRow(batch)).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = html;
    }

    /**
     * Render single batch row
     */
    renderBatchRow(batch) {
        const status = this.getBatchStatus(batch.expiration_date);
        return `
            <tr class="batch-row ${status.class}">
                <td>${batch.batch_number || 'N/A'}</td>
                <td>${batch.quantity}</td>
                <td>${new Date(batch.expiration_date).toLocaleDateString()}</td>
                <td>${status.daysLeft}</td>
                <td><span class="status-badge ${status.class}">${status.text}</span></td>
            </tr>
        `;
    }

    /**
     * Get batch status based on expiration
     */
    getBatchStatus(expirationDate) {
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
     * Get oldest batch (FIFO)
     */
    getOldestBatch() {
        if (this.batches.length === 0) return null;
        return [...this.batches].sort((a, b) => 
            new Date(a.expiration_date) - new Date(b.expiration_date)
        )[0];
    }

    /**
     * Deduct quantity from batches (FIFO)
     */
    async deductFromBatches(productId, quantity) {
        const sortedBatches = [...this.batches].sort((a, b) => 
            new Date(a.expiration_date) - new Date(b.expiration_date)
        );

        let remaining = quantity;
        const updates = [];

        for (const batch of sortedBatches) {
            if (remaining <= 0) break;

            const deductAmount = Math.min(batch.quantity, remaining);
            updates.push({
                batch_id: batch.id,
                new_quantity: batch.quantity - deductAmount
            });
            remaining -= deductAmount;
        }

        // Submit updates to server
        try {
            const response = await fetch(`/api/products/${productId}/batches/deduct`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates })
            });
            return response.ok;
        } catch (error) {
            console.error('Error deducting from batches:', error);
            return false;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BatchManager;
}
