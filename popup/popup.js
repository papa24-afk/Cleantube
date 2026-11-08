/**
 * CleanTube - Popup Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const masterToggle = document.getElementById('masterToggle');
  const autoSkipToggle = document.getElementById('autoSkipToggle');
  const fastForwardToggle = document.getElementById('fastForwardToggle');
  const hideBannersToggle = document.getElementById('hideBannersToggle');
  const bypassPopupToggle = document.getElementById('bypassPopupToggle');

  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const masterStatusDesc = document.getElementById('masterStatusDesc');

  const blockedCountElem = document.getElementById('blockedCount');
  const timeSavedElem = document.getElementById('timeSaved');

  const refreshTabBtn = document.getElementById('refreshTabBtn');
  const resetStatsBtn = document.getElementById('resetStatsBtn');

  // Format seconds into a friendly human-readable string
  function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '0m';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) {
      return `${mins}m`;
    }
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
  }

  // Update Status UI (Active vs Paused)
  function updateStatusDisplay(isEnabled) {
    if (isEnabled) {
      statusIndicator.classList.remove('paused');
      statusText.textContent = 'Active';
      masterStatusDesc.textContent = 'Blocking ads & popups';
    } else {
      statusIndicator.classList.add('paused');
      statusText.textContent = 'Paused';
      masterStatusDesc.textContent = 'Protection disabled';
    }
  }

  // Broadcast settings change to active tabs
  function broadcastSettings(config) {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'SETTINGS_UPDATED',
              config: config
            }).catch(() => {
              // Ignore tabs that haven't initialized content script
            });
          }
        });
      });
    }
  }

  // Load saved configuration from storage
  function loadConfig() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(
        ['enabled', 'autoSkip', 'fastForward', 'hideBanners', 'bypassPopup', 'adsBlockedCount', 'timeSavedSeconds'],
        (data) => {
          const isEnabled = data.enabled !== undefined ? data.enabled : true;
          masterToggle.checked = isEnabled;
          autoSkipToggle.checked = data.autoSkip !== undefined ? data.autoSkip : true;
          fastForwardToggle.checked = data.fastForward !== undefined ? data.fastForward : true;
          hideBannersToggle.checked = data.hideBanners !== undefined ? data.hideBanners : true;
          bypassPopupToggle.checked = data.bypassPopup !== undefined ? data.bypassPopup : true;

          updateStatusDisplay(isEnabled);

          const count = data.adsBlockedCount || 0;
          const time = data.timeSavedSeconds || 0;
          blockedCountElem.textContent = count.toLocaleString();
          timeSavedElem.textContent = formatTime(time);
        }
      );
    }
  }

  // Save setting to storage
  function saveSetting(key, value) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const obj = {};
      obj[key] = value;
      chrome.storage.local.set(obj, () => {
        // Collect current full config and broadcast
        chrome.storage.local.get(
          ['enabled', 'autoSkip', 'fastForward', 'hideBanners', 'bypassPopup'],
          (config) => {
            broadcastSettings(config);
          }
        );
      });
    }
  }

  // Event Listeners for Toggles
  masterToggle.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    updateStatusDisplay(isEnabled);
    saveSetting('enabled', isEnabled);

    // Notify background worker to toggle network rulesets
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'TOGGLE_RULES',
        enabled: isEnabled
      });
    }
  });

  autoSkipToggle.addEventListener('change', (e) => {
    saveSetting('autoSkip', e.target.checked);
  });

  fastForwardToggle.addEventListener('change', (e) => {
    saveSetting('fastForward', e.target.checked);
  });

  hideBannersToggle.addEventListener('change', (e) => {
    saveSetting('hideBanners', e.target.checked);
  });

  bypassPopupToggle.addEventListener('change', (e) => {
    saveSetting('bypassPopup', e.target.checked);
  });

  // Action: Reload YouTube Tab
  refreshTabBtn.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
          chrome.tabs.reload(tabs[0].id);
        } else {
          // Open YouTube if not already on it
          chrome.tabs.create({ url: 'https://www.youtube.com' });
        }
      });
    }
  });

  // Action: Reset Statistics
  resetStatsBtn.addEventListener('click', () => {
    if (confirm('Reset your blocked ads statistics?')) {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'RESET_STATS' }, () => {
          blockedCountElem.textContent = '0';
          timeSavedElem.textContent = '0m';
        });
      }
    }
  });

  // Realtime storage listener to update stats while popup is open
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.adsBlockedCount) {
          blockedCountElem.textContent = (changes.adsBlockedCount.newValue || 0).toLocaleString();
        }
        if (changes.timeSavedSeconds) {
          timeSavedElem.textContent = formatTime(changes.timeSavedSeconds.newValue || 0);
        }
      }
    });
  }

  // Initial load
  loadConfig();
});
