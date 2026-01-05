/* Video Downloader Extension - Content Script
   
   This script is injected into every web page to detect videos
   that are loaded dynamically (AJAX, fetch, lazy loading, etc.)
   
   PRIVACY NOTE:
   No data is stored permanently or sent to external servers. */

(function() {
  'use strict';

  /* 1. Configuration */

  const VIDEO_PATTERNS = [
    /\.mp4/i,
    /\.webm/i,
    /\.m3u8/i,
    /\.mpd/i,
    /\.mov/i,
    /\.avi/i,
    /\.mkv/i,
    /\.flv/i,
    /video/i,
    /stream/i,
    /media.*segment/i
  ];

  /* 2. Network Interception */

  /**
   * Intercept XMLHttpRequest to detect dynamically loaded videos
   */
  const originalXHROpen = XMLHttpRequest.prototype.open;
  
  XMLHttpRequest.prototype.open = function(method, url) {
    if (isVideoUrl(url)) {
      notifyVideoFound(url);
    }
    return originalXHROpen.apply(this, arguments);
  };

  /**
   * Intercept fetch API to detect dynamically loaded videos
   */
  const originalFetch = window.fetch;
  
  window.fetch = function(resource, options) {
    const url = typeof resource === 'string' ? resource : resource.url;
    
    if (url && isVideoUrl(url)) {
      notifyVideoFound(url);
    }
    
    return originalFetch.apply(this, arguments);
  };

  /* 3. DOM Observation */

  /**
   * Observe DOM changes to detect new video elements
   */
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        // Check if the added node is a video
        if (node.tagName === 'VIDEO') {
          checkVideoElement(node);
        }

        // Check for video children
        if (node.querySelectorAll) {
          node.querySelectorAll('video').forEach(checkVideoElement);
          
          // Check for source elements
          node.querySelectorAll('source[src]').forEach(source => {
            if (isVideoUrl(source.src)) {
              notifyVideoFound(source.src);
            }
          });
        }

        // Check if it's a source element
        if (node.tagName === 'SOURCE' && node.src) {
          if (isVideoUrl(node.src)) {
            notifyVideoFound(node.src);
          }
        }
      });
    });
  });

  // Start observing the document
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  /* 4. Initial Scan */

  /**
   * Scan existing videos when script loads
   */
  function initialScan() {
    document.querySelectorAll('video').forEach(checkVideoElement);
    document.querySelectorAll('source[src]').forEach(source => {
      if (isVideoUrl(source.src)) {
        notifyVideoFound(source.src);
      }
    });
  }

  // Run initial scan
  initialScan();

  /* 5. Helper Functions */

  /**
   * Check a video element for valid sources
   * @param {HTMLVideoElement} video - Video element to check
   */
  function checkVideoElement(video) {
    // Check direct src
    if (video.src && !video.src.startsWith('blob:')) {
      notifyVideoFound(video.src);
    }
    
    // Check currentSrc (actual playing source)
    if (video.currentSrc && !video.currentSrc.startsWith('blob:')) {
      notifyVideoFound(video.currentSrc);
    }

    // Check source children
    video.querySelectorAll('source').forEach(source => {
      if (source.src && !source.src.startsWith('blob:')) {
        notifyVideoFound(source.src);
      }
    });
  }

  /**
   * Check if URL is a video URL
   * @param {string} url - URL to check
   * @returns {boolean}
   */
  function isVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (url.startsWith('data:') || url.startsWith('blob:')) return false;
    
    return VIDEO_PATTERNS.some(pattern => pattern.test(url));
  }

  /**
   * Notify background script about found video
   * @param {string} url - Video URL
   */
  function notifyVideoFound(url) {
    try {
      chrome.runtime?.sendMessage?.({
        action: 'videoFound',
        url: url,
        pageUrl: window.location.href
      });
    } catch (error) {
      // Silently ignore communication errors
      // This can happen if extension context is invalidated
    }
  }

  // Log to confirm script is loaded (only in development)
  console.log('🎬 Video Downloader: Content script loaded');

})();