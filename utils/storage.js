class StorageManager {
    constructor() {
        this.defaultSettings = {
            autoEnable: false,
            showNotifications: true,
            trackingAlerts: true,
            allFrames: true,
            advancedDetection: false,
            whitelist: [],
            statistics: {
                totalSitesChecked: 0,
                sitesWithBlocking: 0,
                totalBypassAttempts: 0,
                successfulBypasses: 0,
                lastReset: Date.now()
            }
        };
    }

    // Get data from storage
    async get(keys) {
        return new Promise((resolve, reject) => {
            try {
                if (chrome.storage && chrome.storage.sync) {
                    chrome.storage.sync.get(keys, (result) => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(result);
                        }
                    });
                } else {
                    // Fallback to localStorage for testing
                    const result = {};
                    const keysArray = Array.isArray(keys) ? keys : [keys];
                    keysArray.forEach(key => {
                        const value = localStorage.getItem(key);
                        if (value) {
                            try {
                                result[key] = JSON.parse(value);
                            } catch (e) {
                                result[key] = value;
                            }
                        }
                    });
                    resolve(result);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    // Set data in storage
    async set(items) {
        return new Promise((resolve, reject) => {
            try {
                if (chrome.storage && chrome.storage.sync) {
                    chrome.storage.sync.set(items, () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve();
                        }
                    });
                } else {
                    // Fallback to localStorage for testing
                    Object.keys(items).forEach(key => {
                        localStorage.setItem(key, JSON.stringify(items[key]));
                    });
                    resolve();
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    // Remove data from storage
    async remove(keys) {
        return new Promise((resolve, reject) => {
            try {
                if (chrome.storage && chrome.storage.sync) {
                    chrome.storage.sync.remove(keys, () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve();
                        }
                    });
                } else {
                    // Fallback to localStorage for testing
                    const keysArray = Array.isArray(keys) ? keys : [keys];
                    keysArray.forEach(key => {
                        localStorage.removeItem(key);
                    });
                    resolve();
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    // Clear all storage
    async clear() {
        return new Promise((resolve, reject) => {
            try {
                if (chrome.storage && chrome.storage.sync) {
                    chrome.storage.sync.clear(() => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve();
                        }
                    });
                } else {
                    // Fallback to localStorage for testing
                    localStorage.clear();
                    resolve();
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    // Get settings with defaults
    async getSettings() {
        try {
            const data = await this.get('copyBlockSettings');
            return { ...this.defaultSettings, ...data.copyBlockSettings };
        } catch (error) {
            console.error('Error getting settings:', error);
            return this.defaultSettings;
        }
    }

    // Save settings
    async saveSettings(settings) {
        try {
            const mergedSettings = { ...this.defaultSettings, ...settings };
            await this.set({ copyBlockSettings: mergedSettings });
            return mergedSettings;
        } catch (error) {
            console.error('Error saving settings:', error);
            throw error;
        }
    }

    // Add domain to whitelist
    async addToWhitelist(domain) {
        try {
            const settings = await this.getSettings();
            const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
            
            if (!settings.whitelist.includes(normalizedDomain)) {
                settings.whitelist.push(normalizedDomain);
                await this.saveSettings(settings);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error adding to whitelist:', error);
            throw error;
        }
    }

    // Remove domain from whitelist
    async removeFromWhitelist(domain) {
        try {
            const settings = await this.getSettings();
            const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
            const index = settings.whitelist.indexOf(normalizedDomain);
            
            if (index > -1) {
                settings.whitelist.splice(index, 1);
                await this.saveSettings(settings);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error removing from whitelist:', error);
            throw error;
        }
    }

    // Check if domain is whitelisted
    async isWhitelisted(domain) {
        try {
            const settings = await this.getSettings();
            const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
            return settings.whitelist.includes(normalizedDomain);
        } catch (error) {
            console.error('Error checking whitelist:', error);
            return false;
        }
    }

    // Update statistics
    async updateStatistics(update) {
        try {
            const settings = await this.getSettings();
            const stats = { ...settings.statistics, ...update };
            
            settings.statistics = stats;
            await this.saveSettings(settings);
            return stats;
        } catch (error) {
            console.error('Error updating statistics:', error);
            throw error;
        }
    }

    // Get statistics
    async getStatistics() {
        try {
            const settings = await this.getSettings();
            return settings.statistics || this.defaultSettings.statistics;
        } catch (error) {
            console.error('Error getting statistics:', error);
            return this.defaultSettings.statistics;
        }
    }

    // Reset statistics
    async resetStatistics() {
        try {
            const settings = await this.getSettings();
            settings.statistics = {
                ...this.defaultSettings.statistics,
                lastReset: Date.now()
            };
            await this.saveSettings(settings);
            return settings.statistics;
        } catch (error) {
            console.error('Error resetting statistics:', error);
            throw error;
        }
    }

    // Increment site check counter
    async incrementSiteChecked() {
        try {
            const stats = await this.getStatistics();
            return await this.updateStatistics({
                totalSitesChecked: stats.totalSitesChecked + 1
            });
        } catch (error) {
            console.error('Error incrementing site checked:', error);
        }
    }

    // Increment blocking detected counter
    async incrementBlockingDetected() {
        try {
            const stats = await this.getStatistics();
            return await this.updateStatistics({
                sitesWithBlocking: stats.sitesWithBlocking + 1
            });
        } catch (error) {
            console.error('Error incrementing blocking detected:', error);
        }
    }

    // Increment bypass attempt counter
    async incrementBypassAttempt() {
        try {
            const stats = await this.getStatistics();
            return await this.updateStatistics({
                totalBypassAttempts: stats.totalBypassAttempts + 1
            });
        } catch (error) {
            console.error('Error incrementing bypass attempt:', error);
        }
    }

    // Increment successful bypass counter
    async incrementSuccessfulBypass() {
        try {
            const stats = await this.getStatistics();
            return await this.updateStatistics({
                successfulBypasses: stats.successfulBypasses + 1
            });
        } catch (error) {
            console.error('Error incrementing successful bypass:', error);
        }
    }

    // Export all data
    async exportData() {
        try {
            const settings = await this.getSettings();
            return {
                settings,
                exportDate: new Date().toISOString(),
                version: '2.0.0',
                extensionId: chrome.runtime?.id || 'unknown'
            };
        } catch (error) {
            console.error('Error exporting data:', error);
            throw error;
        }
    }

    // Import data with validation
    async importData(data) {
        try {
            // Validate import data structure
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid import data format');
            }

            // Validate settings structure
            if (data.settings) {
                const settings = data.settings;
                
                // Validate boolean fields
                const booleanFields = ['autoEnable', 'showNotifications', 'trackingAlerts', 'allFrames', 'advancedDetection'];
                booleanFields.forEach(field => {
                    if (settings[field] !== undefined && typeof settings[field] !== 'boolean') {
                        settings[field] = Boolean(settings[field]);
                    }
                });

                // Validate whitelist array
                if (settings.whitelist && !Array.isArray(settings.whitelist)) {
                    settings.whitelist = [];
                } else if (settings.whitelist) {
                    // Validate and clean whitelist domains
                    settings.whitelist = settings.whitelist
                        .filter(domain => typeof domain === 'string' && domain.trim().length > 0)
                        .map(domain => domain.toLowerCase().replace(/^www\./, ''));
                }

                // Validate statistics
                if (settings.statistics && typeof settings.statistics === 'object') {
                    const stats = settings.statistics;
                    const numericFields = ['totalSitesChecked', 'sitesWithBlocking', 'totalBypassAttempts', 'successfulBypasses'];
                    numericFields.forEach(field => {
                        if (stats[field] !== undefined && (isNaN(stats[field]) || stats[field] < 0)) {
                            stats[field] = 0;
                        }
                    });
                }

                await this.saveSettings(settings);
                return settings;
            } else {
                throw new Error('No settings found in import data');
            }
        } catch (error) {
            console.error('Error importing data:', error);
            throw error;
        }
    }

    // Get storage usage information
    async getStorageInfo() {
        try {
            if (chrome.storage && chrome.storage.sync) {
                return new Promise((resolve) => {
                    chrome.storage.sync.getBytesInUse(null, (bytesInUse) => {
                        resolve({
                            bytesInUse,
                            quota: chrome.storage.sync.QUOTA_BYTES || 102400, // 100KB default
                            percentUsed: Math.round((bytesInUse / (chrome.storage.sync.QUOTA_BYTES || 102400)) * 100)
                        });
                    });
                });
            } else {
                // Estimate localStorage usage
                let totalSize = 0;
                for (let key in localStorage) {
                    if (localStorage.hasOwnProperty(key)) {
                        totalSize += localStorage[key].length + key.length;
                    }
                }
                return {
                    bytesInUse: totalSize,
                    quota: 5242880, // 5MB typical localStorage limit
                    percentUsed: Math.round((totalSize / 5242880) * 100)
                };
            }
        } catch (error) {
            console.error('Error getting storage info:', error);
            return { bytesInUse: 0, quota: 0, percentUsed: 0 };
        }
    }

    // Backup data to local file
    async createBackup() {
        try {
            const exportData = await this.exportData();
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const filename = `copyblock-backup-${new Date().toISOString().split('T')[0]}.json`;
            
            if (chrome.downloads) {
                chrome.downloads.download({
                    url,
                    filename,
                    saveAs: true
                });
            } else {
                // Fallback for content scripts
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            
            URL.revokeObjectURL(url);
            return filename;
        } catch (error) {
            console.error('Error creating backup:', error);
            throw error;
        }
    }

    // Restore from backup file
    async restoreFromBackup(file) {
        try {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const backupData = JSON.parse(e.target.result);
                        const restoredSettings = await this.importData(backupData);
                        resolve(restoredSettings);
                    } catch (error) {
                        reject(error);
                    }
                };
                reader.onerror = () => reject(new Error('Failed to read backup file'));
                reader.readAsText(file);
            });
        } catch (error) {
            console.error('Error restoring from backup:', error);
            throw error;
        }
    }

    // Migrate from old versions
    async migrateFromOldVersion() {
        try {
            // Check for old version data
            const oldData = await this.get(['copyBlockDetectorSettings', 'copyBlockStats']);
            
            if (oldData.copyBlockDetectorSettings || oldData.copyBlockStats) {
                const newSettings = { ...this.defaultSettings };
                
                // Migrate old settings
                if (oldData.copyBlockDetectorSettings) {
                    const old = oldData.copyBlockDetectorSettings;
                    newSettings.autoEnable = old.autoEnable || false;
                    newSettings.showNotifications = old.notifications !== false;
                    newSettings.whitelist = old.whitelist || [];
                }
                
                // Migrate old statistics
                if (oldData.copyBlockStats) {
                    newSettings.statistics = { ...this.defaultSettings.statistics, ...oldData.copyBlockStats };
                }
                
                // Save migrated data
                await this.saveSettings(newSettings);
                
                // Remove old data
                await this.remove(['copyBlockDetectorSettings', 'copyBlockStats']);
                
                return newSettings;
            }
            
            return null; // No migration needed
        } catch (error) {
            console.error('Error migrating from old version:', error);
            return null;
        }
    }

    // Listen for storage changes
    onStorageChanged(callback) {
        if (chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'sync' && changes.copyBlockSettings) {
                    callback(changes.copyBlockSettings.newValue, changes.copyBlockSettings.oldValue);
                }
            });
        }
    }

    // Sync settings across devices
    async syncSettings() {
        try {
            if (chrome.storage && chrome.storage.sync) {
                // Force sync by updating a timestamp
                const settings = await this.getSettings();
                settings.lastSync = Date.now();
                await this.saveSettings(settings);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error syncing settings:', error);
            return false;
        }
    }

    // Clean up old data
    async cleanup() {
        try {
            const settings = await this.getSettings();
            let needsUpdate = false;
            
            // Clean up whitelist duplicates
            if (settings.whitelist && settings.whitelist.length > 0) {
                const uniqueWhitelist = [...new Set(settings.whitelist)];
                if (uniqueWhitelist.length !== settings.whitelist.length) {
                    settings.whitelist = uniqueWhitelist;
                    needsUpdate = true;
                }
            }
            
            // Reset statistics if too old (older than 6 months)
            if (settings.statistics && settings.statistics.lastReset) {
                const sixMonthsAgo = Date.now() - (6 * 30 * 24 * 60 * 60 * 1000);
                if (settings.statistics.lastReset < sixMonthsAgo) {
                    settings.statistics = {
                        ...this.defaultSettings.statistics,
                        lastReset: Date.now()
                    };
                    needsUpdate = true;
                }
            }
            
            if (needsUpdate) {
                await this.saveSettings(settings);
            }
            
            return needsUpdate;
        } catch (error) {
            console.error('Error during cleanup:', error);
            return false;
        }
    }
}

// Create singleton instance
const storageManager = new StorageManager();

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
} else if (typeof window !== 'undefined') {
    window.StorageManager = StorageManager;
    window.storageManager = storageManager;
} else {
    this.StorageManager = StorageManager;
    this.storageManager = storageManager;
}