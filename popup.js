import { browserAPI } from './utils.js';

window.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('toggleButton');
  const status = document.getElementById('statusText');
  const captureStatus = document.getElementById('captureStatus');
  const retry = document.getElementById('retryCapture');

  function display(enabled) {
    toggle.classList.toggle('active', enabled);
    toggle.setAttribute('aria-pressed', String(enabled));
    status.textContent = enabled
      ? 'Ask what to do with each download'
      : 'Downloads stay in your browser';
  }

  const settings = await browserAPI.storage.sync.get(['isEnabled']);
  display(settings.isEnabled ?? true);
  toggle.addEventListener('click', async () => {
    const enabled = toggle.getAttribute('aria-pressed') !== 'true';
    await browserAPI.storage.sync.set({ isEnabled: enabled });
    display(enabled);
  });

  const records = await browserAPI.storage.local.get(null);
  const pending = Object.values(records).filter(value => value && value.status === 'pending' && Number.isInteger(value.id));
  captureStatus.textContent = pending.length
    ? `${pending.length} download${pending.length === 1 ? '' : 's'} waiting for your choice.`
    : 'Start a download to choose where it goes.';
  if (pending.length) {
    retry.hidden = false;
    retry.textContent = 'Review waiting downloads';
    retry.addEventListener('click', async () => {
      try {
        for (const record of pending) {
          const url = browserAPI.runtime.getURL(`download.html?id=${record.id}`);
          const tabs = await browserAPI.tabs.query({});
          const existing = tabs.find(tab => tab.url === url);
          if (existing) await browserAPI.tabs.update(existing.id, { active: true });
          else await browserAPI.tabs.create({ url });
        }
      } catch {
        captureStatus.textContent = 'Could not open download choices. Close and reopen the extension popup to try again.';
      }
    });
  }
});
