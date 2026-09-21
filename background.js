// Background service worker for Naukri Job Blocker extension

function updateBadge(filterEnabled) {
  if (filterEnabled === false) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Initial badge check on startup/install
chrome.storage.local.get({ filterEnabled: true }, (res) => {
  updateBadge(res.filterEnabled);
});

// React to filter toggle changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.filterEnabled !== undefined) {
    updateBadge(changes.filterEnabled.newValue !== false);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "open_options") {
    // Opens the extension popup inside a full tab as the Options/Settings UI
    chrome.runtime.openOptionsPage(() => {
      if (chrome.runtime.lastError) {
        console.error("Error opening options page:", chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true });
      }
    });
    return true; // Keep message port open for async response
  }
});
