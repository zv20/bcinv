/**
 * Low Stock Alerts Manager
 * Displays low stock items and alert badges
 */

class LowStockAlerts {
    constructor() {
        this.lowStockItems = [];
        this.alertCount = 0;
    }

    /**
     * Load low stock items
     */
    async loadLowStockItems() {
        try {
            const response = await fetch('/api/products/low-stock');
            const data = await response.json();
            this.lowStockItems = data.products || [];
            this.alertCount = this.lowStockItems.length;
            return this.lowStockItems;
        } catch (error) {
            console.error('Error loading low stock items:', error);
            return [];
        }
    }

    /**
     * Display low stock section on dashboard
     */
    async displayLowStockSection(containerId) {
        await this.loadLowStockItems();
        const container = document.getElementById(containerId);
        if (!container) return;

        if (this.lowStockItems.length === 0) {
            container.innerHTML = '<p class="no-alerts">✓ All items well stocked</p>';
            return;
        }

        const html = `
            <div class="low-stock-header">
                <h3>Low Stock Alerts</h3>
                <span class="alert-count">${this.alertCount}</span>
            </div>
            <div class="low-stock-list">
                ${this.lowStockItems.map(item => this.renderLowStockItem(item)).join('')}
            </div>
        `;
        container.innerHTML = html;
    }

    /**
     * Render single low stock item
     */
    renderLowStockItem(item) {
        const shortage = item.min_stock_level - item.quantity;
        return `
            <div class="low-stock-item">
                <div class="item-info">
                    <h4>${item.name}</h4>
                    <p>SKU: ${item.sku}</p>
                </div>
                <div class="stock-info">
                    <span class="current-stock">${item.quantity} ${item.unit}</span>
                    <span class="min-stock">Min: ${item.min_stock_level}</span>
                    <span class="shortage warning">Need: ${shortage}</span>
                </div>
            </div>
        `;
    }

    /**
     * Update alert badge in navigation
     */
    updateAlertBadge() {
        const badge = document.getElementById('low-stock-badge');
        if (!badge) return;

        if (this.alertCount > 0) {
            badge.textContent = this.alertCount;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }

    /**
     * Start auto-refresh (check every 5 minutes)
     */
    startAutoRefresh() {
        setInterval(async () => {
            await this.loadLowStockItems();
            this.updateAlertBadge();
        }, 5 * 60 * 1000);
    }
}

// Initialize on page load
if (typeof document !== 'undefined') {
    let lowStockAlerts;
    document.addEventListener('DOMContentLoaded', () => {
        lowStockAlerts = new LowStockAlerts();
        lowStockAlerts.startAutoRefresh();
    });
}
