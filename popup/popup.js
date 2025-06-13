class PopupUI {
  constructor() {
    this.elements = {
      mainStatus: document.getElementById('mainStatus'),
      cssStatus: document.getElementById('cssStatus'),
      jsStatus: document.getElementById('jsStatus'),
      trackingStatus: document.getElementById('trackingStatus'),
      contextStatus: document.getElementById('contextStatus'),
      enableBtn: document.getElementById('enableCopyBtn'),
      buttonText: document.getElementById('buttonText'),
      buttonLoading: document.getElementById('buttonLoading'),
      autoToggle: document.getElementById('autoToggle'),
      notifyToggle: document.getElementById('notifyToggle'),
      whitelistBtn: document.getElementById('whitelistBtn'),
      settingsBtn: document.getElementById('settingsBtn'),
      themeToggle: document.getElementById('themeToggle'),
      themeIcon: document.getElementById('themeIcon')
    };
    
    this.currentStatus = null;
    this.currentTab = null;
    this.currentTheme = 'light';
    this.init();
  }

  init() {
    this.loadTheme();
    this.getCurrentTab();
    this.setupEventListeners();
    this.loadSettings();
    this.requestStatus();
  }

  loadTheme() {
    // Load saved theme or detect system preference
    const savedTheme = localStorage.getItem('copyblock-theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    
    this.currentTheme = savedTheme || systemTheme;
    this.applyTheme(this.currentTheme);
  }

  applyTheme(theme) {
    this.currentTheme = theme;
    document.body.setAttribute('data-theme', theme);
    
    if (this.elements.themeIcon) {
      this.elements.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    
    // Save theme preference
    localStorage.setItem('copyblock-theme', theme);
  }

  toggleTheme() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(newTheme);
    
    // Add a nice transition effect
    document.body.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      document.body.style.transition = '';
    }, 300);
  }

  getCurrentTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        this.currentTab = tabs[0];
      }
    });
  }

  setupEventListeners() {
    // Theme toggle
    if (this.elements.themeToggle) {
      this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
    }
    
    if (this.elements.enableBtn) {
      this.elements.enableBtn.addEventListener('click', () => this.enableCopy());
    }
    
    if (this.elements.autoToggle) {
      this.elements.autoToggle.addEventListener('click', () => this.toggleSetting('autoEnable'));
    }
    
    if (this.elements.notifyToggle) {
      this.elements.notifyToggle.addEventListener('click', () => this.toggleSetting('showNotifications'));
    }
    
    if (this.elements.whitelistBtn) {
      this.elements.whitelistBtn.addEventListener('click', () => this.addToWhitelist());
    }
    
    if (this.elements.settingsBtn) {
      this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
    }

    // Listen for status updates
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'DETECTION_COMPLETE' || msg.type === 'DETECTION_UPDATE') {
          this.updateStatus(msg.results);
        } else if (msg.type === 'COPY_ENABLED') {
          this.showSuccess(msg.message);
        }
      });
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('copyblock-theme')) {
        this.applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  requestStatus() {
    if (!this.currentTab) {
      setTimeout(() => this.requestStatus(), 100);
      return;
    }

    // Skip special pages that don't support content scripts
    if (this.currentTab.url && (
        this.currentTab.url.startsWith('chrome://') ||
        this.currentTab.url.startsWith('chrome-extension://') ||
        this.currentTab.url.startsWith('edge://') ||
        this.currentTab.url.startsWith('moz-extension://') ||
        this.currentTab.url.startsWith('about:')
      )) {
      this.showError('Cannot analyze this page type');
      return;
    }

    // First, try to get existing state from background script
    chrome.runtime.sendMessage({ 
      type: 'GET_CURRENT_TAB_STATE', 
      tabId: this.currentTab.id 
    }, (backgroundState) => {
      if (backgroundState && backgroundState.results) {
        // We have existing state for this domain
        this.updateStatus(backgroundState.results);
        return;
      }

      // No existing state, request from content script
      chrome.tabs.sendMessage(this.currentTab.id, { type: 'GET_STATUS' }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script not ready or page doesn't support it
          this.showError('Unable to analyze this page');
          return;
        }
        
        if (response) {
          this.updateStatus(response);
        } else {
          this.showError('No response from content script');
        }
      });
    });
  }

  updateStatus(results) {
    this.currentStatus = results;
    
    // Update individual status items with animation
    this.updateStatusItem('cssStatus', results.cssBlocking);
    this.updateStatusItem('jsStatus', results.jsBlocking);
    this.updateStatusItem('trackingStatus', results.copyTracking || results.pasteTracking);
    this.updateStatusItem('contextStatus', results.contextMenuBlocked);

    // Update main status
    const hasBlocking = Object.values(results).some(blocked => blocked);
    this.updateMainStatus(hasBlocking, results);
  }

  updateStatusItem(elementId, isBlocked) {
    const element = this.elements[elementId];
    if (element) {
      element.className = 'status-item ' + (isBlocked ? 'blocked' : 'safe');
      element.classList.add('fade-in');
      
      // Add a subtle animation delay for staggered effect
      const delay = Object.keys(this.elements).indexOf(elementId) * 100;
      element.style.animationDelay = `${delay}ms`;
    }
  }

  updateMainStatus(hasBlocking, results) {
    const mainStatus = this.elements.mainStatus;
    if (!mainStatus) return;
    
    if (hasBlocking) {
      mainStatus.className = 'main-status alert pulse';
      mainStatus.innerHTML = `
        <span class="main-status-icon">⚠️</span>
        <div class="main-status-text">Restrictions Detected</div>
        <div class="main-status-detail">This page blocks copy/paste or tracks your actions</div>
      `;
    } else {
      mainStatus.className = 'main-status safe';
      mainStatus.innerHTML = `
        <span class="main-status-icon">✅</span>
        <div class="main-status-text">Page is Safe</div>
        <div class="main-status-detail">No copy restrictions or tracking detected</div>
      `;
    }
    
    // Add fade-in animation
    mainStatus.classList.add('fade-in');
  }

  showError(message) {
    const mainStatus = this.elements.mainStatus;
    if (mainStatus) {
      mainStatus.className = 'main-status';
      mainStatus.innerHTML = `
        <span class="main-status-icon">❌</span>
        <div class="main-status-text">Analysis Failed</div>
        <div class="main-status-detail">${message}</div>
      `;
      mainStatus.classList.add('fade-in');
    }
  }

  enableCopy() {
    if (!this.currentTab) return;
    
    this.showLoading();
    
    // Add haptic feedback effect
    if (this.elements.enableBtn) {
      this.elements.enableBtn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        if (this.elements.enableBtn) {
          this.elements.enableBtn.style.transform = '';
        }
      }, 150);
    }
    
    chrome.tabs.sendMessage(this.currentTab.id, { type: 'ENABLE_COPY' }, (response) => {
      if (chrome.runtime.lastError) {
        this.showError('Failed to enable copy');
        this.hideLoading();
      }
    });
  }

  showLoading() {
    if (this.elements.buttonText) {
      this.elements.buttonText.style.display = 'none';
    }
    if (this.elements.buttonLoading) {
      this.elements.buttonLoading.style.display = 'inline-block';
    }
    if (this.elements.enableBtn) {
      this.elements.enableBtn.disabled = true;
    }
  }

  hideLoading() {
    if (this.elements.buttonLoading) {
      this.elements.buttonLoading.style.display = 'none';
    }
    if (this.elements.buttonText) {
      this.elements.buttonText.style.display = 'inline';
    }
    if (this.elements.enableBtn) {
      this.elements.enableBtn.disabled = false;
    }
  }

  showSuccess(message) {
    this.hideLoading();
    if (this.elements.buttonText) {
      this.elements.buttonText.textContent = '✅ Success!';
      
      // Add success animation
      if (this.elements.enableBtn) {
        this.elements.enableBtn.style.background = 'var(--bg-success)';
        this.elements.enableBtn.style.transform = 'scale(1.05)';
        
        setTimeout(() => {
          if (this.elements.enableBtn) {
            this.elements.enableBtn.style.background = '';
            this.elements.enableBtn.style.transform = '';
          }
        }, 300);
      }
    }
    
    setTimeout(() => {
      if (this.elements.buttonText) {
        this.elements.buttonText.textContent = 'Enable Copy';
      }
    }, 2000);
  }

  addToWhitelist() {
    if (!this.currentTab || !this.currentTab.url) return;
    
    try {
      const domain = new URL(this.currentTab.url).hostname.replace(/^www\./, '');
      
      // Add loading state to whitelist button
      const originalText = this.elements.whitelistBtn.textContent;
      this.elements.whitelistBtn.textContent = 'Adding...';
      this.elements.whitelistBtn.disabled = true;
      
      chrome.runtime.sendMessage({
        type: 'ADD_TO_WHITELIST',
        domain: domain
      }, (response) => {
        // Re-enable button first
        this.elements.whitelistBtn.disabled = false;
        
        if (chrome.runtime.lastError) {
          console.error('Chrome runtime error:', chrome.runtime.lastError);
          this.elements.whitelistBtn.textContent = '❌ Failed';
          setTimeout(() => {
            this.elements.whitelistBtn.textContent = originalText;
          }, 2000);
          return;
        }
        
        if (!response) {
          console.error('No response from background script');
          this.elements.whitelistBtn.textContent = '❌ No Response';
          setTimeout(() => {
            this.elements.whitelistBtn.textContent = originalText;
          }, 2000);
          return;
        }
        
        if (response.success) {
          this.elements.whitelistBtn.textContent = '✅ Added';
          
          // Add success animation
          this.elements.whitelistBtn.style.background = 'var(--bg-success)';
          this.elements.whitelistBtn.style.color = 'white';
          
          setTimeout(() => {
            if (this.elements.whitelistBtn) {
              this.elements.whitelistBtn.textContent = originalText;
              this.elements.whitelistBtn.style.background = '';
              this.elements.whitelistBtn.style.color = '';
            }
          }, 2000);
        } else {
          console.error('Background script error:', response.error);
          this.elements.whitelistBtn.textContent = '❌ Error';
          setTimeout(() => {
            this.elements.whitelistBtn.textContent = originalText;
          }, 2000);
        }
      });
    } catch (error) {
      console.error('Error in addToWhitelist:', error);
      this.elements.whitelistBtn.textContent = '❌ Error';
      this.elements.whitelistBtn.disabled = false;
      setTimeout(() => {
        this.elements.whitelistBtn.textContent = 'Whitelist Site';
      }, 2000);
    }
  }

  openSettings() {
    if (chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  }

  toggleSetting(setting) {
    const toggle = this.elements[setting === 'autoEnable' ? 'autoToggle' : 'notifyToggle'];
    if (!toggle) return;
    
    toggle.classList.toggle('active');
    
    // Add toggle animation
    toggle.style.transform = 'scale(0.9)';
    setTimeout(() => {
      toggle.style.transform = '';
    }, 150);
    
    // Get current settings and update
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (settings) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to get settings:', chrome.runtime.lastError);
        return;
      }
      
      if (settings) {
        settings[setting] = toggle.classList.contains('active');
        chrome.runtime.sendMessage({ 
          type: 'UPDATE_SETTINGS', 
          settings: settings 
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to update settings:', chrome.runtime.lastError);
          }
        });
      }
    });
  }

  loadSettings() {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (settings) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to load settings:', chrome.runtime.lastError);
        return;
      }
      
      if (settings) {
        if (settings.autoEnable && this.elements.autoToggle) {
          this.elements.autoToggle.classList.add('active');
        }
        if (settings.showNotifications && this.elements.notifyToggle) {
          this.elements.notifyToggle.classList.add('active');
        }
      }
    });
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    new PopupUI();
  } catch (error) {
    console.error('Failed to initialize popup UI:', error);
  }
});