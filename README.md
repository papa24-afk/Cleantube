# CleanTube - Ad Blocker for YouTube™ (Manifest V3) v1.1.2

A fast, lightweight, and modern browser extension designed to block, skip, and accelerate ads on YouTube™ without breaking video playback or triggering ad-block detection walls.

---

## 🚀 Key Features

1. **⚡ Instant Auto-Skip**: Detects and clicks skip buttons within milliseconds as soon as they appear in the player.
2. **⏩ Silent Fast-Forwarding (16x Acceleration)**:
   - For unskippable ads (e.g. 15-second or 30-second pre-rolls), automatically mutes the audio and accelerates the video to 16x speed.
   - Jumps to the end of the ad segment instantly, allowing your normal video to resume seamlessly.
3. **🛡️ Anti-Adblock Popup Bypass**:
   - Detects and automatically dismisses YouTube's *"Ad blockers violate YouTube's Terms of Service"* modal dialogs.
   - Removes backdrop overlays and resumes video playback automatically.
4. **🚫 Clean UI & Banner Blocker**:
   - Strips masthead hero banners, promoted search results, video overlays, and in-feed sponsored recommendations.
   - Removes YouTube Shorts ad reels.
5. **📊 Live Dashboard & Stats**:
   - Real-time counter of total ads neutralized.
   - Estimated watch time saved (e.g. `14m`, `1h 20m`).
   - Clean, modern popup UI with per-feature toggles and badge notifications.

---

## 📂 Project Structure

```text
yt ads blocker/
├── manifest.json         # Manifest V3 extension configuration
├── rules.json            # DeclarativeNetRequest network blocking rules
├── background.js         # Service worker for stats, badges & rulesets
├── content.js            # Video player observer, ad accelerator & auto-skipper
├── content.css           # Element hiding stylesheet for banners & promos
├── popup/
│   ├── popup.html        # Sleek dark-mode extension popup
│   ├── popup.css         # Styling matching modern YouTube aesthetics
│   └── popup.js          # Settings synchronization & statistics controller
├── icons/
│   ├── icon16.png        # Toolbar favicon
│   ├── icon32.png        # Retina icon
│   ├── icon48.png        # Extensions management icon
│   ├── icon128.png       # Web Store & install display icon
│   └── icon.svg          # Vector master icon
└── README.md             # Documentation & setup instructions
```

---

## 🛠️ How to Install in Your Browser

This extension works on **Google Chrome**, **Microsoft Edge**, **Brave**, **Opera**, and any Chromium-based browser.

### Step 1: Open Extensions Management
- **Google Chrome**: Navigate to `chrome://extensions` in your address bar.
- **Microsoft Edge**: Navigate to `edge://extensions`.
- **Brave**: Navigate to `brave://extensions`.

### Step 2: Enable Developer Mode
- In the top-right corner of the Extensions page, toggle the **Developer mode** switch to **ON**.

### Step 3: Load Unpacked Extension
1. Click the **Load unpacked** button in the top-left toolbar.
2. In the folder picker window, select this directory:
   ```
   c:\Users\user\Downloads\yt ads blocker
   ```
3. Click **Select Folder**.

### Step 4: Pin and Enjoy
- Click the puzzle piece (Extensions) icon on your browser toolbar and pin **CleanTube**.
- Open [YouTube](https://www.youtube.com) and enjoy uninterrupted video watching!

---

## ⚙️ Customization & Settings

Open the extension popup by clicking the CleanTube icon in your browser toolbar to:
- **Toggle Protection**: Master toggle to pause or resume ad blocking.
- **Auto-Skip Video Ads**: Enable/disable instant skip-button clicking.
- **Fast-Forward (16x Speed)**: Accelerate unskippable ads silently.
- **Hide Banners & Promos**: Hide homepage banners, sidebars, and sponsor cards.
- **Bypass Adblock Popups**: Automatically clear anti-adblock notices.
- **Reset Statistics**: Clear your neutralized ads and time-saved counts.

---

## 💡 How It Works Behind the Scenes

Unlike traditional ad blockers that rely purely on URL filtering (which can trigger YouTube's playback blocks), **CleanTube** uses a multi-layer strategy:

1. **Network Filtering (`declarativeNetRequest`)**: Blocks known ad telemetry, tracker pings, and ad-break metadata calls.
2. **DOM Acceleration (`content.js`)**: Observes `#movie_player` with `MutationObserver`. When an ad is displayed (`.ad-showing`), it mutes the audio track, raises the playback rate to `16.0`, fast-forwards the player, and programmatically clicks the skip button.
3. **Restoration**: The moment the ad finishes, original volume and user playback speed are instantly restored.
