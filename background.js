/**
 * CleanTube - Background Service Worker
 * Manages Declarative Net Request rules, statistics, and badge counter
 */

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    ['enabled', 'autoSkip', 'fastForward', 'hideBanners', 'bypassPopup', 'adsBlockedCount', 'timeSavedSeconds'],
    (data) => {
      const defaults = {
        enabled: data.enabled !== undefined ? data.enabled : true,
        autoSkip: data.autoSkip !== undefined ? data.autoSkip : true,
        fastForward: data.fastForward !== undefined ? data.fastForward : true,
        hideBanners: data.hideBanners !== undefined ? data.hideBanners : true,
        bypassPopup: data.bypassPopup !== undefined ? data.bypassPopup : true,
        adsBlockedCount: (data.adsBlockedCount && data.adsBlockedCount < 500) ? data.adsBlockedCount : 0,
        timeSavedSeconds: (data.timeSavedSeconds && data.adsBlockedCount < 500) ? data.timeSavedSeconds : 0
      };

      chrome.storage.local.set(defaults, () => {
        updateRulesetState(defaults.enabled);
        updateBadge(defaults.adsBlockedCount);
      });
    }
  );
});

// Update DeclarativeNetRequest dynamic/static ruleset state
function updateRulesetState(isEnabled) {
  if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateEnabledRulesets) {
    chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: isEnabled ? ['ruleset_1'] : [],
      disableRulesetIds: isEnabled ? [] : ['ruleset_1']
    }).catch((err) => {
      console.warn('[CleanTube] Failed to update ruleset:', err);
    });
  }
}

// Update extension icon badge
function updateBadge(count) {
  if (typeof chrome.action !== 'undefined' && chrome.action.setBadgeText) {
    if (count > 0) {
      const badgeText = count > 999 ? `${Math.floor(count / 1000)}k` : `${count}`;
      chrome.action.setBadgeText({ text: badgeText });
      chrome.action.setBadgeBackgroundColor({ color: '#E62117' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  }
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'AD_BLOCKED') {
    chrome.storage.local.get(['adsBlockedCount', 'timeSavedSeconds'], (data) => {
      const newCount = (data.adsBlockedCount || 0) + 1;
      const newTimeSaved = (data.timeSavedSeconds || 0) + 15; // Estimate 15 seconds saved per ad

      chrome.storage.local.set({
        adsBlockedCount: newCount,
        timeSavedSeconds: newTimeSaved
      }, () => {
        updateBadge(newCount);
      });
    });
    sendResponse({ status: 'ok' });
  } else if (message.action === 'RESET_STATS') {
    chrome.storage.local.set({
      adsBlockedCount: 0,
      timeSavedSeconds: 0
    }, () => {
      updateBadge(0);
      sendResponse({ status: 'ok' });
    });
    return true; // Keep message channel open for async response
  } else if (message.action === 'TOGGLE_RULES') {
    updateRulesetState(message.enabled);
    sendResponse({ status: 'ok' });
  }
});

// Clean up runaway counts from previous bug and sync badge
chrome.storage.local.get(['adsBlockedCount'], (data) => {
  if (data && data.adsBlockedCount) {
    if (data.adsBlockedCount > 500) {
      chrome.storage.local.set({ adsBlockedCount: 0, timeSavedSeconds: 0 }, () => {
        updateBadge(0);
      });
    } else {
      updateBadge(data.adsBlockedCount);
    }
  }
});
