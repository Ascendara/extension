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
    // Try with specific URL first (most reliable for Firefox)
    const cookie = await browserAPI.cookies.get({
      url: 'https://steamrip.com/',
      name: 'cf_clearance'
    });
    
    if (cookie) {
      console.log('cf_clearance cookie found via URL method:', cookie.value);
      return cookie.value;
    }
    
    // Try getting all cookies for the domain
    const allCookies = await browserAPI.cookies.getAll({
      domain: 'steamrip.com'
    });
    console.log('All cookies for steamrip.com:', allCookies);
    
    // Also try with .steamrip.com (subdomain wildcard)
    const dotDomainCookies = await browserAPI.cookies.getAll({
      domain: '.steamrip.com'
    });
    console.log('All cookies for .steamrip.com:', dotDomainCookies);
    
    // Also try without domain filter and filter manually
    const allSiteCookies = await browserAPI.cookies.getAll({
      url: 'https://steamrip.com/'
    });
    console.log('All cookies via URL filter:', allSiteCookies);
    
    // Combine all and find cf_clearance
    const allFound = [...allCookies, ...dotDomainCookies, ...allSiteCookies];
    const cfCookies = allFound.filter(c => c.name === 'cf_clearance');
    console.log('All cf_clearance cookies found:', cfCookies);
    
    if (cfCookies.length > 0) {
      // If multiple, prefer the one with longest value or most recent
      const best = cfCookies.reduce((a, b) => 
        (b.value.length > a.value.length) ? b : a
      );
      console.log('Using cf_clearance cookie:', best.value);
      return best.value;
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
// Firefox doesn't support 'extraHeaders' option, so we conditionally include it
const isFirefox = typeof browser !== 'undefined' && browser !== null && typeof browser.runtime.getBrowserInfo === 'function';
const sendHeadersOptions = isFirefox ? ['requestHeaders'] : ['requestHeaders', 'extraHeaders'];

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
  { urls: ['*://*.steamrip.com/*', '*://steamrip.com/*'] },
  sendHeadersOptions
);

// Listen for completed responses to verify the request succeeded (not a Cloudflare challenge)
browserAPI.webRequest.onCompleted.addListener(
  async (details) => {
    if (cookiePopupShown) return;
    if (!details.url.includes('steamrip.com/wp-json/wp/v2/posts')) return;
    
    console.log('>>> Response completed for steamrip.com API, status:', details.statusCode);
    
    // Only proceed if we got a successful response (200 = JSON loaded, not Cloudflare challenge)
    if (details.statusCode === 200) {
      console.log('Valid JSON response received, cookie is valid!');

      // Chrome MV3 does not expose the Cookie header via webRequest, so fall back to cookies API
      if (!pendingCfClearance) {
        console.log('No cookie from request header (Chrome MV3 restriction), trying cookies API...');
        const freshCookie = await getSteamripCfClearance();
        if (freshCookie) {
          pendingCfClearance = 'cf_clearance=' + freshCookie;
          console.log('Got cookie from cookies API:', pendingCfClearance.substring(0, 80));
        } else {
          console.log('Could not get cf_clearance from any source, opening popup for manual entry');
          cookiePopupShown = true;
          await browserAPI.storage.local.set({ steamripNeedsManual: true, steamripCfClearance: null });
          openCookiePopup();
          resetPopupFlag();
          return;
        }
      }
      
      // Mark as shown to prevent duplicates
      cookiePopupShown = true;
      
      // On Firefox, re-fetch the cookie directly from the cookies API to ensure we have the correct value
      // The webRequest header might have a stale or different cookie
      let finalCookie = pendingCfClearance;
      if (isFirefox) {
        try {
          console.log('Firefox: Intercepted cookie from request header:', pendingCfClearance);
          const freshCookie = await getSteamripCfClearance();
          console.log('Firefox: Fresh cookie from cookies API:', freshCookie);
          if (freshCookie) {
            finalCookie = 'cf_clearance=' + freshCookie;
            console.log('Firefox: Using fresh cookie:', finalCookie);
            // Compare to see if they differ
            if (pendingCfClearance !== finalCookie) {
              console.log('Firefox: Cookie values DIFFER - intercepted vs API');
              console.log('  Intercepted:', pendingCfClearance.substring(0, 80));
              console.log('  API cookie:', finalCookie.substring(0, 80));
            }
          } else {
            console.log('Firefox: Could not get fresh cookie, using intercepted value');
          }
        } catch (e) {
          console.error('Firefox: Error fetching fresh cookie:', e);
        }
      }
      
      console.log('Final cookie to store (first 100 chars):', finalCookie.substring(0, 100));
      
      // Capture the User-Agent for Cloudflare validation
      // The cookie is tied to the User-Agent that was used when it was issued
      const userAgent = navigator.userAgent;
      console.log('Captured User-Agent:', userAgent);
      
      // Store both cookie and user-agent
      browserAPI.storage.local.set({ 
        steamripCfClearance: finalCookie,
        steamripUserAgent: userAgent
      }).then(() => {
        console.log('Cookie stored:', finalCookie);
        console.log('User-Agent stored:', userAgent);
        console.log('Opening popup...');
        openCookiePopup();
        // Reset flag after 30 seconds so user can retry
        resetPopupFlag();
      });
    } else {
      console.log('Response was not 200, likely Cloudflare challenge. Status:', details.statusCode);
      pendingCfClearance = null;
    }
  },
  { urls: ['*://*.steamrip.com/*', '*://steamrip.com/*'] }
);

// Capture cf_clearance from Set-Cookie response headers (handles Cloudflare cookie refresh)
const headersReceivedOptions = isFirefox ? ['responseHeaders'] : ['responseHeaders', 'extraHeaders'];

browserAPI.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!details.responseHeaders) return;
    for (const header of details.responseHeaders) {
      if (header.name.toLowerCase() === 'set-cookie' && header.value && header.value.startsWith('cf_clearance=')) {
        const match = header.value.match(/cf_clearance=([^;]+)/);
        if (match) {
          const captured = 'cf_clearance=' + match[1];
          console.log('Captured cf_clearance from Set-Cookie response header');
          browserAPI.storage.local.set({ steamripCfClearance: captured, steamripNeedsManual: false });
        }
        break;
      }
    }
  },
  { urls: ['*://*.steamrip.com/*', '*://steamrip.com/*'] },
  headersReceivedOptions
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

// The main toggle controls downloads from every HTTP(S) site.
browserAPI.runtime.onInstalled.addListener(async () => {
  const data = await browserAPI.storage.sync.get(['isEnabled']);
  if (data.isEnabled === undefined) {
    await browserAPI.storage.sync.set({ isEnabled: true });
  }
  // Remove preferences from older versions; they no longer restrict capture.
  await browserAPI.storage.sync.remove(['captureMode', 'blockedDomains']);
  await browserAPI.storage.local.remove('captureNextUntil');
});

function gameNameFromPage(pageUrl) {
  try {
    const page = new URL(pageUrl);
    if (!['http:', 'https:'].includes(page.protocol)) return '';
    const match = page.pathname.match(/^\/game\/([^/]+)/i);
    if (!match) return '';
    return decodeURIComponent(match[1])
      .replace(/\.[a-z0-9]{1,5}$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200)
      .replace(/\b[a-z]/g, letter => letter.toUpperCase());
  } catch { return ''; }
}

async function findGamePage(item) {
  let tabs = [];
  try { tabs = await browserAPI.tabs.query({}); }
  catch (error) { console.warn('Could not read browser tabs:', error); }
  const detailsForTab = tab => {
    const pageUrl = /^https?:\/\//i.test(tab?.url || '') ? tab.url : '';
    const fromUrl = gameNameFromPage(pageUrl);
    if (fromUrl) return { title: fromUrl, pageUrl };
    let tabTitle = typeof tab?.title === 'string'
      ? tab.title.split(/\s+(?:[|\u2013\u2014]|-)\s+/)[0].trim()
      : '';
    const providerName = pageUrl
      ? new URL(pageUrl).hostname.split('.').slice(-2, -1)[0]
      : '';
    if (providerName) tabTitle = tabTitle.replace(new RegExp(providerName, 'ig'), ' ');
    tabTitle = tabTitle.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (tabTitle && !/^(download|downloads)$/i.test(tabTitle)) {
      return { title: tabTitle.slice(0, 200), pageUrl };
    }
    return null;
  };
  // DownloadItem.tabId points to the tab that initiated this download, even
  // when the file URL is on a CDN and the browser's active tab has changed.
  const sourceTab = Number.isInteger(item.tabId) && item.tabId >= 0
    ? tabs.find(tab => tab.id === item.tabId)
    : null;
  const sourceDetails = sourceTab && detailsForTab(sourceTab);
  if (sourceDetails) return sourceDetails;

  const referrer = item.referrer || '';
  const referrerTab = tabs.find(tab => tab.url === referrer);
  const referrerGuess = gameNameFromPage(referrer);
  if (referrerGuess) return { title: referrerGuess, pageUrl: referrer };
  const referrerDetails = referrerTab && detailsForTab(referrerTab);
  if (referrerDetails) return referrerDetails;

  // A CDN can replace the referrer. Use only an active game page, not any
  // unrelated tab that happens to be open in the browser.
  const activeGame = tabs.find(tab => tab.active && gameNameFromPage(tab.url));
  if (activeGame) {
    return { title: gameNameFromPage(activeGame.url), pageUrl: activeGame.url };
  }
  return { title: '', pageUrl: '' };
}
let captureEnabled = true;
void browserAPI.storage.sync.get(['isEnabled']).then(prefs => {
  captureEnabled = prefs.isEnabled ?? true;
}).catch(error => console.warn('Could not read download setting:', error));
browserAPI.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.isEnabled) {
    captureEnabled = changes.isEnabled.newValue ?? true;
  }
});

function isCapturableDownload(item) {
  const url = item.finalUrl || item.url || '';
  return /^https?:\/\//i.test(url) && item.byExtensionId !== browserAPI.runtime.id;
}

async function handleDownload(item) {
  const url = item.finalUrl || item.url;
  if (!isCapturableDownload(item)) return;
  // Cancel immediately in onCreated, before any asynchronous storage or tab work.
  try {
    await browserAPI.downloads.cancel(item.id);
  } catch (error) {
    console.error('Could not stop browser download:', error);
    await browserAPI.storage.local.set({ lastCapture: {
      version: 1, url, filename: (item.filename || '').split(/[\\/]/).pop(), title: '',
      status: 'Browser download was not stopped. Use the retry button if needed.', time: Date.now()
    } });
    return;
  }
  // A completed file cannot be handed off as a canceled browser transfer.
  const current = await browserAPI.downloads.search({ id: item.id }).catch(() => []);
  if (current[0]?.state === 'complete') {
    await browserAPI.storage.local.set({ lastCapture: {
      version: 1, url, filename: (item.filename || '').split(/[\\/]/).pop(), title: '',
      status: 'Browser download completed before it could be stopped.', time: Date.now()
    } });
    return;
  }
  // Remove the canceled entry from browser history; cancel removes its partial file.
  await browserAPI.downloads.erase({ id: item.id }).catch(error =>
    console.warn('Could not clear canceled browser download:', error)
  );
  const { title, pageUrl } = await findGamePage(item);
  const payload = {
    version: 1, url, filename: (item.filename || '').split(/[\\/]/).pop(),
    title, pageUrl
  };
  const protocolUrl = 'ascendara://download?payload=' + encodeURIComponent(JSON.stringify(payload));
  // Keep a recoverable record even if the OS prompt is dismissed.
  await browserAPI.storage.local.set({ lastCapture: { ...payload, status: 'Opening Ascendara', time: Date.now() } });
  try {
    await browserAPI.tabs.create({ url: protocolUrl });
    await browserAPI.storage.local.set({ lastCapture: { ...payload, status: 'Sent to Ascendara. Review the game name in the app.', time: Date.now() } });
  } catch (error) {
    await browserAPI.storage.local.set({ lastCapture: { ...payload, status: 'Could not open Ascendara. Browser download was stopped; use Send last download again.', time: Date.now() } });
    console.error('Download handoff failed:', error);
  }
}

browserAPI.downloads.onCreated.addListener(item => {
  if (!captureEnabled) return;
  void handleDownload(item).catch(error => console.error('Download capture failed:', error));
});