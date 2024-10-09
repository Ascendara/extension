// browser object for cross-browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

let isBlocking = false;

browserAPI.runtime.onInstalled.addListener(() => {
  browserAPI.storage.sync.set({isBlocking: false});
});

browserAPI.storage.sync.get('isBlocking', function(data) {
  isBlocking = data.isBlocking;
});

browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateBlockingStatus') {
    isBlocking = request.isBlocking;
  }
});

browserAPI.downloads.onCreated.addListener(function(downloadItem) {
  if (!isBlocking) return;

  browserAPI.downloads.cancel(downloadItem.id, function() {
    console.log("Download item:", downloadItem); // For debugging
    let url = downloadItem.finalUrl || downloadItem.url;
    if (!url) {
      console.error("Failed to get download URL");
      return;
    }
    
    browserAPI.tabs.create({
      url: 'confirmation.html',
      active: true
    }, function(tab) {
      // Wait for the tab to finish loading
      browserAPI.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          browserAPI.tabs.onUpdated.removeListener(listener);
          // Send download information to the confirmation page
          browserAPI.tabs.sendMessage(tab.id, {
            action: 'showConfirmation',
            downloadUrl: url,
            filename: downloadItem.filename
          });
        }
      });
    });
  });
});