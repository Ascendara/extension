const browserAPI = (typeof browser !== 'undefined' && browser !== null) ? browser : chrome;

// Close the steamrip tab that triggered this popup
async function closeSteamripTab() {
  const tabs = await browserAPI.tabs.query({ url: '*://*.steamrip.com/*' });
  for (const tab of tabs) {
    browserAPI.tabs.remove(tab.id);
  }
}

// Send cookie to Ascendara
document.getElementById('sendBtn').addEventListener('click', async () => {
  const data = await browserAPI.storage.local.get('steamripCfClearance');
  const cookieValue = data.steamripCfClearance;
  
  if (cookieValue) {
    const protocolUrl = 'ascendara://steamrip-cookie/' + encodeURIComponent(cookieValue);
    
    // Use the same method as download handler - create a new tab with the protocol
    browserAPI.tabs.create({ url: protocolUrl }, async () => {
      // Show success message
      document.getElementById('statusMessage').classList.add('show');
      
      // Close steamrip tab
      await closeSteamripTab();
      
      // Close popup after a delay
      setTimeout(async () => {
        const currentWindow = await browserAPI.windows.getCurrent();
        browserAPI.windows.remove(currentWindow.id);
      }, 1500);
    });
  }
});

// Cancel button - close the popup window and steamrip tab
document.getElementById('cancelBtn').addEventListener('click', async () => {
  await closeSteamripTab();
  const currentWindow = await browserAPI.windows.getCurrent();
  browserAPI.windows.remove(currentWindow.id);
});
