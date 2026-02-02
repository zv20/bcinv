/**
 * Performance Optimization
 * Sprint 6 - Issue #1
 * Improves loading times, reduces unnecessary re-renders, and optimizes API calls
 */

class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.pendingRequests = new Map();
        this.debounceTimers = new Map();
        this.originalFetch = window.fetch; // Store original fetch
    }

    /**
     * Initialize performance optimizations
     */
    init() {
        this.setupImageLazyLoading();
        this.setupRequestDeduplication();
        this.setupCaching();
        this.monitorPerformance();
    }

    /**
     * Lazy load images
     */
    setupImageLazyLoading() {
        if ('loading' in HTMLImageElement.prototype) {
            // Native lazy loading support
            const images = document.querySelectorAll('img[data-src]');
            images.forEach(img => {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                img.loading = 'lazy';
            });
        } else {
            // Fallback for older browsers
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                });
            });

            const images = document.querySelectorAll('img[data-src]');
            images.forEach(img => imageObserver.observe(img));
        }
    }

    /**
     * Deduplicate concurrent API requests
     */
    async fetchWithDeduplication(url, options = {}) {
        const key = `${url}-${JSON.stringify(options)}`;

        // Return pending request if exists
        if (this.pendingRequests.has(key)) {
            return this.pendingRequests.get(key);
        }

        // Check cache first
        if (this.cache.has(key)) {
            const cached = this.cache.get(key);
            if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
                return Promise.resolve(cached.data);
            }
        }

        // Make new request using ORIGINAL fetch (not overridden one)
        const promise = this.originalFetch(url, options)
            .then(response => response.json())
            .then(data => {
                this.cache.set(key, { data, timestamp: Date.now() });
                this.pendingRequests.delete(key);
                return data;
            })
            .catch(error => {
                this.pendingRequests.delete(key);
                throw error;
            });

        this.pendingRequests.set(key, promise);
        return promise;
    }

    /**
     * Setup request deduplication
     */
    setupRequestDeduplication() {
        // Override fetch globally (optional)
        if (typeof window !== 'undefined' && !window.__fetchDeduplicationSetup) {
            window.__fetchDeduplicationSetup = true;
            
            // Only deduplicate GET requests to our API
            window.fetch = (url, options = {}) => {
                if (typeof url === 'string' && url.startsWith('/api/') && (!options.method || options.method === 'GET')) {
                    return this.fetchWithDeduplication(url, options);
                }
                return this.originalFetch(url, options);
            };
        }
    }

    /**
     * Setup caching strategies
     */
    setupCaching() {
        // Clear old cache entries every 5 minutes
        setInterval(() => {
            const now = Date.now();
            for (const [key, value] of this.cache.entries()) {
                if (now - value.timestamp > 300000) { // 5 minutes
                    this.cache.delete(key);
                }
            }
        }, 300000);
    }

    /**
     * Debounce function calls
     */
    debounce(key, callback, delay = 300) {
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }

        const timer = setTimeout(() => {
            callback();
            this.debounceTimers.delete(key);
        }, delay);

        this.debounceTimers.set(key, timer);
    }

    /**
     * Throttle function calls
     */
    throttle(key, callback, limit = 1000) {
        if (this.debounceTimers.has(key)) {
            return;
        }

        callback();
        
        const timer = setTimeout(() => {
            this.debounceTimers.delete(key);
        }, limit);

        this.debounceTimers.set(key, timer);
    }

    /**
     * Monitor performance metrics
     */
    monitorPerformance() {
        if ('PerformanceObserver' in window) {
            // Monitor long tasks
            try {
                const longTaskObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        console.warn('Long task detected:', entry.duration, 'ms');
                    }
                });
                longTaskObserver.observe({ entryTypes: ['longtask'] });
            } catch (e) {
                // Long task observer not supported
            }

            // Monitor layout shifts
            try {
                const clsObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.hadRecentInput) continue;
                        console.warn('Layout shift detected:', entry.value);
                    }
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
            } catch (e) {
                // Layout shift observer not supported
            }
        }

        // Log page load metrics
        if (window.performance && window.performance.timing) {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    const timing = window.performance.timing;
                    const loadTime = timing.loadEventEnd - timing.navigationStart;
                    const domReadyTime = timing.domContentLoadedEventEnd - timing.navigationStart;
                    
                    console.log('Performance Metrics:');
                    console.log('- Page Load Time:', loadTime, 'ms');
                    console.log('- DOM Ready Time:', domReadyTime, 'ms');
                    
                    // Warn if slow
                    if (loadTime > 3000) {
                        console.warn('⚠️ Page load time exceeds 3 seconds');
                    }
                }, 0);
            });
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('Cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            pendingRequests: this.pendingRequests.size,
            debounceTimers: this.debounceTimers.size
        };
    }
}

// Initialize on page load
let performanceOptimizer = null;

if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        performanceOptimizer = new PerformanceOptimizer();
        performanceOptimizer.init();
        
        // Make available globally for debugging
        window.performanceOptimizer = performanceOptimizer;
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceOptimizer;
}
