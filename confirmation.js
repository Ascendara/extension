const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

let downloadUrl;
let filename;

browserAPI.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("Received message:", request); // For debugging
  if (request.action === 'showConfirmation') {
    downloadUrl = request.downloadUrl;
    filename = request.filename;
    document.getElementById('downloadUrl').textContent = downloadUrl || 'URL not available';
  }
});

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('copyBtn').addEventListener('click', function() {
    if (downloadUrl) {
      navigator.clipboard.writeText(downloadUrl).then(function() {
        alert('Download link copied to clipboard!');
      }).catch(function(err) {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy download link. Please copy it manually.');
      });
    } else {
      alert('Download URL is not available');
    }
  });

  document.getElementById('cancelBtn').addEventListener('click', function() {
    browserAPI.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      browserAPI.tabs.remove(tabs[0].id, function() {
        console.log("Tab removed");
      });
    });
  });
});
