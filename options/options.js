class OptionsManager {
  constructor() {
    this.settings = {
      autoEnable: false,
      showNotifications: true,
      trackingAlerts: true,
      allFrames: true,
      advancedDetection: false,
      whitelist: []
    };
    this.currentTheme = 'light';
    this.init();
  }

  init() {
    this.loadTheme();
    this.loadSettings();
    this.setupEventListeners();
    this.loadStats();
    this.setupKeyboardShortcuts();
    this.animateCardsOnLoad();
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
    
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
      themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    
    // Save theme preference
    localStorage.setItem('copyblock-theme', theme);
  }

  toggleTheme() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(newTheme);
    
    // Add transition effect
    document.body.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      document.body.style.transition = '';
    }, 300);
  }

  animateCardsOnLoad() {
    const cards = document.querySelectorAll('.settings-card');
    cards.forEach((card, index) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(30px)';
      setTimeout(() => {
        card.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, index * 150);
    });
  }

  loadSettings() {
    chrome.storage.sync.get('copyBlockSettings', (data) => {
      if (data.copyBlockSettings) {
        this.settings = { ...this.settings, ...data.copyBlockSettings };
      }
      this.updateUI();
    });
  }

  saveSettings() {
    chrome.storage.sync.set({ copyBlockSettings: this.settings }, () => {
      this.showToast('Settings saved successfully', 'success');
      chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: this.settings });
    });
  }

  updateUI() {
    // Update toggles
    Object.keys(this.settings).forEach(key => {
      const element = document.getElementById(key);
      if (element && typeof this.settings[key] === 'boolean') {
        element.classList.toggle('active', this.settings[key]);
      }
    });

    // Update whitelist
    this.updateWhitelistUI();
  }

  updateWhitelistUI() {
    const container = document.getElementById('whitelistItems');
    
    if (this.settings.whitelist.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🌊</div>
          <div class="empty-text">No whitelisted sites yet</div>
          <div class="empty-subtext">Add domains above to get started</div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    this.settings.whitelist.forEach((domain, index) => {
      const item = document.createElement('div');
      item.className = 'whitelist-item slide-in';
      item.style.animationDelay = `${index * 100}ms`;
      item.innerHTML = `
        <div>
          <div class="whitelist-domain">${domain}</div>
          <div class="whitelist-meta">Added ${new Date().toLocaleDateString()}</div>
        </div>
        <button class="remove-btn" onclick="optionsManager.removeFromWhitelist(${index})">
          Remove
        </button>
      `;
      container.appendChild(item);
    });
  }

  setupEventListeners() {
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    // Toggle switches
    ['autoEnable', 'showNotifications', 'trackingAlerts', 'allFrames', 'advancedDetection'].forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('click', (e) => {
          e.target.classList.toggle('active');
          this.settings[id] = e.target.classList.contains('active');
          this.saveSettings();
          
          // Add haptic feedback
          e.target.style.transform = 'scale(0.9)';
          setTimeout(() => {
            e.target.style.transform = '';
          }, 150);
        });
      }
    });

    // Whitelist management
    const addButton = document.getElementById('addWhitelist');
    const whitelistInput = document.getElementById('whitelistInput');
    
    if (addButton) {
      addButton.addEventListener('click', () => this.addToWhitelist());
    }

    if (whitelistInput) {
      whitelistInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.addToWhitelist();
        }
      });

      // Add input validation styling
      whitelistInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        const isValid = this.isValidDomain(value);
        
        if (value && !isValid) {
          e.target.style.borderColor = '#ef5350';
        } else {
          e.target.style.borderColor = '';
        }
      });
    }

    // Data management
    const exportBtn = document.getElementById('exportSettings');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    const resetBtn = document.getElementById('resetSettings');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportSettings());
    }

    if (importBtn) {
      importBtn.addEventListener('click', () => importFile?.click());
    }

    if (importFile) {
      importFile.addEventListener('change', (e) => {
        if (e.target.files[0]) {
          this.importSettings(e.target.files[0]);
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetSettings());
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('copyblock-theme')) {
        this.applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            this.saveSettings();
            break;
          case 'e':
            e.preventDefault();
            this.exportSettings();
            break;
          case 'd':
            e.preventDefault();
            this.toggleTheme();
            break;
        }
      }
    });
  }

  isValidDomain(domain) {
    if (!domain) return false;
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain) && domain.length <= 253;
  }

  addToWhitelist() {
    const input = document.getElementById('whitelistInput');
    if (!input) return;

    const domain = input.value.trim().toLowerCase().replace(/^www\./, '');

    if (!domain) {
      this.showToast('Please enter a domain', 'error');
      input.focus();
      return;
    }

    if (!this.isValidDomain(domain)) {
      this.showToast('Please enter a valid domain (e.g., example.com)', 'error');
      input.focus();
      input.style.borderColor = '#ef5350';
      return;
    }

    if (this.settings.whitelist.includes(domain)) {
      this.showToast('Domain already in whitelist', 'warning');
      input.focus();
      return;
    }

    // Add loading state
    const addBtn = document.getElementById('addWhitelist');
    const originalText = addBtn.textContent;
    addBtn.textContent = 'Adding...';
    addBtn.disabled = true;

    this.settings.whitelist.push(domain);
    input.value = '';
    input.style.borderColor = '';
    
    setTimeout(() => {
      this.updateWhitelistUI();
      this.saveSettings();
      this.showToast(`Added ${domain} to whitelist`, 'success');
      
      // Reset button
      addBtn.textContent = originalText;
      addBtn.disabled = false;
      input.focus();
    }, 500);
  }

  removeFromWhitelist(index) {
    const domain = this.settings.whitelist[index];
    
    // Add confirmation for multiple items
    if (this.settings.whitelist.length > 3) {
      if (!confirm(`Remove ${domain} from whitelist?`)) {
        return;
      }
    }

    this.settings.whitelist.splice(index, 1);
    this.updateWhitelistUI();
    this.saveSettings();
    this.showToast(`Removed ${domain} from whitelist`, 'success');
  }

  loadStats() {
    chrome.runtime.sendMessage({ type: 'GET_STATS' }, (stats) => {
      if (stats) {
        this.displayStats(stats);
      }
    });
  }

  displayStats(stats) {
    const container = document.getElementById('statsGrid');
    if (!container) return;

    const successRate = stats.totalSitesChecked > 0 ? 
      Math.round(((stats.sitesWithBlocking || 0) / stats.totalSitesChecked) * 100) : 0;
    
    const statsData = [
      { icon: '🔍', number: stats.totalSitesChecked || 0, label: 'Sites Analyzed' },
      { icon: '🚫', number: stats.sitesWithBlocking || 0, label: 'Restrictions Found' },
      { icon: '✅', number: `${successRate}%`, label: 'Detection Rate' },
      { icon: '⭐', number: this.settings.whitelist.length, label: 'Whitelisted Sites' }
    ];

    container.innerHTML = '';
    statsData.forEach((stat, index) => {
      const card = document.createElement('div');
      card.className = 'stat-card';
      card.style.animationDelay = `${index * 100}ms`;
      card.innerHTML = `
        <div class="stat-icon">${stat.icon}</div>
        <div class="stat-number">${stat.number}</div>
        <div class="stat-label">${stat.label}</div>
      `;
      container.appendChild(card);
    });
  }

  exportSettings() {
    const exportBtn = document.getElementById('exportSettings');
    const originalText = exportBtn.textContent;
    
    exportBtn.classList.add('loading');
    exportBtn.textContent = 'Exporting...';

    const exportData = {
      ...this.settings,
      exportDate: new Date().toISOString(),
      version: '2.0.0',
      theme: this.currentTheme
    };
    
    setTimeout(() => {
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `copyblock-settings-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
      
      // Reset button
      exportBtn.classList.remove('loading');
      exportBtn.textContent = originalText;
      
      this.showToast('Settings exported successfully', 'success');
    }, 1000);
  }

  importSettings(file) {
    if (!file) return;

    const importBtn = document.getElementById('importBtn');
    const originalText = importBtn.textContent;
    
    importBtn.classList.add('loading');
    importBtn.textContent = 'Importing...';

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        
        // Validate settings structure
        if (typeof importedData !== 'object') {
          throw new Error('Invalid settings format');
        }

        // Import theme if available
        if (importedData.theme) {
          this.applyTheme(importedData.theme);
        }

        // Merge settings, preserving structure
        const validKeys = Object.keys(this.settings);
        const filteredSettings = {};
        
        validKeys.forEach(key => {
          if (importedData.hasOwnProperty(key)) {
            filteredSettings[key] = importedData[key];
          }
        });

        this.settings = { ...this.settings, ...filteredSettings };
        this.updateUI();
        this.saveSettings();
        
        setTimeout(() => {
          importBtn.classList.remove('loading');
          importBtn.textContent = originalText;
          
          this.showToast(`Settings imported successfully! Imported ${Object.keys(filteredSettings).length} settings.`, 'success');
        }, 1000);
        
      } catch (error) {
        importBtn.classList.remove('loading');
        importBtn.textContent = originalText;
        this.showToast(`Error importing settings: ${error.message}`, 'error');
      }
    };
    reader.readAsText(file);
  }

  resetSettings() {
    const confirmed = confirm('Are you sure you want to reset all settings? This action cannot be undone.');
    if (!confirmed) return;

    const resetBtn = document.getElementById('resetSettings');
    const originalText = resetBtn.textContent;
    
    resetBtn.classList.add('loading');
    resetBtn.textContent = 'Resetting...';

    setTimeout(() => {
      this.settings = {
        autoEnable: false,
        showNotifications: true,
        trackingAlerts: true,
        allFrames: true,
        advancedDetection: false,
        whitelist: []
      };
      
      this.updateUI();
      this.saveSettings();
      
      resetBtn.classList.remove('loading');
      resetBtn.textContent = originalText;
      
      this.showToast('All settings have been reset to defaults', 'success');
    }, 1500);
  }

  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);

    // Add click to dismiss
    toast.onclick = () => toast.classList.remove('show');
  }
}

// Initialize options manager
let optionsManager;

document.addEventListener('DOMContentLoaded', () => {
  try {
    optionsManager = new OptionsManager();
  } catch (error) {
    console.error('Failed to initialize options manager:', error);
  }
});