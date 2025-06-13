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
    this.init();
  }

  init() {
    this.injectDetectionScript();
    this.detectCSSBlocking();
    this.detectJSBlocking();
    this.detectEventTracking();
    this.detectSelectionBlocking();
    this.monitorDynamicChanges();
    this.setupMessageListeners();
    this.sendInitialReport();
  }

  injectDetectionScript() {
    // Inject script into page context for deeper detection
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/injected.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
    this.injectedScript = script;
  }

  setupMessageListeners() {
    // Listen for messages from injected script
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      
      const message = event.data;
      if (message && message.type && message.type.startsWith('COPYBLOCK_')) {
        this.handleInjectedMessage(message);
      }
    });

    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'ENABLE_COPY') {
        this.enableCopy();
      } else if (msg.type === 'GET_STATUS') {
        sendResponse(this.detectionResults);
      }
      return true;
    });
  }

  handleInjectedMessage(message) {
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
  }

  detectCSSBlocking() {
    // Check multiple CSS properties that can block selection
    const elementsToCheck = [document.body, document.documentElement];
    
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
  }

  checkStylesheets() {
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
                break;
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
    if (window.DetectionPatterns) {
      const blockingClasses = window.DetectionPatterns.blockingClassNames;
      const hasBlockingClass = blockingClasses.some(className => 
        document.querySelector(`.${className}`)
      );
      
      if (hasBlockingClass) {
        this.detectionResults.cssBlocking = true;
      }
    }
  }

  detectJSBlocking() {
    // Check for inline event handlers that might block
    const blockingHandlers = [
      'onselectstart', 'oncontextmenu', 'ondragstart', 
      'oncopy', 'oncut', 'onpaste'
    ];

    const elementsToCheck = [document.body, document.documentElement, document];
    
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
  }

  testEventBlocking() {
    // Test if contextmenu event is blocked
    const testDiv = document.createElement('div');
    testDiv.style.position = 'absolute';
    testDiv.style.left = '-9999px';
    testDiv.textContent = 'test';
    document.body.appendChild(testDiv);

    let contextBlocked = false;
    const contextHandler = (e) => {
      if (e.defaultPrevented) {
        contextBlocked = true;
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
    document.body.removeChild(testDiv);
  }

  detectEventTracking() {
    // Enhanced event listener detection
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const trackedEvents = ['copy', 'paste', 'cut', 'selectstart', 'contextmenu'];
    const self = this;
    
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (trackedEvents.includes(type)) {
        chrome.runtime.sendMessage({
          type: 'EVENT_TRACKING_DETECTED',
          eventType: type,
          target: this.tagName || 'unknown'
        });
        
        if (type === 'copy') self.detectionResults.copyTracking = true;
        if (type === 'paste') self.detectionResults.pasteTracking = true;
      }
      return originalAddEventListener.call(this, type, listener, options);
    };
  }

  detectSelectionBlocking() {
    // Test if text selection actually works
    try {
      const testElement = document.createElement('div');
      testElement.textContent = 'test selection';
      testElement.style.position = 'absolute';
      testElement.style.left = '-9999px';
      testElement.style.userSelect = 'text';
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
      document.body.removeChild(testElement);
    } catch (e) {
      this.detectionResults.selectionBlocked = true;
    }
  }

  monitorDynamicChanges() {
    // Watch for dynamic changes that might add blocking
    this.observer = new MutationObserver(Utils.debounce((mutations) => {
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

    if (document.body) {
      this.observer.observe(document.body, {
        attributes: true,
        subtree: true,
        childList: true,
        attributeFilter: ['style', 'class', 'oncontextmenu', 'onselectstart']
      });
    }
  }

  recheckBlocking() {
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
  }

  sendInitialReport() {
    chrome.runtime.sendMessage({
      type: 'DETECTION_COMPLETE',
      results: this.detectionResults,
      url: window.location.href,
      title: document.title
    });
  }

  sendStatusUpdate() {
    chrome.runtime.sendMessage({
      type: 'DETECTION_UPDATE',
      results: this.detectionResults
    });
  }

  // Enhanced copy enabler
  enableCopy() {
    // Remove CSS blocking with high-priority styles
    const style = document.createElement('style');
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
    document.head.appendChild(style);

    // Remove JS blocking from common elements
    const elementsToFix = [document.body, document.documentElement, document];
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
    document.querySelectorAll('*').forEach(el => {
      blockingProps.forEach(prop => {
        if (el[prop]) {
          el[prop] = null;
        }
      });
      
      // Reset CSS properties
      el.style.userSelect = 'text';
      el.style.webkitUserSelect = 'text';
      el.style.pointerEvents = 'auto';
    });

    // Override common blocking functions with high priority
    ['contextmenu', 'selectstart', 'dragstart'].forEach(eventType => {
      document.addEventListener(eventType, (e) => {
        e.stopImmediatePropagation();
      }, {
        capture: true,
        passive: false
      });
    });

    // Call injected script cleanup if available
    if (window.copyBlockRemoveListeners) {
      window.copyBlockRemoveListeners();
    }

    // Remove blocking classes
    if (window.DetectionPatterns) {
      window.DetectionPatterns.blockingClassNames.forEach(className => {
        document.querySelectorAll(`.${className}`).forEach(el => {
          el.classList.remove(className);
        });
      });
    }

    chrome.runtime.sendMessage({
      type: 'COPY_ENABLED',
      message: '✅ All copy restrictions removed successfully!'
    });
  }

  // Cleanup method
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    // Remove injected styles
    const overrideStyle = document.getElementById('copyblock-detector-override');
    if (overrideStyle) {
      overrideStyle.remove();
    }
  }
}

// Initialize detector when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.copyBlockDetector = new CopyBlockDetector();
  });
} else {
  window.copyBlockDetector = new CopyBlockDetector();
}