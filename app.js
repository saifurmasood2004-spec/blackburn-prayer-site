const CSV_PATH = "./blackburn_prayer_times.csv";
const TIMEZONE = "Europe/London";

const PRAYERS = [
  { key: "fajr", name: "Fajr" },
  { key: "sunrise", name: "Sunrise" },
  { key: "dhuhr", name: "Dhuhr" }, // may display as Jumu’ah
  { key: "asr1", name: "Asr 1" },
  { key: "asr2", name: "Asr 2" },
  { key: "maghrib", name: "Maghrib" },
  { key: "isha", name: "Isha" },
];

const els = {
  datePill: document.getElementById("datePill"),
  timesBody: document.getElementById("timesBody"),
  statusText: document.getElementById("statusText"),
  mkAfter: document.getElementById("mkAfter"),
  mkBefore: document.getElementById("mkBefore"),
  themeToggle: document.getElementById("themeToggle"),
  themeIcon: document.getElementById("themeIcon"),
  nextPrayerText: document.getElementById("nextPrayerText"),
  nextPrayerCountdown: document.getElementById("nextPrayerCountdown"),
};

// Countdown state
let countdownTarget = null; // { label, dayOffset, targetSec }

function isoDateInTZ(dateObj, tz) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dateObj);
}

function isoAddDays(iso, days, tz) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDateInTZ(d, tz);
}

function prettyDateInTZ(dateObj, tz) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(dateObj);

  const get = (type) => parts.find(p => p.type === type)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")} ${get("year")}`.replace(/\s+/g, " ").trim();
}

function weekdayShortFromISO(iso, tz) {
  const d = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short" }).format(d);
}

function londonNowMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const h = Number(parts.find(p => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find(p => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

/* Seconds version for countdown */
function londonNowSeconds() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const h = Number(parts.find(p => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find(p => p.type === "minute")?.value ?? "0");
  const s = Number(parts.find(p => p.type === "second")?.value ?? "0");
  return h * 3600 + m * 60 + s;
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim().length);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map(c => c.trim());
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cells[idx] ?? ""; });
    rows.push(obj);
  }
  return rows;
}

function hhmmToMinutes(hhmm) {
  const [hStr, mStr] = String(hhmm).split(":");
  const h = Number(hStr), m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function hhmmAddMinutes(hhmm, mins) {
  const base = hhmmToMinutes(hhmm);
  if (base === null) return "";
  let total = base + mins;
  total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/* Countdown helpers */
function hhmmToSeconds(hhmm) {
  const mins = hhmmToMinutes(hhmm);
  if (mins === null) return null;
  return mins * 60;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatHMS(totalSeconds) {
  const t = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(t / 3600);
  const mm = Math.floor((t % 3600) / 60);
  const ss = t % 60;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

function getNextPrayerTarget(todayISO, tomorrowISO, todayRow, tomorrowRow) {
  if (!todayRow) return null;

  const nowSec = londonNowSeconds();

  const todayTimes = PRAYERS.map(p => ({
    key: p.key,
    name: p.name,
    sec: hhmmToSeconds(todayRow[p.key]),
  })).filter(x => x.sec !== null);

  const nextToday = todayTimes.find(x => x.sec > nowSec);

  const makeLabel = (key, baseName, isoForDay) => {
    if (key === "dhuhr") {
      const wd = weekdayShortFromISO(isoForDay, TIMEZONE);
      if (wd === "Fri") return "Jumu’ah";
    }
    return baseName;
  };

  if (nextToday) {
    const label = makeLabel(nextToday.key, nextToday.name, todayISO);
    return { label, dayOffset: 0, targetSec: nextToday.sec };
  }

  if (!tomorrowRow) return null;

  const fajrSec = hhmmToSeconds(tomorrowRow.fajr);
  if (fajrSec === null) return null;

  const label = makeLabel("fajr", "Fajr", tomorrowISO);
  return { label, dayOffset: 1, targetSec: fajrSec };
}

/* Theme */
function getThemePref() {
  return localStorage.getItem("bpt_theme") || "light";
}
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("bpt_theme", theme);
  els.themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
}
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  setTheme(current === "dark" ? "light" : "dark");
}

/* Highlight logic: stays highlighted until next prayer starts */
function getCurrentPrayerKeyToday(todayRow, nowMins) {
  if (!todayRow) return null;

  let currentKey = null;
  for (const p of PRAYERS) {
    const m = hhmmToMinutes(todayRow[p.key]);
    if (m === null) continue;

    if (m <= nowMins) currentKey = p.key;
    else break;
  }
  return currentKey; // null before Fajr
}

function buildRollingSchedule(todayRow, tomorrowRow, nowMins) {
  const currentKey = getCurrentPrayerKeyToday(todayRow, nowMins);

  const items = PRAYERS.map(p => {
    const tToday = todayRow?.[p.key] || "";
    const tTomorrow = tomorrowRow?.[p.key] || "";
    const mToday = hhmmToMinutes(tToday);

    // Use tomorrow only if passed AND not the current prayer
    const useTomorrow = (mToday === null)
      ? true
      : (mToday < nowMins && p.key !== currentKey);

    return {
      key: p.key,
      baseName: p.name,
      displayTime: useTomorrow ? tTomorrow : tToday,
      displayDay: useTomorrow ? "tomorrow" : "today",
    };
  });

  return { items, highlightKey: currentKey };
}

function render(todayISO, tomorrowISO, todayRow, tomorrowRow) {
  els.datePill.textContent = prettyDateInTZ(new Date(), TIMEZONE);

  // Update next prayer target + label
  countdownTarget = getNextPrayerTarget(todayISO, tomorrowISO, todayRow, tomorrowRow);
  if (countdownTarget) {
    els.nextPrayerText.textContent = `The Adhan of ${countdownTarget.label} is in`;
  } else {
    els.nextPrayerText.textContent = "The Adhan is in";
    els.nextPrayerCountdown.textContent = "--:--:--";
  }

  const nowMins = londonNowMinutes();
  const { items, highlightKey } = buildRollingSchedule(todayRow, tomorrowRow, nowMins);

  els.timesBody.innerHTML = "";

  for (const it of items) {
    const tr = document.createElement("tr");
    if (it.key === highlightKey) tr.classList.add("is-current");

    // Dhuhr -> Jumu’ah if the displayed Dhuhr row is Friday
    let prayerLabel = it.baseName;
    if (it.key === "dhuhr") {
      const isoForLabel = (it.displayDay === "today") ? todayISO : tomorrowISO;
      const wd = weekdayShortFromISO(isoForLabel, TIMEZONE);
      if (wd === "Fri") prayerLabel = "Jumu’ah";
    }

    const tdName = document.createElement("td");
    tdName.textContent = prayerLabel;

    const tdTime = document.createElement("td");
    tdTime.className = "right";
    tdTime.textContent = it.displayTime || "--:--";

    tr.appendChild(tdName);
    tr.appendChild(tdTime);
    els.timesBody.appendChild(tr);
  }

  els.statusText.textContent = todayRow ? "Updated Automatically Daily" : `No timetable found for ${todayISO}.`;

  // Makrooh based on today's row (with proper mins + until/from times)
  if (!todayRow) {
    els.mkAfter.textContent = "--";
    els.mkBefore.textContent = "--";
    return;
  }

  const afterMins = Number(todayRow.makrooh_after_sunrise_mins);
  const beforeMins = Number(todayRow.makrooh_before_maghrib_mins);

  const sunrise = todayRow.sunrise;
  const maghrib = todayRow.maghrib;

  const afterUntil = Number.isFinite(afterMins) ? hhmmAddMinutes(sunrise, afterMins) : "";
  const beforeFrom = Number.isFinite(beforeMins) ? hhmmAddMinutes(maghrib, -beforeMins) : "";

  els.mkAfter.textContent =
    (afterUntil && Number.isFinite(afterMins))
      ? `${afterMins} mins after sunrise (until ${afterUntil})`
      : "--";

  els.mkBefore.textContent =
    (beforeFrom && Number.isFinite(beforeMins))
      ? `${beforeMins} mins before Maghrib (from ${beforeFrom})`
      : "--";
}

async function loadTimetable() {
  const res = await fetch(CSV_PATH, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load CSV (${res.status})`);
  const text = await res.text();
  const rows = parseCSV(text);

  const byDate = new Map();
  for (const r of rows) {
    if (r.date) byDate.set(r.date, r);
  }
  return byDate;
}

async function init() {
  setTheme(getThemePref());
  els.themeToggle.addEventListener("click", toggleTheme);

  els.statusText.textContent = "Loading…";

  let byDate = await loadTimetable();

  let todayISO = isoDateInTZ(new Date(), TIMEZONE);
  let tomorrowISO = isoAddDays(todayISO, 1, TIMEZONE);

  render(todayISO, tomorrowISO, byDate.get(todayISO), byDate.get(tomorrowISO));

  // Live countdown tick (every second)
  setInterval(() => {
    if (!countdownTarget) return;

    const nowSec = londonNowSeconds();
    const targetAbs = (countdownTarget.dayOffset * 86400) + countdownTarget.targetSec;
    const remaining = targetAbs - nowSec;

    els.nextPrayerCountdown.textContent = formatHMS(remaining);

    // when it hits 0, re-render to move to next prayer
    if (remaining <= 0) {
      render(todayISO, tomorrowISO, byDate.get(todayISO), byDate.get(tomorrowISO));
    }
  }, 1000);

  // Auto refresh at midnight + keep highlight accurate
  setInterval(async () => {
    const currentToday = isoDateInTZ(new Date(), TIMEZONE);

    if (currentToday !== todayISO) {
      byDate = await loadTimetable();
      todayISO = currentToday;
      tomorrowISO = isoAddDays(todayISO, 1, TIMEZONE);
    }

    render(todayISO, tomorrowISO, byDate.get(todayISO), byDate.get(tomorrowISO));
  }, 60000);
}

init().catch(() => {
  els.statusText.textContent = "Could not load timetable.";
}).finally(() => {
  const y = new Date().getFullYear();
  const el = document.getElementById("copyrightYear");
  if (el) el.textContent = y;
});

