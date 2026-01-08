const CSV_PATH = "./blackburn_prayer_times.csv";
const TIMEZONE = "Europe/London";

const PRAYERS = [
  { key: "fajr", name: "Fajr" },
  { key: "sunrise", name: "Sunrise" },
  { key: "dhuhr", name: "Dhuhr" },  // may display as Jumu’ah
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
};

function isoDateInTZ(dateObj, tz) {
  // en-CA gives YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dateObj);
}

function prettyDateInTZ(dateObj, tz) {
  // "Thu 8 January 2026"
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
  // using midday UTC avoids edge cases
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

function parseCSV(text) {
  // Simple CSV parsing (works for your timetable format)
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

function buildRollingSchedule(todayRow, tomorrowRow, nowMins) {
  // For each prayer: if today time passed, show tomorrow time.
  const items = PRAYERS.map(p => {
    const tToday = todayRow?.[p.key] || "";
    const tTomorrow = tomorrowRow?.[p.key] || "";

    const mToday = hhmmToMinutes(tToday);
    const useTomorrow = (mToday === null) ? true : (mToday < nowMins);

    const displayTime = useTomorrow ? tTomorrow : tToday;
    const displayDay = useTomorrow ? "tomorrow" : "today";

    return {
      key: p.key,
      baseName: p.name,
      displayTime,
      displayDay,
    };
  });

  // Find next upcoming (smallest minutes from now)
  let bestKey = null;
  let bestDelta = Infinity;

  for (const it of items) {
    const mins = hhmmToMinutes(it.displayTime);
    if (mins === null) continue;

    let delta;
    if (it.displayDay === "today") {
      delta = mins - nowMins;
    } else {
      delta = (24 * 60 - nowMins) + mins;
    }

    if (delta >= 0 && delta < bestDelta) {
      bestDelta = delta;
      bestKey = it.key;
    }
  }

  return { items, bestKey };
}

function render(todayISO, tomorrowISO, todayRow, tomorrowRow) {
  const now = new Date();
  els.datePill.textContent = prettyDateInTZ(now, TIMEZONE);

  const nowMins = londonNowMinutes();
  const { items, bestKey } = buildRollingSchedule(todayRow, tomorrowRow, nowMins);

  // Table rows
  els.timesBody.innerHTML = "";

  for (const it of items) {
    const tr = document.createElement("tr");
    if (it.key === bestKey) tr.classList.add("is-current");

    // Prayer name (Dhuhr -> Jumu’ah if the displayed day is Friday)
    let prayerLabel = it.baseName;
    if (it.key === "dhuhr") {
      const isoForLabel = (it.displayDay === "today") ? todayISO : tomorrowISO;
      const wd = weekdayShortFromISO(isoForLabel, TIMEZONE); // "Fri"
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

  // Status
  if (!todayRow) {
    els.statusText.textContent = `No timetable found for ${todayISO}.`;
  } else {
    els.statusText.textContent = "Updated Automatically Daily";
  }

  // Makrooh (use today's data)
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
  // Theme
  setTheme(getThemePref());
  els.themeToggle.addEventListener("click", toggleTheme);

  els.statusText.textContent = "Loading…";

  const byDate = await loadTimetable();

  const todayISO = isoDateInTZ(new Date(), TIMEZONE);
  const tomorrowISO = isoDateInTZ(new Date(Date.now() + 36 * 3600 * 1000), TIMEZONE);

  const todayRow = byDate.get(todayISO);
  const tomorrowRow = byDate.get(tomorrowISO);

  render(todayISO, tomorrowISO, todayRow, tomorrowRow);

  // Auto refresh at midnight (checks every minute)
  setInterval(async () => {
    const currentToday = isoDateInTZ(new Date(), TIMEZONE);
    if (currentToday !== todayISO) {
      // Date changed in London, reload timetable and re-render
      try {
        const updated = await loadTimetable();
        const newTomorrow = isoDateInTZ(new Date(Date.now() + 36 * 3600 * 1000), TIMEZONE);
        render(
          currentToday,
          newTomorrow,
          updated.get(currentToday),
          updated.get(newTomorrow)
        );
      } catch (e) {
        // keep quiet, but show a small message
        els.statusText.textContent = "Updated Automatically Daily";
      }
    } else {
      // Same day, but the highlighted row may change through the day
      const todayRowLive = byDate.get(todayISO);
      const tomorrowRowLive = byDate.get(tomorrowISO);
      render(todayISO, tomorrowISO, todayRowLive, tomorrowRowLive);
    }
  }, 60000);
}

init().catch(() => {
  els.statusText.textContent = "Could not load timetable.";
}).finally(() => {
  const y = new Date().getFullYear();
  const el = document.getElementById("copyrightYear");
  if (el) el.textContent = y;
});
