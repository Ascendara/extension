import { browserAPI } from './utils.js';

// Track handled downloads to prevent duplicate handling
const handledDownloads = new Set();

// Default blocked domains
const defaultBlockedDomains = [
  'megadb.xyz',
  'datanodes.to',
  'qiwi.gg',
  'buzzheavier.com'
];

browserAPI.runtime.onInstalled.addListener(() => {
  browserAPI.storage.sync.set({
    isEnabled: false,
    blockedDomains: defaultBlockedDomains
  });
});

// Function to extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase().replace(/^www\./, '');
  } catch (e) {
    console.error('Invalid URL:', url);
    return '';
  }
}

// Function to check if a domain matches any blocked domain
function isDomainBlocked(domain, blockedDomains) {
  return blockedDomains.some(blockedDomain => 
    domain === blockedDomain || domain.endsWith('.' + blockedDomain)
  );
}

// Function to handle sending download to Ascendara
function handleDownload(downloadItem) {
  if (handledDownloads.has(downloadItem.id)) return;

  let url = downloadItem.finalUrl || downloadItem.url;
  if (!url) {
    console.error("Failed to get download URL");
    return;
  }

  const domain = extractDomain(url);
  
  browserAPI.storage.sync.get(['isEnabled', 'blockedDomains'], function(data) {
    const isEnabled = data.isEnabled || false;
    const blockedDomains = data.blockedDomains || defaultBlockedDomains;
    
    if (isEnabled && isDomainBlocked(domain, blockedDomains)) {
      // Mark this download as handled
      handledDownloads.add(downloadItem.id);

      // Cancel the browser download since we're sending it to Ascendara
      browserAPI.downloads.cancel(downloadItem.id, function() {
        browserAPI.downloads.erase({ id: downloadItem.id }, function() {
          // Get the current tab that initiated the download
          browserAPI.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs && tabs.length > 0) {
              // Update the current tab with the Ascendara protocol
              browserAPI.tabs.update(tabs[0].id, {
                url: 'Ascendara://' + url
              });
            }
          });
        });
      });
    }
  });
}

// Listen for download creation
browserAPI.downloads.onCreated.addListener(handleDownload);

// Also listen for download state changes to catch any that slip through
browserAPI.downloads.onChanged.addListener(function(delta) {
  if (handledDownloads.has(delta.id)) return;
  
  browserAPI.downloads.search({id: delta.id}, function(downloads) {
    if (downloads && downloads.length > 0) {
      handleDownload(downloads[0]);
    }
  });
});

// Clear handled downloads periodically (every hour)
setInterval(() => {
  handledDownloads.clear();
}, 3600000);