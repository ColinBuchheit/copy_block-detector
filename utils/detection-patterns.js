const DetectionPatterns = {
    // CSS properties that indicate copy blocking
    cssBlockingPatterns: [
        { property: 'user-select', value: 'none' },
        { property: '-webkit-user-select', value: 'none' },
        { property: '-moz-user-select', value: 'none' },
        { property: '-ms-user-select', value: 'none' },
        { property: 'pointer-events', value: 'none' },
        { property: '-webkit-touch-callout', value: 'none' },
        { property: '-webkit-tap-highlight-color', value: 'transparent' }
    ],

    // JavaScript event patterns that indicate blocking
    jsBlockingPatterns: [
        'onselectstart',
        'oncontextmenu',
        'ondragstart',
        'oncopy',
        'oncut',
        'onpaste',
        'onkeydown',
        'onkeyup',
        'onmousedown',
        'onmouseup'
    ],

    // Common class names used for blocking selection
    blockingClassNames: [
        'no-select',
        'disable-select',
        'unselectable',
        'no-copy',
        'disable-copy',
        'protect',
        'noselect',
        'protected',
        'copy-protection',
        'select-none',
        'user-select-none',
        'no-highlight',
        'disable-highlight',
        'protected-content',
        'anti-copy',
        'copy-guard'
    ],

    // CSS selectors that commonly indicate blocking
    blockingSelectors: [
        '[onselectstart]',
        '[oncontextmenu]',
        '[ondragstart]',
        '[style*="user-select: none"]',
        '[style*="-webkit-user-select: none"]',
        '.no-select',
        '.unselectable',
        '.disable-copy'
    ],

    // Known tracking and monitoring scripts
    trackingScripts: [
        'tynt.js',
        'copy-track',
        'clipboard-monitor',
        'selection-tracker',
        'copyprotect',
        'rightclick-disable',
        'no-right-click',
        'disable-select',
        'anti-copy'
    ],

    // Tracking script patterns (regex patterns)
    trackingScriptPatterns: [
        /copy.*track/i,
        /clipboard.*monitor/i,
        /selection.*track/i,
        /right.*click.*disable/i,
        /copy.*protect/i,
        /anti.*copy/i,
        /disable.*select/i,
        /no.*select/i
    ],

    // Site-specific bypass methods and fixes
    siteSpecificFixes: {
        'medium.com': {
            method: 'removePaywallOverlay',
            selectors: ['.meteredContent', '.overlay', '.js-postMeteredContent'],
            description: 'Remove Medium paywall overlay'
        },
        'nytimes.com': {
            method: 'removeSubscriptionModal',
            selectors: ['.css-1t62hi8', '.gateway-container', '[data-testid="gateway"]'],
            description: 'Remove NYTimes subscription modal'
        },
        'wsj.com': {
            method: 'removePaywall',
            selectors: ['.wsj-snippet-body', '.snippet-promotion'],
            description: 'Remove Wall Street Journal paywall'
        },
        'bloomberg.com': {
            method: 'removePaywall',
            selectors: ['.paywall-banner', '.fence-body'],
            description: 'Remove Bloomberg paywall'
        },
        'ft.com': {
            method: 'removePaywall',
            selectors: ['.subscription-banner', '.barrier'],
            description: 'Remove Financial Times paywall'
        },
        'quora.com': {
            method: 'removeLoginPrompt',
            selectors: ['.modal_signup_background', '.signup_wall_prevent_scroll'],
            description: 'Remove Quora login prompt'
        }
    },

    // Advanced blocking detection patterns
    advancedPatterns: {
        // Invisible overlays that prevent selection
        invisibleOverlays: [
            'div[style*="position: absolute"][style*="z-index"]',
            'div[style*="position: fixed"][style*="z-index"]',
            '.overlay',
            '.modal-backdrop',
            '.selection-blocker'
        ],

        // Canvas-based text rendering (harder to select)
        canvasText: [
            'canvas[width][height]',
            'canvas.text-canvas',
            'canvas[data-text]'
        ],

        // Image-based text (prevents copy)
        imageText: [
            'img[src*="text"]',
            'img[alt*="text"]',
            'img.text-image',
            'img[data-text]'
        ],

        // SVG text elements
        svgText: [
            'svg text',
            'svg tspan',
            'svg textPath'
        ],

        // Shadow DOM elements (harder to detect)
        shadowDom: [
            '[data-shadow]',
            '.shadow-root',
            '[shadow]'
        ]
    },

    // Common blocking techniques and their detection methods
    blockingTechniques: {
        cssUserSelect: {
            detect: (element) => {
                const style = window.getComputedStyle(element);
                return style.userSelect === 'none' || 
                       style.webkitUserSelect === 'none' ||
                       style.MozUserSelect === 'none' ||
                       style.msUserSelect === 'none';
            },
            bypass: (element) => {
                element.style.userSelect = 'text';
                element.style.webkitUserSelect = 'text';
                element.style.MozUserSelect = 'text';
                element.style.msUserSelect = 'text';
            }
        },

        pointerEvents: {
            detect: (element) => {
                const style = window.getComputedStyle(element);
                return style.pointerEvents === 'none';
            },
            bypass: (element) => {
                element.style.pointerEvents = 'auto';
            }
        },

        contextMenuBlocking: {
            detect: (element) => {
                return element.oncontextmenu !== null || 
                       element.getAttribute('oncontextmenu') !== null;
            },
            bypass: (element) => {
                element.oncontextmenu = null;
                element.removeAttribute('oncontextmenu');
            }
        },

        selectionBlocking: {
            detect: (element) => {
                return element.onselectstart !== null || 
                       element.getAttribute('onselectstart') !== null;
            },
            bypass: (element) => {
                element.onselectstart = null;
                element.removeAttribute('onselectstart');
            }
        },

        dragBlocking: {
            detect: (element) => {
                return element.ondragstart !== null || 
                       element.getAttribute('ondragstart') !== null;
            },
            bypass: (element) => {
                element.ondragstart = null;
                element.removeAttribute('ondragstart');
            }
        }
    },

    // Known good domains (sites that don't typically block)
    trustedDomains: [
        'stackoverflow.com',
        'github.com',
        'mozilla.org',
        'w3.org',
        'developer.mozilla.org',
        'google.com',
        'wikipedia.org',
        'archive.org'
    ],

    // Known problematic domains (sites that commonly block)
    problematicDomains: [
        'medium.com',
        'nytimes.com',
        'wsj.com',
        'bloomberg.com',
        'ft.com',
        'economist.com',
        'forbes.com',
        'businessinsider.com',
        'quora.com',
        'scribd.com'
    ],

    // Content type patterns that might indicate blocking
    contentTypePatterns: {
        articles: [
            '.article',
            '.post',
            '.content',
            '.entry',
            'article',
            '[role="article"]'
        ],
        
        codeBlocks: [
            'pre',
            'code',
            '.highlight',
            '.code-block',
            '.source-code'
        ],

        textContent: [
            'p',
            '.text',
            '.paragraph',
            '.body',
            '.content-body'
        ]
    },

    // Browser-specific detection patterns
    browserSpecific: {
        chrome: {
            userAgentPattern: /Chrome/,
            specificBlocking: [
                '-webkit-user-select',
                '-webkit-touch-callout'
            ]
        },
        
        firefox: {
            userAgentPattern: /Firefox/,
            specificBlocking: [
                '-moz-user-select'
            ]
        },

        safari: {
            userAgentPattern: /Safari/,
            specificBlocking: [
                '-webkit-user-select',
                '-webkit-touch-callout'
            ]
        },

        edge: {
            userAgentPattern: /Edge/,
            specificBlocking: [
                '-ms-user-select'
            ]
        }
    },

    // Methods to detect different types of blocking
    detectionMethods: {
        // Detect CSS-based blocking
        detectCSSBlocking(element = document.body) {
            const patterns = DetectionPatterns.cssBlockingPatterns;
            const style = window.getComputedStyle(element);
            
            return patterns.some(pattern => 
                style.getPropertyValue(pattern.property) === pattern.value
            );
        },

        // Detect JavaScript-based blocking
        detectJSBlocking(element = document.body) {
            const patterns = DetectionPatterns.jsBlockingPatterns;
            
            return patterns.some(pattern => 
                element[pattern] !== null && element[pattern] !== undefined
            );
        },

        // Detect blocking by class names
        detectBlockingClasses(element = document.body) {
            const classes = DetectionPatterns.blockingClassNames;
            
            return classes.some(className => {
                return document.querySelector(`.${className}`) !== null ||
                       element.classList.contains(className);
            });
        },

        // Detect tracking scripts
        detectTrackingScripts() {
            const scripts = Array.from(document.querySelectorAll('script[src]'));
            const patterns = DetectionPatterns.trackingScriptPatterns;
            
            return scripts.some(script => {
                const src = script.src.toLowerCase();
                return DetectionPatterns.trackingScripts.some(tracker => 
                    src.includes(tracker.toLowerCase())
                ) || patterns.some(pattern => pattern.test(src));
            });
        },

        // Detect site-specific blocking
        detectSiteSpecific(url = window.location.href) {
            const domain = new URL(url).hostname;
            const baseDomain = domain.replace(/^www\./, '');
            
            return DetectionPatterns.siteSpecificFixes.hasOwnProperty(baseDomain);
        },

        // Get bypass method for current site
        getBypassMethod(url = window.location.href) {
            const domain = new URL(url).hostname;
            const baseDomain = domain.replace(/^www\./, '');
            
            return DetectionPatterns.siteSpecificFixes[baseDomain] || null;
        }
    },

    // Bypass methods for different blocking types
    bypassMethods: {
        // Remove all CSS-based blocking
        removeCSSBlocking() {
            const style = document.createElement('style');
            style.id = 'copyblock-detector-css-bypass';
            style.textContent = `
                *, *::before, *::after {
                    user-select: text !important;
                    -webkit-user-select: text !important;
                    -moz-user-select: text !important;
                    -ms-user-select: text !important;
                    -webkit-touch-callout: default !important;
                    pointer-events: auto !important;
                }
            `;
            document.head.appendChild(style);
        },

        // Remove JavaScript-based blocking
        removeJSBlocking() {
            const elements = [document, document.body, document.documentElement];
            const patterns = DetectionPatterns.jsBlockingPatterns;
            
            elements.forEach(element => {
                if (!element) return;
                patterns.forEach(pattern => {
                    if (element[pattern]) {
                        element[pattern] = null;
                    }
                });
            });

            // Remove from all elements
            document.querySelectorAll('*').forEach(element => {
                patterns.forEach(pattern => {
                    if (element[pattern]) {
                        element[pattern] = null;
                    }
                });
            });
        },

        // Remove blocking classes
        removeBlockingClasses() {
            DetectionPatterns.blockingClassNames.forEach(className => {
                document.querySelectorAll(`.${className}`).forEach(element => {
                    element.classList.remove(className);
                });
            });
        },

        // Remove invisible overlays
        removeInvisibleOverlays() {
            DetectionPatterns.advancedPatterns.invisibleOverlays.forEach(selector => {
                document.querySelectorAll(selector).forEach(element => {
                    const style = window.getComputedStyle(element);
                    const zIndex = parseInt(style.zIndex) || 0;
                    const position = style.position;
                    
                    if ((position === 'absolute' || position === 'fixed') && zIndex > 1000) {
                        element.style.display = 'none';
                    }
                });
            });
        },

        // Apply site-specific fixes
        applySiteSpecificFix(url = window.location.href) {
            const bypassMethod = DetectionPatterns.detectionMethods.getBypassMethod(url);
            
            if (bypassMethod && bypassMethod.selectors) {
                bypassMethod.selectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(element => {
                        element.style.display = 'none';
                    });
                });
            }
        }
    }
};

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DetectionPatterns;
} else if (typeof window !== 'undefined') {
    window.DetectionPatterns = DetectionPatterns;
} else {
    this.DetectionPatterns = DetectionPatterns;
}