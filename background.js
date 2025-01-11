import { browserAPI } from './utils.js';

// Default blocked domains
const defaultBlockedDomains = [
  'megadb.xyz',
  'datanodes.to',
  'qiwi.gg',
  'buzzheavier.com'
];

// Initialize the extension
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    isEnabled: true,
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
async function handleDownload(downloadItem) {
  let url = downloadItem.finalUrl || downloadItem.url;
  if (!url) {
    console.error("Failed to get download URL");
    return;
  }

  const domain = extractDomain(url);
  
  try {
    const data = await chrome.storage.sync.get(['isEnabled', 'blockedDomains']);
    const isEnabled = data.isEnabled ?? true;
    const blockedDomains = data.blockedDomains || defaultBlockedDomains;
    
    if (isEnabled && isDomainBlocked(domain, blockedDomains)) {
      try {
        await chrome.downloads.cancel(downloadItem.id);
        await chrome.downloads.erase({ id: downloadItem.id });
        
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0) {
          await chrome.tabs.update(tabs[0].id, {
            url: 'Ascendara://' + url
          });
        }
      } catch (error) {
        console.error('Error handling download:', error);
      }
    }
  } catch (error) {
    console.error('Error getting storage:', error);
  }
}

// Set up download listeners
chrome.downloads.onCreated.addListener(handleDownload);

// Also listen for download state changes to catch any that slip through
chrome.downloads.onChanged.addListener((delta) => {
  chrome.downloads.search({id: delta.id}, (downloads) => {
    if (downloads && downloads.length > 0) {
      handleDownload(downloads[0]);
    }
  });
});