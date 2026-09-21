// Merge Window: banner + click interception on GitHub merge buttons during a freeze window.

const DEFAULTS = {
  timezone: 'America/Chicago',
  startHour: 10,   // inclusive
  endHour: 16,     // exclusive
  days: [1, 2, 3, 4, 5], // 1 = Monday ... 7 = Sunday
  hardBlock: true  // true = require typing to override, false = warn only
};

let config = DEFAULTS;

// Current wall-clock day/hour/minute in the configured timezone, DST included.
function nowInZone(tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).formatToParts(new Date());

  const get = (t) => parts.find((p) => p.type === t)?.value;
  const dayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

  return {
    day: dayMap[get('weekday')],
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute'))
  };
}

function inFreezeWindow() {
  const { day, hour } = nowInZone(config.timezone);
  return config.days.includes(day) && hour >= config.startHour && hour < config.endHour;
}

function fmtHour(h) {
  const suffix = h < 12 ? 'am' : 'pm';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${suffix}`;
}

function minutesUntilOpen() {
  const { hour, minute } = nowInZone(config.timezone);
  return (config.endHour - hour) * 60 - minute;
}

// --- Merge button detection -------------------------------------------------
// GitHub's DOM changes often, so match on the button's visible text rather than
// on class names or data attributes.
const MERGE_TEXT = /^(merge pull request|squash and merge|rebase and merge|confirm (merge|squash and merge|rebase and merge)|merge when ready|create a merge commit)/i;

function isMergeButton(el) {
  const btn = el.closest('button, [role="button"]');
  if (!btn) return null;
  const label = (btn.innerText || btn.textContent || '').trim();
  return MERGE_TEXT.test(label) ? btn : null;
}

// --- Banner -----------------------------------------------------------------
function renderBanner() {
  const existing = document.getElementById('merge-window-banner');
  const frozen = inFreezeWindow();

  document.documentElement.classList.toggle('merge-window-frozen', frozen);

  if (!frozen) {
    existing?.remove();
    return;
  }
  if (existing) {
    // Only write when the text actually changed: every write is a DOM mutation.
    const slot = existing.querySelector('.mw-countdown');
    const next = countdownText();
    if (slot.textContent !== next) slot.textContent = next;
    return;
  }

  const bar = document.createElement('div');
  bar.id = 'merge-window-banner';
  bar.innerHTML = `
    <span class="mw-dot"></span>
    <strong>Merge freeze</strong>
    <span>${fmtHour(config.startHour)}&ndash;${fmtHour(config.endHour)} Central, weekdays.</span>
    <span class="mw-countdown">${countdownText()}</span>
  `;
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

    const window_ = `${fmtHour(config.startHour)}-${fmtHour(config.endHour)} Central`;
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
function start() {
  renderBanner();
  // A 30s tick keeps the countdown current and flips the banner at the boundary.
  setInterval(renderBanner, 30_000);

  // GitHub navigates with Turbo, which swaps <body> but leaves <html> alone, so the
  // banner survives. These events cover a restored bfcache page and Turbo renders.
  // Do NOT use a MutationObserver here: renderBanner writes to the DOM, so observing
  // the document would re-enter it on its own writes and hang the tab.
  addEventListener('pageshow', renderBanner);
  document.addEventListener('turbo:load', renderBanner);
  document.addEventListener('turbo:render', renderBanner);
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
  renderBanner();
});
