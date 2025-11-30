// Use the appropriate browser API
const browserAPI = (typeof browser !== 'undefined' && browser !== null) ? browser : (typeof chrome !== 'undefined' ? chrome : null);
if (!browserAPI) {
    console.error('No browser API found');
    throw new Error('Browser API not supported');
}
// SteamRip API URL for cookie fetching
const STEAMRIP_API_URL = 'https://steamrip.com/wp-json/wp/v2/posts?per_page=1&page=1';

// Function to get cf_clearance cookie from steamrip.com
async function getSteamripCfClearance() {
  try {
    // Try getting all cookies for the domain first
    const allCookies = await browserAPI.cookies.getAll({
      domain: 'steamrip.com'
    });
    console.log('All cookies for steamrip.com:', allCookies);
    
    // Also try with .steamrip.com (subdomain wildcard)
    const dotDomainCookies = await browserAPI.cookies.getAll({
      domain: '.steamrip.com'
    });
    console.log('All cookies for .steamrip.com:', dotDomainCookies);
    
    // Combine and find cf_clearance
    const allFound = [...allCookies, ...dotDomainCookies];
    const cfCookie = allFound.find(c => c.name === 'cf_clearance');
    
    if (cfCookie) {
      console.log('cf_clearance cookie found:', cfCookie.value);
      return cfCookie.value;
    }
    
    // Try with specific URL as fallback
    const cookie = await browserAPI.cookies.get({
      url: 'https://steamrip.com/wp-json/wp/v2/posts',
      name: 'cf_clearance'
    });
    
    if (cookie) {
      console.log('cf_clearance cookie found via URL:', cookie.value);
      return cookie.value;
    }
    
    console.log('cf_clearance cookie not found in any method');
    return null;
  } catch (error) {
    console.error('Error fetching cf_clearance cookie:', error);
    return null;
  }
}

// Function to get all cookies from steamrip.com
async function getAllSteamripCookies() {
  try {
    const cookies = await browserAPI.cookies.getAll({
      domain: 'steamrip.com'
    });
    
    console.log('All steamrip.com cookies:', cookies);
    return cookies;
  } catch (error) {
    console.error('Error fetching steamrip.com cookies:', error);
    return [];
  }
}

// Function to open the cookie popup window
function openCookiePopup() {
  browserAPI.windows.create({
    url: browserAPI.runtime.getURL('cookie-popup.html'),
    type: 'popup',
    width: 360,
    height: 340,
    focused: true
  });
}

// Function to check if user is on the SteamRip API page and fetch cookie
async function checkAndFetchSteamripCookie(tabId, url) {
  if (url && url.startsWith('https://steamrip.com/wp-json/wp/v2/posts')) {
    console.log('User is on SteamRip API page, fetching cf_clearance cookie...');
    const cfClearance = await getSteamripCfClearance();
    
    if (cfClearance) {
      // Store the cookie for later use
      await browserAPI.storage.local.set({ steamripCfClearance: cfClearance });
      console.log('cf_clearance cookie stored successfully');
      
      // Open the popup to prompt user to send to Ascendara
      openCookiePopup();
      
      return cfClearance;
    }
  }
  return null;
}

// Listen for tab updates to detect when user navigates to SteamRip API
console.log('=== Ascendara Extension Loaded ===');

// Track if we've already shown the popup (resets after 30 seconds to allow retrying)
let cookiePopupShown = false;
let pendingCfClearance = null;

// Reset the popup flag after 30 seconds so user can retry if needed
function resetPopupFlag() {
  setTimeout(() => {
    cookiePopupShown = false;
    console.log('Popup flag reset, can show again');
  }, 30000);
}

// Use webRequest to intercept the actual Cookie header from requests
browserAPI.webRequest.onSendHeaders.addListener(
  (details) => {
    // Only process if we haven't shown popup yet and it's the API endpoint
    if (cookiePopupShown) return;
    if (!details.url.includes('steamrip.com/wp-json/wp/v2/posts')) return;
    
    console.log('>>> Intercepted request to steamrip.com API');
    const cookieHeader = details.requestHeaders?.find(h => h.name.toLowerCase() === 'cookie');
    if (cookieHeader) {
      console.log('Cookie header found:', cookieHeader.value);
      
      // Extract cf_clearance=value from the cookie string
      const match = cookieHeader.value.match(/cf_clearance=[^;]+/);
      if (match) {
        // Store cf_clearance=value format
        pendingCfClearance = match[0];
        console.log('cf_clearance pending verification:', pendingCfClearance);
      }
    } else {
      console.log('No cookie header in request');
    }
  },
  { urls: ['*://*.steamrip.com/*'] },
  ['requestHeaders', 'extraHeaders']
);

// Listen for completed responses to verify the request succeeded (not a Cloudflare challenge)
browserAPI.webRequest.onCompleted.addListener(
  (details) => {
    if (cookiePopupShown) return;
    if (!details.url.includes('steamrip.com/wp-json/wp/v2/posts')) return;
    if (!pendingCfClearance) return;
    
    console.log('>>> Response completed for steamrip.com API, status:', details.statusCode);
    
    // Only proceed if we got a successful response (200 = JSON loaded, not Cloudflare challenge)
    if (details.statusCode === 200) {
      console.log('Valid JSON response received, cookie is valid!');
      
      // Mark as shown to prevent duplicates
      cookiePopupShown = true;
      
      // Store it and open popup
      browserAPI.storage.local.set({ steamripCfClearance: pendingCfClearance }).then(() => {
        console.log('Cookie stored, opening popup...');
        openCookiePopup();
        // Reset flag after 30 seconds so user can retry
        resetPopupFlag();
      });
    } else {
      console.log('Response was not 200, likely Cloudflare challenge. Status:', details.statusCode);
      pendingCfClearance = null;
    }
  },
  { urls: ['*://*.steamrip.com/*'] }
);

browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log('Tab updated:', tabId, 'status:', changeInfo.status, 'url:', tab.url);
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('Checking URL:', tab.url);
    if (tab.url.startsWith('https://steamrip.com')) {
      console.log('>>> SteamRip domain detected!');
    }
  }
});

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