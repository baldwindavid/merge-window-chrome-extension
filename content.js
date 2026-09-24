// Merge Window: status banner + click interception on GitHub merge buttons during a freeze window.

const DEFAULTS = {
  timezone: 'America/Chicago',
  startHour: 10,   // inclusive
  endHour: 16,     // exclusive
  days: [1, 2, 3, 4, 5], // 1 = Monday ... 7 = Sunday
  hardBlock: true  // true = require typing to override, false = warn only
};

let config = DEFAULTS;

// Current wall-clock day/hour/minute in the configured timezone, DST included.
function nowInZone(tz, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).formatToParts(date);

  const get = (t) => parts.find((p) => p.type === t)?.value;
  const dayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

  return {
    day: dayMap[get('weekday')],
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute'))
  };
}

function isFreezeAt(date) {
  const { day, hour } = nowInZone(config.timezone, date);
  return config.days.includes(day) && hour >= config.startHour && hour < config.endHour;
}

function inFreezeWindow() {
  return onPullRequestPage() && isFreezeAt(new Date());
}

function fmtHour(h) {
  const suffix = h < 12 ? 'am' : 'pm';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${suffix}`;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// e.g. "10am-4pm CDT, weekdays" - derived from config so it cannot go stale.
function windowLabel(date = new Date()) {
  const zone =
    new Intl.DateTimeFormat('en-US', { timeZone: config.timezone, timeZoneName: 'short' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value ?? config.timezone;

  const days = [...config.days].sort((a, b) => a - b);
  const weekdays = days.length === 5 && days.every((d, i) => d === i + 1);
  const dayText = weekdays ? 'weekdays' : days.map((d) => DAY_NAMES[d - 1]).join(', ');

  return `${fmtHour(config.startHour)}-${fmtHour(config.endHour)} ${zone}, ${dayText}`;
}

// Changes whenever a setting that appears in the banner changes.
function configSignature() {
  return [config.startHour, config.endHour, config.timezone, [...config.days].sort()].join('|');
}

function minutesUntilOpen() {
  const { hour, minute } = nowInZone(config.timezone);
  return (config.endHour - hour) * 60 - minute;
}

// Find the next transition into a freeze in real time. Searching timestamps
// rather than adding calendar days keeps the result correct across DST changes.
function nextFreezeStart(now = new Date()) {
  let previous = now.getTime();
  // Two weeks also covers a one-hour weekly window skipped by spring DST.
  for (let step = 1; step <= 15 * 24; step++) {
    const current = previous + 60 * 60 * 1000;
    if (isFreezeAt(new Date(current))) {
      // The hourly probe found a freeze. Narrow its start to the minute.
      let low = previous;
      let high = current;
      while (high - low > 60 * 1000) {
        const middle = Math.floor((low + high) / (2 * 60 * 1000)) * 60 * 1000;
        if (isFreezeAt(new Date(middle))) high = middle;
        else low = middle;
      }
      return new Date(high);
    }
    previous = current;
  }
  return null;
}

function nextFreezeText(now = new Date()) {
  const start = nextFreezeStart(now);
  if (!start) return { window: 'No upcoming freeze scheduled.', countdown: '' };
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone, weekday: 'short', month: 'short', day: 'numeric'
  }).format(start);
  const zone = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone, timeZoneName: 'short'
  }).formatToParts(start).find((part) => part.type === 'timeZoneName')?.value ?? config.timezone;
  const mins = Math.ceil((start.getTime() - now.getTime()) / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return {
    window: `Next freeze ${day}, ${fmtHour(nowInZone(config.timezone, start).hour)}-${fmtHour(config.endHour)} ${zone}.`,
    countdown: `Starts in ${h ? h + 'h ' : ''}${m}m.`
  };
}

// --- Page scope -------------------------------------------------------------
// Only pull request pages. The manifest still matches all of github.com because
// GitHub navigates with Turbo: a narrower match would skip injection when you
// click into a PR from a repo page, since that is a pushState, not a load.
const PR_PATH = /^\/[^/]+\/[^/]+\/pull\/\d+/;

function onPullRequestPage() {
  return PR_PATH.test(location.pathname);
}

// --- Merge button detection -------------------------------------------------
// GitHub's DOM changes often, so match on the button's visible text rather than
// on class names or data attributes.
const MERGE_TEXT = /^(merge pull request|squash and merge|rebase and merge|confirm (merge|squash and merge|rebase and merge)|merge when ready|create a merge commit)/i;

function isMergeButton(el) {
  if (!(el instanceof Element)) return null;
  const btn = el.closest('button, [role="button"]');
  if (!btn) return null;
  const label = (btn.innerText || btn.textContent || '').trim();
  return MERGE_TEXT.test(label) ? btn : null;
}

// --- Merge button styling ---------------------------------------------------
// Class names are matched in JS, not CSS: GitHub's Primer React markup has no
// stable class on the merge button, so the only durable handle is its text.
const BLOCKED_CLASS = 'merge-window-blocked';

function paintMergeButtons() {
  const frozen = inFreezeWindow();
  // textContent, not innerText: innerText forces a reflow on every button.
  for (const btn of document.querySelectorAll('button, [role="button"]')) {
    const match = frozen && MERGE_TEXT.test((btn.textContent || '').trim());
    btn.classList.toggle(BLOCKED_CLASS, match);
  }
}

// --- Banner -----------------------------------------------------------------
function renderBanner() {
  const existing = document.getElementById('merge-window-banner');
  if (!onPullRequestPage()) {
    document.documentElement.classList.remove('merge-window-banner-visible');
    existing?.remove();
    return;
  }
  const frozen = inFreezeWindow();

  document.documentElement.classList.add('merge-window-banner-visible');
  const signature = `${configSignature()}|${frozen}`;
  const status = frozen
    ? { window: `${windowLabel()}.`, countdown: countdownText() }
    : nextFreezeText();

  if (existing && existing.dataset.signature === signature) {
    // Only write when the text actually changed: every write is a DOM mutation.
    const windowSlot = existing.querySelector('.mw-window');
    const countdownSlot = existing.querySelector('.mw-countdown');
    if (windowSlot.textContent !== status.window) windowSlot.textContent = status.window;
    if (countdownSlot.textContent !== status.countdown) countdownSlot.textContent = status.countdown;
    return;
  }
  existing?.remove(); // Settings changed: rebuild rather than patch.

  const bar = document.createElement('div');
  bar.id = 'merge-window-banner';
  bar.dataset.signature = signature;
  bar.dataset.state = frozen ? 'frozen' : 'open';
  bar.innerHTML = `
    <span class="mw-dot"></span>
    <strong>${frozen ? 'Merge freeze' : 'Merges open'}</strong>
    <span class="mw-window"></span>
    <span class="mw-countdown"></span>
  `;
  // textContent, not innerHTML: the timezone name comes from Intl, not from us.
  bar.querySelector('.mw-window').textContent = status.window;
  bar.querySelector('.mw-countdown').textContent = status.countdown;
  document.documentElement.appendChild(bar);
}

function countdownText() {
  const mins = minutesUntilOpen();
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `Opens in ${h ? h + 'h ' : ''}${m}m.`;
}

// --- Click interception -----------------------------------------------------
// Capture phase, so this runs before GitHub's own handler. Setting `disabled`
// on the button does not survive React re-renders; blocking the event does.
document.addEventListener(
  'click',
  (event) => {
    if (!inFreezeWindow()) return;
    const btn = isMergeButton(event.target);
    if (!btn) return;

    // Our own replayed click after an override: let it through once.
    if (btn.dataset.mergeWindowOverride) {
      delete btn.dataset.mergeWindowOverride;
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const window_ = windowLabel();
    if (config.hardBlock) {
      const answer = prompt(
        `Merge freeze is active (${window_}). ${countdownText()}\n\n` +
          `If this is a genuine exception, type MERGE to continue.`
      );
      if (answer !== 'MERGE') return;
    } else if (!confirm(`Merge freeze is active (${window_}). ${countdownText()}\n\nMerge anyway?`)) {
      return;
    }

    // Override granted: replay the click past our own listener.
    btn.dataset.mergeWindowOverride = '1';
    const replay = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
    setTimeout(() => btn.dispatchEvent(replay), 0);
  },
  true
);

// --- Lifecycle --------------------------------------------------------------
function refresh() {
  renderBanner();
  paintMergeButtons();
}

function start() {
  refresh();
  // A 30s tick keeps the countdown current and flips the banner at the boundary.
  setInterval(renderBanner, 30_000);
  // The merge button renders well after load and after every Turbo swap, so it
  // needs a faster tick than the countdown does.
  setInterval(paintMergeButtons, 2_000);

  // GitHub navigates with Turbo, which swaps <body> but leaves <html> alone, so the
  // banner survives. These events cover a restored bfcache page and Turbo renders.
  // Do NOT use a MutationObserver here: renderBanner writes to the DOM, so observing
  // the document would re-enter it on its own writes and hang the tab.
  addEventListener('pageshow', refresh);
  addEventListener('popstate', refresh);
  document.addEventListener('turbo:load', refresh);
  document.addEventListener('turbo:render', refresh);

  // Backstop for pushState navigation that fires no event we can hear.
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    refresh();
  }, 500);
}

chrome.storage.sync.get(DEFAULTS, (stored) => {
  config = { ...DEFAULTS, ...stored };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
});

chrome.storage.onChanged.addListener((changes) => {
  for (const [key, { newValue }] of Object.entries(changes)) config[key] = newValue;
  refresh();
});
