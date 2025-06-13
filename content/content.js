// Check if we're in a valid content script environment
if (typeof document === 'undefined' || typeof window === 'undefined') {
  console.log('Not in a valid content script environment, skipping initialization');
} else {
  class CopyBlockDetector {
    constructor() {
      this.detectionResults = {
        cssBlocking: false,
        jsBlocking: false,
        contextMenuBlocked: false,
        copyTracking: false,
        pasteTracking: false,
        selectionBlocked: false
      };
      this.observer = null;
      this.injectedScript = null;
      this.initialized = false;
      this.contextValid = false;
      
      // Bind methods to preserve context
      this.handleInjectedMessage = this.handleInjectedMessage.bind(this);
      this.handleRuntimeMessage = this.handleRuntimeMessage.bind(this);
      
      // Check if extension context is valid
      this.checkExtensionContext();
    }

    checkExtensionContext() {
      try {
        // More thorough context check
        if (typeof chrome !== 'undefined' && 
            chrome.runtime && 
            chrome.runtime.id && 
            chrome.runtime.getURL) {
          this.contextValid = true;
          // Initialize after context is confirmed
          this.init();
        } else {
          this.contextValid = false;
          console.log('Extension context is not available');
        }
      } catch (error) {
        this.contextValid = false;
        console.log('Extension context check failed:', error.message);
      }
    }

    async init() {
      if (this.initialized || !this.contextValid) return;
      
      try {
        await this.waitForDOM();
        this.initialized = true;
        
        await this.injectDetectionScript();
        this.detectCSSBlocking();
        this.detectJSBlocking();
        this.detectEventTracking();
        this.detectSelectionBlocking();
        this.monitorDynamicChanges();
        this.setupMessageListeners();
        
        // Small delay before sending initial report to ensure everything is ready
        setTimeout(() => this.sendInitialReport(), 100);
        
      } catch (error) {
        console.error('CopyBlockDetector initialization failed:', error);
        this.initialized = false;
      }
    }

    waitForDOM() {
      return new Promise((resolve) => {
        if (!document) {
          resolve();
          return;
        }
        
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', resolve, { once: true });
        } else {
          resolve();
        }
      });
    }

    async injectDetectionScript() {
      if (!this.contextValid || !document || !chrome.runtime) return;
      
      try {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('content/injected.js');
        script.onload = () => script.remove();
        script.onerror = (error) => {
          console.error('Failed to inject detection script:', error);
        };
        
        const target = document.head || document.documentElement;
        if (target) {
          target.appendChild(script);
          this.injectedScript = script;
        }
      } catch (error) {
        console.error('Error injecting detection script:', error);
        this.contextValid = false;
      }
    }

    setupMessageListeners() {
      // Listen for messages from injected script
      if (window) {
        window.addEventListener('message', this.handleInjectedMessage);
      }

      // Listen for messages from popup/background with context validation
      if (this.contextValid && chrome.runtime && chrome.runtime.onMessage) {
        try {
          chrome.runtime.onMessage.addListener(this.handleRuntimeMessage);
        } catch (error) {
          console.error('Failed to set up runtime message listener:', error);
          this.contextValid = false;
        }
      }
    }

    handleInjectedMessage(event) {
      if (!event || event.source !== window) return;
      
      const message = event.data;
      if (!message || !message.type || !message.type.startsWith('COPYBLOCK_')) {
        return;
      }

      try {
        switch (message.type) {
          case 'COPYBLOCK_LISTENER_DETECTED':
            this.detectionResults.copyTracking = message.eventType === 'copy';
            this.detectionResults.pasteTracking = message.eventType === 'paste';
            this.sendStatusUpdate();
            break;
            
          case 'COPYBLOCK_PREVENT_DEFAULT':
            if (message.eventType === 'contextmenu') {
              this.detectionResults.contextMenuBlocked = true;
            }
            this.sendStatusUpdate();
            break;
            
          case 'COPYBLOCK_CSS_DETECTED':
            this.detectionResults.cssBlocking = true;
            this.sendStatusUpdate();
            break;
        }
      } catch (error) {
        console.error('Error handling injected message:', error);
      }
    }

    handleRuntimeMessage(msg, sender, sendResponse) {
      try {
        if (msg.type === 'ENABLE_COPY') {
          this.enableCopy();
          sendResponse({ success: true });
        } else if (msg.type === 'GET_STATUS') {
          sendResponse(this.detectionResults);
        }
      } catch (error) {
        console.error('Error handling runtime message:', error);
        sendResponse({ error: error.message });
      }
      return true; // Keep message channel open
    }

    detectCSSBlocking() {
      if (!document || !window) return;
      
      try {
        // Check multiple CSS properties that can block selection
        const elementsToCheck = [document.body, document.documentElement].filter(Boolean);
        
        elementsToCheck.forEach(el => {
          if (!el) return;
          
          const styles = window.getComputedStyle(el);
          const blockingStyles = [
            styles.userSelect === 'none',
            styles.webkitUserSelect === 'none',
            styles.MozUserSelect === 'none',
            styles.msUserSelect === 'none',
            styles.pointerEvents === 'none'
          ];
          
          if (blockingStyles.some(blocked => blocked)) {
            this.detectionResults.cssBlocking = true;
          }
        });

        // Check for CSS rules in stylesheets
        this.checkStylesheets();
        
        // Check for blocking class names
        this.checkBlockingClasses();
      } catch (error) {
        console.error('Error detecting CSS blocking:', error);
      }
    }

    checkStylesheets() {
      if (!document) return;
      
      try {
        for (let sheet of document.styleSheets) {
          try {
            const rules = sheet.cssRules || sheet.rules;
            if (!rules) continue;
            
            for (let rule of rules) {
              if (rule.style) {
                const userSelect = rule.style.userSelect || rule.style.webkitUserSelect;
                if (userSelect === 'none') {
                  this.detectionResults.cssBlocking = true;
                  return;
                }
              }
            }
          } catch (e) {
            // Cross-origin stylesheet, skip
            continue;
          }
        }
      } catch (e) {
        console.log('Could not check stylesheets:', e);
      }
    }

    checkBlockingClasses() {
      if (!document || !window.DetectionPatterns) return;
      
      try {
        const blockingClasses = window.DetectionPatterns.blockingClassNames;
        const hasBlockingClass = blockingClasses.some(className => {
          try {
            return document.querySelector(`.${className}`) !== null;
          } catch (e) {
            return false;
          }
        });
        
        if (hasBlockingClass) {
          this.detectionResults.cssBlocking = true;
        }
      } catch (error) {
        console.error('Error checking blocking classes:', error);
      }
    }

    detectJSBlocking() {
      if (!document) return;
      
      try {
        // Check for inline event handlers that might block
        const blockingHandlers = [
          'onselectstart', 'oncontextmenu', 'ondragstart', 
          'oncopy', 'oncut', 'onpaste'
        ];

        const elementsToCheck = [document.body, document.documentElement, document].filter(Boolean);
        
        elementsToCheck.forEach(el => {
          if (!el) return;
          
          blockingHandlers.forEach(handler => {
            if (el[handler]) {
              this.detectionResults.jsBlocking = true;
            }
          });
        });

        // Test for function-based blocking
        this.testEventBlocking();
      } catch (error) {
        console.error('Error detecting JS blocking:', error);
      }
    }

    testEventBlocking() {
      if (!document || !document.body) return;
      
      try {
        // Test if contextmenu event is blocked
        const testDiv = document.createElement('div');
        testDiv.style.cssText = 'position: absolute; left: -9999px; width: 1px; height: 1px;';
        testDiv.textContent = 'test';
        
        document.body.appendChild(testDiv);

        const contextHandler = (e) => {
          if (e.defaultPrevented) {
            this.detectionResults.contextMenuBlocked = true;
          }
        };

        testDiv.addEventListener('contextmenu', contextHandler);
        
        // Simulate context menu event
        const contextEvent = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true
        });
        
        testDiv.dispatchEvent(contextEvent);
        testDiv.removeEventListener('contextmenu', contextHandler);
        
        if (document.body.contains(testDiv)) {
          document.body.removeChild(testDiv);
        }
      } catch (error) {
        console.error('Error testing event blocking:', error);
      }
    }

    detectEventTracking() {
      if (!window || !window.EventTarget || !EventTarget.prototype.addEventListener) return;
      
      try {
        // Enhanced event listener detection
        const originalAddEventListener = EventTarget.prototype.addEventListener;
        const trackedEvents = ['copy', 'paste', 'cut', 'selectstart', 'contextmenu'];
        const self = this;
        
        EventTarget.prototype.addEventListener = function(type, listener, options) {
          if (trackedEvents.includes(type)) {
            try {
              if (self.contextValid) {
                self.safeRuntimeMessage({
                  type: 'EVENT_TRACKING_DETECTED',
                  eventType: type,
                  target: this.tagName || 'unknown'
                });
              }
              
              if (type === 'copy') self.detectionResults.copyTracking = true;
              if (type === 'paste') self.detectionResults.pasteTracking = true;
            } catch (error) {
              // Silently handle errors to avoid breaking the page
            }
          }
          return originalAddEventListener.call(this, type, listener, options);
        };
      } catch (error) {
        console.error('Error setting up event tracking detection:', error);
      }
    }

    detectSelectionBlocking() {
      if (!document || !document.body || !window) return;
      
      try {
        // Test if text selection actually works
        const testElement = document.createElement('div');
        testElement.textContent = 'test selection';
        testElement.style.cssText = 'position: absolute; left: -9999px; user-select: text; width: 100px; height: 20px;';
        
        document.body.appendChild(testElement);

        const range = document.createRange();
        range.selectNodeContents(testElement);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        // Check if selection worked
        const selectedText = selection.toString();
        this.detectionResults.selectionBlocked = selectedText !== 'test selection';
        
        selection.removeAllRanges();
        if (document.body.contains(testElement)) {
          document.body.removeChild(testElement);
        }
      } catch (e) {
        console.error('Error testing selection blocking:', e);
        this.detectionResults.selectionBlocked = true;
      }
    }

    monitorDynamicChanges() {
      if (!document || !document.body || !window.MutationObserver) return;
      
      try {
        // Watch for dynamic changes that might add blocking
        this.observer = new MutationObserver(this.debounce((mutations) => {
          let needsRecheck = false;
          
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes') {
              const attr = mutation.attributeName;
              if (['style', 'class', 'oncontextmenu', 'onselectstart'].includes(attr)) {
                needsRecheck = true;
              }
            } else if (mutation.type === 'childList') {
              // Check if new style elements were added
              mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  if (node.tagName === 'STYLE' || node.tagName === 'LINK') {
                    needsRecheck = true;
                  }
                }
              });
            }
          });
          
          if (needsRecheck) {
            this.recheckBlocking();
          }
        }, 500));

        this.observer.observe(document.body, {
          attributes: true,
          subtree: true,
          childList: true,
          attributeFilter: ['style', 'class', 'oncontextmenu', 'onselectstart']
        });
      } catch (error) {
        console.error('Error setting up dynamic monitoring:', error);
      }
    }

    // Simple debounce function
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
    }

    recheckBlocking() {
      try {
        const previousState = { ...this.detectionResults };
        
        // Reset and recheck
        this.detectionResults.cssBlocking = false;
        this.detectionResults.jsBlocking = false;
        
        this.detectCSSBlocking();
        this.detectJSBlocking();
        
        // Only send update if something changed
        if (JSON.stringify(previousState) !== JSON.stringify(this.detectionResults)) {
          this.sendStatusUpdate();
        }
      } catch (error) {
        console.error('Error rechecking blocking:', error);
      }
    }

    // Safe runtime message sending with context validation
    safeRuntimeMessage(message) {
      if (!this.contextValid) return;
      
      try {
        // Re-check context before sending
        if (chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage(message).catch(error => {
            if (error.message.includes('Extension context invalidated')) {
              this.contextValid = false;
              console.log('Extension context invalidated, stopping message sending');
            }
          });
        } else {
          this.contextValid = false;
        }
      } catch (error) {
        this.contextValid = false;
      }
    }

    sendInitialReport() {
      this.safeRuntimeMessage({
        type: 'DETECTION_COMPLETE',
        results: this.detectionResults,
        url: window.location.href,
        title: document.title
      });
    }

    sendStatusUpdate() {
      this.safeRuntimeMessage({
        type: 'DETECTION_UPDATE',
        results: this.detectionResults
      });
    }

    // Enhanced copy enabler
    enableCopy() {
      if (!document) return;
      
      try {
        // Remove CSS blocking with high-priority styles
        let style = document.getElementById('copyblock-detector-override');
        if (!style) {
          style = document.createElement('style');
          style.id = 'copyblock-detector-override';
          style.textContent = `
            *, *::before, *::after {
              user-select: text !important;
              -webkit-user-select: text !important;
              -moz-user-select: text !important;
              -ms-user-select: text !important;
              pointer-events: auto !important;
            }
            
            body, html {
              user-select: text !important;
              -webkit-user-select: text !important;
              -moz-user-select: text !important;
              -ms-user-select: text !important;
            }
          `;
          
          const target = document.head || document.documentElement;
          if (target) {
            target.appendChild(style);
          }
        }

        // Remove JS blocking from common elements
        const elementsToFix = [document.body, document.documentElement, document].filter(Boolean);
        const blockingProps = [
          'oncontextmenu', 'onselectstart', 'ondragstart', 
          'oncopy', 'oncut', 'onpaste'
        ];
        
        elementsToFix.forEach(el => {
          if (!el) return;
          blockingProps.forEach(prop => {
            if (el[prop]) {
              el[prop] = null;
            }
          });
        });

        // Remove blocking from all elements
        if (document.querySelectorAll) {
          document.querySelectorAll('*').forEach(el => {
            blockingProps.forEach(prop => {
              if (el[prop]) {
                el[prop] = null;
              }
            });
            
            // Reset CSS properties
            try {
              el.style.userSelect = 'text';
              el.style.webkitUserSelect = 'text';
              el.style.pointerEvents = 'auto';
            } catch (e) {
              // Some elements might not support style changes
            }
          });
        }

        // Override common blocking functions with high priority
        ['contextmenu', 'selectstart', 'dragstart'].forEach(eventType => {
          if (document.addEventListener) {
            document.addEventListener(eventType, (e) => {
              e.stopImmediatePropagation();
            }, {
              capture: true,
              passive: false
            });
          }
        });

        // Call injected script cleanup if available
        if (window && window.copyBlockRemoveListeners) {
          window.copyBlockRemoveListeners();
        }

        // Remove blocking classes
        if (window && window.DetectionPatterns && document.querySelectorAll) {
          window.DetectionPatterns.blockingClassNames.forEach(className => {
            document.querySelectorAll(`.${className}`).forEach(el => {
              el.classList.remove(className);
            });
          });
        }

        this.safeRuntimeMessage({
          type: 'COPY_ENABLED',
          message: '✅ All copy restrictions removed successfully!'
        });
      } catch (error) {
        console.error('Error enabling copy:', error);
      }
    }

    // Cleanup method
    destroy() {
      try {
        if (this.observer) {
          this.observer.disconnect();
          this.observer = null;
        }
        
        // Remove injected styles
        if (document) {
          const overrideStyle = document.getElementById('copyblock-detector-override');
          if (overrideStyle) {
            overrideStyle.remove();
          }
        }

        // Remove event listeners
        if (window) {
          window.removeEventListener('message', this.handleInjectedMessage);
        }
        
        if (this.contextValid && chrome.runtime && chrome.runtime.onMessage) {
          try {
            chrome.runtime.onMessage.removeListener(this.handleRuntimeMessage);
          } catch (error) {
            // Context may already be invalid
          }
        }
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    }
  }

  // Monitor URL changes for SPAs (Single Page Applications)
  monitorUrlChanges() {
    // Create a more robust URL change detector
    let lastUrl = window.location.href;
    let lastDomain = this.getDomainFromCurrentUrl();
    
    const checkForUrlChange = () => {
      const currentUrl = window.location.href;
      const currentDomain = this.getDomainFromCurrentUrl();
      
      if (currentUrl !== lastUrl) {
        console.log('URL changed from', lastUrl, 'to', currentUrl);
        
        // If domain changed, reset and re-initialize
        if (currentDomain !== lastDomain) {
          console.log('Domain changed from', lastDomain, 'to', currentDomain);
          this.currentUrl = currentUrl;
          this.currentDomain = currentDomain;
          
          // Reset detection results for new domain
          this.detectionResults = {
            cssBlocking: false,
            jsBlocking: false,
            contextMenuBlocked: false,
            copyTracking: false,
            pasteTracking: false,
            selectionBlocked: false
          };
          
          // Re-run detection for new domain
          setTimeout(() => {
            this.detectCSSBlocking();
            this.detectJSBlocking();
            this.detectSelectionBlocking();
            this.sendInitialReport();
          }, 500);
        }
        
        lastUrl = currentUrl;
        lastDomain = currentDomain;
      }
    };
    
    // Monitor using multiple methods for better compatibility
    
    // Method 1: Monitor history API changes
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      setTimeout(checkForUrlChange, 100);
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      setTimeout(checkForUrlChange, 100);
    };
    
    // Method 2: Listen to popstate events
    window.addEventListener('popstate', () => {
      setTimeout(checkForUrlChange, 100);
    });
    
    // Method 3: Periodic check as fallback
    setInterval(checkForUrlChange, 2000);
    
    // Method 4: Monitor hash changes
    window.addEventListener('hashchange', () => {
      setTimeout(checkForUrlChange, 100);
    });
  }

  // Initialize detector with proper error handling and context validation
  try {
    // Only initialize if we have a valid extension context and document
    if (typeof chrome !== 'undefined' && 
        chrome.runtime && 
        chrome.runtime.id && 
        document && 
        window) {
      
      // Wait for DOM to be ready before initializing
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          try {
            window.copyBlockDetector = new CopyBlockDetector();
          } catch (error) {
            console.error('Failed to initialize CopyBlockDetector on DOMContentLoaded:', error);
          }
        }, { once: true });
      } else {
        window.copyBlockDetector = new CopyBlockDetector();
      }
    } else {
      console.log('Extension context or document not available, skipping CopyBlockDetector initialization');
    }
  } catch (error) {
    console.error('Failed to initialize CopyBlockDetector:', error);
  }
}