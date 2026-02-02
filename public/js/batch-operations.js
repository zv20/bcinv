/**
 * Batch-Aware Stock Operations
 * Handles stock adjustments with FIFO batch logic
 * Sprint 4 - Issue #1
 */

class BatchOperations {
    constructor() {
        this.batchManager = new BatchManager();
    }

    /**
     * Add stock with batch creation
     */
    async addStock(productId, quantity, batchData = {}) {
        try {
            // Create new batch
            const batch = {
                quantity: parseInt(quantity),
                batch_number: batchData.batchNumber || this.generateBatchNumber(),
                expiration_date: batchData.expirationDate || null,
                received_date: new Date().toISOString().split('T')[0]
            };

            const response = await fetch(`/api/products/${productId}/batches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batch)
            });

            if (!response.ok) {
                throw new Error('Failed to add batch');
            }

            // Update product total quantity
            await this.updateProductQuantity(productId);
            
            return { success: true, batch };
        } catch (error) {
            console.error('Error adding stock:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Remove stock using FIFO logic
     */
    async removeStock(productId, quantity) {
        try {
            // Load current batches
            const batches = await this.batchManager.loadBatches(productId);
            
            if (batches.length === 0) {
                throw new Error('No batches available');
            }

            // Calculate total available
            const totalAvailable = batches.reduce((sum, b) => sum + b.quantity, 0);
            if (quantity > totalAvailable) {
                throw new Error(`Insufficient stock. Available: ${totalAvailable}`);
            }

            // Deduct from batches (FIFO)
            const success = await this.batchManager.deductFromBatches(productId, quantity);
            
            if (!success) {
                throw new Error('Failed to deduct from batches');
            }

            // Update product total quantity
            await this.updateProductQuantity(productId);
            
            return { success: true };
        } catch (error) {
            console.error('Error removing stock:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Adjust stock (positive or negative)
     */
    async adjustStock(productId, adjustment, reason, notes = '') {
        try {
            if (adjustment > 0) {
                // Adding stock - create new batch
                return await this.addStock(productId, adjustment, {
                    batchNumber: `ADJ-${Date.now()}`,
                    expirationDate: null
                });
            } else if (adjustment < 0) {
                // Removing stock - use FIFO
                return await this.removeStock(productId, Math.abs(adjustment));
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error adjusting stock:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Discard batch (for expired/damaged items)
     */
    async discardBatch(productId, batchId, reason) {
        try {
            const response = await fetch(`/api/products/${productId}/batches/${batchId}/discard`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason })
            });

            if (!response.ok) {
                throw new Error('Failed to discard batch');
            }

            // Update product total quantity
            await this.updateProductQuantity(productId);
            
            return { success: true };
        } catch (error) {
            console.error('Error discarding batch:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update product total quantity from batches
     */
    async updateProductQuantity(productId) {
        try {
            const response = await fetch(`/api/products/${productId}/sync-quantity`, {
                method: 'POST'
            });
            return response.ok;
        } catch (error) {
            console.error('Error syncing quantity:', error);
            return false;
        }
    }

    /**
     * Generate batch number
     */
    generateBatchNumber() {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `B${year}${month}${day}-${random}`;
    }

    /**
     * Get batch summary for product
     */
    async getBatchSummary(productId) {
        try {
            const batches = await this.batchManager.loadBatches(productId);
            
            const totalQuantity = batches.reduce((sum, b) => sum + b.quantity, 0);
            const totalBatches = batches.length;
            
            // Count expiring soon (within 7 days)
            const today = new Date();
            const expiringSoon = batches.filter(b => {
                const expiry = new Date(b.expiration_date);
                const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
                return daysLeft > 0 && daysLeft <= 7;
            }).length;

            // Count expired
            const expired = batches.filter(b => {
                const expiry = new Date(b.expiration_date);
                return expiry < today;
            }).length;

            return {
                totalQuantity,
                totalBatches,
                expiringSoon,
                expired,
                oldestBatch: this.batchManager.getOldestBatch()
            };
        } catch (error) {
            console.error('Error getting batch summary:', error);
            return null;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BatchOperations;
}
