// Background service worker for Naukri Job Blocker extension

let globalFilterEnabled = true;

function updateGlobalBadge(enabled) {
  globalFilterEnabled = enabled;
  if (!enabled) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Initial badge check on startup/install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({
    filterEnabled: true,
    blockedCompanies: [],
    blockedLocations: [],
    blockedTitles: [],
    targetLocations: [],
    targetTitles: []
  }, (res) => {
    updateGlobalBadge(res.filterEnabled !== false);
  });
});

chrome.storage.local.get({ filterEnabled: true }, (res) => {
  updateGlobalBadge(res.filterEnabled !== false);
});

// React to filter toggle changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.filterEnabled !== undefined) {
    updateGlobalBadge(changes.filterEnabled.newValue !== false);
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

  if (request.action === "update_tab_badge") {
    if (!globalFilterEnabled) {
      chrome.action.setBadgeText({ text: 'OFF' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    } else if (sender.tab && sender.tab.id) {
      const count = Number(request.count) || 0;
      if (count > 0) {
        chrome.action.setBadgeText({ text: String(count), tabId: sender.tab.id });
        chrome.action.setBadgeBackgroundColor({ color: '#6366f1', tabId: sender.tab.id });
      } else {
        chrome.action.setBadgeText({ text: '', tabId: sender.tab.id });
      }
    }
    sendResponse({ success: true });
    return false;
  }
});
