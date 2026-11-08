/**
 * CleanTube - Page Context (MAIN world) Script
 * Runs in YouTube's main window context with access to
 * the HTML5 movie_player API and native player methods.
 */

(function () {
  'use strict';

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

    // Check player classes (strictly ad-showing or ad-interrupting)
    if (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting')) {
      return true;
    }

    return false;
  }

  function tryNativeSkip() {
    const player = getPlayer();
    if (!player || !isAdActive()) return;

    // Call player.skipAd() natively if available
    if (typeof player.skipAd === 'function') {
      try {
        player.skipAd();
      } catch (e) {}
    }
  }

  // Periodic check for native skip
  setInterval(() => {
    if (isAdActive()) {
      tryNativeSkip();
    }
  }, 100);

  // Listen for custom trigger from content script
  window.addEventListener('cleantube-skip-ad', tryNativeSkip);
})();
