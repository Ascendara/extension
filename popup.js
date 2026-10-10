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
      ? 'Sending downloads from any website to Ascendara'
      : 'Downloads stay in your browser';
  }

  const settings = await browserAPI.storage.sync.get(['isEnabled']);
  display(settings.isEnabled ?? true);
  toggle.addEventListener('click', async () => {
    const enabled = toggle.getAttribute('aria-pressed') !== 'true';
    await browserAPI.storage.sync.set({ isEnabled: enabled });
    display(enabled);
  });

  const { lastCapture } = await browserAPI.storage.local.get(['lastCapture']);
  captureStatus.textContent = lastCapture?.status || 'Ready for downloads from any website.';
  if (lastCapture) {
    retry.hidden = false;
    retry.addEventListener('click', async () => {
      try {
        await browserAPI.tabs.create({
          url: 'ascendara://download?payload=' + encodeURIComponent(JSON.stringify(lastCapture))
        });
      } catch {
        captureStatus.textContent = 'Could not open Ascendara. Make sure it is installed.';
      }
    });
  }
});
