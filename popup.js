const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', function() {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const statusText = document.getElementById('status');

  browserAPI.storage.sync.get('isBlocking', function(data) {
    toggleSwitch.checked = data.isBlocking;
    updateStatus(data.isBlocking);
  });

  toggleSwitch.addEventListener('change', function() {
    const isBlocking = this.checked;
    browserAPI.storage.sync.set({isBlocking: isBlocking}, function() {
      updateStatus(isBlocking);
      browserAPI.runtime.sendMessage({action: 'updateBlockingStatus', isBlocking: isBlocking});
    });
  });

  function updateStatus(isBlocking) {
    statusText.textContent = isBlocking ? 'Block and report all downloads' : 'Do not block any downloads';
  }
});