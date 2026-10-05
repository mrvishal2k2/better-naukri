# Privacy Policy for Better Naukri

**Last updated:** October 6, 2026

**Better Naukri** ("we", "our", or "the extension") is an open-source browser extension designed to help job seekers filter unwanted listings, remove spam, and display real applicant metrics on Naukri.com.

We respect your privacy. This extension is built with a **local-first, zero-telemetry** architecture.

---

## 1. Information Collection and Usage

* **No Personal Data Collected:** Better Naukri does **not** collect, store, track, transmit, or sell any personal information, browsing history, login credentials, resumes, or search queries.
* **No External Servers or Analytics:** The extension does **not** communicate with any external servers, third-party APIs, or analytics tracking services (no Google Analytics, no Mixpanel, no remote tracking).
* **Local Storage Only:** All custom settings, blocked company names, target/excluded locations, target/excluded titles, and posting age filter thresholds are stored strictly on your local machine using the Chrome Extension Storage API (`chrome.storage.local`). This data never leaves your browser.

---

## 2. Browser Permissions Explained

Better Naukri requests the absolute minimum permissions required to perform its functions:

| Permission | Purpose |
| :--- | :--- |
| **`storage`** | Used exclusively to save your custom blocklists, whitelist keywords, and filter preferences locally on your device. |
| **`*://*.naukri.com/*`** | Required to inject the content scripts that detect and hide blocked job cards, display exact applicant metrics, and render the on-page floating filter widget on Naukri.com search results. The extension cannot access any other website. |

---

## 3. Data Retention and Deletion

* Because all data resides locally on your device, you have complete control over it at all times.
* You can export or import your settings as a JSON file anytime via the **Settings** tab.
* You can clear any individual filter list or reset all extension data with one click using the **Clear Lists** tool in the Settings tab.
* Uninstalling the extension from your browser instantly and permanently deletes all stored preferences and data.

---

## 4. Changes to This Policy

If we ever make changes to this privacy policy, we will update the "Last updated" date at the top of this document. However, our commitment to zero tracking and 100% local operation will remain unchanged.

---

## 5. Contact & Open Source

Better Naukri is open-source software licensed under the GNU General Public License v3.0 (GPL-3.0). You can review the complete source code or raise questions on GitHub:

* **Repository:** [https://github.com/mrvishal2k2/better-naukri](https://github.com/mrvishal2k2/better-naukri)
* **Issues & Questions:** [https://github.com/mrvishal2k2/better-naukri/issues](https://github.com/mrvishal2k2/better-naukri/issues)
