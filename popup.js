/* popup la logic */

/**
 * Initialization when the DOM is ready
 */
document.addEventListener('DOMContentLoaded', initializePopup);

function initializePopup() {
  // DOM references to elements
  const scanBtn = document.getElementById('scanBtn');
  const content = document.getElementById('content');

  // Event listener for scan of the button
  scanBtn.addEventListener('click', () => handleScan(scanBtn, content));
}

/* 1. Main functions of the scan
 */

/**
 * Manages video scanning process
 * @param {HTMLElement} scanBtn - scan button
 * @param {HTMLElement} content - content container
 */
async function handleScan(scanBtn, content) {
  // Disable button while scanning
  scanBtn.disabled = true;
  scanBtn.textContent = '⏳ Searching...';
  
  // Charge status
  content.innerHTML = createLoadingHTML();

  try {
    // Videos obtained of the active page
    const videos = await scanCurrentTab();
    
    // Results showed
    displayVideos(videos, content);
  } catch (error) {
    console.error('Error during scanning:', error);
    content.innerHTML = createErrorHTML();
  } finally {
    // Rehabilitate button
    scanBtn.disabled = false;
    scanBtn.textContent = '🔍 SCAN';
  }
}

/**
 * Scan the current tab videos
 * @returns {Promise<Array>} Videos list found
 */
async function scanCurrentTab() {
  // Active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Detection script of the page
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: detectVideosInPage
  });

  const videosFromPage = results[0]?.result || [];
  
  // Videos detected by the background script
  const videosFromBackground = await chrome.runtime.sendMessage({ 
    action: 'getVideos', 
    tabId: tab.id 
  });

  // Merge and remove duplicates
  return mergeAndDeduplicate(videosFromPage, videosFromBackground);
}

/**
 * Combine videos arrives and remove duplicates
 * @param {Array} videosA - First array for videos
 * @param {Array} videosB - Second array for videos
 * @returns {Array} Combined videos without duplicates
 */
function mergeAndDeduplicate(videosA, videosB = []) {
  const allVideos = [...videosA];
  
  videosB.forEach(video => {
    const isDuplicate = allVideos.some(existing => existing.url === video.url);
    if (!isDuplicate) {
      allVideos.push(video);
    }
  });

  return allVideos;
}

/*    2. Rendering functions (UI) */

/**
 * Display the videos found in the interface
 * @param {Array} videos - Videos list
 * @param {HTMLElement} container - Show in container 
 */
function displayVideos(videos, container) {
  // If there's no video, show empty state
  if (!videos || videos.length === 0) {
    container.innerHTML = createEmptyStateHTML();
    return;
  }

  // Create HTML of the videos list
  const videoListHTML = videos.map(video => createVideoItemHTML(video)).join('');

  container.innerHTML = `
    <p class="results-count">
      We found <span class="badge">${videos.length}</span> video(s)
    </p>
    <div class="video-list">
      ${videoListHTML}
    </div>
  `;

  // Add event listeners to the buttons
  attachButtonListeners(container);
}

/**
 * Crea el HTML para un item de video
 * @param {Object} video - Datos del video
 * @returns {string} HTML del item
 */
function createVideoItemHTML(video) {
  const icon = getVideoIcon(video.type);
  const truncatedUrl = truncateUrl(video.url, 80);
  const quality = video.quality ? `• ${video.quality}` : '';
  const escapedUrl = escapeHtml(video.url);
  const escapedFilename = escapeHtml(video.filename || 'video');

  // Check if it's a protected platform (Vimeo, YouTube)
  const isProtected = isProtectedPlatform(video.type);

  // Different buttons for protected vs direct videos
  const downloadButton = isProtected
    ? `<button class="btn btn--download btn--disabled" disabled title="Protected video">
         🔒 Protected
       </button>`
    : `<button class="btn btn--download" data-url="${escapedUrl}" data-filename="${escapedFilename}">
         ⬇️ Download
       </button>`;

  // Show tip for protected platforms
  const protectedTip = isProtected
    ? `<p class="video-item__tip">💡 Use <strong>yt-dlp</strong> or <strong>cobalt.tools</strong> with the copied URL</p>`
    : '';

  return `
    <article class="video-item">
      <div class="video-item__info">
        <span class="video-item__icon">${icon}</span>
        <div class="video-item__details">
          <span class="video-item__type">${video.type || 'Video'} ${quality}</span>
          <p class="video-item__url">${truncatedUrl}</p>
        </div>
      </div>
      ${protectedTip}
      <div class="video-item__actions">
        ${downloadButton}
        <button class="btn btn--copy" data-url="${escapedUrl}">
          📋 Copy
        </button>
      </div>
    </article>
  `;
}

/**
 * Check if video is from a protected platform
 * @param {string} type - Video type
 * @returns {boolean}
 */
function isProtectedPlatform(type) {
  const protectedTypes = ['vimeo', 'youtube'];
  return protectedTypes.includes(type?.toLowerCase());
}

/**
 * HTML charge status
 * @returns {string} HTML
 */
function createLoadingHTML() {
  return `
    <div class="status status--scanning">
      <div class="spinner"></div>
      <p>Scanning page in videos searching...</p>
    </div>
  `;
}

/**
 * Crea HTML para el estado vacío
 * @returns {string} HTML
 */
function createEmptyStateHTML() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">🔍</div>
      <p class="empty-state__text">
        No video in this page.<br>
        Try playing the video first and SCAN again.
      </p>
    </div>
  `;
}

/**
 * Crea HTML para el estado de error
 * @returns {string} HTML
 */
function createErrorHTML() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">⚠️</div>
      <p class="empty-state__text">
        Error at SCANning the page.<br>
        Refresh the page and try again.
      </p>
    </div>
  `;
}

/* 3. Actions function (download, copy) */

/**
 * Add event listeners to the buttons of download and copy
 * @param {HTMLElement} container - Buttons of container
 */
function attachButtonListeners(container) {
  // Download buttons
  container.querySelectorAll('.btn--download').forEach(btn => {
    btn.addEventListener('click', () => {
      downloadVideo(btn.dataset.url, btn.dataset.filename);
    });
  });

  // Copy buttons
  container.querySelectorAll('.btn--copy').forEach(btn => {
    btn.addEventListener('click', () => copyUrl(btn));
  });
}

/**
 * Download a video
 * @param {string} url - URL of the video
 * @param {string} filename - Name of the archive
 */
async function downloadVideo(url, filename) {
  try {
    // Determine extension of the URL
    const extension = getExtensionFromUrl(url);
    const finalFilename = filename.includes('.') ? filename : `${filename}.${extension}`;

    // Start download
    await chrome.downloads.download({
      url: url,
      filename: finalFilename,
      saveAs: true
    });
  } catch (error) {
    console.error('Error al descargar:', error);
    // Fallback: open in a new tab
    chrome.tabs.create({ url: url });
  }
}

/**
 * Copy URL in clipboard
 * @param {HTMLElement} btn - Button clicked
 */
async function copyUrl(btn) {
  const url = btn.dataset.url;

  try {
    await navigator.clipboard.writeText(url);
    
    // Visual Feedback
    btn.classList.add('is-copied');
    btn.innerHTML = '✅ Copiado!';
    
    // Restore after 2 seconds
    setTimeout(() => {
      btn.classList.remove('is-copied');
      btn.innerHTML = '📋 Copiar';
    }, 2000);
  } catch (error) {
    console.error('Error al copiar:', error);
  }
}

/* 4. Utility functions */

/**
 * Get the icon according to the video type
 * @param {string} type - Video type
 * @returns {string} Icon emoji
 */
function getVideoIcon(type) {
  const icons = {
    'mp4': '🎥',
    'webm': '🎬',
    'm3u8': '📺',
    'hls': '📺',
    'blob': '💾',
    'stream': '📡'
  };
  return icons[type?.toLowerCase()] || '🎬';
}

/**
 * Truncate a URL to display
 * @param {string} url - Complete URL
 * @param {number} maxLength - Max length
 * @returns {string} - Truncated URL
 */
function truncateUrl(url, maxLength = 80) {
  if (url.length <= maxLength) return url;
  
  const start = url.substring(0, 40);
  const end = url.substring(url.length - 35);
  return `${start}...${end}`;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} String escaped
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Get the file extension from the URL
 * @param {string} url - URL of the video
 * @returns {string} Extension for the archive
 */
function getExtensionFromUrl(url) {
  if (url.includes('.webm')) return 'webm';
  if (url.includes('.m3u8')) return 'm3u8';
  if (url.includes('.mkv')) return 'mkv';
  if (url.includes('.avi')) return 'avi';
  if (url.includes('.mov')) return 'mov';
  return 'mp4';
}

/* 5. Detection function (injected into the page)*/

/**
 * Detect videos in the actual page
 * This function execute in the context of the web
 * @returns {Array} List of videos founded
 */
function detectVideosInPage() {
  const videos = [];
  const foundUrls = new Set();

  // --- Helper functions ---
  
  function addVideo(url, type) {
    if (foundUrls.has(url)) return;
    foundUrls.add(url);
    
    videos.push({
      url: url,
      type: type,
      filename: generateFilename(url),
      quality: detectQuality(url)
    });
  }

  function isVideoUrl(url) {
    const extensions = ['.mp4', '.webm', '.m3u8', '.mov', '.avi', '.mkv', '.flv'];
    const keywords = ['video', 'stream', 'media', 'playback'];
    
    const urlLower = url.toLowerCase();
    return extensions.some(ext => urlLower.includes(ext)) ||
           keywords.some(kw => urlLower.includes(kw));
  }

  function isValidVideoUrl(url) {
    try {
      new URL(url);
      
      // Basic validation
      if (!isVideoUrl(url) || url.includes('undefined') || url.length > 2000) {
        return false;
      }

      // ===== FILTERS TO AVOID JUNK =====
      
      // Ignore video segments/chunks
      if (url.includes('range=')) {
        return false;
      }

      // Ignore Vimeo thumbnails
      if (url.includes('i.vimeocdn.com')) {
        return false;
      }

      // Ignore small previews
      if (url.includes('mw=80') || url.includes('w=640')) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  function getTypeFromUrl(url) {
    if (url.includes('.m3u8')) return 'HLS';
    if (url.includes('.webm')) return 'WebM';
    if (url.includes('.mov')) return 'MOV';
    if (url.includes('.mkv')) return 'MKV';
    return 'MP4';
  }

  function generateFilename(url) {
    try {
      const urlObj = new URL(url);
      const parts = urlObj.pathname.split('/').filter(p => p);
      const lastPart = parts[parts.length - 1] || 'video';
      return lastPart.replace(/\.[^.]+$/, '') || 'video';
    } catch {
      return 'video';
    }
  }

  function detectQuality(url) {
    const patterns = {
      '4K': /4k|2160p|uhd/i,
      '1080p': /1080p|fullhd|fhd/i,
      '720p': /720p|hd/i,
      '480p': /480p|sd/i,
      '360p': /360p/i
    };

    for (const [quality, pattern] of Object.entries(patterns)) {
      if (pattern.test(url)) return quality;
    }
    return null;
  }

  // --- Videos detection ---

  // 1. Elements <video>
  document.querySelectorAll('video').forEach(video => {
    if (video.src && !video.src.startsWith('blob:')) {
      addVideo(video.src, 'MP4');
    }
    if (video.currentSrc && !video.currentSrc.startsWith('blob:')) {
      addVideo(video.currentSrc, 'MP4');
    }

    // Sources inside the video
    video.querySelectorAll('source').forEach(source => {
      if (source.src) {
        addVideo(source.src, getTypeFromUrl(source.src));
      }
    });
  });

  // 2. Standalone <source> elements
  document.querySelectorAll('source[src]').forEach(source => {
    if (source.src && isVideoUrl(source.src)) {
      addVideo(source.src, getTypeFromUrl(source.src));
    }
  });

  // 3. Iframes con videos embebidos (YouTube, Vimeo)
  document.querySelectorAll('iframe').forEach(iframe => {
    const src = iframe.src;
    if (!src) return;

    // YouTube
    if (src.includes('youtube.com/embed/') || src.includes('youtu.be')) {
      const match = src.match(/(?:embed\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (match) {
        videos.push({
          url: `https://www.youtube.com/watch?v=${match[1]}`,
          type: 'YouTube',
          filename: `youtube_${match[1]}`
        });
      }
    }
    // Vimeo
    else if (src.includes('vimeo.com')) {
      videos.push({
        url: src,
        type: 'Vimeo',
        filename: 'vimeo_video'
      });
    }
  });

  // 4. URLs of HTML videos
  const pageContent = document.documentElement.innerHTML;
  const patterns = [
    /https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]+\.webm[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi
  ];

  patterns.forEach(pattern => {
    const matches = pageContent.match(pattern) || [];
    matches.forEach(url => {
      const cleanUrl = url.replace(/['"\\]/g, '');
      if (isValidVideoUrl(cleanUrl)) {
        addVideo(cleanUrl, getTypeFromUrl(cleanUrl));
      }
    });
  });

  // 5. Data attributes-*
  document.querySelectorAll('[data-src], [data-video], [data-video-src]').forEach(el => {
    ['data-src', 'data-video', 'data-video-src'].forEach(attr => {
      const value = el.getAttribute(attr);
      if (value && isVideoUrl(value)) {
        addVideo(value, getTypeFromUrl(value));
      }
    });
  });

  return videos;
}