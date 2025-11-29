// Use the appropriate browser API
const browserAPI = (typeof browser !== 'undefined' && browser !== null) ? browser : (typeof chrome !== 'undefined' ? chrome : null);
if (!browserAPI) {
    console.error('No browser API found');
    throw new Error('Browser API not supported');
}

// Default blocked domains (fallback)
const defaultBlockedDomains = [
  'flashbang.sh',
  'dlproxy.uk',
  'gofile.io',
  'megadb.xyz',
  'pixeldrain.com',
  'spyderrock.com'
];

// Fetch blocked domains from API
async function fetchBlockedDomains() {
  try {
    const response = await fetch('https://api.ascendara.app/app/json/providers');
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    if (data && data.forwardingLinks) {
      // Extract hostnames from the forwardingLinks values
      return Object.values(data.forwardingLinks).map(url => {
        try {
          return new URL(url.replace(/\\\//g, '/')).hostname;
        } catch (e) {
          return null;
        }
      }).filter(Boolean);
    }
  } catch (e) {
    console.error('Failed to fetch blocked domains:', e);
  }
  return defaultBlockedDomains;
}

// Initialize the extension
browserAPI.runtime.onInstalled.addListener(async () => {
  const blockedDomains = await fetchBlockedDomains();
  browserAPI.storage.sync.set({
    isEnabled: true,
    blockedDomains
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
async function handleDownload(downloadItem, suggest) {
  let url = downloadItem.finalUrl || downloadItem.url;
  if (!url) {
    console.error("Failed to get download URL");
    if (suggest) suggest();
    return;
  }

  const domain = extractDomain(url);
  
  try {
    const data = await browserAPI.storage.sync.get(['isEnabled', 'blockedDomains']);
    const isEnabled = data.isEnabled ?? true;
    const blockedDomains = data.blockedDomains || defaultBlockedDomains;
    
    if (isEnabled && isDomainBlocked(domain, blockedDomains)) {
      try {
        if (suggest) {
          suggest({ 
            filename: 'cancelled.tmp', 
            conflictAction: 'uniquify' 
          });
        } else {
          // Firefox path
          await browserAPI.downloads.cancel(downloadItem.id);
        }
        
        // Clean up any existing download
        if (downloadItem.id) {
          await browserAPI.downloads.erase({ id: downloadItem.id });
        }
        
        // Handle the Ascendara protocol
        browserAPI.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          if (tabs[0]) {
            browserAPI.tabs.update(tabs[0].id, {
              url: 'ascendara://' + encodeURIComponent(url)
            });
          }
        });
      } catch (error) {
        console.error('Error handling download:', error);
        if (suggest) suggest();
      }
    } else if (suggest) {
      suggest();
    }
  } catch (error) {
    console.error('Error getting storage:', error);
    if (suggest) suggest();
  }
}

// Set up download listeners based on browser
if (typeof browser !== 'undefined') {
  // Firefox
  browserAPI.downloads.onCreated.addListener(async (downloadItem) => {
    await handleDownload(downloadItem);
  });
} else {
  // Chrome
  browserAPI.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
    handleDownload(downloadItem, suggest);
    return true; // Keep the suggest callback valid
  });
}