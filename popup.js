// Controller for Naukri Job Blocker Popup / Options page

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const itemInput = document.getElementById('item-input') || document.getElementById('company-input');
  const addForm = document.getElementById('add-form');
  const btnAddText = document.getElementById('btn-add-text');
  const sectionHeading = document.getElementById('section-heading');
  const searchInput = document.getElementById('search-input');
  const container = document.getElementById('blocklist-container');
  
  const tabCompanies = document.getElementById('tab-companies');
  const tabLocations = document.getElementById('tab-locations');
  const tabTitles = document.getElementById('tab-titles');
  
  const tabCountCompanies = document.getElementById('tab-count-companies');
  const tabCountLocations = document.getElementById('tab-count-locations');
  const tabCountTitles = document.getElementById('tab-count-titles');

  // Location Sub-nav Elements
  const locSubnav = document.getElementById('loc-subnav');
  const locSubTarget = document.getElementById('loc-sub-target');
  const locSubExcluded = document.getElementById('loc-sub-excluded');
  const subCountTarget = document.getElementById('sub-count-target');
  const subCountExcluded = document.getElementById('sub-count-excluded');
  const targetQuickChips = document.getElementById('target-quick-chips');

  // Title Sub-nav Elements
  const titleSubnav = document.getElementById('title-subnav');
  const titleSubTarget = document.getElementById('title-sub-target');
  const titleSubExcluded = document.getElementById('title-sub-excluded');
  const subCountTitleTarget = document.getElementById('sub-count-title-target');
  const subCountTitleExcluded = document.getElementById('sub-count-title-excluded');
  const targetTitleQuickChips = document.getElementById('target-title-quick-chips');

  // Footer Counters
  const companiesCountEl = document.getElementById('companies-count');
  const targetLocationsCountEl = document.getElementById('target-locations-count');
  const locationsCountEl = document.getElementById('locations-count');
  const targetTitlesCountEl = document.getElementById('target-titles-count');
  const titlesCountEl = document.getElementById('titles-count');

  // Master Toggle Elements
  const filterToggle = document.getElementById('filter-toggle');
  const toggleStatus = document.getElementById('toggle-status');
  const disabledBanner = document.getElementById('disabled-banner');
  const btnResumeBanner = document.getElementById('btn-resume-banner');

  // State
  let currentTab = 'companies'; // 'companies' | 'locations' | 'titles'
  let locSubTab = 'target'; // 'target' | 'excluded'
  let titleSubTab = 'target'; // 'target' | 'excluded'
  let filterEnabled = true;
  let blockedCompanies = [];
  let blockedLocations = [];
  let blockedTitles = [];
  let targetLocations = [];
  let targetTitles = [];

  // Initialize
  loadAll();

  // Master Toggle handlers
  if (filterToggle) {
    filterToggle.addEventListener('change', () => {
      setFilterEnabled(filterToggle.checked);
    });
  }

  if (btnResumeBanner) {
    btnResumeBanner.addEventListener('click', () => {
      setFilterEnabled(true);
    });
  }

  function setFilterEnabled(enabled) {
    filterEnabled = enabled;
    chrome.storage.local.set({ filterEnabled }, () => {
      updateToggleUI();
    });
  }

  function updateToggleUI() {
    if (filterToggle) {
      filterToggle.checked = filterEnabled;
    }
    if (toggleStatus) {
      toggleStatus.textContent = filterEnabled ? 'Active' : 'Paused';
      if (filterEnabled) {
        toggleStatus.classList.remove('paused');
      } else {
        toggleStatus.classList.add('paused');
      }
    }
    if (disabledBanner) {
      if (filterEnabled) {
        disabledBanner.classList.add('hidden');
      } else {
        disabledBanner.classList.remove('hidden');
      }
    }
  }

  // Tab switching
  if (tabCompanies) tabCompanies.addEventListener('click', () => switchTab('companies'));
  if (tabLocations) tabLocations.addEventListener('click', () => switchTab('locations'));
  if (tabTitles) tabTitles.addEventListener('click', () => switchTab('titles'));

  // Location Sub-tab switching
  if (locSubTarget) locSubTarget.addEventListener('click', () => switchLocSubTab('target'));
  if (locSubExcluded) locSubExcluded.addEventListener('click', () => switchLocSubTab('excluded'));

  // Title Sub-tab switching
  if (titleSubTarget) titleSubTarget.addEventListener('click', () => switchTitleSubTab('target'));
  if (titleSubExcluded) titleSubExcluded.addEventListener('click', () => switchTitleSubTab('excluded'));

  // Quick suggestion chips for locations
  document.querySelectorAll('.chip-btn:not(.chip-title-btn)').forEach(btn => {
    btn.addEventListener('click', () => {
      const loc = btn.dataset.loc;
      if (loc) {
        currentTab = 'locations';
        locSubTab = 'target';
        switchTab('locations');
        addItem(loc);
      }
    });
  });

  // Quick suggestion chips for titles
  document.querySelectorAll('.chip-title-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const title = btn.dataset.title;
      if (title) {
        currentTab = 'titles';
        titleSubTab = 'target';
        switchTab('titles');
        addItem(title);
      }
    });
  });

  function switchTab(tab) {
    currentTab = tab;

    // Reset tab active classes
    [tabCompanies, tabLocations, tabTitles].forEach(t => {
      if (t) t.classList.remove('active');
    });

    if (currentTab === 'companies') {
      if (tabCompanies) tabCompanies.classList.add('active');
      if (locSubnav) locSubnav.style.display = 'none';
      if (targetQuickChips) targetQuickChips.style.display = 'none';
      if (titleSubnav) titleSubnav.style.display = 'none';
      if (targetTitleQuickChips) targetTitleQuickChips.style.display = 'none';
      itemInput.placeholder = 'Enter company name to block...';
      if (btnAddText) btnAddText.textContent = 'Block';
      if (sectionHeading) sectionHeading.textContent = 'Blocked Companies';
      searchInput.placeholder = 'Search companies...';
    } else if (currentTab === 'locations') {
      if (tabLocations) tabLocations.classList.add('active');
      if (titleSubnav) titleSubnav.style.display = 'none';
      if (targetTitleQuickChips) targetTitleQuickChips.style.display = 'none';
      if (locSubnav) locSubnav.style.display = 'flex';
      updateLocSubUI();
    } else {
      if (tabTitles) tabTitles.classList.add('active');
      if (locSubnav) locSubnav.style.display = 'none';
      if (targetQuickChips) targetQuickChips.style.display = 'none';
      if (titleSubnav) titleSubnav.style.display = 'flex';
      updateTitleSubUI();
    }

    itemInput.value = '';
    searchInput.value = '';
    renderList();
  }

  function switchLocSubTab(sub) {
    if (locSubTab === sub) return;
    locSubTab = sub;
    updateLocSubUI();
    itemInput.value = '';
    searchInput.value = '';
    renderList();
  }

  function updateLocSubUI() {
    if (!locSubTarget || !locSubExcluded) return;
    if (locSubTab === 'target') {
      locSubTarget.classList.add('active');
      locSubExcluded.classList.remove('active');
      if (targetQuickChips) targetQuickChips.style.display = 'flex';
      itemInput.placeholder = 'Enter target location (e.g. Bangalore, Remote)';
      if (btnAddText) btnAddText.textContent = 'Allow';
      if (sectionHeading) sectionHeading.textContent = 'Target Locations (Whitelist)';
      searchInput.placeholder = 'Search target locations...';
    } else {
      locSubExcluded.classList.add('active');
      locSubTarget.classList.remove('active');
      if (targetQuickChips) targetQuickChips.style.display = 'none';
      itemInput.placeholder = 'Enter location to exclude (e.g. Noida, Pune)';
      if (btnAddText) btnAddText.textContent = 'Exclude';
      if (sectionHeading) sectionHeading.textContent = 'Excluded Locations (Blacklist)';
      searchInput.placeholder = 'Search excluded locations...';
    }
  }

  function switchTitleSubTab(sub) {
    if (titleSubTab === sub) return;
    titleSubTab = sub;
    updateTitleSubUI();
    itemInput.value = '';
    searchInput.value = '';
    renderList();
  }

  function updateTitleSubUI() {
    if (!titleSubTarget || !titleSubExcluded) return;
    if (titleSubTab === 'target') {
      titleSubTarget.classList.add('active');
      titleSubExcluded.classList.remove('active');
      if (targetTitleQuickChips) targetTitleQuickChips.style.display = 'flex';
      itemInput.placeholder = 'Enter target title keyword (e.g. Frontend, React)';
      if (btnAddText) btnAddText.textContent = 'Allow';
      if (sectionHeading) sectionHeading.textContent = 'Target Titles (Whitelist)';
      searchInput.placeholder = 'Search target titles...';
    } else {
      titleSubExcluded.classList.add('active');
      titleSubTarget.classList.remove('active');
      if (targetTitleQuickChips) targetTitleQuickChips.style.display = 'none';
      itemInput.placeholder = 'Enter title keyword to exclude (e.g. Intern, Tester)';
      if (btnAddText) btnAddText.textContent = 'Exclude';
      if (sectionHeading) sectionHeading.textContent = 'Excluded Title Keywords (Blacklist)';
      searchInput.placeholder = 'Search excluded title keywords...';
    }
  }

  // Handle form submission
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = itemInput.value.trim();
    if (!value) return;

    addItem(value);
  });

  // Handle live search input
  searchInput.addEventListener('input', () => {
    renderList(searchInput.value.trim());
  });

  // Load from local storage
  function loadAll() {
    chrome.storage.local.get({
      blockedCompanies: [],
      blockedLocations: [],
      blockedTitles: [],
      targetLocations: [],
      targetTitles: [],
      filterEnabled: true
    }, (result) => {
      blockedCompanies = result.blockedCompanies || [];
      blockedLocations = result.blockedLocations || [];
      blockedTitles = result.blockedTitles || [];
      targetLocations = result.targetLocations || [];
      targetTitles = result.targetTitles || [];
      filterEnabled = result.filterEnabled !== false;
      updateToggleUI();
      updateBadges();
      renderList();
    });
  }

  // React to storage changes from page widget or other tabs
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (changes.filterEnabled !== undefined) {
        filterEnabled = changes.filterEnabled.newValue !== false;
        updateToggleUI();
      }
      if (changes.blockedCompanies) {
        blockedCompanies = changes.blockedCompanies.newValue || [];
        updateBadges();
        if (currentTab === 'companies') renderList(searchInput.value.trim());
      }
      if (changes.blockedLocations) {
        blockedLocations = changes.blockedLocations.newValue || [];
        updateBadges();
        if (currentTab === 'locations' && locSubTab === 'excluded') renderList(searchInput.value.trim());
      }
      if (changes.targetLocations) {
        targetLocations = changes.targetLocations.newValue || [];
        updateBadges();
        if (currentTab === 'locations' && locSubTab === 'target') renderList(searchInput.value.trim());
      }
      if (changes.targetTitles) {
        targetTitles = changes.targetTitles.newValue || [];
        updateBadges();
        if (currentTab === 'titles' && titleSubTab === 'target') renderList(searchInput.value.trim());
      }
      if (changes.blockedTitles) {
        blockedTitles = changes.blockedTitles.newValue || [];
        updateBadges();
        if (currentTab === 'titles' && titleSubTab === 'excluded') renderList(searchInput.value.trim());
      }
    }
  });

  // Save current active list to storage
  function saveCurrent() {
    let payload = {};
    if (currentTab === 'companies') {
      payload = { blockedCompanies };
    } else if (currentTab === 'titles') {
      payload = titleSubTab === 'target' ? { targetTitles } : { blockedTitles };
    } else if (locSubTab === 'target') {
      payload = { targetLocations };
    } else {
      payload = { blockedLocations };
    }

    chrome.storage.local.set(payload, () => {
      updateBadges();
      renderList(searchInput.value.trim());
    });
  }

  // Update counts in badges and footer
  function updateBadges() {
    if (tabCountCompanies) tabCountCompanies.textContent = blockedCompanies.length;

    if (subCountTarget) subCountTarget.textContent = targetLocations.length;
    if (subCountExcluded) subCountExcluded.textContent = blockedLocations.length;

    if (subCountTitleTarget) subCountTitleTarget.textContent = targetTitles.length;
    if (subCountTitleExcluded) subCountTitleExcluded.textContent = blockedTitles.length;

    if (tabCountLocations) {
      if (targetLocations.length > 0) {
        tabCountLocations.textContent = `🎯 ${targetLocations.length}`;
      } else {
        tabCountLocations.textContent = blockedLocations.length;
      }
    }

    if (tabCountTitles) {
      if (targetTitles.length > 0) {
        tabCountTitles.textContent = `🎯 ${targetTitles.length}`;
      } else {
        tabCountTitles.textContent = blockedTitles.length;
      }
    }

    if (companiesCountEl) companiesCountEl.textContent = blockedCompanies.length;
    if (targetLocationsCountEl) targetLocationsCountEl.textContent = `🎯 ${targetLocations.length}`;
    if (locationsCountEl) locationsCountEl.textContent = `🚫 ${blockedLocations.length}`;
    if (targetTitlesCountEl) targetTitlesCountEl.textContent = `🎯 ${targetTitles.length}`;
    if (titlesCountEl) titlesCountEl.textContent = `🚫 ${blockedTitles.length}`;
  }

  // Get active list array reference
  function getActiveList() {
    if (currentTab === 'companies') return blockedCompanies;
    if (currentTab === 'titles') return titleSubTab === 'target' ? targetTitles : blockedTitles;
    if (locSubTab === 'target') return targetLocations;
    return blockedLocations;
  }

  // Add an item to the current list
  function addItem(name) {
    const targetList = getActiveList();
    const exists = targetList.some(item => item.toLowerCase() === name.toLowerCase());

    if (exists) {
      itemInput.style.borderColor = 'var(--danger)';
      setTimeout(() => {
        itemInput.style.borderColor = '';
      }, 1000);

      let label = 'item';
      if (currentTab === 'companies') label = 'company';
      else if (currentTab === 'titles') label = titleSubTab === 'target' ? 'target title keyword' : 'excluded title keyword';
      else if (locSubTab === 'target') label = 'target location';
      else label = 'excluded location';

      alert(`"${name}" is already in your ${label} list.`);
      return;
    }

    targetList.push(name);
    itemInput.value = '';
    saveCurrent();
  }

  // Delete an item from the current list
  function deleteItem(originalIndex) {
    const targetList = getActiveList();
    targetList.splice(originalIndex, 1);
    saveCurrent();
  }

  // Render the active list
  function renderList(filterQuery = '') {
    container.innerHTML = '';
    updateBadges();

    const targetList = getActiveList();

    // Sort alphabetically
    const indexedList = targetList.map((name, index) => ({ name, originalIndex: index }));
    indexedList.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    const query = filterQuery.toLowerCase();
    const filteredList = indexedList.filter(item => item.name.toLowerCase().includes(query));

    if (targetList.length === 0) {
      if (currentTab === 'companies') {
        showEmptyState(
          "No companies blocked yet.",
          "Add a company name above or click the Block button on Naukri.com listings to hide them from your feed."
        );
      } else if (currentTab === 'locations' && locSubTab === 'target') {
        showEmptyState(
          "No target locations set.",
          "Add locations like Bangalore or Remote to only show matching jobs. Multi-city listings (e.g. Hyderabad/Bangalore or Bengaluru/Remote) will automatically stay visible!"
        );
      } else if (currentTab === 'locations' && locSubTab === 'excluded') {
        showEmptyState(
          "No locations excluded yet.",
          "Add cities or regions above (e.g. Noida, Gurgaon, Pune) or click Exclude Loc on Naukri cards to hide them."
        );
      } else if (currentTab === 'titles' && titleSubTab === 'target') {
        showEmptyState(
          "No target titles set.",
          "Add keywords like Frontend, React, or SDE to only show matching jobs. Postings with other titles will automatically be hidden!"
        );
      } else {
        showEmptyState(
          "No title keywords excluded yet.",
          "Add words or phrases above (e.g. Tester, Intern, Data Science, Support) to hide jobs with matching titles."
        );
      }
      return;
    }

    if (filteredList.length === 0) {
      showEmptyState("No matches found.", "Try searching for a different term or clear the search query.");
      return;
    }

    filteredList.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'blocked-item';

      let iconSvg = '';
      let tagBadge = '';
      if (currentTab === 'companies') {
        iconSvg = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" style="flex-shrink:0;opacity:0.6;margin-right:6px;"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="18"/><line x1="15" y1="22" x2="15" y2="18"/></svg>`;
      } else if (currentTab === 'locations' && locSubTab === 'target') {
        iconSvg = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="#10b981" stroke-width="2.5" fill="none" style="flex-shrink:0;margin-right:6px;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>`;
        tagBadge = `<span style="margin-left:8px;font-size:9.5px;background:rgba(16,185,129,0.15);color:#6ee7b7;padding:1px 6px;border-radius:4px;font-weight:700;">TARGET</span>`;
      } else if (currentTab === 'locations' && locSubTab === 'excluded') {
        iconSvg = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" style="flex-shrink:0;opacity:0.6;margin-right:6px;"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`;
      } else if (currentTab === 'titles' && titleSubTab === 'target') {
        iconSvg = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="#10b981" stroke-width="2.5" fill="none" style="flex-shrink:0;margin-right:6px;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>`;
        tagBadge = `<span style="margin-left:8px;font-size:9.5px;background:rgba(16,185,129,0.15);color:#6ee7b7;padding:1px 6px;border-radius:4px;font-weight:700;">TARGET</span>`;
      } else {
        iconSvg = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" style="flex-shrink:0;opacity:0.6;margin-right:6px;"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`;
      }

      itemEl.innerHTML = `
        <div style="display:flex;align-items:center;overflow:hidden;flex:1;">
          ${iconSvg}
          <span class="company-name-text" title="${item.name}">${item.name}</span>
          ${tagBadge}
        </div>
        <button class="btn-delete" title="Remove ${item.name}" type="button">
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
        itemEl.style.opacity = '0';
        itemEl.style.transform = 'scale(0.9) translateX(-10px)';
        setTimeout(() => {
          deleteItem(item.originalIndex);
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
