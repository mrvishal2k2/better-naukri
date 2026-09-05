// Selectors for Naukri's job card containers
const CARD_SELECTORS = [
  'div.srp-jobtuple-wrapper',
  'article.jobTuple',
  'div.jobTuple',
  'div[cust-id]',
  '.srp-jobtuple-wrapper'
];

let blockedCompanies = [];
let activeToast = null;
let widgetElement = null;
let scanTimeout = null;

// Clean and extract company name from the card element
function getCompanyName(cardElement) {
  const selectors = [
    'a.comp-name',
    'a.subTitle',
    '.companyInfo a.subTitle',
    '[class*="comp-name"]',
    '[class*="company-name"]',
    'a[href*="/careers"]',
    '.company-name'
  ];

  for (const selector of selectors) {
    const el = cardElement.querySelector(selector);
    if (el) {
      // Clone element to remove ratings/reviews child tags safely
      const clone = el.cloneNode(true);
      const ratings = clone.querySelectorAll('.rating, .starRating, .reviews, span, i, em');
      ratings.forEach(r => r.remove());
      
      let name = clone.textContent.trim();
      
      // Clean reviews / ratings at the end (e.g. "Accenture 4.1" or "Accenture 1234 Reviews")
      name = name.replace(/\s+\d+(\.\d+)?\s*$/, '').trim();
      name = name.replace(/\s*Reviews\s*$/i, '').trim();
      name = name.replace(/\s+/g, ' '); // Normalize spaces

      if (name) return name;
    }
  }

  // Fallback for custom or direct text containers
  const compInfo = cardElement.querySelector('.companyInfo');
  if (compInfo) {
    let text = compInfo.textContent.trim();
    text = text.replace(/\d+(\.\d+)?\s*Reviews.*$/i, '').trim();
    if (text) return text;
  }

  return null;
}

// Check if a company name is on the blocklist
function isBlocked(companyName) {
  if (!companyName) return false;
  const lowerName = companyName.toLowerCase().trim();
  
  return blockedCompanies.some(blocked => {
    if (!blocked) return false;
    
    // Exact match
    if (lowerName === blocked) return true;
    
    // Substring match for names with at least 3 characters
    if (blocked.length >= 3 && lowerName.includes(blocked)) {
      return true;
    }
    
    // Exact word boundary check for short abbreviations (e.g. "TCS")
    try {
      const escapedBlocked = blocked.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedBlocked}\\b`, 'i');
      if (regex.test(lowerName)) return true;
    } catch (e) {
      if (lowerName.includes(blocked)) return true;
    }
    
    return false;
  });
}

// Inject the Block button next to the company name in the card
function injectBlockButton(card, companyName) {
  if (card.querySelector('.naukri-block-btn')) return;

  const selectors = [
    'a.comp-name',
    'a.subTitle',
    '.companyInfo a.subTitle',
    '[class*="comp-name"]',
    '[class*="company-name"]',
    'a[href*="/careers"]',
    '.company-name'
  ];

  let compEl = null;
  for (const selector of selectors) {
    compEl = card.querySelector(selector);
    if (compEl) break;
  }

  if (!compEl) return;

  const btn = document.createElement('button');
  btn.className = 'naukri-block-btn';
  btn.title = `Block all postings from ${companyName}`;
  btn.type = 'button';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none" class="naukri-block-icon">
      <circle cx="12" cy="12" r="10"/>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    </svg>
    <span>Block</span>
  `;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    addCompanyToBlocklist(companyName);
  });

  // Insert button right after the company element
  compEl.parentNode.insertBefore(btn, compEl.nextSibling);
}

// Process a single job card element
function processCard(card) {
  const company = card.dataset.companyName || getCompanyName(card);
  if (!company) return;

  // Mark as processed and cache the name
  card.dataset.naukriFiltered = "true";
  card.dataset.companyName = company;

  injectBlockButton(card, company);

  const blockedStatus = isBlocked(company);
  if (blockedStatus) {
    card.classList.add('naukri-blocked-card');
  } else {
    card.classList.remove('naukri-blocked-card');
  }
}

// Scan all matching elements in the DOM
function scanPage() {
  for (const selector of CARD_SELECTORS) {
    const cards = document.querySelectorAll(selector);
    if (cards.length > 0) {
      cards.forEach(processCard);
    }
  }
  createOrUpdateWidget();
}

// Create or update the floating stats widget in the bottom-right
function createOrUpdateWidget() {
  const blockedCards = document.querySelectorAll('.naukri-blocked-card');
  const count = blockedCards.length;

  const companyCounts = {};
  blockedCards.forEach(card => {
    const comp = card.dataset.companyName || 'Unknown';
    companyCounts[comp] = (companyCounts[comp] || 0) + 1;
  });

  if (!widgetElement) {
    widgetElement = document.createElement('div');
    widgetElement.id = 'naukri-filter-widget';
    widgetElement.className = 'naukri-filter-widget';
    
    widgetElement.innerHTML = `
      <div class="naukri-widget-header" id="naukri-widget-header">
        <div class="naukri-widget-title">
          <span class="naukri-widget-icon">🚫</span>
          <span class="naukri-widget-count" id="naukri-widget-count">0 jobs filtered</span>
        </div>
        <span class="naukri-widget-arrow" id="naukri-widget-arrow">▲</span>
      </div>
      <div class="naukri-widget-body" id="naukri-widget-body">
        <div class="naukri-widget-label">Blocked on this page:</div>
        <div class="naukri-widget-list" id="naukri-widget-list"></div>
        <div class="naukri-widget-actions">
          <button id="naukri-widget-toggle" class="naukri-widget-btn secondary">Show Blocked</button>
          <button id="naukri-widget-settings" class="naukri-widget-btn primary">Manage List</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(widgetElement);

    const header = widgetElement.querySelector('#naukri-widget-header');
    header.addEventListener('click', () => {
      widgetElement.classList.toggle('expanded');
    });

    const toggleBtn = widgetElement.querySelector('#naukri-widget-toggle');
    toggleBtn.addEventListener('click', () => {
      const isShowing = document.body.classList.toggle('naukri-show-blocked-cards');
      toggleBtn.textContent = isShowing ? 'Hide Blocked' : 'Show Blocked';
      toggleBtn.classList.toggle('active', isShowing);
    });

    const settingsBtn = widgetElement.querySelector('#naukri-widget-settings');
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: "open_options" });
    });
  }

  // Update counts
  const countEl = widgetElement.querySelector('#naukri-widget-count');
  countEl.textContent = `${count} job${count === 1 ? '' : 's'} filtered`;

  if (count === 0) {
    widgetElement.classList.add('empty');
  } else {
    widgetElement.classList.remove('empty');
  }

  // Update list view
  const listEl = widgetElement.querySelector('#naukri-widget-list');
  listEl.innerHTML = '';
  
  const sortedCompanies = Object.entries(companyCounts).sort((a, b) => b[1] - a[1]);
  if (sortedCompanies.length === 0) {
    listEl.innerHTML = '<div class="naukri-empty-list-msg">No blocked companies visible on this page.</div>';
  } else {
    sortedCompanies.forEach(([company, num]) => {
      const item = document.createElement('div');
      item.className = 'naukri-widget-list-item';
      item.innerHTML = `
        <span class="naukri-item-name" title="${company}">${company}</span>
        <span class="naukri-item-count">${num}</span>
      `;
      listEl.appendChild(item);
    });
  }
}

// Storage helpers
function addCompanyToBlocklist(companyName) {
  const cleanName = companyName.trim();
  if (!cleanName) return;

  chrome.storage.local.get({ blockedCompanies: [] }, (result) => {
    const list = result.blockedCompanies;
    const exists = list.some(c => c.toLowerCase() === cleanName.toLowerCase());
    
    if (!exists) {
      list.push(cleanName);
      chrome.storage.local.set({ blockedCompanies: list }, () => {
        blockedCompanies = list.map(c => c.toLowerCase().trim());
        
        showToast(`Blocked ${cleanName}`, 'Undo', () => {
          removeCompanyFromBlocklist(cleanName);
        });
        
        // Scan page immediately to hide cards
        scanPage();
      });
    } else {
      showToast(`"${cleanName}" is already blocked`);
    }
  });
}

function removeCompanyFromBlocklist(companyName) {
  const cleanName = companyName.trim();
  chrome.storage.local.get({ blockedCompanies: [] }, (result) => {
    const list = result.blockedCompanies.filter(c => c.toLowerCase() !== cleanName.toLowerCase());
    chrome.storage.local.set({ blockedCompanies: list }, () => {
      blockedCompanies = list.map(c => c.toLowerCase().trim());
      showToast(`Unblocked ${cleanName}`);
      
      // Force reprocessing of all cards
      const cards = document.querySelectorAll('[data-naukri-filtered]');
      cards.forEach(card => card.removeAttribute('data-naukri-filtered'));
      
      scanPage();
    });
  });
}

// Show a clean Toast UI notification
function showToast(message, actionText = null, actionCallback = null) {
  if (activeToast) {
    activeToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = 'naukri-toast';
  
  const textEl = document.createElement('span');
  textEl.textContent = message;
  toast.appendChild(textEl);

  if (actionText && actionCallback) {
    const actionEl = document.createElement('button');
    actionEl.className = 'naukri-toast-action';
    actionEl.textContent = actionText;
    actionEl.addEventListener('click', () => {
      actionCallback();
      toast.remove();
    });
    toast.appendChild(actionEl);
  }

  document.body.appendChild(toast);
  activeToast = toast;

  // Auto remove after 4.5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('fading');
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 300);
    }
  }, 4500);
}

// Initialize
function init() {
  chrome.storage.local.get({ blockedCompanies: [] }, (result) => {
    blockedCompanies = result.blockedCompanies.map(c => c.toLowerCase().trim());
    
    // Scan page
    scanPage();
    
    // Set up MutationObserver to watch for dynamic job list loading
    const observer = new MutationObserver(() => {
      if (scanTimeout) clearTimeout(scanTimeout);
      scanTimeout = setTimeout(scanPage, 150);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

// React to storage changes from the extension popup
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.blockedCompanies) {
    blockedCompanies = (changes.blockedCompanies.newValue || []).map(c => c.toLowerCase().trim());
    // Clear filtered attribute to trigger a clean filter run
    const cards = document.querySelectorAll('[data-naukri-filtered]');
    cards.forEach(card => card.removeAttribute('data-naukri-filtered'));
    scanPage();
  }
});

// Run
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
