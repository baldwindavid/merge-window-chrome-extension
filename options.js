const DEFAULTS = {
  timezone: 'America/Chicago',
  startHour: 10,
  endHour: 16,
  days: [1, 2, 3, 4, 5],
  hardBlock: true
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function label(h) {
  const suffix = h < 12 ? 'am' : 'pm';
  return `${h % 12 === 0 ? 12 : h % 12}:00 ${suffix}`;
}

for (const id of ['startHour', 'endHour']) {
  const select = document.getElementById(id);
  for (let h = 0; h < 24; h++) {
    select.add(new Option(label(h), String(h)));
  }
}

// --- Timezone dropdown ------------------------------------------------------
const COMMON_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu'
];

function zoneAbbreviation(zone) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value;
  } catch {
    return null;
  }
}

function buildTimezoneMenu(selected) {
  const select = document.getElementById('timezone');
  select.textContent = '';

  // Intl.supportedValuesOf needs Chrome 99+; fall back to the common list alone.
  const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];

  const common = document.createElement('optgroup');
  common.label = 'Common';
  for (const zone of COMMON_ZONES) {
    const abbr = zoneAbbreviation(zone);
    common.appendChild(new Option(abbr ? `${zone} (${abbr})` : zone, zone));
  }
  select.appendChild(common);

  if (all.length) {
    const rest = document.createElement('optgroup');
    rest.label = 'All';
    for (const zone of all) rest.appendChild(new Option(zone, zone));
    select.appendChild(rest);
  }

  // A stored zone the browser no longer lists still needs to be selectable.
  if (selected && !select.querySelector(`option[value="${CSS.escape(selected)}"]`)) {
    const custom = document.createElement('optgroup');
    custom.label = 'Saved';
    custom.appendChild(new Option(selected, selected));
    select.appendChild(custom);
  }

  select.value = selected;
}

const daysBox = document.getElementById('days');
DAY_NAMES.forEach((name, i) => {
  const wrap = document.createElement('label');
  wrap.innerHTML = `<input type="checkbox" value="${i + 1}"> ${name}`;
  daysBox.appendChild(wrap);
});

chrome.storage.sync.get(DEFAULTS, (config) => {
  document.getElementById('startHour').value = String(config.startHour);
  document.getElementById('endHour').value = String(config.endHour);
  buildTimezoneMenu(config.timezone);
  document.getElementById('hardBlock').value = String(config.hardBlock);
  for (const box of daysBox.querySelectorAll('input')) {
    box.checked = config.days.includes(Number(box.value));
  }
});

document.getElementById('save').addEventListener('click', () => {
  const timezone = document.getElementById('timezone').value;

  const startHour = Number(document.getElementById('startHour').value);
  const endHour = Number(document.getElementById('endHour').value);
  if (startHour >= endHour) {
    alert('"From" must be earlier than "Until". Overnight windows are not supported.');
    return;
  }

  const days = [...daysBox.querySelectorAll('input:checked')].map((b) => Number(b.value));
  if (days.length === 0) {
    alert('Pick at least one day, or the extension will never do anything.');
    return;
  }

  chrome.storage.sync.set(
    {
      startHour,
      endHour,
      timezone,
      days,
      hardBlock: document.getElementById('hardBlock').value === 'true'
    },
    () => {
      const saved = document.getElementById('saved');
      saved.style.visibility = 'visible';
      setTimeout(() => (saved.style.visibility = 'hidden'), 1500);
    }
  );
});
