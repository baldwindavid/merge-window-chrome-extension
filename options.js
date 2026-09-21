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

const daysBox = document.getElementById('days');
DAY_NAMES.forEach((name, i) => {
  const wrap = document.createElement('label');
  wrap.innerHTML = `<input type="checkbox" value="${i + 1}"> ${name}`;
  daysBox.appendChild(wrap);
});

chrome.storage.sync.get(DEFAULTS, (config) => {
  document.getElementById('startHour').value = String(config.startHour);
  document.getElementById('endHour').value = String(config.endHour);
  document.getElementById('timezone').value = config.timezone;
  document.getElementById('hardBlock').value = String(config.hardBlock);
  for (const box of daysBox.querySelectorAll('input')) {
    box.checked = config.days.includes(Number(box.value));
  }
});

document.getElementById('save').addEventListener('click', () => {
  const timezone = document.getElementById('timezone').value.trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    alert(`"${timezone}" is not an IANA timezone. Try America/Chicago.`);
    return;
  }

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
