# 🚀 Better Naukri

> A lightweight, open-source Chrome extension that eliminates spam, consultancy reposts, and irrelevant listings on **Naukri.com**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

---

## 💡 The Problem

Anyone searching for jobs on Naukri.com in India knows the frustration:
* **Duplicate & High-Volume Spam:** High-volume consultancies, third-party staffing agencies, and mass-recruiters often flood search results by reposting identical listings dozens of times across multiple locations.
* **No Company Blocking:** Naukri provides **no built-in way** to block or exclude specific companies.
* **Irrelevant Roles:** Searching for *Frontend Developer* frequently shows *PHP*, *QA Automation*, *Wordpress*, *Technical Support*, or *Intern* positions.
* **Location Mismatch:** Blacklisting 50 different cities is exhausting when you only want to see jobs in *Bangalore* or *Remote*.

**Better Naukri** solves all of that with a clean, 1-click interface directly inside Naukri.

---

## ✨ Features

### 1. 🏢 Company Blocklist
* Block any company with **1-click** using the "Block" button injected next to company names on Naukri search cards.
* Manage your blocklist anytime via the extension popup.
* Instantly hides all postings from blocked companies across all search pages.

### 2. 📍 Target Locations (Whitelist) & Exclusions
* **Target / Keep (Whitelist):** Specify target locations (e.g., `Bangalore`, `Remote`, `Hybrid`). Only postings matching these locations will stay visible.
* **Smart Multi-City Support:** Listings tagged with multiple cities (e.g. *Hyderabad / Bangalore*) automatically stay visible if your target city is included.
* **Excluded Locations (Blacklist):** Or blacklist specific cities you don't want to relocate to (e.g., `Noida`, `Gurgaon`).

### 3. 💼 Target Titles (Whitelist) & Exclusions
* **Target Titles:** Set keywords like `Frontend`, `React`, or `Software Engineer` to only keep matching jobs. Everything else is hidden automatically.
* **Excluded Title Keywords:** Block specific words (e.g. `Intern`, `QA`, `Tester`, `Support`) so roles like *QA Engineer* are filtered even if *Engineer* is targeted.
* **In-Page Title Popover:** Click "Exclude Title" on any card to exclude keywords or click `+ Target` to whitelist keywords on the fly.

### 4. 📊 Floating Dashboard Widget
* A sleek floating pill in the bottom-right of Naukri search pages shows how many jobs have been filtered on the current page.
* Expand to see a live breakdown of filtered companies, locations, and titles.
* Includes a **Show Blocked** toggle (to inspect hidden jobs with visual reason badges) and a **Pause** filter toggle.

### 5. 🔒 100% Private & Local
* Zero analytics, zero trackers, zero external servers.
* All data is stored locally in your browser via `chrome.storage.local`.

---

## 🚀 How to Install (Takes 30 Seconds)

Since this extension is open source, you don't need the Chrome Web Store to use it:

1. **Download the code:**
   * Click the green **Code** button above and select **Download ZIP**, then extract it.
   * *Or clone via git:*
     ```bash
     git clone https://github.com/mrvishal2k2/better-naukri.git
     ```
2. **Open Chrome Extensions:**
   * In your browser, navigate to `chrome://extensions`
3. **Enable Developer Mode:**
   * Toggle the **Developer mode** switch in the top-right corner.
4. **Load the Extension:**
   * Click the **Load unpacked** button in the top-left.
   * Select the folder containing this extension's code.

That's it! Open [Naukri.com](https://www.naukri.com) and start browsing clean search results.

---

## 🤖 Built with AI & Battle-Tested

This project was **100% vibe coded using Gemini 3.8 Flash** to solve a genuine daily frustration while job hunting on Naukri. 

I've been using this extension daily for over a month now, and it drastically improved my job search experience by cutting out the noise. Seeing how much time it saved me, I decided to open-source it so other job seekers can benefit from it too.

I'm not a dedicated JavaScript developer myself, but AI made it possible to turn an annoying problem into a working tool. If you're a JS / frontend dev and spot areas to refactor, optimize, or improve, **PRs and code reviews from the community are warmly welcomed!** 🙌

---

## 🛠️ Tech Stack
* **Manifest V3** compliant Chrome Extension
* Pure JavaScript & CSS (zero heavy dependencies or frameworks)
* Native `MutationObserver` for real-time DOM filtering on infinite scroll and pagination

---

## 🤝 Contributing
Contributions, bug reports, and feature suggestions are welcome! Feel free to open an issue or submit a pull request.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
