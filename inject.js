/**
 * CleanTube - Page Context (MAIN world) Script
 * Runs directly in YouTube's main window context with full access to
 * the HTML5 movie_player API and internal player methods.
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__cleantube_injected) return;
  window.__cleantube_injected = true;

  function getPlayer() {
    return document.getElementById('movie_player') || document.querySelector('.html5-video-player');
  }

  function isAdActive() {
    const player = getPlayer();
    if (!player) return false;

    // Check YouTube's internal player API flags
    if (typeof player.isAdPlaying === 'function' && player.isAdPlaying()) {
      return true;
    }
    if (typeof player.getAdState === 'function' && player.getAdState() > 0) {
      return true;
    }

    // Check player classes
    if (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting')) {
      return true;
    }

    // Check for ad module / overlay presence
    if (document.querySelector('.ytp-ad-player-overlay, .ytp-ad-player-overlay-layout, .ytp-ad-text, [class*="ytp-ad-"]')) {
      return true;
    }

    // Check for sponsored badges
    const badge = document.querySelector('.ytp-ad-badge, [class*="ad-badge"], .ytp-ad-simple-ad-badge');
    if (badge && badge.offsetParent !== null) {
      return true;
    }

    return false;
  }

  function executeNativeSkip() {
    const player = getPlayer();
    if (!player) return;

    // 1. Call player.skipAd() natively if available
    if (typeof player.skipAd === 'function') {
      try {
        player.skipAd();
      } catch (e) {}
    }

    // 2. Accelerate and finish ad video segment
    const video = player.querySelector('video') || document.querySelector('video');
    if (video && isAdActive()) {
      video.muted = true;
      try {
        video.playbackRate = 16.0;
      } catch (e) {}

      if (isFinite(video.duration) && video.duration > 0) {
        if (video.currentTime < video.duration - 0.1) {
          video.currentTime = video.duration;
        }
      }

      if (video.paused && !video.ended) {
        video.play().catch(() => {});
      }
    }
  }

  // High-frequency monitor loop (50ms) in main window
  setInterval(() => {
    if (isAdActive()) {
      executeNativeSkip();
    }
  }, 50);

  // Hook into video play / timeupdate events in page context
  document.addEventListener('play', (e) => {
    if (e.target && e.target.tagName === 'VIDEO') {
      if (isAdActive()) {
        executeNativeSkip();
      }
    }
  }, true);

  document.addEventListener('timeupdate', (e) => {
    if (e.target && e.target.tagName === 'VIDEO') {
      if (isAdActive()) {
        executeNativeSkip();
      }
    }
  }, true);
})();
