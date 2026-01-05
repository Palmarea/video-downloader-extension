/* Video Downloader Extension - Background Service Worker
   
   PRIVACY NOTE:
   This extension does NOT store any data permanently.
   Detected videos are kept only in memory (RAM) and are deleted
   when the tab is closed. No databases, no external servers.*/

/**
 * Storage for detected videos per tab
 * @type {Map<number, Array>}
 */
const detectedVideos = new Map();

/* 1. Configuration */

// URL patterns that indicate video content
const VIDEO_URL_PATTERNS = [
  /\.mp4(\?|$|#)/i,
  /\.webm(\?|$|#)/i,
  /\.m3u8(\?|$|#)/i,
  /\.mpd(\?|$|#)/i,
  /\.mov(\?|$|#)/i,
  /\.avi(\?|$|#)/i,
  /\.mkv(\?|$|#)/i,
  /\.flv(\?|$|#)/i,
  /\/video\//i,
  /videoplayback/i,
  /\.ts(\?|$|#)/i,
  /media.*segment/i,
  /chunk.*video/i
];

// Content types that indicate video
const VIDEO_CONTENT_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/x-flv',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
  'application/dash+xml'
];

/* 2. Network Request Listeners */

/**
 * Check if URL matches video patterns
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isVideoUrl(url) {
  // Ignore data URLs and blobs
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return false;
  }

  // Ignore very short or very long URLs
  if (url.length < 10 || url.length > 5000) {
    return false;
  }

  // ===== FILTERS TO AVOID JUNK =====
  
  // Ignore video segments/chunks (partial files)
  if (url.includes('range=')) {
    return false;
  }

  // Ignore Vimeo thumbnails and images
  if (url.includes('i.vimeocdn.com')) {
    return false;
  }

  // Ignore very small image previews
  if (url.includes('mw=80') || url.includes('w=640')) {
    return false;
  }

  // Ignore segment files from HLS/DASH
  if (/segment|chunk|frag/i.test(url) && /range|bytes/i.test(url)) {
    return false;
  }

  return VIDEO_URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * listen for response headers to detect video content types
 */

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const { tabId, url, responseHeaders } = details;
    
    if (tabId < 0) return;

    // Find content-type header
    const contentTypeHeader = responseHeaders?.find(
      header => header.name.toLowerCase() === 'content-type'
    );

    if (contentTypeHeader) {
      const contentType = contentTypeHeader.value.toLowerCase();
      
      // Check if content type indicates video
      if (VIDEO_CONTENT_TYPES.some(vct => contentType.includes(vct))) {
        addVideoToTab(tabId, {
          url: url,
          type: getTypeFromContentType(contentType),
          filename: generateFilename(url),
          quality: detectQuality(url),
          timestamp: Date.now()
        });
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

/* 3. Tab Management */

/**
 * Clean up when a tab is closed
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  detectedVideos.delete(tabId);
});

/**
 * Clean up when navigating to a new page
 */

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    detectedVideos.delete(tabId);
  }
});

/* 4. Message Handling */

/** Handle messages from popup */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getVideos') {
    const videos = detectedVideos.get(message.tabId) || [];
    
    // Remove duplicates and sort by timestamp (newest first)
    const uniqueVideos = Array.from(
      new Map(videos.map(v => [v.url, v])).values()
    ).sort((a, b) => b.timestamp - a.timestamp);
    
    sendResponse(uniqueVideos);
  }
  
  // Keep message channel open for async response
  return true;
});

/*  5. Helper Functions */

/**
 * Check if URL matches video patterns
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isVideoUrl(url) {
  // Ignore data URLs and blobs
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return false;
  }

  // Ignore very short or very long URLs
  if (url.length < 10 || url.length > 5000) {
    return false;
  }

  return VIDEO_URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Add a video to the tab's detected videos
 * @param {number} tabId - Tab ID
 * @param {Object} videoInfo - Video information
 */
function addVideoToTab(tabId, videoInfo) {
  if (!detectedVideos.has(tabId)) {
    detectedVideos.set(tabId, []);
  }

  const tabVideos = detectedVideos.get(tabId);
  
  // Avoid exact duplicates
  const isDuplicate = tabVideos.some(v => v.url === videoInfo.url);
  if (!isDuplicate) {
    tabVideos.push(videoInfo);
    
    // Keep only the last 50 videos per tab (memory management)
    if (tabVideos.length > 50) {
      tabVideos.shift();
    }

    // Update badge to show video count
    updateBadge(tabId, tabVideos.length);
  }
}

/**
 * Update the extension badge with video count
 * @param {number} tabId - Tab ID
 * @param {number} count - Number of videos
 */
function updateBadge(tabId, count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString(), tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#e94560', tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
}

/**
 * Get video type from URL
 * @param {string} url - Video URL
 * @returns {string} Video type
 */
function getVideoType(url) {
  if (/\.m3u8/i.test(url)) return 'HLS';
  if (/\.mpd/i.test(url)) return 'DASH';
  if (/\.webm/i.test(url)) return 'WebM';
  if (/\.mov/i.test(url)) return 'MOV';
  if (/\.mkv/i.test(url)) return 'MKV';
  if (/\.flv/i.test(url)) return 'FLV';
  if (/\.avi/i.test(url)) return 'AVI';
  if (/\.ts/i.test(url)) return 'TS';
  return 'MP4';
}

/**
 * Get video type from content type header
 * @param {string} contentType - Content-Type header value
 * @returns {string} Video type
 */
function getTypeFromContentType(contentType) {
  if (contentType.includes('mpegurl')) return 'HLS';
  if (contentType.includes('dash')) return 'DASH';
  if (contentType.includes('webm')) return 'WebM';
  if (contentType.includes('quicktime')) return 'MOV';
  if (contentType.includes('flv')) return 'FLV';
  if (contentType.includes('matroska')) return 'MKV';
  return 'MP4';
}

/**
 * Generate a filename from URL
 * @param {string} url - Video URL
 * @returns {string} Generated filename
 */
function generateFilename(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const parts = pathname.split('/').filter(p => p && !p.includes('?'));
    let filename = parts[parts.length - 1] || 'video';
    
    // Clean the filename
    filename = filename.replace(/\.[^.]+$/, ''); // Remove extension
    filename = filename.replace(/[^a-zA-Z0-9_-]/g, '_'); // Clean special chars
    
    // If filename is too short or generic, use timestamp
    if (filename.length < 3 || filename === 'video' || filename === 'media') {
      filename = `video_${Date.now()}`;
    }

    return filename.substring(0, 50); // Limit length
  } catch {
    return `video_${Date.now()}`;
  }
}

/**
 * Detect video quality from URL
 * @param {string} url - Video URL
 * @returns {string|null} Quality string or null
 */
function detectQuality(url) {
  const urlLower = url.toLowerCase();
  
  if (/4k|2160p|uhd/i.test(urlLower)) return '4K';
  if (/1080p|fullhd|fhd/i.test(urlLower)) return '1080p';
  if (/720p|hd(?!d)/i.test(urlLower)) return '720p';
  if (/480p|sd/i.test(urlLower)) return '480p';
  if (/360p/i.test(urlLower)) return '360p';
  if (/240p/i.test(urlLower)) return '240p';
  if (/144p/i.test(urlLower)) return '144p';
  
  return null;
}

// Log to confirm script is loaded
console.log('🎬 Video Downloader: Background service worker loaded');
