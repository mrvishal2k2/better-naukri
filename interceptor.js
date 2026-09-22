// Intercepts Naukri's internal jobapi responses to extract exact applicant counts and openings
(function() {
  function parseAndDispatch(data, url) {
    if (!data || typeof data !== 'object') return;

    const stats = {};

    // 1. Check if this is a single job details response (e.g. from job posting page)
    let applyCount = data.applyCount ?? data.appliedCount ?? data.applicantCount ?? data.totalApplicants;
    let vacancy = data.vacancy ?? data.vacancies ?? data.openings ?? data.openingsCount;
    let views = data.viewCount ?? data.views ?? data.viewsCount ?? data.totalViews;
    let jobId = data.jobId || data.id;

    const detail = (data.jobDetails && !Array.isArray(data.jobDetails) && typeof data.jobDetails === 'object') ? data.jobDetails :
                   (data.jobDetail && typeof data.jobDetail === 'object') ? data.jobDetail :
                   (data.jobData && typeof data.jobData === 'object') ? data.jobData : null;
    if (detail) {
      applyCount = applyCount ?? detail.applyCount ?? detail.appliedCount ?? detail.applicantCount ?? detail.totalApplicants;
      vacancy = vacancy ?? detail.vacancy ?? detail.vacancies ?? detail.openings ?? detail.openingsCount;
      views = views ?? detail.viewCount ?? detail.views ?? detail.viewsCount ?? detail.totalViews;
      jobId = jobId ?? (detail.jobId || detail.id);
    }

    if (applyCount !== undefined || vacancy !== undefined || views !== undefined) {
      if (!jobId && url) {
        const m = url.match(/\/job\/(\d+)/) || url.match(/-(\d{8,14})/);
        if (m) jobId = m[1];
      }

      const activeJob = {
        applyCount,
        vacancy,
        views,
        jobId: jobId ? String(jobId) : null
      };

      if (jobId) {
        stats[String(jobId)] = activeJob;
      }

      window.dispatchEvent(new CustomEvent('better-naukri-job-stats', {
        detail: { ...stats, _activeJob: activeJob }
      }));
      return;
    }

    // 2. Check if this is a bulk search results response (list of jobs)
    const list = Array.isArray(data.jobDetails) ? data.jobDetails : (Array.isArray(data) ? data : []);
    for (const job of list) {
      const id = String(job.jobId || job.id || '');
      const aCount = job.applyCount ?? job.appliedCount ?? job.applicantCount ?? job.totalApplicants;
      const vac = job.vacancy ?? job.vacancies ?? job.openings ?? job.openingsCount;
      const vCount = job.viewCount ?? job.views ?? job.viewsCount ?? job.totalViews;
      if (id && (aCount !== undefined || vac !== undefined || vCount !== undefined)) {
        stats[id] = {
          applyCount: aCount,
          vacancy: vac,
          views: vCount
        };
      }
    }

    if (Object.keys(stats).length > 0) {
      window.dispatchEvent(new CustomEvent('better-naukri-job-stats', { detail: stats }));
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

