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

A browser extension that stops downloads and asks where they should go: your browser or Ascendara. Keep it enabled for games and everyday files.

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
- If Chrome displays version **4.2** or `manifest_version: 2`, it is loading an older copy or the Firefox manifest. Remove that entry and use **Load unpacked** to select this updated folder. The current extension version is **5.2**.

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
2. Start a download to open its choice page.
3. Choose **Download in browser**, **Open Ascendara**, or **Cancel download**.
4. For Ascendara, review the game name and approve the external-app prompt. Dismiss the choice once it appears in the app.

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


## Download choices (v5.2)

Web downloads are canceled before their choice page opens. Download in browser starts an explicitly allowed browser download; it is not intercepted again. Cancel download dismisses the saved choice without starting a transfer. Only Open Ascendara sends the link and editable game name to the app.

Choices remain available after the original canceled entry changes state or is removed from browser history. Closing the page or requesting Ascendara keeps the choice available through the extension popup. Dismiss it after confirming the file in Ascendara. Turning the handler off affects new downloads only.

Browser-local files (such as blob URLs) are paused instead because they cannot reliably be recreated. Browser downloads begun through the choice page use the original URL, but POST requests and single-use or expired links may require starting again on the source site with the handler disabled. No browser cookies are sent to Ascendara.

Download events arrive after transfers start, so very small files may complete before cancellation. The extension verifies the transfer stopped before opening its choice page. If the choice page fails to open, its saved record stays accessible from the popup; the download is not automatically restarted.

Pending records, including potentially signed URLs, are stored locally until the user resolves the choice. The latest explicit Ascendara request is also retained locally. SteamRIP cookie setup remains separate. Requires an Ascendara build supporting the v5 download payload.
