# 🎬 Video Downloader Extension

Chrome extension to detect and download videos from web pages.

## ✨ Features

- 🔍 Detects videos on any webpage (MP4, WebM, HLS, Vimeo, YouTube)
- 📡 Intercepts network requests to find dynamically loaded videos
- 📋 Copy video URLs to clipboard
- ⬇️ Direct download for unprotected videos
- 🔒 Identifies protected platforms (Vimeo, YouTube)

## 📦 Installation

1. Download this repository (green "Code" button → "Download ZIP")
2. Unzip the file
3. Open Chrome and go to `chrome://extensions`
4. Enable **"Developer mode"** (top right corner)
5. Click **"Load unpacked"** and select the extension folder

## 🚀 Usage

1. Go to a webpage with a video
2. Play the video (this helps detection)
3. Click the extension icon 🎬
4. Click **"SCAN"**
5. Download or copy the URL

## 💡 Tip

For protected Vimeo videos, the extension detects the URL but can't download directly. Copy the URL and use tools like [yt-dlp](https://github.com/yt-dlp/yt-dlp) or [cobalt.tools](https://cobalt.tools).

## 📁 Project Structure
```
video-downloader-ext/
├── manifest.json      # Extension configuration
├── popup.html         # UI structure
├── popup.js           # UI logic & video detection
├── styles.css         # Styles
├── background.js      # Network request interception
├── content.js         # DOM observation & detection
└── icons/             # Extension icons
```

## 🔒 Privacy

This extension does **NOT**:
- Store any data permanently
- Send data to external servers
- Track your browsing

All detected videos are kept in memory only and cleared when you close the tab.

## ⚠️ Disclaimer

This extension is for personal use only. Respect copyright laws and terms of service of websites.

## 📝 License

MIT License

---

Made with ❤️ by palmarea