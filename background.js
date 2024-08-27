let isBlocking = false;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({isBlocking: false});
});

chrome.storage.sync.get('isBlocking', function(data) {
  isBlocking = data.isBlocking;
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateBlockingStatus') {
    isBlocking = request.isBlocking;
  }
});

chrome.downloads.onCreated.addListener(function(downloadItem) {
  if (!isBlocking) return;

  chrome.downloads.cancel(downloadItem.id, function() {
    console.log("Download item:", downloadItem); // For debugging
    let url = downloadItem.finalUrl || downloadItem.url;
    if (!url) {
      console.error("Failed to get download URL");
      return;
    }
    
    chrome.tabs.create({
      url: 'confirmation.html',
      active: true
    }, function(tab) {
      // Wait for the tab to finish loading
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          // Send download information to the confirmation page
          chrome.tabs.sendMessage(tab.id, {
            action: 'showConfirmation',
            downloadUrl: url,
            filename: downloadItem.filename
          });
        }
      });
    });
  });
});