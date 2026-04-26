// ==UserScript==
// @name         New Recruit to 40k Planner
// @namespace    https://github.com/kaashif/40k-planner
// @version      0.1.0
// @description  Adds an Open in 40k Planner button to New Recruit JSON exports.
// @updateURL    https://raw.githubusercontent.com/kaashif/40k-planner/main/userscripts/newrecruit-to-40k-planner.user.js
// @downloadURL  https://raw.githubusercontent.com/kaashif/40k-planner/main/userscripts/newrecruit-to-40k-planner.user.js
// @match        https://www.newrecruit.eu/*
// @match        https://newrecruit.eu/*
// @match        http://localhost:3000/*
// @match        http://127.0.0.1:3000/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// ==/UserScript==

(function () {
  'use strict';

  const PLANNER_URL = 'http://localhost:3000/?nrImport=1';
  const STORAGE_KEY = 'newRecruitRosterJson';
  const BUTTON_ID = 'nr-to-40k-planner-button';

  function looksLikeRoster(value) {
    return Boolean(value?.roster?.forces?.[0]?.selections);
  }

  function tryParseJson(text) {
    if (!text || !text.includes('roster')) return null;
    try {
      const parsed = JSON.parse(text);
      return looksLikeRoster(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function extractBalancedJson(text) {
    const rosterIndex = text.indexOf('"roster"');
    if (rosterIndex === -1) return null;

    const start = text.lastIndexOf('{', rosterIndex);
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i += 1) {
      const char = text[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          return text.slice(start, i + 1);
        }
      }
    }

    return null;
  }

  function getExportTextFromPage() {
    const candidates = [
      ...Array.from(document.querySelectorAll('textarea, pre, code')),
      ...Array.from(document.querySelectorAll('[contenteditable="true"]')),
    ];

    for (const candidate of candidates) {
      const text = 'value' in candidate ? candidate.value : candidate.textContent;
      if (tryParseJson(text)) return text;
      const balanced = extractBalancedJson(text || '');
      if (balanced && tryParseJson(balanced)) return balanced;
    }

    const balanced = extractBalancedJson(document.body.innerText || '');
    if (balanced && tryParseJson(balanced)) return balanced;

    for (let i = 0; i < localStorage.length; i += 1) {
      const value = localStorage.getItem(localStorage.key(i));
      if (tryParseJson(value)) return value;
    }

    for (let i = 0; i < sessionStorage.length; i += 1) {
      const value = sessionStorage.getItem(sessionStorage.key(i));
      if (tryParseJson(value)) return value;
    }

    return null;
  }

  async function openPlanner() {
    const raw = getExportTextFromPage();
    const parsed = tryParseJson(raw) || tryParseJson(extractBalancedJson(raw || ''));

    if (!parsed) {
      alert('Could not find a New Recruit JSON export on this page. Open the JSON export view first, then try again.');
      return;
    }

    await GM_setValue(STORAGE_KEY, JSON.stringify(parsed));
    GM_openInTab(PLANNER_URL, { active: true, insert: true });
  }

  function installNewRecruitButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = 'Open in 40k Planner';
    button.addEventListener('click', openPlanner);
    button.style.cssText = [
      'position: fixed',
      'right: 16px',
      'bottom: 16px',
      'z-index: 2147483647',
      'padding: 10px 14px',
      'border-radius: 8px',
      'border: 1px solid #C5A33E',
      'background: #4a3a0f',
      'color: white',
      'font: 600 14px system-ui, sans-serif',
      'box-shadow: 0 8px 24px rgba(0,0,0,0.35)',
      'cursor: pointer',
    ].join(';');

    document.body.appendChild(button);
  }

  async function importPendingRosterIntoPlanner() {
    const rosterJson = await GM_getValue(STORAGE_KEY, '');
    if (!rosterJson) return;

    localStorage.setItem('newRecruitRosterImport', rosterJson);
    window.dispatchEvent(new Event('newRecruitRosterImport'));
    await GM_deleteValue(STORAGE_KEY);
  }

  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    importPendingRosterIntoPlanner();
    return;
  }

  installNewRecruitButton();
  new MutationObserver(installNewRecruitButton).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
