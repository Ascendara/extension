import { browserAPI } from './utils.js';

const id = Number(new URLSearchParams(location.search).get('id'));
const get = name => document.getElementById(name);
let record;
let busy = false;
let finished = false;

function buttons() {
  for (const action of ['browser', 'ascendara', 'cancel']) {
    get(action).disabled = busy || finished || !record || (action === 'ascendara' && !/^https?:\/\//i.test(record.url));
  }
  get('title').disabled = busy || finished;
  get('choices').setAttribute('aria-busy', String(busy));
}

async function init() {
  record = (await browserAPI.storage.local.get(`downloadChoice:${id}`))[`downloadChoice:${id}`];
  if (!record) throw new Error('This download is no longer waiting. Check your browser downloads for its status.');
  const [current] = await browserAPI.downloads.search({ id });
  get('filename').textContent = (current?.filename || record.filename || 'Untitled download').split(/[\\/]/).pop();
  const bytes = current?.totalBytes > 0 ? current?.totalBytes : record.totalBytes;
  const size = bytes > 0 ? (bytes / (1024 ** (bytes >= 1024 ** 3 ? 3 : 2))).toFixed(1) + (bytes >= 1024 ** 3 ? ' GB' : ' MB') : 'Size unknown';
  get('metadata').textContent = [size, record.mime].filter(Boolean).join(' · ');
  try { get('source').textContent = new URL(record.url).hostname || 'Local browser file'; } catch { get('source').textContent = 'Local browser file'; }
  get('title').value = record.title || '';
  get('badge').textContent = record.mode === 'stopped' ? 'STOPPED' : 'WAITING';
  get('status').textContent = /^https?:\/\//i.test(record.url)
    ? 'The download is waiting for your choice.'
    : 'This file belongs to your browser session. Choose Download in browser to continue.';
  buttons();
}

for (const action of ['browser', 'ascendara', 'cancel']) {
  get(action).addEventListener('click', async () => {
    busy = true;
    buttons();
    try {
      const result = await browserAPI.runtime.sendMessage({ type: 'chooseDownload', id, action, title: get('title').value });
      if (!result?.ok) throw new Error(result?.error || 'Could not handle the download. Please try again.');
      finished = result.status !== 'pending';
      get('status').textContent = result.message;
      if (finished) {
        get('badge').textContent = action === 'browser' ? 'IN BROWSER' : 'CANCELED';
        get('hint').textContent = 'You can close this page.';
      } else {
        get('ascendara').firstChild.textContent = 'Open Ascendara again ';
        get('cancel').textContent = 'Dismiss choice';
      }
    } catch (error) {
      get('status').textContent = error.message;
    } finally {
      busy = false;
      buttons();
    }
  });
}

init().catch(error => {
  finished = true;
  get('filename').textContent = 'Download unavailable';
  get('badge').textContent = 'CLOSED';
  get('status').textContent = error.message;
  buttons();
});
