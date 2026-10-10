<div align="center">
    <img align="center" width="128" height="128" src="/readme/ascendara.png" alt="Ascendara Logo">
    <h1>Download Handler Extension</h1>
    <p>
        <img src="https://img.shields.io/github/last-commit/ascendara/extension" alt="Last Commit">
        <img src="https://img.shields.io/github/issues-raw/ascendara/extension" alt="Issues">
        <a href="https://ascendara.app/"><img src="https://img.shields.io/badge/website-ascendara.app-blue" alt="Website"></a>
         <a href="./LICENSE"><img src="https://img.shields.io/badge/license-CC%20BY--NC%201.0-green" alt="License"></a>
    </p>
</div>

## 🔗 About

A lightweight browser extension that enhances your Ascendara experience. When enabled, it automatically detects downloads from supported providers and sends them straight to Ascendara - making downloads up to 50% faster! No manual intervention needed.

## 🖼️ Preview

### Download Latest Version (Chrome & Firefox Supported)
🚀 [Get it for your browser](https://ascendara.app/extension)

<details>
<summary>📸 Screenshots</summary>

### Extension Disabled
![Extension Disabled](/readme/disabled.png)

### Extension Enabled
![Extension Enabled](/readme/enabled.png)

</details>

## 🛠️ Manual Installation

### Prerequisites
- A Chromium-based browser (Chrome, Arc, Edge, etc.)
- Developer mode enabled in extensions

### Browser manifests

- **Chrome / Edge / Chromium:** load this repository folder directly. The default `manifest.json` is Manifest V3 and matches `manifest.chrome.json`. Do not replace it with the Firefox manifest.
- **Firefox:** make a separate copy of the extension folder and copy `manifest.firefox.json` over `manifest.json` in that copy. Load that copy through `about:debugging`. Keep the Chrome folder unchanged.
- If Chrome displays version **4.2** or `manifest_version: 2`, it is loading an older copy or the Firefox manifest. Remove that entry and use **Load unpacked** to select this updated folder. The current extension version is **5.0**.

### Quick Start

1. **Download the Extension**
   ```sh
   git clone https://github.com/ascendara/extension.git
   # Or download ZIP from the green 'Code' button
   ```

2. **Install in Browser**
   - Open your browser's extension management page
   - Enable "Developer mode"
   - Click "Load Unpacked"
   - Select the downloaded extension folder

## 🎯 How to Use

1. Install and enable the extension
2. When a download starts, you'll get a prompt to open Ascendara
3. Check "Always open in Ascendara" for future convenience
4. Click "Open in Ascendara" to start your download

> 💡 **Pro tip**: Use [Arc Browser](https://arc.net/download) for the best experience with built-in ad and popup blocking.

## 📲 Support & Feedback

Found a bug or have a suggestion? The community is here to help!
- [Open an issue](https://github.com/ascendara/extension/issues)
- [Join our Discord](https://ascendara.app/discord)

## 📝 License & Contact  

This project is part of the Ascendara ecosystem

Licensed under [MIT](./LICENSE) - 2026 tagoWorks

### Get in Touch
- Email: [santiago@tago.works](mailto:santiago@tago.works)
- Website: [tago.works](https://tago.works)
- Discord: [Join our community](https://ascendara.app/discord)


---
<div align="center">
    <sub>Built with 💖 by <a href="https://tago.works">tago</a></sub>
</div>


## Downloads from any website (v5)

Open a game in Ascendara, then start the file download in your browser. The extension guesses the game name from the page URL (for example, `/game/rest-area-simulator`) or its matching tab title and sends that suggestion to Ascendara. Ascendara autofills the name and lets you edit it before continuing. For a game outside the index, send the download from any page and enter its name. Requires an Ascendara build with the v5 download handoff.

When enabled, the extension forwards every HTTP(S) file download to Ascendara, regardless of website or provider. The setting stays on until you turn it off. Turn it off to keep downloads in your browser.

The browser download is canceled immediately and its canceled entry is cleared before requesting that the OS open Ascendara. This does not confirm that the app accepted the download: approve the browser's external-app prompt and review it in Ascendara. The popup retains the last link for retry, and canceled downloads remain in browser history. Only the latest capture is retained locally; it can contain a temporary signed URL. Browser cookies are not included in download handoffs. Session-bound links, blob URLs, and providers without transferable direct links cannot be downloaded this way. Existing SteamRIP cookie setup remains separate.
