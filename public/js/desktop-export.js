/**
 * Desktop Export Menu
 * Handles export functionality for desktop users
 * Sprint 5 - Issue #1
 */

class DesktopExport {
    constructor() {
        this.menu = null;
        this.isOpen = false;
        this.exportSettings = {
            days: 7,
            includeExpired: false
        };
    }

    /**
     * Initialize export menu
     */
    init() {
        this.createExportButton();
        this.createExportMenu();
        this.attachEventListeners();
    }

    /**
     * Create export button in navbar
     */
    createExportButton() {
        // Find navbar collapse or navbar-nav
        const navbar = document.querySelector('.navbar-collapse');
        if (!navbar) return;

        // Create export button container
        const container = document.createElement('div');
        container.className = 'export-btn-container desktop-only-export';
        container.innerHTML = `
            <button class="btn-export" id="exportMenuBtn">
                <i class="bi bi-download"></i>
                <span>Export</span>
                <i class="bi bi-chevron-down" style="font-size: 0.8em;"></i>
            </button>
        `;

        navbar.appendChild(container);
    }

    /**
     * Create export dropdown menu
     */
    createExportMenu() {
        const container = document.querySelector('.export-btn-container');
        if (!container) return;

        const menu = document.createElement('div');
        menu.className = 'export-menu';
        menu.id = 'exportMenu';
        menu.innerHTML = `
            <div class="export-menu-header">
                <h5><i class="bi bi-file-earmark-arrow-down"></i> Export Reports</h5>
            </div>
            
            <div class="export-menu-body">
                <!-- Expiring Soon -->
                <div class="export-section">
                    <div class="export-section-title">Inventory Alerts</div>
                    <div class="export-option" data-export-type="expiring-soon">
                        <div class="export-option-info">
                            <div class="export-option-icon warning">
                                <i class="bi bi-exclamation-triangle"></i>
                            </div>
                            <div class="export-option-text">
                                <div class="export-option-title">Expiring Soon</div>
                                <div class="export-option-desc">Items expiring within <span id="daysDisplay">7</span> days</div>
                            </div>
                        </div>
                        <div class="export-format-buttons">
                            <button class="export-format-btn csv" data-format="csv" title="Export as CSV">CSV</button>
                            <button class="export-format-btn pdf" data-format="pdf" title="Export as PDF">PDF</button>
                            <button class="export-format-btn excel" data-format="excel" title="Export as Excel">XLS</button>
                        </div>
                    </div>
                    
                    <div class="export-option" data-export-type="low-stock">
                        <div class="export-option-info">
                            <div class="export-option-icon warning">
                                <i class="bi bi-arrow-down-circle"></i>
                            </div>
                            <div class="export-option-text">
                                <div class="export-option-title">Low Stock Items</div>
                                <div class="export-option-desc">Below minimum threshold</div>
                            </div>
                        </div>
                        <div class="export-format-buttons">
                            <button class="export-format-btn csv" data-format="csv">CSV</button>
                            <button class="export-format-btn pdf" data-format="pdf">PDF</button>
                            <button class="export-format-btn excel" data-format="excel">XLS</button>
                        </div>
                    </div>
                </div>
                
                <!-- Full Inventory -->
                <div class="export-section">
                    <div class="export-section-title">Complete Reports</div>
                    <div class="export-option" data-export-type="full-inventory">
                        <div class="export-option-info">
                            <div class="export-option-icon success">
                                <i class="bi bi-list-check"></i>
                            </div>
                            <div class="export-option-text">
                                <div class="export-option-title">Full Inventory</div>
                                <div class="export-option-desc">All products with batch details</div>
                            </div>
                        </div>
                        <div class="export-format-buttons">
                            <button class="export-format-btn csv" data-format="csv">CSV</button>
                            <button class="export-format-btn excel" data-format="excel">XLS</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Export Settings -->
            <div class="export-settings">
                <div class="export-settings-title">Export Options</div>
                <div class="export-setting-row">
                    <label for="exportDays">Days ahead for expiring:</label>
                    <input type="number" id="exportDays" min="1" max="90" value="7">
                </div>
            </div>
            
            <!-- Status Message -->
            <div class="export-status" id="exportStatus"></div>
            
            <!-- Loading Spinner -->
            <div class="export-loading" id="exportLoading">
                <div class="export-loading-spinner"></div>
                <div class="export-loading-text">Generating export...</div>
            </div>
        `;

        container.style.position = 'relative';
        container.appendChild(menu);
        this.menu = menu;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Toggle menu button
        const menuBtn = document.getElementById('exportMenuBtn');
        if (menuBtn) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMenu();
            });
        }

        // Days input
        const daysInput = document.getElementById('exportDays');
        if (daysInput) {
            daysInput.addEventListener('change', (e) => {
                this.exportSettings.days = parseInt(e.target.value);
                const display = document.getElementById('daysDisplay');
                if (display) {
                    display.textContent = e.target.value;
                }
            });
        }

        // Export format buttons
        const formatButtons = document.querySelectorAll('.export-format-btn');
        formatButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const format = btn.dataset.format;
                const exportOption = btn.closest('.export-option');
                const exportType = exportOption.dataset.exportType;
                this.handleExport(exportType, format);
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.menu.contains(e.target) && e.target.id !== 'exportMenuBtn') {
                this.closeMenu();
            }
        });

        // Prevent menu close when clicking inside
        if (this.menu) {
            this.menu.addEventListener('click', (e) => {
                if (!e.target.classList.contains('export-format-btn')) {
                    e.stopPropagation();
                }
            });
        }
    }

    /**
     * Toggle menu open/close
     */
    toggleMenu() {
        if (this.isOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    /**
     * Open menu
     */
    openMenu() {
        if (this.menu) {
            this.menu.classList.add('active');
            this.isOpen = true;
        }
    }

    /**
     * Close menu
     */
    closeMenu() {
        if (this.menu) {
            this.menu.classList.remove('active');
            this.isOpen = false;
        }
    }

    /**
     * Handle export request
     */
    async handleExport(exportType, format) {
        console.log(`Exporting ${exportType} as ${format}`);
        
        this.showLoading();
        this.hideStatus();

        try {
            let url = '';
            
            switch (exportType) {
                case 'expiring-soon':
                    url = `/api/export/expiring-soon?format=${format}&days=${this.exportSettings.days}`;
                    break;
                case 'low-stock':
                    url = `/api/export/low-stock?format=${format}`;
                    break;
                case 'full-inventory':
                    url = `/api/export/full-inventory?format=${format}`;
                    break;
                default:
                    throw new Error('Unknown export type');
            }

            // Trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = '';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Show success after a brief delay
            setTimeout(() => {
                this.hideLoading();
                this.showStatus('Export started! Your download should begin shortly.', 'success');
                setTimeout(() => {
                    this.closeMenu();
                }, 2000);
            }, 500);

        } catch (error) {
            console.error('Export error:', error);
            this.hideLoading();
            this.showStatus('Export failed: ' + error.message, 'error');
        }
    }

    /**
     * Show loading state
     */
    showLoading() {
        const loading = document.getElementById('exportLoading');
        if (loading) {
            loading.classList.add('active');
        }
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        const loading = document.getElementById('exportLoading');
        if (loading) {
            loading.classList.remove('active');
        }
    }

    /**
     * Show status message
     */
    showStatus(message, type = 'info') {
        const status = document.getElementById('exportStatus');
        if (status) {
            status.className = `export-status active ${type}`;
            
            let icon = 'info-circle';
            if (type === 'success') icon = 'check-circle';
            if (type === 'error') icon = 'x-circle';
            
            status.innerHTML = `<i class="bi bi-${icon}"></i>${message}`;
        }
    }

    /**
     * Hide status message
     */
    hideStatus() {
        const status = document.getElementById('exportStatus');
        if (status) {
            status.classList.remove('active');
        }
    }
}

// Initialize on page load
let desktopExport = null;

if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Only initialize on desktop (viewport width > 991px)
        if (window.innerWidth > 991) {
            desktopExport = new DesktopExport();
            desktopExport.init();
        }
        
        // Re-initialize on window resize if crossing desktop threshold
        let wasDesktop = window.innerWidth > 991;
        window.addEventListener('resize', () => {
            const isDesktop = window.innerWidth > 991;
            if (isDesktop && !wasDesktop) {
                if (!desktopExport) {
                    desktopExport = new DesktopExport();
                    desktopExport.init();
                }
            }
            wasDesktop = isDesktop;
        });
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DesktopExport;
}
