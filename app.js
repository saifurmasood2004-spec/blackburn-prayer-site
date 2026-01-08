const CSV_PATH = "./blackburn_prayer_times.csv";

const ROWS = [
  { key:"fajr",    name:"Fajr" },
  { key:"sunrise", name:"Sunrise" },
  { key:"dhuhr",   name:"Dhuhr" },
  { key:"asr1",    name:"Asr 1", hint:"Earlier Asr" },
  { key:"asr2",    name:"Asr 2", hint:"Later Asr" },
  { key:"maghrib", name:"Maghrib" },
  { key:"isha",    name:"Isha" },
];

const els = {
  dateInput: document.getElementById("dateInput"),
  statusPill: document.getElementById("statusPill"),
  statusText: document.getElementById("statusText"),
  timesList: document.getElementById("timesList"),
  mkAfter: document.getElementById("mkAfter"),
  mkBefore: document.getElementById("mkBefore"),
};

function isoToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
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

function hhmmAddMinutes(hhmm, mins) {
  const [hStr, mStr] = String(hhmm).split(":");
  const h = Number(hStr), m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const total = h * 60 + m + mins;
  const clamped = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  const nh = String(Math.floor(clamped / 60)).padStart(2, "0");
  const nm = String(clamped % 60).padStart(2, "0");
  return `${nh}:${nm}`;
}

function render(dateISO, row) {
  els.dateInput.value = dateISO;
  els.statusPill.textContent = `Showing: ${dateISO}`;

  els.timesList.innerHTML = "";

  if (!row) {
    els.statusText.textContent = `No data found for ${dateISO}.`;
    els.mkAfter.textContent = "--";
    els.mkBefore.textContent = "--";
    return;
  }

  els.statusText.textContent = "Updated automatically from the timetable.";

  for (const r of ROWS) {
    const time = row[r.key] || "--:--";
    const div = document.createElement("div");
    div.className = "row";

    const left = document.createElement("div");
    left.className = "left";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = r.name;
    left.appendChild(name);

    if (r.hint) {
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = r.hint;
      left.appendChild(hint);
    }

    const right = document.createElement("div");
    right.className = "time";
    right.textContent = time;

    div.appendChild(left);
    div.appendChild(right);
    els.timesList.appendChild(div);
  }

  const afterMins = Number(row.makrooh_after_sunrise_mins);
  const beforeMins = Number(row.makrooh_before_maghrib_mins);

  const sunrise = row.sunrise;
  const maghrib = row.maghrib;

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

async function init() {
  els.statusText.textContent = "Loading timetable…";

  const res = await fetch(CSV_PATH, { cache: "no-store" });
  if (!res.ok) {
    els.statusText.textContent = "Could not load CSV file.";
    return;
  }

  const text = await res.text();
  const rows = parseCSV(text);

  const byDate = new Map();
  for (const r of rows) {
    if (r.date) byDate.set(r.date, r);
  }

  const today = isoToday();
  render(today, byDate.get(today));
}

init().catch(() => {
  els.statusText.textContent = "Error loading timetable.";
});
