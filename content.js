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

  // 1. Load stored settings and sync changes
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

      ['pointerover', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((eventType) => {
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
    const selectors = [
      '.ytp-ad-skip-button-modern',
      '.ytp-skip-ad-button',
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-text',
      'button.ytp-ad-skip-button-modern',
      'button.ytp-skip-ad-button',
      '.ytp-ad-skip-button-slot button',
      '.ytp-ad-skip-button-container button',
      '[id^="skip-button:"] button',
      'button[class*="skip-button"]',
      'button[class*="skip-ad"]',
      '.ytp-ad-overlay-close-button',
      'button.ytp-ad-overlay-close-button'
    ];

    for (const sel of selectors) {
      const elements = document.querySelectorAll(sel);
      for (const el of elements) {
        if (isVisible(el)) {
          simulateClick(el);
          window.dispatchEvent(new CustomEvent('cleantube-skip-ad'));
          return true;
        }
      }
    }

    // Text-based fallback: find any button containing "Skip" inside the player
    const player = document.querySelector('#movie_player') ||
                   document.querySelector('.html5-video-player');

    if (player) {
      const candidates = player.querySelectorAll('button, div[role="button"]');
      for (const btn of candidates) {
        const text = (btn.textContent || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        if ((text.includes('skip') || aria.includes('skip')) && isVisible(btn)) {
          simulateClick(btn);
          window.dispatchEvent(new CustomEvent('cleantube-skip-ad'));
          return true;
        }
      }
    }

    return false;
  }

  // Accurate ad detection without false positives
  function isAdPresent() {
    const player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
    if (!player) return false;

    // Signal A: Player class names (the definitive in-stream ad indicator)
    if (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting')) {
      return true;
    }

    // Signal B: Skip button is present and visible
    const skipSelectors = [
      '.ytp-ad-skip-button-modern',
      '.ytp-skip-ad-button',
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-text',
      'button.ytp-ad-skip-button-modern',
      'button.ytp-skip-ad-button',
      '[id^="skip-button:"] button'
    ];
    for (const sel of skipSelectors) {
      const el = player.querySelector(sel);
      if (el && isVisible(el)) return true;
    }

    // Signal C: "Sponsored" indicator or ad badge with visible content
    const adBadge = player.querySelector('.ytp-ad-badge, .ytp-ad-simple-ad-badge');
    if (adBadge && isVisible(adBadge)) return true;

    // Signal D: Ad text countdown / remaining
    const adText = player.querySelector('.ytp-ad-text, .ytp-ad-duration-remaining');
    if (adText && isVisible(adText) && (adText.textContent || '').trim().length > 0) {
      return true;
    }

    return false;
  }

  // Report blocked ad (strictly once per ad session)
  function reportAdBlocked() {
    const now = Date.now();
    if (now - lastReportedTime < 2000) return;
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

    const video = getVideo();
    const adActive = isAdPresent();

    if (adActive && video) {
      if (!isHandlingAd) {
        isHandlingAd = true;
        // Save user's original playback settings
        if (video.playbackRate && video.playbackRate <= 4.0) {
          userPlaybackRate = video.playbackRate;
        }
        userWasMuted = video.muted;
        reportAdBlocked();
      }

      // Trigger MAIN world native skip
      window.dispatchEvent(new CustomEvent('cleantube-skip-ad'));

      // Always try clicking skip button
      if (config.autoSkip) {
        findAndClickSkipButton();
      }

      // Fast-forward & mute the ad
      if (config.fastForward) {
        // Mute ad audio
        if (!video.muted) {
          video.muted = true;
        }

        // Accelerate to 16x speed
        try {
          video.playbackRate = 16.0;
        } catch (e) {
          try { video.playbackRate = 8.0; } catch (e2) {}
        }

        // Fast-forward near end so YouTube finishes the ad segment cleanly without freezing
        if (isFinite(video.duration) && video.duration > 0.5) {
          if (video.currentTime < video.duration - 0.2) {
            video.currentTime = video.duration - 0.2;
          }
        }

        // Keep video playing so the ad finishes and transitions smoothly
        if (video.paused) {
          video.play().catch(() => {});
        }
      }
    } else if (isHandlingAd) {
      // Ad has finished, restore normal playback
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
      if (video.paused) {
        video.play().catch(() => {});
      }
    }
  }

  // Setup listeners and high-speed interval loop
  function setup() {
    initConfig();

    // Check every 50ms for instant reaction
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
    setInterval(attachVideoListeners, 1000);
  }

  // Initialize as soon as DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
