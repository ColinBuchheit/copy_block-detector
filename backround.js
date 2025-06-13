class CopyBlockBackground {
  constructor() {
    this.tabStates = new Map();
    this.settings = {
      autoEnable: false,
      showNotifications: true,
      trackingAlerts: true,
      allFrames: true,
      whitelist: []
    };
    this.init();
  }

  init() {
    this.loadSettings();
    this.setupEventListeners();
    this.setupContextMenus();
  }

  loadSettings() {
    chrome.storage.sync.get('copyBlockSettings', (data) => {
      if (data.copyBlockSettings) {
        this.settings = { ...this.settings, ...data.copyBlockSettings };
      }
    });
  }

  saveSettings() {
    chrome.storage.sync.set({ copyBlockSettings: this.settings });
  }

  setupEventListeners() {
    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.checkWhitelist(tab.url, tabId);
      }
    });

    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Listen for icon clicks
    chrome.action.onClicked.addListener((tab) => {
      this.handleIconClick(tab);
    });
  }

  setupContextMenus() {
    chrome.contextMenus.create({
      id: 'enableCopyHere',
      title: 'Enable Copy on This Page',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: 'addToWhitelist',
      title: 'Add Site to Whitelist',
      contexts: ['page']
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'enableCopyHere') {
        this.enableCopyOnTab(tab.id);
      } else if (info.menuItemId === 'addToWhitelist') {
        this.addToWhitelist(tab.url);
      }
    });
  }

  handleMessage(message, sender, sendResponse) {
    const tabId = sender.tab?.id;
    
    switch (message.type) {
      case 'DETECTION_COMPLETE':
        this.handleDetectionComplete(message, tabId);
        break;
        
      case 'DETECTION_UPDATE':
        this.handleDetectionUpdate(message, tabId);
        break;
        
      case 'COPY_ENABLED':
        this.handleCopyEnabled(message, tabId);
        break;
        
      case 'EVENT_TRACKING_DETECTED':
        this.handleTrackingDetected(message, tabId);
        break;
        
      case 'GET_SETTINGS':
        sendResponse(this.settings);
        break;
        
      case 'UPDATE_SETTINGS':
        this.updateSettings(message.settings);
        break;

      case 'GET_STATS':
        sendResponse(this.generateReport());
        break;
    }
  }

  handleDetectionComplete(message, tabId) {
    const results = message.results;
    this.tabStates.set(tabId, {
      url: message.url,
      title: message.title,
      results: results,
      timestamp: Date.now()
    });

    // Update badge
    this.updateBadge(tabId, results);

    // Auto-enable if setting is on and blocking detected
    if (this.settings.autoEnable && this.hasBlocking(results)) {
      this.enableCopyOnTab(tabId);
    }

    // Show notification if enabled
    if (this.settings.showNotifications && this.hasBlocking(results)) {
      this.showNotification(message.title, results);
    }
  }

  handleDetectionUpdate(message, tabId) {
    const existingState = this.tabStates.get(tabId);
    if (existingState) {
      existingState.results = message.results;
      existingState.timestamp = Date.now();
      this.updateBadge(tabId, message.results);
    }
  }

  handleCopyEnabled(message, tabId) {
    const state = this.tabStates.get(tabId);
    if (state) {
      state.copyEnabled = true;
      state.enabledAt = Date.now();
    }

    if (this.settings.showNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'CopyBlock Detector',
        message: 'Copy restrictions successfully removed!'
      });
    }
  }

  handleTrackingDetected(message, tabId) {
    if (this.settings.trackingAlerts) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Privacy Alert',
        message: `This page is monitoring ${message.eventType} events`
      });
    }
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  hasBlocking(results) {
    return Object.values(results).some(blocked => blocked);
  }

  updateBadge(tabId, results) {
    const hasBlocking = this.hasBlocking(results);
    
    if (hasBlocking) {
      chrome.action.setBadgeText({ text: '!', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#ff4444', tabId });
      chrome.action.setTitle({ 
        title: 'CopyBlock Detector - Restrictions detected!', 
        tabId 
      });
    } else {
      chrome.action.setBadgeText({ text: '', tabId });
      chrome.action.setTitle({ 
        title: 'CopyBlock Detector - Page is safe', 
        tabId 
      });
    }
  }

  showNotification(pageTitle, results) {
    const blockingTypes = [];
    if (results.cssBlocking) blockingTypes.push('CSS blocking');
    if (results.jsBlocking) blockingTypes.push('JavaScript blocking');
    if (results.copyTracking) blockingTypes.push('Copy tracking');
    if (results.contextMenuBlocked) blockingTypes.push('Context menu disabled');

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Copy Restrictions Detected',
      message: `${pageTitle} has: ${blockingTypes.join(', ')}`
    });
  }

  enableCopyOnTab(tabId) {
    chrome.tabs.sendMessage(tabId, { type: 'ENABLE_COPY' });
  }

  checkWhitelist(url, tabId) {
    try {
      const domain = new URL(url).hostname;
      if (this.settings.whitelist.includes(domain)) {
        // Auto-enable for whitelisted sites
        setTimeout(() => this.enableCopyOnTab(tabId), 1000);
      }
    } catch (e) {
      console.log('Invalid URL:', url);
    }
  }

  addToWhitelist(url) {
    try {
      const domain = new URL(url).hostname;
      if (!this.settings.whitelist.includes(domain)) {
        this.settings.whitelist.push(domain);
        this.saveSettings();
        
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Added to Whitelist',
          message: `${domain} will auto-enable copy functionality`
        });
      }
    } catch (e) {
      console.log('Invalid URL:', url);
    }
  }

  handleIconClick(tab) {
    // This is called when popup is disabled and icon is clicked directly
    this.enableCopyOnTab(tab.id);
  }

  // Analytics and reporting
  generateReport() {
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);
    
    const recentStates = Array.from(this.tabStates.values())
      .filter(state => state.timestamp > dayAgo);
    
    const stats = {
      totalSitesChecked: recentStates.length,
      sitesWithBlocking: recentStates.filter(s => this.hasBlocking(s.results)).length,
      mostCommonBlocking: this.getMostCommonBlocking(recentStates),
      topBlockingSites: this.getTopBlockingSites(recentStates)
    };
    
    return stats;
  }

  getMostCommonBlocking(states) {
    const counts = {
      cssBlocking: 0,
      jsBlocking: 0,
      copyTracking: 0,
      contextMenuBlocked: 0
    };
    
    states.forEach(state => {
      Object.keys(counts).forEach(key => {
        if (state.results[key]) counts[key]++;
      });
    });
    
    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .map(([key, count]) => ({ type: key, count }));
  }

  getTopBlockingSites(states) {
    const siteCounts = {};
    
    states.forEach(state => {
      if (this.hasBlocking(state.results)) {
        try {
          const domain = new URL(state.url).hostname;
          siteCounts[domain] = (siteCounts[domain] || 0) + 1;
        } catch (e) {
          // Invalid URL, skip
        }
      }
    });
    
    return Object.entries(siteCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));
  }

  // Cleanup old tab states
  cleanupOldStates() {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const [tabId, state] of this.tabStates.entries()) {
      if (state.timestamp < oneWeekAgo) {
        this.tabStates.delete(tabId);
      }
    }
  }
}

// Initialize background service
const copyBlockBackground = new CopyBlockBackground();

// Cleanup old states periodically
setInterval(() => {
  copyBlockBackground.cleanupOldStates();
}, 60 * 60 * 1000); // Every hour