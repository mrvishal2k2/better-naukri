// Background service worker for Naukri Job Blocker extension

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
