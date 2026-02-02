/**
 * Accessibility Enhancements
 * Sprint 6 - Issue #1
 * Improves keyboard navigation, ARIA labels, and screen reader support
 */

class AccessibilityManager {
    constructor() {
        this.focusTrapStack = [];
        this.lastFocusedElement = null;
    }

    /**
     * Initialize accessibility features
     */
    init() {
        this.enhanceKeyboardNavigation();
        this.addARIALabels();
        this.setupFocusManagement();
        this.enhanceModals();
        this.setupSkipLinks();
    }

    /**
     * Enhance keyboard navigation
     */
    enhanceKeyboardNavigation() {
        // ESC key to close modals and menus
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close export menu if open
                const exportMenu = document.getElementById('exportMenu');
                if (exportMenu && exportMenu.classList.contains('active')) {
                    const menuBtn = document.getElementById('exportMenuBtn');
                    if (menuBtn) menuBtn.click();
                }

                // Close any open Bootstrap modals
                const modals = document.querySelectorAll('.modal.show');
                modals.forEach(modal => {
                    const bsModal = bootstrap.Modal.getInstance(modal);
                    if (bsModal) bsModal.hide();
                });
            }
        });

        // Tab navigation for cards
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
            if (!card.hasAttribute('tabindex')) {
                card.setAttribute('tabindex', '0');
            }
        });

        // Enter/Space activation for custom buttons
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                if (e.target.classList.contains('export-format-btn')) {
                    e.preventDefault();
                    e.target.click();
                }
            }
        });
    }

    /**
     * Add ARIA labels to interactive elements
     */
    addARIALabels() {
        // Navigation links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            if (!link.hasAttribute('aria-label')) {
                const text = link.textContent.trim();
                link.setAttribute('aria-label', `Navigate to ${text}`);
            }
        });

        // Action buttons
        const buttons = document.querySelectorAll('button[onclick]');
        buttons.forEach(btn => {
            if (!btn.hasAttribute('aria-label')) {
                const icon = btn.querySelector('i');
                const text = btn.textContent.trim();
                if (icon) {
                    const action = text || btn.getAttribute('title') || 'Action';
                    btn.setAttribute('aria-label', action);
                }
            }
        });

        // Export menu button
        const exportBtn = document.getElementById('exportMenuBtn');
        if (exportBtn) {
            exportBtn.setAttribute('aria-label', 'Open export menu');
            exportBtn.setAttribute('aria-haspopup', 'true');
            exportBtn.setAttribute('aria-expanded', 'false');
        }

        // Export menu
        const exportMenu = document.getElementById('exportMenu');
        if (exportMenu) {
            exportMenu.setAttribute('role', 'menu');
            exportMenu.setAttribute('aria-label', 'Export options');

            // Export options
            const options = exportMenu.querySelectorAll('.export-option');
            options.forEach(option => {
                option.setAttribute('role', 'menuitem');
                const title = option.querySelector('.export-option-title');
                if (title) {
                    option.setAttribute('aria-label', title.textContent);
                }
            });

            // Format buttons
            const formatBtns = exportMenu.querySelectorAll('.export-format-btn');
            formatBtns.forEach(btn => {
                const format = btn.dataset.format;
                btn.setAttribute('role', 'button');
                btn.setAttribute('aria-label', `Export as ${format.toUpperCase()}`);
            });
        }

        // Tables
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            if (!table.hasAttribute('role')) {
                table.setAttribute('role', 'table');
            }
            const caption = table.closest('.card')?.querySelector('.card-header')?.textContent;
            if (caption && !table.querySelector('caption')) {
                const captionEl = document.createElement('caption');
                captionEl.textContent = caption;
                captionEl.className = 'visually-hidden';
                table.insertBefore(captionEl, table.firstChild);
            }
        });

        // Forms
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.setAttribute('role', 'form');
            
            // Required fields
            const requiredInputs = form.querySelectorAll('input[required], select[required], textarea[required]');
            requiredInputs.forEach(input => {
                input.setAttribute('aria-required', 'true');
            });
        });

        // Status messages
        const alerts = document.querySelectorAll('.alert');
        alerts.forEach(alert => {
            alert.setAttribute('role', 'alert');
            alert.setAttribute('aria-live', 'polite');
        });
    }

    /**
     * Setup focus management for modals
     */
    setupFocusManagement() {
        // Track last focused element before modal opens
        document.addEventListener('show.bs.modal', (e) => {
            this.lastFocusedElement = document.activeElement;
        });

        // Restore focus when modal closes
        document.addEventListener('hidden.bs.modal', (e) => {
            if (this.lastFocusedElement) {
                this.lastFocusedElement.focus();
                this.lastFocusedElement = null;
            }
        });

        // Focus first input when modal opens
        document.addEventListener('shown.bs.modal', (e) => {
            const modal = e.target;
            const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        });
    }

    /**
     * Enhance modals with proper ARIA attributes
     */
    enhanceModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            
            const title = modal.querySelector('.modal-title');
            if (title && !modal.hasAttribute('aria-labelledby')) {
                const titleId = title.id || `modal-title-${Math.random().toString(36).substr(2, 9)}`;
                title.id = titleId;
                modal.setAttribute('aria-labelledby', titleId);
            }
        });
    }

    /**
     * Setup skip links for keyboard navigation
     */
    setupSkipLinks() {
        // Check if skip link already exists
        if (document.getElementById('skip-to-content')) return;

        const skipLink = document.createElement('a');
        skipLink.id = 'skip-to-content';
        skipLink.href = '#main-content';
        skipLink.textContent = 'Skip to main content';
        skipLink.className = 'visually-hidden-focusable';
        skipLink.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            padding: 1rem;
            background: #0d6efd;
            color: white;
            z-index: 9999;
            text-decoration: none;
            transform: translateY(-100%);
            transition: transform 0.2s;
        `;

        skipLink.addEventListener('focus', () => {
            skipLink.style.transform = 'translateY(0)';
        });

        skipLink.addEventListener('blur', () => {
            skipLink.style.transform = 'translateY(-100%)';
        });

        document.body.insertBefore(skipLink, document.body.firstChild);

        // Add ID to main content
        const mainContent = document.querySelector('.container-fluid');
        if (mainContent && !mainContent.id) {
            mainContent.id = 'main-content';
            mainContent.setAttribute('role', 'main');
        }
    }

    /**
     * Announce dynamic content changes to screen readers
     */
    announce(message, priority = 'polite') {
        let announcer = document.getElementById('screen-reader-announcer');
        
        if (!announcer) {
            announcer = document.createElement('div');
            announcer.id = 'screen-reader-announcer';
            announcer.className = 'visually-hidden';
            announcer.setAttribute('role', 'status');
            announcer.setAttribute('aria-live', priority);
            announcer.setAttribute('aria-atomic', 'true');
            document.body.appendChild(announcer);
        }

        // Clear and set new message
        announcer.textContent = '';
        setTimeout(() => {
            announcer.textContent = message;
        }, 100);
    }

    /**
     * Add loading state announcements
     */
    announceLoading(isLoading, context = 'content') {
        if (isLoading) {
            this.announce(`Loading ${context}, please wait...`, 'polite');
        } else {
            this.announce(`${context} loaded`, 'polite');
        }
    }
}

// Initialize on page load
let accessibilityManager = null;

if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        accessibilityManager = new AccessibilityManager();
        accessibilityManager.init();
        
        // Add visually-hidden CSS if not already present
        if (!document.querySelector('#accessibility-styles')) {
            const style = document.createElement('style');
            style.id = 'accessibility-styles';
            style.textContent = `
                .visually-hidden {
                    position: absolute !important;
                    width: 1px !important;
                    height: 1px !important;
                    padding: 0 !important;
                    margin: -1px !important;
                    overflow: hidden !important;
                    clip: rect(0,0,0,0) !important;
                    white-space: nowrap !important;
                    border: 0 !important;
                }
                
                .visually-hidden-focusable:focus,
                .visually-hidden-focusable:active {
                    position: static !important;
                    width: auto !important;
                    height: auto !important;
                    overflow: visible !important;
                    clip: auto !important;
                    white-space: normal !important;
                }
                
                *:focus {
                    outline: 2px solid #0d6efd;
                    outline-offset: 2px;
                }
                
                button:focus,
                a:focus,
                input:focus,
                select:focus,
                textarea:focus {
                    box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.25);
                }
            `;
            document.head.appendChild(style);
        }
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AccessibilityManager;
}
