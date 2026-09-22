// Selectors for Naukri's job card containers
const CARD_SELECTORS = [
  'div.srp-jobtuple-wrapper',
  'article.jobTuple',
  'div.jobTuple',
  'div[cust-id]',
  '.srp-jobtuple-wrapper'
];

let filterEnabled = true;
let blockedCompanies = [];
let blockedLocations = [];
let blockedTitles = [];
let targetLocations = [];
let targetTitles = [];
let activeToast = null;
let widgetElement = null;
let scanTimeout = null;

let latestActiveJobStats = null;
const jobStatsMap = new Map();

window.addEventListener('better-naukri-job-stats', (e) => {
  const stats = e.detail;
  if (!stats) return;

  if (stats._activeJob) {
    latestActiveJobStats = stats._activeJob;
    if (stats._activeJob.jobId) {
      jobStatsMap.set(stats._activeJob.jobId, stats._activeJob);
    }
  }

  for (const [id, data] of Object.entries(stats)) {
    if (id !== '_activeJob') {
      jobStatsMap.set(id, data);
    }
  }

  scanPage();
  updateJobDetailsPage();
});

// Common Indian city & work-mode synonyms for smart matching
const LOCATION_ALIASES = {
  'bangalore': ['bengaluru', 'bangalore rural', 'bangalore urban'],
  'bengaluru': ['bangalore', 'bengaluru rural', 'bengaluru urban'],
  'remote': ['work from home', 'wfh', 'anywhere in india', 'pan india', 'remote in india'],
  'work from home': ['remote', 'wfh'],
  'wfh': ['remote', 'work from home'],
  'hybrid': ['hybrid work', 'hybrid - bengaluru', 'hybrid - bangalore'],
  'gurgaon': ['gurugram'],
  'gurugram': ['gurgaon'],
  'mumbai': ['bombay', 'navi mumbai'],
  'bombay': ['mumbai'],
  'kolkata': ['calcutta'],
  'calcutta': ['kolkata'],
  'chennai': ['madras'],
  'madras': ['chennai'],
  'delhi': ['delhi / ncr', 'delhi ncr', 'new delhi'],
  'ncr': ['delhi / ncr', 'delhi ncr']
};

// Common filler words to ignore when extracting quick title keyword chips
const TITLE_STOP_WORDS = new Set([
  'and', 'for', 'with', 'the', 'yrs', 'years', 'exp', 'hiring', 'urgent',
  'opening', 'immediate', 'joiner', 'required', 'requirement', 'looking',
  'top', 'mnc', 'remote', 'hybrid', 'all', 'areas', 'day', 'days', 'shift',
  'male', 'female', 'only', 'lead', 'fresher', 'freshers'
]);

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
      const clone = el.cloneNode(true);
      const ratings = clone.querySelectorAll('.rating, .starRating, .reviews, span, i, em');
      ratings.forEach(r => r.remove());
      
      let name = clone.textContent.trim();
      name = name.replace(/\s+\d+(\.\d+)?\s*$/, '').trim();
      name = name.replace(/\s*Reviews\s*$/i, '').trim();
      name = name.replace(/\s+/g, ' ');

      if (name) return name;
    }
  }

  const compInfo = cardElement.querySelector('.companyInfo');
  if (compInfo) {
    let text = compInfo.textContent.trim();
    text = text.replace(/\d+(\.\d+)?\s*Reviews.*$/i, '').trim();
    if (text) return text;
  }

  return null;
}

// Clean and extract job location from the card element
function getJobLocation(cardElement) {
  const selectors = [
    'span.loc-wrap span.loc',
    'span.loc-wrap span.locWdth',
    'span.loc-wrap',
    'span.locWdth',
    'span.loc',
    '[class*="locWdth"]',
    'span[class*="location"]',
    'li.location span.loc',
    'li.location',
    '.location',
    'a[href*="/jobs-in-"]',
    '[class*="location-wrap"]'
  ];

  for (const selector of selectors) {
    const el = cardElement.querySelector(selector);
    if (el) {
      const titleAttr = el.getAttribute('title');
      if (titleAttr && titleAttr.trim()) {
        return titleAttr.trim();
      }

      const clone = el.cloneNode(true);
      const toRemove = clone.querySelectorAll('i, svg, em, span.icon, [class*="icon"]');
      toRemove.forEach(r => r.remove());

      let loc = clone.textContent.trim();
      loc = loc.replace(/\s+/g, ' ');
      if (loc) return loc;
    }
  }

  const locIcon = cardElement.querySelector('i.ni-job-tuple-icon-srp-location, [class*="icon-srp-location"]');
  if (locIcon && locIcon.parentElement) {
    const clone = locIcon.parentElement.cloneNode(true);
    const toRemove = clone.querySelectorAll('i, svg, em');
    toRemove.forEach(r => r.remove());
    const text = clone.textContent.trim();
    if (text) return text.replace(/\s+/g, ' ');
  }

  return null;
}

// Clean and extract job title from the card element
function getJobTitle(cardElement) {
  const selectors = [
    'a.title',
    'a[class*="title"]',
    '.job-title',
    '.title',
    'h2 a',
    'a[href*="/job-listings-"]'
  ];

  for (const selector of selectors) {
    const el = cardElement.querySelector(selector);
    if (el) {
      const titleAttr = el.getAttribute('title');
      if (titleAttr && titleAttr.trim()) {
        return titleAttr.trim();
      }

      const clone = el.cloneNode(true);
      const toRemove = clone.querySelectorAll('i, svg, em, span.icon, [class*="icon"]');
      toRemove.forEach(r => r.remove());

      let title = clone.textContent.trim();
      title = title.replace(/\s+/g, ' ');
      if (title) return title;
    }
  }

  return null;
}

// Boundary-aware matching (prevents "Java" matching "JavaScript", "React" matching "Reactive", etc.)
function matchesTerm(haystack, term) {
  if (!haystack || !term) return false;
  const h = haystack.toLowerCase().trim();
  const t = term.toLowerCase().trim();
  if (h === t) return true;

  try {
    const escaped = t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp('(^|[^a-zA-Z0-9+#])' + escaped + '([^a-zA-Z0-9+#]|$)', 'i');
    return regex.test(h);
  } catch (e) {
    return h.includes(t);
  }
}

// Check if a company name is on the blocklist
function isBlocked(companyName) {
  if (!companyName || blockedCompanies.length === 0) return false;
  const lowerName = companyName.toLowerCase().trim();
  
  return blockedCompanies.some(blocked => {
    if (!blocked) return false;
    return matchesTerm(lowerName, blocked);
  });
}

// Check if a location matches any blocked locations
function isLocationBlocked(locationStr) {
  if (!locationStr || blockedLocations.length === 0) return false;
  const lowerLoc = locationStr.toLowerCase().trim();

  return blockedLocations.some(blocked => {
    if (!blocked) return false;
    const cleanBlocked = blocked.toLowerCase().trim();

    if (matchesTerm(lowerLoc, cleanBlocked)) return true;

    const aliases = LOCATION_ALIASES[cleanBlocked];
    if (aliases && aliases.some(alias => matchesTerm(lowerLoc, alias))) {
      return true;
    }

    return false;
  });
}

// Check if a location satisfies Target Locations requirement (Allowlist / Whitelist)
function isLocationAllowedByTarget(locationStr, cardElement) {
  if (!targetLocations || targetLocations.length === 0) return true;

  let loc = (locationStr || '').toLowerCase().trim();
  if (cardElement) {
    // Also include work-mode tags on card (e.g. "Remote", "Hybrid", "WFH")
    const modeEls = cardElement.querySelectorAll('[class*="work-mode"], [class*="workMode"], [class*="wfh"], [class*="mode"], .ni-job-tuple-icon-srp-wfh');
    modeEls.forEach(el => {
      if (el.textContent) {
        loc += ' ' + el.textContent.toLowerCase().trim();
      }
    });
  }

  if (!loc) return false;

  return targetLocations.some(target => {
    if (!target) return false;
    const cleanTarget = target.toLowerCase().trim();

    if (matchesTerm(loc, cleanTarget)) return true;

    const aliases = LOCATION_ALIASES[cleanTarget];
    if (aliases && aliases.some(alias => matchesTerm(loc, alias))) {
      return true;
    }

    return false;
  });
}

// Check if a job title satisfies Target Titles requirement (Allowlist / Whitelist)
function isTitleAllowedByTarget(jobTitle, cardElement) {
  if (!targetTitles || targetTitles.length === 0) return true;
  if (!jobTitle) return false;

  const lowerTitle = jobTitle.toLowerCase().trim();

  return targetTitles.some(target => {
    if (!target) return false;
    const cleanTarget = target.toLowerCase().trim();
    return matchesTerm(lowerTitle, cleanTarget);
  });
}

// Check if a job title matches any blocked title keywords
function isTitleBlocked(jobTitle) {
  if (!jobTitle || blockedTitles.length === 0) return null;
  const lowerTitle = jobTitle.toLowerCase().trim();

  for (const blocked of blockedTitles) {
    if (!blocked) continue;
    const cleanBlocked = blocked.toLowerCase().trim();
    if (matchesTerm(lowerTitle, cleanBlocked)) {
      return cleanBlocked;
    }
  }

  return null;
}

// Inject the Block button next to the company name in the card
function injectBlockButton(card, companyName) {
  if (card.querySelector('.naukri-block-comp-btn')) return;

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
  btn.className = 'naukri-block-btn naukri-block-comp-btn';
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

  compEl.parentNode.insertBefore(btn, compEl.nextSibling);
}

// Inject the Exclude Loc button next to the location in the card
function injectLocationBlockButton(card, locationStr) {
  if (card.querySelector('.naukri-block-loc-btn')) return;

  const selectors = [
    'span.loc-wrap',
    'span.locWdth',
    'span.loc',
    '[class*="locWdth"]',
    'span[class*="location"]',
    'li.location',
    '.location'
  ];

  let locEl = null;
  for (const selector of selectors) {
    locEl = card.querySelector(selector);
    if (locEl) break;
  }

  if (!locEl) return;

  const btn = document.createElement('button');
  btn.className = 'naukri-block-btn naukri-block-loc-btn';
  btn.title = `Exclude location: ${locationStr}`;
  btn.type = 'button';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none" class="naukri-block-icon">
      <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
      <circle cx="12" cy="10" r="3"/>
      <line x1="4" y1="4" x2="20" y2="20"/>
    </svg>
    <span>Exclude Loc</span>
  `;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleLocationBlockClick(locationStr, btn);
  });

  locEl.parentNode.insertBefore(btn, locEl.nextSibling);
}

// Handle clicking the Exclude Location button
function handleLocationBlockClick(locationText, btn) {
  const existingPopover = document.querySelector('.naukri-loc-popover');
  if (existingPopover) {
    existingPopover.remove();
  }

  const rawParts = locationText.split(/[,/|]/).map(p => p.trim()).filter(p => p.length > 1);
  const cities = [...new Set(rawParts)];

  if (cities.length <= 1) {
    addLocationToBlocklist(cities[0] || locationText);
    return;
  }

  const popover = document.createElement('div');
  popover.className = 'naukri-loc-popover';

  const title = document.createElement('div');
  title.className = 'naukri-loc-popover-title';
  title.textContent = 'Exclude which location?';
  popover.appendChild(title);

  const chipsContainer = document.createElement('div');
  chipsContainer.className = 'naukri-loc-popover-chips';

  cities.forEach(city => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'naukri-loc-chip';
    chip.textContent = city;
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.remove();
      addLocationToBlocklist(city);
    });
    chipsContainer.appendChild(chip);
  });

  const allChip = document.createElement('button');
  allChip.type = 'button';
  allChip.className = 'naukri-loc-chip all';
  allChip.textContent = 'Exclude All';
  allChip.addEventListener('click', (e) => {
    e.stopPropagation();
    popover.remove();
    cities.forEach(c => addLocationToBlocklist(c, false));
    showToast(`Excluded all ${cities.length} locations`);
    scanPage();
  });
  chipsContainer.appendChild(allChip);

  popover.appendChild(chipsContainer);

  const rect = btn.getBoundingClientRect();
  popover.style.top = `${window.scrollY + rect.bottom + 4}px`;
  popover.style.left = `${window.scrollX + rect.left}px`;

  document.body.appendChild(popover);

  const dismissHandler = (e) => {
    if (!popover.contains(e.target) && e.target !== btn) {
      popover.remove();
      document.removeEventListener('click', dismissHandler);
    }
  };
  setTimeout(() => {
    document.addEventListener('click', dismissHandler);
  }, 10);
}

// Inject Exclude Title button next to job title in the card
function injectTitleBlockButton(card, titleStr) {
  if (card.querySelector('.naukri-block-title-btn')) return;

  const selectors = [
    'a.title',
    'a[class*="title"]',
    '.job-title',
    '.title',
    'h2 a',
    'a[href*="/job-listings-"]'
  ];

  let titleEl = null;
  for (const selector of selectors) {
    titleEl = card.querySelector(selector);
    if (titleEl) break;
  }

  if (!titleEl) return;

  const btn = document.createElement('button');
  btn.className = 'naukri-block-btn naukri-block-title-btn';
  btn.title = `Exclude keyword from title: ${titleStr}`;
  btn.type = 'button';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none" class="naukri-block-icon">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
    <span>Exclude Title</span>
  `;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleTitleBlockClick(titleStr, btn);
  });

  titleEl.parentNode.insertBefore(btn, titleEl.nextSibling);
}

// Handle clicking Exclude Title button
function handleTitleBlockClick(titleText, btn) {
  const existingPopover = document.querySelector('.naukri-loc-popover');
  if (existingPopover) {
    existingPopover.remove();
  }

  const rawWords = titleText.split(/[\s,/|()\-+:]+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2 && !TITLE_STOP_WORDS.has(w.toLowerCase()));

  const seen = new Set();
  const keywords = [];
  for (const word of rawWords) {
    const lower = word.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      keywords.push(word);
    }
  }

  if (keywords.length === 0) {
    keywords.push(titleText);
  }

  const popover = document.createElement('div');
  popover.className = 'naukri-loc-popover';

  const titleEl = document.createElement('div');
  titleEl.className = 'naukri-loc-popover-title';
  titleEl.textContent = 'Exclude which title keyword?';
  popover.appendChild(titleEl);

  const chipsContainer = document.createElement('div');
  chipsContainer.className = 'naukri-loc-popover-chips';

  keywords.slice(0, 8).forEach(kw => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'naukri-loc-chip title';
    chip.textContent = kw;
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.remove();
      addTitleToBlocklist(kw);
    });
    chipsContainer.appendChild(chip);
  });

  popover.appendChild(chipsContainer);

  // Quick Target Option
  const targetDivider = document.createElement('div');
  targetDivider.className = 'naukri-loc-popover-title';
  targetDivider.style.marginTop = '6px';
  targetDivider.textContent = 'Or keep / target:';
  popover.appendChild(targetDivider);

  const targetChipsContainer = document.createElement('div');
  targetChipsContainer.className = 'naukri-loc-popover-chips';

  keywords.slice(0, 4).forEach(kw => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'naukri-loc-chip';
    chip.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    chip.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
    chip.style.color = '#6ee7b7';
    chip.textContent = `+ Target "${kw}"`;
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.remove();
      addTitleToTarget(kw);
    });
    targetChipsContainer.appendChild(chip);
  });

  popover.appendChild(targetChipsContainer);

  const rect = btn.getBoundingClientRect();
  popover.style.top = `${window.scrollY + rect.bottom + 4}px`;
  popover.style.left = `${window.scrollX + rect.left}px`;

  document.body.appendChild(popover);

  const dismissHandler = (e) => {
    if (!popover.contains(e.target) && e.target !== btn) {
      popover.remove();
      document.removeEventListener('click', dismissHandler);
    }
  };
  setTimeout(() => {
    document.addEventListener('click', dismissHandler);
  }, 10);
}

// Extract job ID from card element
function getJobId(card) {
  if (card.dataset.jobId) return card.dataset.jobId;
  const link = card.querySelector('a[href*="/job-listings-"], a.title');
  if (link && link.href) {
    const m = link.href.match(/-(\d{8,14})(?:\?|$)/) || link.href.match(/jobId=(\d+)/) || link.href.match(/-(\d+)(?:\?|$)/);
    if (m) {
      card.dataset.jobId = m[1];
      return m[1];
    }
  }
  if (card.id) {
    const m = card.id.match(/\d{8,14}/);
    if (m) {
      card.dataset.jobId = m[0];
      return m[0];
    }
  }
  const custId = card.getAttribute('cust-id');
  if (custId) {
    card.dataset.jobId = custId;
    return custId;
  }
  return null;
}

// Inject exact applicant count, openings, and views badge
function injectCardStats(card, stats) {
  let statsEl = card.querySelector('.naukri-card-stats');
  if (!statsEl) {
    statsEl = document.createElement('div');
    statsEl.className = 'naukri-card-stats';
    const targetParent = card.querySelector('.job-desc, .row3, .row2, .companyInfo') || card;
    if (targetParent !== card && targetParent.parentNode) {
      targetParent.parentNode.insertBefore(statsEl, targetParent.nextSibling);
    } else {
      card.appendChild(statsEl);
    }
  }

  const parts = [];
  if (stats.applyCount !== undefined) {
    parts.push(`<span class="naukri-stat-badge applicants" title="Exact Applicants from Naukri API">👥 <strong>${Number(stats.applyCount).toLocaleString()}</strong> applicants</span>`);
  }
  if (stats.vacancy !== undefined && stats.vacancy > 0) {
    parts.push(`<span class="naukri-stat-badge openings" title="Openings">🎯 <strong>${stats.vacancy}</strong> opening${stats.vacancy > 1 ? 's' : ''}</span>`);
  }
  if (stats.views) {
    parts.push(`<span class="naukri-stat-badge views" title="Total Views">👁️ ${Number(stats.views).toLocaleString()} views</span>`);
  }

  statsEl.innerHTML = parts.join('');
}

// Update rounded applicant text on job details page (/job-listings-... or /job/...)
function updateJobDetailsPage() {
  let stats = latestActiveJobStats;
  if (!stats) {
    const m = window.location.pathname.match(/-(\d{8,14})(?:\?|$)/) || window.location.href.match(/jobId=(\d+)/);
    if (m && jobStatsMap.has(m[1])) {
      stats = jobStatsMap.get(m[1]);
    }
  }
  if (!stats || stats.applyCount === undefined) return;

  const formatted = Number(stats.applyCount).toLocaleString();

  // 1. Walk through all text nodes to find and replace rounded counts
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue;
    if (!text || text.length < 2) continue;

    if (/(?:\d+\+|Less than \d+)\s*Applicants/i.test(text)) {
      node.nodeValue = text.replace(/(?:\d+\+|Less than \d+)\s*Applicants/gi, `${formatted} Applicants`);
    } else if (/Applicants\s*:\s*(?:\d+\+|Less than \d+)/i.test(text)) {
      node.nodeValue = text.replace(/Applicants\s*:\s*(?:\d+\+|Less than \d+)/gi, `Applicants: ${formatted}`);
    } else if (/^\s*(?:\d+\+|Less than \d+)\s*$/i.test(text)) {
      const parent = node.parentElement;
      const container = parent ? (parent.closest('[class*="stat"], [class*="appl"], [class*="jhc"]') || parent.parentElement) : null;
      const containerText = container ? container.textContent : (parent ? parent.textContent : '');
      const prevText = parent?.previousElementSibling?.textContent || '';
      if (/applicant/i.test(containerText) || /applicant/i.test(prevText)) {
        node.nodeValue = node.nodeValue.replace(/(?:\d+\+|Less than \d+)/i, formatted);
      }
    }
  }

  // 2. Inject Views stat if present in API payload and not already displayed
  const statsContainer = document.querySelector('[class*="jd-stats"]');
  if (statsContainer && stats.views && !statsContainer.querySelector('.better-naukri-views')) {
    const viewStat = document.createElement('span');
    viewStat.className = 'styles_jhc__stat__PgY67 better-naukri-views';
    viewStat.innerHTML = `<label>Views: </label><span>${Number(stats.views).toLocaleString()}</span>`;
    statsContainer.appendChild(viewStat);
  }
}

// Process a single job card element
function processCard(card) {
  const company = card.dataset.companyName || getCompanyName(card);
  const location = card.dataset.jobLocation || getJobLocation(card);
  const title = card.dataset.jobTitle || getJobTitle(card);

  card.dataset.naukriFiltered = "true";

  if (company) {
    card.dataset.companyName = company;
    injectBlockButton(card, company);
  }

  if (location) {
    card.dataset.jobLocation = location;
    injectLocationBlockButton(card, location);
  }

  if (title) {
    card.dataset.jobTitle = title;
    injectTitleBlockButton(card, title);
  }

  const jobId = getJobId(card);
  if (jobId && jobStatsMap.has(jobId)) {
    injectCardStats(card, jobStatsMap.get(jobId));
  }

  const companyBlocked = isBlocked(company);

  let locationBlocked = false;
  let locationReason = "";

  if (targetLocations.length > 0) {
    const isTarget = isLocationAllowedByTarget(location, card);
    if (!isTarget) {
      locationBlocked = true;
      locationReason = `📍 Not in target [${targetLocations.join(', ')}]`;
    }
  } else if (isLocationBlocked(location)) {
    locationBlocked = true;
    locationReason = `📍 Excluded: ${location}`;
  }

  let titleBlocked = false;
  let titleReason = "";

  if (targetTitles.length > 0) {
    const isTargetTitle = isTitleAllowedByTarget(title, card);
    if (!isTargetTitle) {
      titleBlocked = true;
      titleReason = `💼 Not in target titles [${targetTitles.join(', ')}]`;
    } else {
      const matchedBlocked = isTitleBlocked(title);
      if (matchedBlocked) {
        titleBlocked = true;
        titleReason = `💼 Excluded title: ${matchedBlocked}`;
      }
    }
  } else {
    const matchedBlocked = isTitleBlocked(title);
    if (matchedBlocked) {
      titleBlocked = true;
      titleReason = `💼 Excluded title: ${matchedBlocked}`;
    }
  }

  if (filterEnabled && (companyBlocked || locationBlocked || titleBlocked)) {
    card.classList.add('naukri-blocked-card');

    const reasons = [];
    if (companyBlocked) reasons.push(`🏢 ${company}`);
    if (locationBlocked) reasons.push(locationReason);
    if (titleBlocked) reasons.push(titleReason);

    card.setAttribute('data-blocked-badge', `🚫 Excluded: ${reasons.join(' • ')}`);
    card.dataset.blockedCompanyFlag = companyBlocked ? "true" : "false";
    card.dataset.blockedLocationFlag = locationBlocked ? "true" : "false";
    card.dataset.blockedTitleFlag = titleBlocked ? "true" : "false";
    card.dataset.blockedTitleReason = titleReason || "";
  } else {
    card.classList.remove('naukri-blocked-card');
    card.removeAttribute('data-blocked-badge');
    delete card.dataset.blockedCompanyFlag;
    delete card.dataset.blockedLocationFlag;
    delete card.dataset.blockedTitleFlag;
    delete card.dataset.blockedTitleReason;
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
  const totalSavedRules = blockedCompanies.length + blockedLocations.length + blockedTitles.length + targetLocations.length + targetTitles.length;

  if (!widgetElement) {
    widgetElement = document.createElement('div');
    widgetElement.id = 'naukri-filter-widget';
    widgetElement.className = 'naukri-filter-widget';
    
    widgetElement.innerHTML = `
      <div class="naukri-widget-header" id="naukri-widget-header">
        <div class="naukri-widget-title">
          <span class="naukri-widget-icon" id="naukri-widget-icon">🚫</span>
          <span class="naukri-widget-count" id="naukri-widget-count">0 jobs filtered</span>
        </div>
        <div class="naukri-widget-header-right">
          <button id="naukri-widget-quick-resume" class="naukri-header-resume-btn" type="button" style="display:none;" title="Click to resume filtering">Resume</button>
          <span class="naukri-widget-arrow" id="naukri-widget-arrow">▲</span>
        </div>
      </div>
      <div class="naukri-widget-body" id="naukri-widget-body">
        <div class="naukri-widget-label" id="naukri-widget-label">Filtered on this page:</div>
        <div class="naukri-widget-list" id="naukri-widget-list"></div>
        <div class="naukri-widget-actions">
          <button id="naukri-widget-toggle" class="naukri-widget-btn secondary">Show Blocked</button>
          <button id="naukri-widget-pause" class="naukri-widget-btn pause">Pause</button>
          <button id="naukri-widget-settings" class="naukri-widget-btn primary">Manage</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(widgetElement);

    const header = widgetElement.querySelector('#naukri-widget-header');
    header.addEventListener('click', (e) => {
      if (e.target.closest('#naukri-widget-quick-resume')) return;
      widgetElement.classList.toggle('expanded');
    });

    const quickResumeBtn = widgetElement.querySelector('#naukri-widget-quick-resume');
    quickResumeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.storage.local.set({ filterEnabled: true }, () => {
        showToast('Filtering resumed');
      });
    });

    const toggleBtn = widgetElement.querySelector('#naukri-widget-toggle');
    toggleBtn.addEventListener('click', () => {
      const isShowing = document.body.classList.toggle('naukri-show-blocked-cards');
      toggleBtn.textContent = isShowing ? 'Hide Blocked' : 'Show Blocked';
      toggleBtn.classList.toggle('active', isShowing);
    });

    const pauseBtn = widgetElement.querySelector('#naukri-widget-pause');
    pauseBtn.addEventListener('click', () => {
      const nextState = !filterEnabled;
      chrome.storage.local.set({ filterEnabled: nextState }, () => {
        if (nextState) {
          showToast('Filtering resumed');
        } else {
          showToast('Filtering paused. All jobs visible.', 'Resume', () => {
            chrome.storage.local.set({ filterEnabled: true });
          });
        }
      });
    });

    const settingsBtn = widgetElement.querySelector('#naukri-widget-settings');
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: "open_options" });
    });
  }

  const countEl = widgetElement.querySelector('#naukri-widget-count');
  const iconEl = widgetElement.querySelector('#naukri-widget-icon');
  const quickResumeBtn = widgetElement.querySelector('#naukri-widget-quick-resume');
  const pauseBtn = widgetElement.querySelector('#naukri-widget-pause');
  const toggleBtn = widgetElement.querySelector('#naukri-widget-toggle');
  const labelEl = widgetElement.querySelector('#naukri-widget-label');
  const listEl = widgetElement.querySelector('#naukri-widget-list');

  // Handle paused filter state
  if (!filterEnabled) {
    widgetElement.classList.add('paused');
    iconEl.textContent = '⏸️';
    countEl.textContent = 'Filter Paused';
    quickResumeBtn.style.display = 'inline-flex';
    pauseBtn.textContent = 'Resume Filter';
    pauseBtn.className = 'naukri-widget-btn resume';
    toggleBtn.style.display = 'none';

    labelEl.textContent = 'Status:';
    listEl.innerHTML = `
      <div class="naukri-widget-paused-info">
        <p><strong>Filtering is paused.</strong> All jobs are visible.</p>
        <p style="margin-top: 6px; font-size: 11px; opacity: 0.85;">${totalSavedRules} exclusion rule${totalSavedRules === 1 ? '' : 's'} saved in your list.</p>
      </div>
    `;

    if (totalSavedRules === 0) {
      widgetElement.classList.add('empty');
    } else {
      widgetElement.classList.remove('empty');
    }
    return;
  }

  // Active filter state
  widgetElement.classList.remove('paused');
  iconEl.textContent = '🚫';
  quickResumeBtn.style.display = 'none';
  pauseBtn.textContent = 'Pause';
  pauseBtn.className = 'naukri-widget-btn pause';
  toggleBtn.style.display = 'inline-flex';
  labelEl.textContent = 'Filtered on this page:';

  const blockedCards = document.querySelectorAll('.naukri-blocked-card');
  const count = blockedCards.length;

  countEl.textContent = `${count} job${count === 1 ? '' : 's'} filtered`;

  if (count === 0) {
    widgetElement.classList.add('empty');
  } else {
    widgetElement.classList.remove('empty');
  }

  // Group counts for summary list
  const companyCounts = {};
  const locationCounts = {};
  const titleCounts = {};

  blockedCards.forEach(card => {
    const compBlocked = card.dataset.blockedCompanyFlag === "true";
    const locBlocked = card.dataset.blockedLocationFlag === "true";
    const titleBlocked = card.dataset.blockedTitleFlag === "true";
    const titleReason = card.dataset.blockedTitleReason;

    const comp = card.dataset.companyName;
    const loc = card.dataset.jobLocation;

    if (compBlocked && comp) {
      companyCounts[comp] = (companyCounts[comp] || 0) + 1;
    }
    if (locBlocked && loc) {
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    }
    if (titleBlocked && titleReason) {
      titleCounts[titleReason] = (titleCounts[titleReason] || 0) + 1;
    }
  });

  listEl.innerHTML = '';
  const sortedCompanies = Object.entries(companyCounts).sort((a, b) => b[1] - a[1]);
  const sortedLocations = Object.entries(locationCounts).sort((a, b) => b[1] - a[1]);
  const sortedTitles = Object.entries(titleCounts).sort((a, b) => b[1] - a[1]);

  if (sortedCompanies.length === 0 && sortedLocations.length === 0 && sortedTitles.length === 0) {
    listEl.innerHTML = '<div class="naukri-empty-list-msg">No blocked jobs visible on this page.</div>';
  } else {
    sortedCompanies.forEach(([company, num]) => {
      const item = document.createElement('div');
      item.className = 'naukri-widget-list-item';
      item.innerHTML = `
        <span class="naukri-item-name" title="Company: ${company}">🏢 ${company}</span>
        <span class="naukri-item-count">${num}</span>
      `;
      listEl.appendChild(item);
    });

    sortedLocations.forEach(([loc, num]) => {
      const item = document.createElement('div');
      item.className = 'naukri-widget-list-item';
      item.innerHTML = `
        <span class="naukri-item-name" title="Location: ${loc}">📍 ${loc}</span>
        <span class="naukri-item-count loc">${num}</span>
      `;
      listEl.appendChild(item);
    });

    sortedTitles.forEach(([reason, num]) => {
      const item = document.createElement('div');
      item.className = 'naukri-widget-list-item';
      item.innerHTML = `
        <span class="naukri-item-name" title="${reason}">${reason}</span>
        <span class="naukri-item-count title">${num}</span>
      `;
      listEl.appendChild(item);
    });
  }
}

// Storage helpers for companies
function addCompanyToBlocklist(companyName) {
  const cleanName = companyName.trim();
  if (!cleanName) return;

  chrome.storage.local.get({ blockedCompanies: [] }, (result) => {
    const list = result.blockedCompanies || [];
    const exists = list.some(c => c.toLowerCase() === cleanName.toLowerCase());
    
    if (!exists) {
      list.push(cleanName);
      chrome.storage.local.set({ blockedCompanies: list }, () => {
        blockedCompanies = list.map(c => c.toLowerCase().trim());
        showToast(`Blocked company: ${cleanName}`, 'Undo', () => {
          removeCompanyFromBlocklist(cleanName);
        });
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
    const list = (result.blockedCompanies || []).filter(c => c.toLowerCase() !== cleanName.toLowerCase());
    chrome.storage.local.set({ blockedCompanies: list }, () => {
      blockedCompanies = list.map(c => c.toLowerCase().trim());
      showToast(`Unblocked company: ${cleanName}`);
      
      const cards = document.querySelectorAll('[data-naukri-filtered]');
      cards.forEach(card => card.removeAttribute('data-naukri-filtered'));
      scanPage();
    });
  });
}

// Storage helpers for locations
function addLocationToBlocklist(locationName, triggerScan = true) {
  const cleanName = locationName.trim();
  if (!cleanName) return;

  chrome.storage.local.get({ blockedLocations: [] }, (result) => {
    const list = result.blockedLocations || [];
    const exists = list.some(l => l.toLowerCase() === cleanName.toLowerCase());

    if (!exists) {
      list.push(cleanName);
      chrome.storage.local.set({ blockedLocations: list }, () => {
        blockedLocations = list.map(l => l.toLowerCase().trim());
        if (triggerScan) {
          showToast(`Excluded location: ${cleanName}`, 'Undo', () => {
            removeLocationFromBlocklist(cleanName);
          });
          scanPage();
        }
      });
    } else if (triggerScan) {
      showToast(`"${cleanName}" is already excluded`);
    }
  });
}

function removeLocationFromBlocklist(locationName) {
  const cleanName = locationName.trim();
  chrome.storage.local.get({ blockedLocations: [] }, (result) => {
    const list = (result.blockedLocations || []).filter(l => l.toLowerCase() !== cleanName.toLowerCase());
    chrome.storage.local.set({ blockedLocations: list }, () => {
      blockedLocations = list.map(l => l.toLowerCase().trim());
      showToast(`Restored location: ${cleanName}`);

      const cards = document.querySelectorAll('[data-naukri-filtered]');
      cards.forEach(card => card.removeAttribute('data-naukri-filtered'));
      scanPage();
    });
  });
}

// Storage helpers for title keywords
function addTitleToBlocklist(keyword, triggerScan = true) {
  const cleanKeyword = keyword.trim();
  if (!cleanKeyword) return;

  chrome.storage.local.get({ blockedTitles: [] }, (result) => {
    const list = result.blockedTitles || [];
    const exists = list.some(k => k.toLowerCase() === cleanKeyword.toLowerCase());

    if (!exists) {
      list.push(cleanKeyword);
      chrome.storage.local.set({ blockedTitles: list }, () => {
        blockedTitles = list.map(k => k.toLowerCase().trim());
        if (triggerScan) {
          showToast(`Excluded title keyword: ${cleanKeyword}`, 'Undo', () => {
            removeTitleFromBlocklist(cleanKeyword);
          });
          scanPage();
        }
      });
    } else if (triggerScan) {
      showToast(`"${cleanKeyword}" is already excluded`);
    }
  });
}

function removeTitleFromBlocklist(keyword) {
  const cleanKeyword = keyword.trim();
  chrome.storage.local.get({ blockedTitles: [] }, (result) => {
    const list = (result.blockedTitles || []).filter(k => k.toLowerCase() !== cleanKeyword.toLowerCase());
    chrome.storage.local.set({ blockedTitles: list }, () => {
      blockedTitles = list.map(k => k.toLowerCase().trim());
      showToast(`Restored title keyword: ${cleanKeyword}`);

      const cards = document.querySelectorAll('[data-naukri-filtered]');
      cards.forEach(card => card.removeAttribute('data-naukri-filtered'));
      scanPage();
    });
  });
}

// Storage helpers for target titles (allowlist)
function addTitleToTarget(keyword, triggerScan = true) {
  const cleanKeyword = keyword.trim();
  if (!cleanKeyword) return;

  chrome.storage.local.get({ targetTitles: [] }, (result) => {
    const list = result.targetTitles || [];
    const exists = list.some(k => k.toLowerCase() === cleanKeyword.toLowerCase());

    if (!exists) {
      list.push(cleanKeyword);
      chrome.storage.local.set({ targetTitles: list }, () => {
        targetTitles = list.map(k => k.toLowerCase().trim());
        if (triggerScan) {
          showToast(`Added target title: ${cleanKeyword}`, 'Undo', () => {
            removeTitleFromTarget(cleanKeyword);
          });
          scanPage();
        }
      });
    } else if (triggerScan) {
      showToast(`"${cleanKeyword}" is already a target title`);
    }
  });
}

function removeTitleFromTarget(keyword) {
  const cleanKeyword = keyword.trim();
  chrome.storage.local.get({ targetTitles: [] }, (result) => {
    const list = (result.targetTitles || []).filter(k => k.toLowerCase() !== cleanKeyword.toLowerCase());
    chrome.storage.local.set({ targetTitles: list }, () => {
      targetTitles = list.map(k => k.toLowerCase().trim());
      showToast(`Removed target title: ${cleanKeyword}`);

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
  chrome.storage.local.get({ blockedCompanies: [], blockedLocations: [], blockedTitles: [], targetLocations: [], targetTitles: [], filterEnabled: true }, (result) => {
    filterEnabled = result.filterEnabled !== false;
    blockedCompanies = (result.blockedCompanies || []).map(c => c.toLowerCase().trim());
    blockedLocations = (result.blockedLocations || []).map(l => l.toLowerCase().trim());
    blockedTitles = (result.blockedTitles || []).map(t => t.toLowerCase().trim());
    targetLocations = (result.targetLocations || []).map(l => l.toLowerCase().trim());
    targetTitles = (result.targetTitles || []).map(t => t.toLowerCase().trim());
    
    scanPage();
    updateJobDetailsPage();
    
    const observer = new MutationObserver(() => {
      if (scanTimeout) clearTimeout(scanTimeout);
      scanTimeout = setTimeout(() => {
        scanPage();
        updateJobDetailsPage();
      }, 150);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.addEventListener('popstate', () => {
      setTimeout(updateJobDetailsPage, 200);
    });
  });
}

// React to storage changes from the extension popup
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    let changed = false;
    if (changes.filterEnabled !== undefined) {
      filterEnabled = changes.filterEnabled.newValue !== false;
      changed = true;
    }
    if (changes.blockedCompanies) {
      blockedCompanies = (changes.blockedCompanies.newValue || []).map(c => c.toLowerCase().trim());
      changed = true;
    }
    if (changes.blockedLocations) {
      blockedLocations = (changes.blockedLocations.newValue || []).map(l => l.toLowerCase().trim());
      changed = true;
    }
    if (changes.targetLocations) {
      targetLocations = (changes.targetLocations.newValue || []).map(l => l.toLowerCase().trim());
      changed = true;
    }
    if (changes.targetTitles) {
      targetTitles = (changes.targetTitles.newValue || []).map(t => t.toLowerCase().trim());
      changed = true;
    }
    if (changes.blockedTitles) {
      blockedTitles = (changes.blockedTitles.newValue || []).map(t => t.toLowerCase().trim());
      changed = true;
    }

    if (changed) {
      const cards = document.querySelectorAll('[data-naukri-filtered]');
      cards.forEach(card => card.removeAttribute('data-naukri-filtered'));
      scanPage();
    }
  }
});

// Run
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
