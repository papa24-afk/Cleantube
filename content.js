/**
 * CleanTube - Enhanced Content Script
 * Fast, reliable ad detection, auto-skip, and 16x acceleration for YouTube™
 */

(function () {
  'use strict';

  let config = {
    enabled: true,
    autoSkip: true,
    fastForward: true,
    hideBanners: true,
    bypassPopup: true
  };

  let isHandlingAd = false;
  let userPlaybackRate = 1.0;
  let userWasMuted = false;
  let lastReportedTime = 0;

  // 1. Inject MAIN-world script for native player API access
  function injectMainWorldScript() {
    try {
      if (document.getElementById('cleantube-injected-script')) return;
      const script = document.createElement('script');
      script.id = 'cleantube-injected-script';
      script.src = chrome.runtime.getURL('inject.js');
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      // Ignore if restricted
    }
  }

  // 2. Load stored settings and sync changes
  function initConfig() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(
        ['enabled', 'autoSkip', 'fastForward', 'hideBanners', 'bypassPopup'],
        (res) => {
          if (res) {
            config = {
              enabled: res.enabled !== undefined ? res.enabled : true,
              autoSkip: res.autoSkip !== undefined ? res.autoSkip : true,
              fastForward: res.fastForward !== undefined ? res.fastForward : true,
              hideBanners: res.hideBanners !== undefined ? res.hideBanners : true,
              bypassPopup: res.bypassPopup !== undefined ? res.bypassPopup : true
            };
          }
          applyConfig();
        }
      );

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
          for (const key in changes) {
            if (key in config) {
              config[key] = changes[key].newValue;
            }
          }
          applyConfig();
        }
      });
    }
  }

  function applyConfig() {
    const styleId = 'cleantube-custom-styles';
    let styleTag = document.getElementById(styleId);

    if (config.enabled && config.hideBanners) {
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        styleTag.textContent = `
          #masthead-ad, ytd-ad-slot-renderer, .ytp-ad-overlay-container,
          ytd-in-feed-ad-layout-renderer, ytd-promoted-sparkles-web-renderer,
          ytd-promoted-video-renderer, ytd-compact-promoted-video-renderer,
          .ytp-ad-message-container, ytd-action-companion-ad-renderer,
          #panels > ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"] {
            display: none !important;
          }
        `;
        (document.head || document.documentElement).appendChild(styleTag);
      }
    } else if (styleTag) {
      styleTag.remove();
    }
  }

  // Helper to find video element
  function getVideo() {
    return document.querySelector('#movie_player video') ||
           document.querySelector('.html5-video-player video') ||
           document.querySelector('video');
  }

  // Dispatch full event sequence to guarantee YouTube recognizes the click
  function simulateClick(element) {
    if (!element) return;
    try {
      const rect = element.getBoundingClientRect();
      const clientX = rect.left + rect.width / 2;
      const clientY = rect.top + rect.height / 2;

      const eventInit = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX: clientX || 0,
        clientY: clientY || 0,
        button: 0,
        buttons: 1
      };

      ['pointerover', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(eventType => {
        element.dispatchEvent(new MouseEvent(eventType, eventInit));
      });

      if (typeof element.click === 'function') {
        element.click();
      }
    } catch (e) {}
  }

  // Check if an element is visible in the viewport
  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // Search for ANY skip button and click it immediately
  function findAndClickSkipButton() {
    // 1. Check known skip button selectors (including modern 2024-2026 designs)
    const selectors = [
      '.ytp-ad-skip-button-modern',
      '.ytp-skip-ad-button',
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-text',
      'button.ytp-ad-skip-button-modern',
      'button.ytp-skip-ad-button',
      '.ytp-ad-skip-button-slot button',
      '.ytp-ad-skip-button-container button',
      '[class*="skip-button"]',
      '[class*="skip-ad-button"]',
      '[class*="ytp-ad-skip"]',
      '[class*="ytp-skip-ad"]',
      '[id^="skip-button:"] button',
      'button[id*="skip"]',
      'button[aria-label*="skip" i]',
      '.ytp-ad-overlay-close-button',
      'button.ytp-ad-overlay-close-button'
    ];

    for (const sel of selectors) {
      const elements = document.querySelectorAll(sel);
      for (const el of elements) {
        if (isVisible(el)) {
          simulateClick(el);
          return true;
        }
      }
    }

    // 2. Text-based scan: find any button containing "Skip" inside the player
    const player = document.querySelector('#movie_player') ||
                   document.querySelector('.html5-video-player') ||
                   document.querySelector('ytd-player') ||
                   document.body;

    if (player) {
      const candidates = player.querySelectorAll('button, div[role="button"], span[role="button"]');
      for (const btn of candidates) {
        const text = (btn.textContent || btn.innerText || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        if ((text.includes('skip') || aria.includes('skip')) && isVisible(btn)) {
          simulateClick(btn);
          return true;
        }
      }
    }

    return false;
  }

  // Comprehensive ad detection (checks classes, badges, timers, modules, and sponsored labels)
  function isAdPresent() {
    const player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');

    // Signal A: Player class names
    if (player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'))) {
      return true;
    }

    // Signal B: Skip button is present
    const skipSelectors = [
      '.ytp-ad-skip-button-modern',
      '.ytp-skip-ad-button',
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-text',
      '[class*="skip-button"]',
      '[class*="skip-ad-button"]'
    ];
    for (const sel of skipSelectors) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) return true;
    }

    // Signal C: "Sponsored" indicator or ad badge (bottom-left)
    const adBadge = document.querySelector(
      '.ytp-ad-badge, [class*="ytp-ad-badge"], .ytp-ad-simple-ad-badge, [class*="ad-info"], div.ytp-ad-text'
    );
    if (adBadge && isVisible(adBadge)) return true;

    // Signal D: Circular timer / progress spinner (top-right)
    const spinner = document.querySelector(
      'svg.ytp-ad-progress-spinner, circle.ytp-ad-progress-spinner, .ytp-ad-duration-remaining, .ytp-ad-preview-container, [class*="progress-spinner"]'
    );
    if (spinner && isVisible(spinner)) return true;

    // Signal E: Ad module / overlay containers that are not empty
    const adModule = document.querySelector('.ytp-ad-player-overlay, .ytp-ad-player-overlay-layout, .video-ads, .ytp-ad-module');
    if (adModule && adModule.children.length > 0 && isVisible(adModule)) {
      return true;
    }

    return false;
  }

  // Report blocked ad (debounced)
  function reportAdBlocked() {
    const now = Date.now();
    if (now - lastReportedTime < 1500) return;
    lastReportedTime = now;

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({ action: 'AD_BLOCKED' });
      } catch (e) {}
    }
  }

  // Dismiss anti-adblock dialogs
  function bypassAntiAdblockDialog() {
    if (!config.enabled || !config.bypassPopup) return;

    const dialogs = document.querySelectorAll(
      'ytd-enforcement-message-view-model, tp-yt-paper-dialog:has(ytd-enforcement-message-view-model), ' +
      'yt-playability-error-supported-renderers:has(#container.ytd-enforcement-message-view-model)'
    );

    if (dialogs.length > 0) {
      dialogs.forEach((dialog) => {
        const dismissBtn = dialog.querySelector('#dismiss-button, button[aria-label="Close"], yt-button-renderer button');
        if (dismissBtn) {
          dismissBtn.click();
        } else {
          dialog.remove();
        }
      });

      document.querySelectorAll('tp-yt-iron-overlay-backdrop').forEach((el) => el.remove());

      const video = getVideo();
      if (video && video.paused) {
        video.play().catch(() => {});
      }
      reportAdBlocked();
    }
  }

  // Process YouTube Shorts ads
  function handleShortsAds() {
    if (!config.enabled || !window.location.pathname.startsWith('/shorts/')) return;

    const currentShort = document.querySelector('ytd-reel-video-renderer[is-active]');
    if (currentShort) {
      const isAd = currentShort.querySelector('ytd-ad-slot-renderer') ||
                   currentShort.querySelector('.ytd-in-feed-ad-layout-renderer') ||
                   currentShort.hasAttribute('is-ad');
      if (isAd) {
        const nextButton = document.querySelector('#navigation-button-down button');
        if (nextButton) {
          nextButton.click();
        } else {
          window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
        }
        reportAdBlocked();
      }
    }
  }

  // Main ad handling loop
  function processAds() {
    if (!config.enabled) {
      if (isHandlingAd) restoreNormalPlayback();
      return;
    }

    bypassAntiAdblockDialog();
    handleShortsAds();

    // ALWAYS try to click skip button if one exists on the page
    if (config.autoSkip) {
      const clicked = findAndClickSkipButton();
      if (clicked) {
        reportAdBlocked();
      }
    }

    const video = getVideo();
    const adActive = isAdPresent();

    if (adActive && video) {
      if (!isHandlingAd) {
        isHandlingAd = true;
        if (video.playbackRate && video.playbackRate <= 4) {
          userPlaybackRate = video.playbackRate;
        }
        userWasMuted = video.muted;
      }

      // Fast-forward & mute the ad
      if (config.fastForward) {
        // Mute immediately to eliminate sound
        if (!video.muted) {
          video.muted = true;
        }

        // Accelerate to 16x speed
        try {
          video.playbackRate = 16.0;
        } catch (e) {
          try { video.playbackRate = 8.0; } catch (e2) {}
        }

        // Jump to end of ad segment
        if (isFinite(video.duration) && video.duration > 0) {
          if (video.currentTime < video.duration - 0.1) {
            video.currentTime = video.duration;
          }
        }
      }

      // Keep video playing if paused by ad logic
      if (video.paused && !video.ended) {
        video.play().catch(() => {});
      }

      reportAdBlocked();
    } else if (isHandlingAd) {
      restoreNormalPlayback();
    }
  }

  // Restore user playback state after ad finishes
  function restoreNormalPlayback() {
    isHandlingAd = false;
    const video = getVideo();
    if (video) {
      if (video.playbackRate > 4.0 || video.playbackRate === 16.0) {
        video.playbackRate = userPlaybackRate || 1.0;
      }
      if (!userWasMuted && video.muted) {
        video.muted = false;
      }
    }
  }

  // Setup listeners and high-speed interval loop
  function setup() {
    injectMainWorldScript();
    initConfig();

    // High frequency interval (every 50ms) ensures ads are killed instantaneously
    setInterval(() => {
      processAds();
    }, 50);

    // Watch DOM mutations
    const observer = new MutationObserver(() => {
      processAds();
    });

    const target = document.body || document.documentElement;
    if (target) {
      observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'src']
      });
    }

    // Attach to video element events
    function attachVideoListeners() {
      const video = getVideo();
      if (video && !video.__cleantube_attached) {
        video.__cleantube_attached = true;
        video.addEventListener('timeupdate', processAds);
        video.addEventListener('ratechange', () => {
          if (!isHandlingAd && video.playbackRate <= 4.0) {
            userPlaybackRate = video.playbackRate;
          }
        });
        video.addEventListener('volumechange', () => {
          if (!isHandlingAd) {
            userWasMuted = video.muted;
          }
        });
      }
    }

    attachVideoListeners();
    setInterval(attachVideoListeners, 500);

    // Message listener for popup updates
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'SETTINGS_UPDATED') {
          config = Object.assign(config, message.config);
          applyConfig();
          processAds();
          sendResponse({ status: 'ok' });
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
