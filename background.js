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

function rememberGameTab(tab) {
  const page = gameDetailsForTab(tab);
  if (page && Number.isInteger(tab.id)) {
    const details = { ...page, time: Date.now() };
    return browserAPI.storage.local.set({
      [`gamePage:${tab.id}`]: details,
      ...(tab.active ? { recentGamePage: details } : {})
    });
  }
}
browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.title) void rememberGameTab({ ...tab, id: tabId });
});
browserAPI.tabs.onActivated.addListener(async ({ tabId }) => {
  try { await rememberGameTab(await browserAPI.tabs.get(tabId)); }
  catch (error) { console.warn('Could not read active browser tab:', error); }
});
browserAPI.tabs.onRemoved.addListener(tabId => {
  void browserAPI.storage.local.remove(`gamePage:${tabId}`);
});
void browserAPI.tabs.query({}).then(tabs => tabs.forEach(rememberGameTab))
  .catch(error => console.warn('Could not read browser tabs:', error));

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

function gameDetailsForTab(tab) {
  const pageUrl = tab?.url || '';
  const fromUrl = gameNameFromPage(pageUrl);
  if (!fromUrl) return null;
  const tabTitle = typeof tab.title === 'string'
    ? tab.title.split(/\s+(?:[|\u2013\u2014]|-)\s+/)[0].trim()
    : '';
  return { title: tabTitle && !/^(download|downloads)$/i.test(tabTitle) ? tabTitle.slice(0, 200) : fromUrl, pageUrl };
}

async function findGamePage(item) {
  let tabs = [];
  try { tabs = await browserAPI.tabs.query({}); }
  catch (error) { console.warn('Could not read browser tabs:', error); }
  // DownloadItem.tabId points to the tab that initiated this download, even
  // when the file URL is on a CDN and the browser's active tab has changed.
  const sourceTab = Number.isInteger(item.tabId) && item.tabId >= 0
    ? tabs.find(tab => tab.id === item.tabId)
    : null;
  const sourceDetails = gameDetailsForTab(sourceTab);
  if (sourceDetails) return sourceDetails;

  const referrer = item.referrer || '';
  const referrerTab = tabs.find(tab => tab.url === referrer);
  const referrerDetails = gameDetailsForTab(referrerTab);
  if (referrerDetails) return referrerDetails;
  const referrerGuess = gameNameFromPage(referrer);
  if (referrerGuess) return { title: referrerGuess, pageUrl: referrer };

  for (const tabId of [item.tabId, sourceTab?.openerTabId]) {
    if (!Number.isInteger(tabId) || tabId < 0) continue;
    const key = `gamePage:${tabId}`;
    const cached = (await browserAPI.storage.local.get(key))[key];
    if (cached && Date.now() - cached.time < 5 * 60 * 1000 &&
        gameNameFromPage(cached.pageUrl) && typeof cached.title === 'string') {
      return { title: cached.title, pageUrl: cached.pageUrl };
    }
  }

  // A CDN can replace the referrer. Use only an active game page, not any
  // unrelated tab that happens to be open in the browser.
  const activeGame = tabs.find(tab => tab.active && gameDetailsForTab(tab));
  if (activeGame) return gameDetailsForTab(activeGame);
  const recent = (await browserAPI.storage.local.get('recentGamePage')).recentGamePage;
  if (recent && Date.now() - recent.time < 5 * 60 * 1000 &&
      gameNameFromPage(recent.pageUrl) && typeof recent.title === 'string') {
    return { title: recent.title, pageUrl: recent.pageUrl };
  }
  return { title: '', pageUrl: '' };
}
// Keep download decisions independent of the original browser history entry.
let captureEnabled = true;
const settingsReady = browserAPI.storage.sync.get(['isEnabled']).then(prefs => {
  captureEnabled = prefs.isEnabled ?? true;
}).catch(error => console.warn('Could not read download setting:', error));
browserAPI.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.isEnabled) captureEnabled = changes.isEnabled.newValue ?? true;
});
const choiceKey = id => `downloadChoice:${id}`;
const choiceUrl = id => browserAPI.runtime.getURL(`download.html?id=${id}`);

// Some browsers omit byExtensionId on onCreated. Register the launch before
// calling download(), then match its returned ID even if onCreated arrives first.
const browserLaunches = new Set();
const allowedBrowserDownloads = new Set();
const allowanceKey = id => `browserDownload:${id}`;
let interceptionReady = false;
const interceptionStartup = Promise.all([
  settingsReady,
  browserAPI.storage.local.get(null).then(data => {
    for (const [key, time] of Object.entries(data)) {
      if (key.startsWith('browserDownload:') && typeof time === 'number' &&
          Date.now() - time >= 0 && Date.now() - time < 10 * 60 * 1000) {
        allowedBrowserDownloads.add(Number(key.slice('browserDownload:'.length)));
      }
    }
  }).catch(error => console.warn('Could not restore download allowances:', error))
]).then(() => { interceptionReady = true; });

async function startBrowserDownload(url) {
  let finish;
  const launch = new Promise(resolve => { finish = resolve; });
  browserLaunches.add(launch);
  try {
    const id = await browserAPI.downloads.download({ url });
    allowedBrowserDownloads.add(id);
    // Persist before releasing waiting events, for service-worker restarts.
    await browserAPI.storage.local.set({ [allowanceKey(id)]: Date.now() }).catch(error =>
      console.warn('Could not persist browser download allowance:', error)
    );
    return id;
  } finally {
    browserLaunches.delete(launch);
    finish();
  }
}

function isAllowedBrowserDownload(item) {
  const key = allowanceKey(item.id);
  const allowed = allowedBrowserDownloads.delete(item.id);
  if (allowed) void browserAPI.storage.local.remove(key).catch(console.warn);
  return allowed || item.byExtensionId === browserAPI.runtime.id;
}

async function handleDownload(item) {
  if (item.state !== 'in_progress') return;
  if (item.byExtensionId === browserAPI.runtime.id || isAllowedBrowserDownload(item)) return;
  const url = item.finalUrl || item.url;
  const mode = /^https?:\/\//i.test(url) ? 'stopped' : 'paused';
  try {
    let held = false;
    if (!interceptionReady || browserLaunches.size) {
      // During startup or a launch race, hold the transfer BEFORE any storage
      // reads or ID lookup waits. Resume it only if it was explicitly allowed.
      await browserAPI.downloads.pause(item.id);
      held = true;
      await interceptionStartup;
      await Promise.all([...browserLaunches]);
      if (isAllowedBrowserDownload(item) || !captureEnabled) {
        await browserAPI.downloads.resume(item.id);
        return;
      }
    }
    if (!captureEnabled) return;
    // Stop HTTP transfers instead of depending on the server honoring a pause.
    // Browser-local URLs cannot reliably be recreated, so retain their transfer.
    // In the normal path cancel is the very first asynchronous browser call.
    if (mode === 'stopped') await browserAPI.downloads.cancel(item.id);
    else if (!held) await browserAPI.downloads.pause(item.id);
    const [current] = await browserAPI.downloads.search({ id: item.id });
    if (current?.state === 'complete' ||
        (mode === 'stopped' && current?.state === 'in_progress') ||
        (mode === 'paused' && (!current || !current.paused || current.state !== 'in_progress'))) {
      console.warn('Download finished or could not be stopped before capture.');
      return;
    }
    // Save before opening the page, and keep this record if opening the page fails.
    // The popup can recover it without silently restarting the download.
    const record = {
      id: item.id, version: 1, url, browserUrl: item.url || url, mode,
      filename: (current?.filename || item.filename || '').split(/[\\/]/).pop(),
      mime: item.mime || '', totalBytes: current?.totalBytes || item.totalBytes,
      title: '', pageUrl: '', status: 'pending', time: Date.now()
    };
    await browserAPI.storage.local.set({ [choiceKey(item.id)]: record });
    const page = await findGamePage(item).catch(() => ({ title: '', pageUrl: '' }));
    await browserAPI.storage.local.set({ [choiceKey(item.id)]: { ...record, ...page } });
    await browserAPI.tabs.create({ url: choiceUrl(item.id) });
  } catch (error) {
    console.error('Could not prepare download choices. Check the extension popup or browser downloads:', error);
  }
}

const choosing = new Set();
async function chooseDownload(id, action, title) {
  if (!Number.isInteger(id) || !['browser', 'ascendara', 'cancel'].includes(action)) {
    throw new Error('Invalid download choice.');
  }
  if (choosing.has(id)) throw new Error('This download is already being handled.');
  choosing.add(id);
  try {
    const key = choiceKey(id);
    const record = (await browserAPI.storage.local.get(key))[key];
    if (!record || record.status !== 'pending') throw new Error('This download has already been handled.');
    const [current] = await browserAPI.downloads.search({ id });
    if (action === 'browser') {
      if (current?.state === 'complete') {
        // A legacy paused transfer may have finished while its page was open.
        await browserAPI.storage.local.remove(key);
        return { ok: true, status: 'browser', message: 'This file has already downloaded in your browser.' };
      }
      if (current?.state === 'in_progress') {
        if (current.paused) await browserAPI.downloads.resume(id);
      } else if (/^https?:\/\//i.test(record.browserUrl || record.url)) {
        await startBrowserDownload(record.browserUrl || record.url);
      } else {
        throw new Error('This browser-only download is no longer available. Start it again from the original page.');
      }
    } else if (action === 'cancel') {
      if (current?.state === 'in_progress') await browserAPI.downloads.cancel(id);
      if (current?.state === 'complete') {
        await browserAPI.storage.local.remove(key);
        return { ok: true, status: 'cancel', message: 'Choice dismissed. This file already finished downloading; it has not been deleted.' };
      }
    } else {
      if (!/^https?:\/\//i.test(record.url)) throw new Error('This file can only be downloaded in your browser.');
      const payload = {
        version: 1, url: record.url, filename: (current?.filename || record.filename || '').split(/[\\/]/).pop(),
        title: typeof title === 'string' ? title.trim().slice(0, 200) : record.title,
        pageUrl: record.pageUrl
      };
      // Keep the saved choice until the user dismisses it, so a rejected app
      // prompt still leaves a browser-download fallback.
      await browserAPI.tabs.create({ url: 'ascendara://download?payload=' + encodeURIComponent(JSON.stringify(payload)) });
      await browserAPI.storage.local.set({ lastCapture: {
        ...payload, status: 'Ascendara requested. Approve the browser prompt and review the download in the app.', time: Date.now()
      } });
      return { ok: true, status: 'pending', message: 'Approve the Open Ascendara prompt. Once the file appears in the app, dismiss this choice below. If it did not open, you can still download in your browser.' };
    }
    // Drop signed URLs as soon as the user resolves the browser transfer.
    await browserAPI.storage.local.remove(key);
    return { ok: true, status: action, message: action === 'browser' ? 'Download started in your browser. Check your browser downloads for progress.' : 'Browser download canceled.' };
  } finally {
    choosing.delete(id);
  }
}

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== browserAPI.runtime.id || !sender.url?.startsWith(browserAPI.runtime.getURL('download.html')) || message?.type !== 'chooseDownload') return;
  chooseDownload(message.id, message.action, message.title)
    .then(sendResponse, error => sendResponse({ ok: false, error: error.message }));
  return true;
});

browserAPI.downloads.onCreated.addListener(item => {
  void handleDownload(item).catch(error => console.error('Download capture failed:', error));
});
// Do not remove pending choices on interrupted/complete/erased events. Canceling
// intentionally emits interrupted, sometimes after the chooser has opened.
// Only an explicit resolved choice removes its record.
