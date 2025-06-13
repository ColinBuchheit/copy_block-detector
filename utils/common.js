const Utils = {
    // Debounce function calls to prevent excessive execution
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function calls to limit execution frequency
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Get domain from URL safely
    getDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return null;
        }
    },

    // Check if element is visible in viewport
    isElementVisible(element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            style.display !== 'none' &&
            rect.top < window.innerHeight &&
            rect.bottom > 0
        );
    },

    // Generate unique ID
    generateId(prefix = 'cb') {
        return `${prefix}_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
    },

    // Enhanced logging with different levels
    log(message, type = 'info', data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[CopyBlock ${timestamp}] ${message}`;
        
        switch (type) {
            case 'error':
                console.error(logMessage, data);
                break;
            case 'warn':
                console.warn(logMessage, data);
                break;
            case 'debug':
                console.debug(logMessage, data);
                break;
            default:
                console.log(logMessage, data);
        }
    },

    // Safe JSON parsing with fallback
    safeJsonParse(str, fallback = null) {
        try {
            return JSON.parse(str);
        } catch (e) {
            Utils.log(`JSON parse error: ${e.message}`, 'warn');
            return fallback;
        }
    },

    // Wait for DOM to be ready
    waitForDOM() {
        return new Promise(resolve => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            } else {
                resolve();
            }
        });
    },

    // Wait for element to exist in DOM
    waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    },

    // Deep clone object
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => Utils.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = Utils.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    },

    // Check if object is empty
    isEmpty(obj) {
        return Object.keys(obj).length === 0 && obj.constructor === Object;
    },

    // Merge objects deeply
    mergeDeep(target, source) {
        const result = Utils.deepClone(target);
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                    result[key] = Utils.mergeDeep(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        
        return result;
    },

    // Format bytes to human readable
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },

    // Format time duration
    formatDuration(ms) {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${seconds}s`;
        return `${seconds}s`;
    },

    // Validate email address
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    // Validate URL
    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    },

    // Validate domain
    isValidDomain(domain) {
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return domainRegex.test(domain) && domain.length <= 253;
    },

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Strip HTML tags
    stripHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    },

    // Create and dispatch custom event
    dispatchCustomEvent(element, eventName, detail = null) {
        const event = new CustomEvent(eventName, {
            detail,
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(event);
    },

    // Get element's computed style property
    getComputedStyleProperty(element, property) {
        return window.getComputedStyle(element).getPropertyValue(property);
    },

    // Check if element has specific class
    hasClass(element, className) {
        return element && element.classList && element.classList.contains(className);
    },

    // Add class to element if it doesn't exist
    addClass(element, className) {
        if (element && element.classList && !element.classList.contains(className)) {
            element.classList.add(className);
        }
    },

    // Remove class from element if it exists
    removeClass(element, className) {
        if (element && element.classList && element.classList.contains(className)) {
            element.classList.remove(className);
        }
    },

    // Toggle class on element
    toggleClass(element, className) {
        if (element && element.classList) {
            element.classList.toggle(className);
        }
    },

    // Get all elements matching selector
    queryAll(selector, context = document) {
        return Array.from(context.querySelectorAll(selector));
    },

    // Get closest parent element matching selector
    closest(element, selector) {
        return element && element.closest ? element.closest(selector) : null;
    },

    // Check if element is descendant of parent
    isDescendant(parent, child) {
        return parent !== child && parent.contains(child);
    },

    // Get element's offset position
    getOffset(element) {
        const rect = element.getBoundingClientRect();
        return {
            top: rect.top + window.pageYOffset,
            left: rect.left + window.pageXOffset,
            width: rect.width,
            height: rect.height
        };
    },

    // Smooth scroll to element
    scrollToElement(element, behavior = 'smooth') {
        if (element && element.scrollIntoView) {
            element.scrollIntoView({ behavior, block: 'center' });
        }
    },

    // Create notification (browser or fallback)
    showNotification(title, options = {}) {
        const defaultOptions = {
            icon: chrome.runtime.getURL('icons/icon48.png'),
            body: '',
            tag: 'copyblock-notification'
        };

        const notificationOptions = Utils.mergeDeep(defaultOptions, options);

        if ('Notification' in window && Notification.permission === 'granted') {
            return new Notification(title, notificationOptions);
        } else if (chrome && chrome.notifications) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: notificationOptions.icon,
                title: title,
                message: notificationOptions.body
            });
        } else {
            Utils.log(`Notification: ${title} - ${notificationOptions.body}`);
        }
    },

    // Request notification permission
    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            return await Notification.requestPermission();
        }
        return Notification.permission;
    },

    // Copy text to clipboard
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                const success = document.execCommand('copy');
                document.body.removeChild(textarea);
                return success;
            }
        } catch (error) {
            Utils.log(`Copy to clipboard failed: ${error.message}`, 'error');
            return false;
        }
    },

    // Get text from clipboard
    async getFromClipboard() {
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                return await navigator.clipboard.readText();
            }
        } catch (error) {
            Utils.log(`Read from clipboard failed: ${error.message}`, 'error');
        }
        return null;
    },

    // Rate limiting utility
    createRateLimiter(maxCalls, timeWindow) {
        const calls = [];
        
        return function(fn) {
            const now = Date.now();
            
            // Remove old calls outside the time window
            while (calls.length > 0 && calls[0] <= now - timeWindow) {
                calls.shift();
            }
            
            if (calls.length < maxCalls) {
                calls.push(now);
                return fn();
            } else {
                Utils.log('Rate limit exceeded', 'warn');
                return Promise.reject(new Error('Rate limit exceeded'));
            }
        };
    },

    // Retry function with exponential backoff
    async retry(fn, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        
        for (let i = 0; i <= maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                if (i === maxRetries) {
                    throw error;
                }
                
                const delay = baseDelay * Math.pow(2, i);
                Utils.log(`Retry attempt ${i + 1} in ${delay}ms`, 'warn');
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    },

    // Performance monitoring
    createPerformanceMonitor() {
        const measurements = new Map();
        
        return {
            start(label) {
                measurements.set(label, performance.now());
            },
            
            end(label) {
                const startTime = measurements.get(label);
                if (startTime) {
                    const duration = performance.now() - startTime;
                    measurements.delete(label);
                    Utils.log(`Performance [${label}]: ${duration.toFixed(2)}ms`);
                    return duration;
                }
                return null;
            },
            
            measure(label, fn) {
                this.start(label);
                const result = fn();
                this.end(label);
                return result;
            },
            
            async measureAsync(label, fn) {
                this.start(label);
                const result = await fn();
                this.end(label);
                return result;
            }
        };
    },

    // Environment detection
    env: {
        isChrome: () => /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor),
        isFirefox: () => /Firefox/.test(navigator.userAgent),
        isEdge: () => /Edg/.test(navigator.userAgent),
        isSafari: () => /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
        isMobile: () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        isExtension: () => typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id
    },

    // Storage utilities for extension
    storage: {
        async get(keys) {
            return new Promise((resolve) => {
                if (chrome.storage && chrome.storage.sync) {
                    chrome.storage.sync.get(keys, resolve);
                } else {
                    resolve({});
                }
            });
        },

        async set(items) {
            return new Promise((resolve) => {
                if (chrome.storage && chrome.storage.sync) {
                    chrome.storage.sync.set(items, resolve);
                } else {
                    resolve();
                }
            });
        },

        async remove(keys) {
            return new Promise((resolve) => {
                if (chrome.storage && chrome.storage.sync) {
                    chrome.storage.sync.remove(keys, resolve);
                } else {
                    resolve();
                }
            });
        },

        async clear() {
            return new Promise((resolve) => {
                if (chrome.storage && chrome.storage.sync) {
                    chrome.storage.sync.clear(resolve);
                } else {
                    resolve();
                }
            });
        }
    }
};

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
} else if (typeof window !== 'undefined') {
    window.Utils = Utils;
} else {
    this.Utils = Utils;
}