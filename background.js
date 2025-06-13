// Import storage manager if using modules
// import { StorageManager } from './utils/storage.js';

class CopyBlockBackground {
  constructor() {
    // Change from tabStates to domainStates for proper tracking
    this.domainStates = new Map();
    this.tabDomains = new Map(); // Track which domain each tab is on
    this.settings = {
      autoEnable: false,
      showNotifications: true,
      trackingAlerts: true,
      allFrames: true,
      whitelist: []
    };
    this.isInitialized = false;
  }

  // Helper function to normalize URLs and extract clean domains
  getDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      // Remove www. prefix for consistency
      const cleanDomain = hostname.replace(/^www\./, '');
      return cleanDomain;
    } catch (e) {
      console.error('Invalid URL:', url);
      return null;
    }
  }

  // Generate a unique key for domain state (domain + basic path for apps like Claude)
  getDomainStateKey(url) {
    try {
      const urlObj = new URL(url);
      const domain = this.getDomainFromUrl(url);
      
      // For certain domains, include the base path to differentiate between different apps/sections
      const specialDomains = ['claude.ai', 'chat.openai.com', 'github.com', 'stackoverflow.com'];
      
      if (specialDomains.includes(domain)) {
        const pathParts = urlObj.pathname.split('/').filter(part => part && part.length > 0);
        // Take first path segment for apps like claude.ai/chat, github.com/user
        const basePath = pathParts[0] || '';
        return basePath ? `${domain}/${basePath}` : domain;
      }
      
      return domain;
    } catch (e) {
      return this.getDomainFromUrl(url);
    }
  }

  async init() {
    if (this.isInitialized) return;
    
    try {
      await this.loadSettings();
      this.setupContextMenus();
      this.isInitialized = true;
      console.log('CopyBlock background initialized');
    } catch (error) {
      console.error('Failed to initialize background:', error);
    }
  }

  async loadSettings() {
    try {
      const data = await chrome.storage.sync.get('copyBlockSettings');
      if (data.copyBlockSettings) {
        this.settings = { ...this.settings, ...data.copyBlockSettings };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.sync.set({ copyBlockSettings: this.settings });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  setupContextMenus() {
    try {
      // Remove existing menus first to avoid duplicates
      chrome.contextMenus.removeAll(() => {
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
      });
    } catch (error) {
      console.error('Failed to setup context menus:', error);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    const tabId = sender.tab?.id;
    
    try {
      // Ensure we're initialized before handling messages
      if (!this.isInitialized) {
        await this.init();
      }
      
      switch (message.type) {
        case 'DETECTION_COMPLETE':
          await this.handleDetectionComplete(message, tabId);
          sendResponse({ success: true });
          break;
          
        case 'DETECTION_UPDATE':
          await this.handleDetectionUpdate(message, tabId);
          sendResponse({ success: true });
          break;
          
        case 'COPY_ENABLED':
          await this.handleCopyEnabled(message, tabId);
          sendResponse({ success: true });
          break;
          
        case 'EVENT_TRACKING_DETECTED':
          await this.handleTrackingDetected(message, tabId);
          sendResponse({ success: true });
          break;
          
        case 'GET_SETTINGS':
          sendResponse(this.settings);
          break;
          
        case 'UPDATE_SETTINGS':
          await this.updateSettings(message.settings);
          sendResponse({ success: true });
          break;

        case 'GET_STATS':
          const stats = await this.generateReport();
          sendResponse(stats);
          break;

        case 'ADD_TO_WHITELIST':
          const result = await this.addToWhitelist(`https://${message.domain}`);
          sendResponse(result);
          break;

        case 'GET_CURRENT_TAB_STATE':
          const tabState = this.getCurrentTabState(message.tabId);
          sendResponse(tabState);
          break;
          
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    }
  }

  async handleDetectionComplete(message, tabId) {
    try {
      const results = message.results;
      const domainKey = this.getDomainStateKey(message.url);
      const domain = this.getDomainFromUrl(message.url);
      
      if (!domainKey || !domain) {
        console.error('Could not extract domain from URL:', message.url);
        return;
      }

      // Update domain state
      this.domainStates.set(domainKey, {
        domain: domain,
        domainKey: domainKey,
        url: message.url,
        title: message.title,
        results: results,
        timestamp: Date.now(),
        lastTabId: tabId
      });

      // Track which domain this tab is currently on
      this.tabDomains.set(tabId, domainKey);

      // Update badge for this tab
      await this.updateBadge(tabId, results);

      // Check if domain is whitelisted (use clean domain for whitelist check)
      const isWhitelisted = this.settings.whitelist.includes(domain);

      // Auto-enable if setting is on and blocking detected, but not if whitelisted
      if (this.settings.autoEnable && this.hasBlocking(results) && !isWhitelisted) {
        await this.enableCopyOnTab(tabId);
      }

      // Show notification if enabled and not whitelisted
      if (this.settings.showNotifications && this.hasBlocking(results) && !isWhitelisted) {
        await this.showNotification(message.title, results, domain);
      }

      // If domain is whitelisted, auto-enable copy
      if (isWhitelisted) {
        setTimeout(() => this.enableCopyOnTab(tabId), 500);
      }

    } catch (error) {
      console.error('Error handling detection complete:', error);
    }
  }

  async handleDetectionUpdate(message, tabId) {
    try {
      const currentDomainKey = this.tabDomains.get(tabId);
      if (!currentDomainKey) {
        // If we don't have the domain key, treat this as a new detection
        await this.handleDetectionComplete(message, tabId);
        return;
      }

      const existingState = this.domainStates.get(currentDomainKey);
      if (existingState) {
        existingState.results = message.results;
        existingState.timestamp = Date.now();
        existingState.lastTabId = tabId;
        await this.updateBadge(tabId, message.results);
      }
    } catch (error) {
      console.error('Error handling detection update:', error);
    }
  }

  async handleCopyEnabled(message, tabId) {
    try {
      const state = this.tabStates.get(tabId);
      if (state) {
        state.copyEnabled = true;
        state.enabledAt = Date.now();
      }

      if (this.settings.showNotifications) {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'CopyBlock Detector',
          message: 'Copy restrictions successfully removed!'
        });
      }
    } catch (error) {
      console.error('Error handling copy enabled:', error);
    }
  }

  async handleTrackingDetected(message, tabId) {
    try {
      if (this.settings.trackingAlerts) {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Privacy Alert',
          message: `This page is monitoring ${message.eventType} events`
        });
      }
    } catch (error) {
      console.error('Error handling tracking detected:', error);
    }
  }

  async updateSettings(newSettings) {
    try {
      this.settings = { ...this.settings, ...newSettings };
      await this.saveSettings();
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  }

  hasBlocking(results) {
    return Object.values(results).some(blocked => blocked);
  }

  async updateBadge(tabId, results) {
    try {
      const hasBlocking = this.hasBlocking(results);
      
      if (hasBlocking) {
        await chrome.action.setBadgeText({ text: '!', tabId });
        await chrome.action.setBadgeBackgroundColor({ color: '#ff4444', tabId });
        await chrome.action.setTitle({ 
          title: 'CopyBlock Detector - Restrictions detected!', 
          tabId 
        });
      } else {
        await chrome.action.setBadgeText({ text: '', tabId });
        await chrome.action.setTitle({ 
          title: 'CopyBlock Detector - Page is safe', 
          tabId 
        });
      }
    } catch (error) {
      console.error('Failed to update badge:', error);
    }
  }

  async showNotification(pageTitle, results) {
    try {
      const blockingTypes = [];
      if (results.cssBlocking) blockingTypes.push('CSS blocking');
      if (results.jsBlocking) blockingTypes.push('JavaScript blocking');
      if (results.copyTracking) blockingTypes.push('Copy tracking');
      if (results.contextMenuBlocked) blockingTypes.push('Context menu disabled');

      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Copy Restrictions Detected',
        message: `${pageTitle} has: ${blockingTypes.join(', ')}`
      });
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  async enableCopyOnTab(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'ENABLE_COPY' });
    } catch (error) {
      console.error('Failed to enable copy on tab:', error);
    }
  }

  async checkWhitelist(url, tabId) {
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

  async addToWhitelist(url) {
    try {
      const domain = new URL(url).hostname.replace(/^www\./, '');
      
      if (!this.settings.whitelist.includes(domain)) {
        this.settings.whitelist.push(domain);
        await this.saveSettings();
        
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Added to Whitelist',
          message: `${domain} will auto-enable copy functionality`
        });
        
        return { success: true, domain };
      } else {
        return { success: true, domain, message: 'Domain already whitelisted' };
      }
    } catch (e) {
      console.error('Error adding to whitelist:', e);
      return { success: false, error: e.message };
    }
  }

  async handleIconClick(tab) {
    try {
      await this.enableCopyOnTab(tab.id);
    } catch (error) {
      console.error('Error handling icon click:', error);
    }
  }

  async handleTabUpdated(tabId, changeInfo, tab) {
    try {
      if (changeInfo.status === 'complete' && tab.url && !this.isInitialized) {
        await this.init();
      }
      
      if (changeInfo.status === 'complete' && tab.url) {
        await this.checkWhitelist(tab.url, tabId);
      }
    } catch (error) {
      console.error('Error handling tab updated:', error);
    }
  }

  async handleContextMenuClick(info, tab) {
    try {
      if (info.menuItemId === 'enableCopyHere') {
        await this.enableCopyOnTab(tab.id);
      } else if (info.menuItemId === 'addToWhitelist') {
        await this.addToWhitelist(tab.url);
      }
    } catch (error) {
      console.error('Error handling context menu click:', error);
    }
  }

  // Analytics and reporting
  async generateReport() {
    try {
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
    } catch (error) {
      console.error('Error generating report:', error);
      return {
        totalSitesChecked: 0,
        sitesWithBlocking: 0,
        mostCommonBlocking: [],
        topBlockingSites: []
      };
    }
  }

  getMostCommonBlocking(states) {
    try {
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
    } catch (error) {
      console.error('Error getting most common blocking:', error);
      return [];
    }
  }

  getTopBlockingSites(states) {
    try {
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
    } catch (error) {
      console.error('Error getting top blocking sites:', error);
      return [];
    }
  }

  // Cleanup old tab states
  cleanupOldStates() {
    try {
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      for (const [tabId, state] of this.tabStates.entries()) {
        if (state.timestamp < oneWeekAgo) {
          this.tabStates.delete(tabId);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old states:', error);
    }
  }
}

// Create global instance
const copyBlockBackground = new CopyBlockBackground();

// Set up event listeners immediately (must be synchronous at top level)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  copyBlockBackground.handleMessage(message, sender, sendResponse);
  return true; // Keep message channel open for async responses
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  copyBlockBackground.handleTabUpdated(tabId, changeInfo, tab);
});

chrome.action.onClicked.addListener((tab) => {
  copyBlockBackground.handleIconClick(tab);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  copyBlockBackground.handleContextMenuClick(info, tab);
});

// Handle service worker lifecycle events
chrome.runtime.onStartup.addListener(() => {
  console.log('Service worker startup');
  copyBlockBackground.init();
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);
  copyBlockBackground.init();
});

// Initialize immediately when service worker starts
copyBlockBackground.init();

// Set up periodic cleanup using alarms (more reliable than setTimeout in service workers)
chrome.alarms.create('cleanup', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    copyBlockBackground.cleanupOldStates();
  }
});

// Handle extension context invalidation gracefully
self.addEventListener('error', (event) => {
  console.error('Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service worker unhandled rejection:', event.reason);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  // Clean up tab-to-domain mapping when tab is closed
  copyBlockBackground.tabDomains.delete(tabId);
});

