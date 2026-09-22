// Intercepts Naukri's internal jobapi responses to extract exact applicant counts and openings
(function() {
  function saveAndDispatch(detail) {
    try {
      let el = document.getElementById('better-naukri-data');
      if (!el) {
        el = document.createElement('script');
        el.id = 'better-naukri-data';
        el.type = 'application/json';
        (document.head || document.documentElement).appendChild(el);
      }
      let merged = detail;
      if (el.textContent) {
        try {
          const prev = JSON.parse(el.textContent);
          merged = { ...prev, ...detail };
          if (detail._activeJob) merged._activeJob = detail._activeJob;
        } catch(e) {}
      }
      el.textContent = JSON.stringify(merged);
    } catch(e) {}
    window.dispatchEvent(new CustomEvent('better-naukri-job-stats', { detail }));
  }

  function parseAndDispatch(data, url) {
    if (!data || typeof data !== 'object') return;

    const stats = {};

    // 1. Check if this is a single job details response (e.g. from job posting page)
    let applyCount = data.applyCount ?? data.appliedCount ?? data.applicantCount ?? data.totalApplicants;
    let vacancy = data.vacancy ?? data.vacancies ?? data.openings ?? data.openingsCount;
    let views = data.viewCount ?? data.views ?? data.viewsCount ?? data.totalViews;
    let jobId = data.jobId || data.id;
    let createdDate = data.createdDate;
    let consultant = data.consultant;
    let hiringFor = data.hiringFor || data.companyDetail?.hiringFor;
    let isKyc = data.isKycSuccessful ?? data.companyDetail?.isKycSuccessful;

    const detail = (data.jobDetails && !Array.isArray(data.jobDetails) && typeof data.jobDetails === 'object') ? data.jobDetails :
                   (data.jobDetail && typeof data.jobDetail === 'object') ? data.jobDetail :
                   (data.jobData && typeof data.jobData === 'object') ? data.jobData : null;
    if (detail) {
      applyCount = applyCount ?? detail.applyCount ?? detail.appliedCount ?? detail.applicantCount ?? detail.totalApplicants;
      vacancy = vacancy ?? detail.vacancy ?? detail.vacancies ?? detail.openings ?? detail.openingsCount;
      views = views ?? detail.viewCount ?? detail.views ?? detail.viewsCount ?? detail.totalViews;
      jobId = jobId ?? (detail.jobId || detail.id);
      createdDate = createdDate ?? detail.createdDate;
      consultant = consultant ?? detail.consultant;
      hiringFor = hiringFor ?? (detail.hiringFor || detail.companyDetail?.hiringFor);
      isKyc = isKyc ?? detail.isKycSuccessful ?? detail.companyDetail?.isKycSuccessful;
    }

    if (applyCount !== undefined || vacancy !== undefined || views !== undefined || createdDate !== undefined) {
      if (!jobId && url) {
        const m = url.match(/\/job\/(\d+)/) || url.match(/-(\d{8,14})/);
        if (m) jobId = m[1];
      }

      const activeJob = {
        applyCount,
        vacancy,
        views,
        jobId: jobId ? String(jobId) : null,
        createdDate: createdDate || null,
        consultant: typeof consultant === 'boolean' ? consultant : null,
        hiringFor: (typeof hiringFor === 'string' && hiringFor.trim()) ? hiringFor.trim() : null,
        isKycSuccessful: typeof isKyc === 'boolean' ? isKyc : null
      };

      if (jobId) {
        stats[String(jobId)] = activeJob;
      }

      saveAndDispatch({ ...stats, _activeJob: activeJob });
      return;
    }

    // 2. Check if this is a bulk search results response (list of jobs)
    const list = Array.isArray(data.jobDetails) ? data.jobDetails : (Array.isArray(data) ? data : []);
    for (const job of list) {
      const id = String(job.jobId || job.id || '');
      const aCount = job.applyCount ?? job.appliedCount ?? job.applicantCount ?? job.totalApplicants;
      const vac = job.vacancy ?? job.vacancies ?? job.openings ?? job.openingsCount;
      const vCount = job.viewCount ?? job.views ?? job.viewsCount ?? job.totalViews;
      if (id && (aCount !== undefined || vac !== undefined || vCount !== undefined || job.createdDate)) {
        stats[id] = {
          applyCount: aCount,
          vacancy: vac,
          views: vCount,
          createdDate: job.createdDate || null,
          consultant: typeof job.consultant === 'boolean' ? job.consultant : null
        };
      }
    }

    if (Object.keys(stats).length > 0) {
      saveAndDispatch(stats);
    }
  }

  function checkUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return lower.includes('jobapi') || lower.includes('job-api') || lower.includes('/job/') || lower.includes('search');
  }

  // Intercept window.fetch
  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = async function(...args) {
      const res = await origFetch.apply(this, args);
      try {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
        if (checkUrl(url)) {
          res.clone().json().then(data => parseAndDispatch(data, url)).catch(() => {});
        }
      } catch (e) {}
      return res;
    };
  }

  // Intercept XMLHttpRequest
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._bnUrl = typeof url === 'string' ? url : '';
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
      try {
        if (checkUrl(this._bnUrl)) {
          parseAndDispatch(JSON.parse(this.responseText), this._bnUrl);
        }
      } catch (e) {}
    });
    return origSend.apply(this, arguments);
  };

  // Also check if initial state is already attached to window
  function checkInitialState() {
    try {
      const state = window.__INITIAL_STATE__ || window.__PRELOADED_STATE__ || window.__NEXT_DATA__;
      if (state) {
        parseAndDispatch(state, window.location.href);
      }
    } catch (e) {}
  }
  setTimeout(checkInitialState, 100);
  setTimeout(checkInitialState, 500);
  setTimeout(checkInitialState, 1500);
})();

