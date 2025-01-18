// Use the appropriate browser API
let browserAPI;
if (typeof browser !== 'undefined' && browser.runtime) {
  browserAPI = browser;
} else if (typeof chrome !== 'undefined' && chrome.runtime) {
  browserAPI = chrome;
} else {
  console.error('No compatible browser API found');
  browserAPI = chrome; // Fallback to chrome
}

// Default blocked domains
const defaultBlockedDomains = [
  'megadb.xyz',
  'datanodes.to',
  'qiwi.gg',
  'buzzheavier.com'
];

// Initialize the extension
browserAPI.runtime.onInstalled.addListener(() => {
  browserAPI.storage.sync.set({
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
        // Cancel the download by suggesting an empty filename
        if (suggest) {
          // Firefox requires a non-empty filename, so we'll use a temporary one
          const isFirefox = browserAPI === browser;
          suggest({ 
            filename: isFirefox ? 'cancelled.tmp' : '', 
            conflictAction: 'uniquify' 
          });
        } else {
          await browserAPI.downloads.cancel(downloadItem.id);
        }
        
        // Clean up any existing download
        if (downloadItem.id) {
          await browserAPI.downloads.erase({ id: downloadItem.id });
        }
        
        // Redirect to Ascendara
        const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0) {
          // Ensure URL is properly encoded and handle both HTTP and HTTPS
          const encodedUrl = encodeURIComponent(url);
          await browserAPI.tabs.update(tabs[0].id, {
            url: `ascendara://${encodedUrl}`
          });
        }
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

// Set up download listeners
browserAPI.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  handleDownload(downloadItem, suggest);
  return true; // Keep the suggest callback valid
});

// Also listen for download state changes to catch any that slip through
browserAPI.downloads.onCreated.addListener(handleDownload);