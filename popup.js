// Controller for Naukri Job Blocker Popup / Options page

document.addEventListener('DOMContentLoaded', () => {
  const companyInput = document.getElementById('company-input');
  const addForm = document.getElementById('add-form');
  const searchInput = document.getElementById('search-input');
  const container = document.getElementById('blocklist-container');
  const totalCountEl = document.getElementById('total-count');

  let blockedCompanies = [];

  // Load blocklist on startup
  loadBlocklist();

  // Handle form submission to add new company
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = companyInput.value.trim();
    if (!name) return;

    addCompany(name);
  });

  // Handle live search input
  searchInput.addEventListener('input', () => {
    renderList(searchInput.value.trim());
  });

  // Load from local storage
  function loadBlocklist() {
    chrome.storage.local.get({ blockedCompanies: [] }, (result) => {
      // Keep casing original for UI, compare case-insensitively
      blockedCompanies = result.blockedCompanies;
      renderList();
    });
  }

  // Save list to storage
  function saveBlocklist() {
    chrome.storage.local.set({ blockedCompanies }, () => {
      renderList(searchInput.value.trim());
    });
  }

  // Add a company to the list
  function addCompany(name) {
    // Check if duplicate (case insensitive)
    const exists = blockedCompanies.some(c => c.toLowerCase() === name.toLowerCase());
    
    if (exists) {
      // Highlight the input as warning/shake
      companyInput.style.borderColor = 'var(--danger)';
      setTimeout(() => {
        companyInput.style.borderColor = '';
      }, 1000);
      
      // Simple alert or notice
      alert(`"${name}" is already in your blocklist.`);
      return;
    }

    blockedCompanies.push(name);
    companyInput.value = '';
    saveBlocklist();
  }

  // Delete a company from the list
  function deleteCompany(indexInFullList) {
    blockedCompanies.splice(indexInFullList, 1);
    saveBlocklist();
  }

  // Render the list of blocked companies
  function renderList(filterQuery = '') {
    container.innerHTML = '';
    
    // Sort alphabetically for clean look
    // Keep track of their original indices in blockedCompanies so deletion works correctly
    const indexedList = blockedCompanies.map((name, index) => ({ name, originalIndex: index }));
    indexedList.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    const query = filterQuery.toLowerCase();
    const filteredList = indexedList.filter(item => item.name.toLowerCase().includes(query));

    // Update total count
    totalCountEl.textContent = blockedCompanies.length;

    if (blockedCompanies.length === 0) {
      showEmptyState("No companies blocked yet.", "Add a company name above or click the Block button on Naukri.com listings to hide them from your feed.");
      return;
    }

    if (filteredList.length === 0) {
      showEmptyState("No matches found.", "Try searching for a different name or clear the search query.");
      return;
    }

    filteredList.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'blocked-item';
      
      itemEl.innerHTML = `
        <span class="company-name-text" title="${item.name}">${item.name}</span>
        <button class="btn-delete" title="Unblock ${item.name}" type="button">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </button>
      `;

      // Attach delete click handler
      const deleteBtn = itemEl.querySelector('.btn-delete');
      deleteBtn.addEventListener('click', () => {
        // Run animation first, then delete
        itemEl.style.opacity = '0';
        itemEl.style.transform = 'scale(0.9) translateX(-10px)';
        setTimeout(() => {
          deleteCompany(item.originalIndex);
        }, 200);
      });

      container.appendChild(itemEl);
    });
  }

  // Display empty state template
  function showEmptyState(title, description) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="1.5" fill="none">
          <circle cx="12" cy="12" r="10"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        <div style="font-weight: 600; font-size: 13px; color: var(--text-main); margin-top: 4px;">${title}</div>
        <p>${description}</p>
      </div>
    `;
  }
});
