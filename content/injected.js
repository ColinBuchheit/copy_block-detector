(function() {
    'use strict';
    
    // Prevent multiple injections
    if (window.copyBlockDetectorInjected) {
        return;
    }
    window.copyBlockDetectorInjected = true;
    
    // Deep detection that needs access to page's JavaScript context
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
    
    // Track all copy/paste related event listeners
    const trackedListeners = new Map();
    
    // Override addEventListener to detect tracking
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (['copy', 'paste', 'cut', 'selectstart', 'contextmenu'].includes(type)) {
            // Store listener for potential removal
            if (!trackedListeners.has(this)) {
                trackedListeners.set(this, []);
            }
            trackedListeners.get(this).push({ type, listener, options });
            
            // Notify content script
            window.postMessage({
                type: 'COPYBLOCK_LISTENER_DETECTED',
                eventType: type,
                target: this.tagName || 'unknown'
            }, '*');
        }
        
        return originalAddEventListener.call(this, type, listener, options);
    };
    
    // Override common blocking functions
    const originalPreventDefault = Event.prototype.preventDefault;
    Event.prototype.preventDefault = function() {
        if (['contextmenu', 'selectstart', 'copy', 'paste'].includes(this.type)) {
            window.postMessage({
                type: 'COPYBLOCK_PREVENT_DEFAULT',
                eventType: this.type
            }, '*');
        }
        return originalPreventDefault.call(this);
    };
    
    // Override stopPropagation for blocking detection
    const originalStopPropagation = Event.prototype.stopPropagation;
    Event.prototype.stopPropagation = function() {
        if (['contextmenu', 'selectstart', 'copy', 'paste'].includes(this.type)) {
            window.postMessage({
                type: 'COPYBLOCK_STOP_PROPAGATION',
                eventType: this.type
            }, '*');
        }
        return originalStopPropagation.call(this);
    };
    
    // Detect CSS-based blocking
    function detectCSSBlocking() {
        const elementsToCheck = [document.body, document.documentElement];
        
        elementsToCheck.forEach(el => {
            if (!el) return;
            
            const computedStyle = window.getComputedStyle(el);
            const blockingProperties = {
                userSelect: computedStyle.userSelect === 'none',
                webkitUserSelect: computedStyle.webkitUserSelect === 'none',
                mozUserSelect: computedStyle.MozUserSelect === 'none',
                msUserSelect: computedStyle.msUserSelect === 'none',
                pointerEvents: computedStyle.pointerEvents === 'none'
            };
            
            if (Object.values(blockingProperties).some(blocked => blocked)) {
                window.postMessage({
                    type: 'COPYBLOCK_CSS_DETECTED',
                    properties: blockingProperties,
                    element: el.tagName
                }, '*');
            }
        });
    }
    
    // Detect inline blocking attributes
    function detectInlineBlocking() {
        const blockingAttributes = [
            'onselectstart', 'oncontextmenu', 'ondragstart',
            'oncopy', 'oncut', 'onpaste'
        ];
        
        const elementsToCheck = [document.body, document.documentElement];
        
        elementsToCheck.forEach(el => {
            if (!el) return;
            
            blockingAttributes.forEach(attr => {
                if (el.getAttribute(attr) || el[attr]) {
                    window.postMessage({
                        type: 'COPYBLOCK_INLINE_BLOCKING',
                        attribute: attr,
                        element: el.tagName
                    }, '*');
                }
            });
        });
    }
    
    // Detect clipboard API hijacking
    function detectClipboardHijacking() {
        if (navigator.clipboard) {
            const originalWriteText = navigator.clipboard.writeText;
            const originalReadText = navigator.clipboard.readText;
            
            navigator.clipboard.writeText = function(...args) {
                window.postMessage({
                    type: 'COPYBLOCK_CLIPBOARD_HIJACK',
                    action: 'writeText',
                    args: args.length
                }, '*');
                return originalWriteText.apply(this, args);
            };
            
            if (originalReadText) {
                navigator.clipboard.readText = function(...args) {
                    window.postMessage({
                        type: 'COPYBLOCK_CLIPBOARD_HIJACK',
                        action: 'readText'
                    }, '*');
                    return originalReadText.apply(this, args);
                };
            }
        }
    }
    
    // Detect text selection interference
    function detectSelectionInterference() {
        const originalGetSelection = window.getSelection;
        window.getSelection = function() {
            const selection = originalGetSelection.call(this);
            
            // Check if selection is being manipulated
            const originalRemoveAllRanges = selection.removeAllRanges;
            selection.removeAllRanges = function() {
                window.postMessage({
                    type: 'COPYBLOCK_SELECTION_CLEARED',
                    timestamp: Date.now()
                }, '*');
                return originalRemoveAllRanges.call(this);
            };
            
            return selection;
        };
    }
    
    // Run initial detection
    function runInitialDetection() {
        detectCSSBlocking();
        detectInlineBlocking();
        detectClipboardHijacking();
        detectSelectionInterference();
    }
    
    // Export function to remove all tracked listeners
    window.copyBlockRemoveListeners = function() {
        trackedListeners.forEach((listeners, element) => {
            listeners.forEach(({ type, listener, options }) => {
                try {
                    originalRemoveEventListener.call(element, type, listener, options);
                } catch (e) {
                    // Element might be removed, ignore error
                }
            });
        });
        trackedListeners.clear();
        
        window.postMessage({
            type: 'COPYBLOCK_LISTENERS_REMOVED',
            count: trackedListeners.size
        }, '*');
    };
    
    // Export function to restore original functions
    window.copyBlockRestoreOriginals = function() {
        EventTarget.prototype.addEventListener = originalAddEventListener;
        EventTarget.prototype.removeEventListener = originalRemoveEventListener;
        Event.prototype.preventDefault = originalPreventDefault;
        Event.prototype.stopPropagation = originalStopPropagation;
    };
    
    // Run detection when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runInitialDetection);
    } else {
        runInitialDetection();
    }
    
    // Monitor for dynamic changes
    const observer = new MutationObserver((mutations) => {
        let needsRecheck = false;
        
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes') {
                const attr = mutation.attributeName;
                if (['onselectstart', 'oncontextmenu', 'style'].includes(attr)) {
                    needsRecheck = true;
                }
            }
        });
        
        if (needsRecheck) {
            setTimeout(runInitialDetection, 100);
        }
    });
    
    if (document.body) {
        observer.observe(document.body, {
            attributes: true,
            subtree: true,
            attributeFilter: ['onselectstart', 'oncontextmenu', 'style', 'class']
        });
    }
    
})();