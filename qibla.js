const KAABA = { lat: 21.4224779, lng: 39.8251832 };

const els = {
  btnLocation: document.getElementById("btnLocation"),
  btnMotion: document.getElementById("btnMotion"),
  status: document.getElementById("qiblaStatus"),
  needleGroup: document.getElementById("needleGroup"),
  dial: document.getElementById("qiblaDial"),
  deg: document.getElementById("qiblaDegrees"),
  cardinal: document.getElementById("qiblaCardinal"),
  coords: document.getElementById("qiblaCoords"),
  mode: document.getElementById("qiblaMode"),
  themeToggle: document.getElementById("themeToggle"),
  themeIcon: document.getElementById("themeIcon"),
};

let qiblaBearing = null;      // degrees from North (0-360)
let deviceHeading = null;     // degrees from North (0-360)
let motionEnabled = false;

function toRad(d){ return d * Math.PI / 180; }
function toDeg(r){ return r * 180 / Math.PI; }
function norm360(d){ return ((d % 360) + 360) % 360; }

function bearingToKaaba(lat, lng){
  // initial bearing from (lat,lng) to KAABA
  const φ1 = toRad(lat);
  const φ2 = toRad(KAABA.lat);
  const Δλ = toRad(KAABA.lng - lng);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return norm360(toDeg(Math.atan2(y, x)));
}

function cardinalFromDegrees(d){
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  const idx = Math.round(norm360(d) / 22.5) % 16;
  return dirs[idx];
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("bpt_theme", theme);
  els.themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
}
function getThemePref() {
  return localStorage.getItem("bpt_theme") || "light";
}
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  setTheme(current === "dark" ? "light" : "dark");
}

  let rafPending = false;
let dialRotation = 0;
let needleRotation = 0;

function updateUI(){
  if (qiblaBearing === null){
    els.deg.textContent = "--°";
    els.cardinal.textContent = "--";
    return;
  }

  els.deg.textContent = `${Math.round(qiblaBearing)}°`;
  els.cardinal.textContent = cardinalFromDegrees(qiblaBearing);

  // Default: arrow mode
  dialRotation = 0;
  needleRotation = qiblaBearing;
  els.mode.textContent = "Mode: Direction arrow (no sensor)";

  // Live compass mode
  if (motionEnabled && deviceHeading !== null){
    // Rotate the dial so N/E/S/W show real directions as you turn
    dialRotation = -deviceHeading;

    // Needle points to qibla relative to your current heading
    needleRotation = norm360(qiblaBearing - deviceHeading);

    els.mode.textContent = "Mode: Live compass (sensor)";
  }

  // Apply transforms using requestAnimationFrame to reduce lag/jitter
  if (!rafPending){
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      if (els.dial) els.dial.style.transform = `rotate(${dialRotation}deg)`;
      els.needleGroup.style.transform = `rotate(${needleRotation}deg)`;
    });
  }
}

  els.deg.textContent = `${Math.round(qiblaBearing)}°`;
  els.cardinal.textContent = cardinalFromDegrees(qiblaBearing);

  // If we have device heading, rotate needle relative to where phone faces.
  // Otherwise rotate needle to absolute bearing (arrow mode).
  let rotation;
  if (motionEnabled && deviceHeading !== null){
    rotation = norm360(qiblaBearing - deviceHeading);
    els.mode.textContent = "Mode: Live compass (sensor)";
  } else {
    rotation = qiblaBearing;
    els.mode.textContent = "Mode: Direction arrow (no sensor)";
  }

  els.needleGroup.style.transform = `rotate(${rotation}deg)`;
}

function requestLocation(){
  if (!navigator.geolocation){
    els.status.textContent = "Location is not supported on this device.";
    return;
  }

  els.status.textContent = "Getting your location…";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      qiblaBearing = bearingToKaaba(lat, lng);
      els.coords.textContent = `Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      els.status.textContent = "Qibla direction calculated.";

      updateUI();
    },
    (err) => {
      els.status.textContent = "Location access was blocked. Please allow location and try again.";
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

async function requestMotion(){
  // iOS requires explicit permission
  try{
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      const resp = await DeviceOrientationEvent.requestPermission();
      if (resp !== "granted"){
        els.status.textContent = "Motion permission was not granted.";
        return;
      }
    }
    motionEnabled = true;
    els.status.textContent = "Compass motion enabled (if supported).";
  } catch {
    // If permission fails, still try to listen (Android/desktop)
    motionEnabled = true;
    els.status.textContent = "Trying to enable compass motion…";
  }

  window.addEventListener("deviceorientationabsolute", onOrientation, true);
  window.addEventListener("deviceorientation", onOrientation, true);
}

function onOrientation(e){
  // Best effort:
  // - e.alpha is rotation around z-axis (0-360)
  // Some browsers expose webkitCompassHeading (iOS)
  let heading = null;

  if (typeof e.webkitCompassHeading === "number") {
    heading = e.webkitCompassHeading; // iOS Safari
  } else if (typeof e.alpha === "number") {
    // alpha is clockwise from North in many implementations, but not all.
    // We'll still use it as best-effort.
    heading = e.alpha;
  }

  if (heading === null) return;

  deviceHeading = norm360(heading);
  updateUI();
}

function init(){
  setTheme(getThemePref());
  els.themeToggle.addEventListener("click", toggleTheme);

  els.btnLocation.addEventListener("click", requestLocation);
  els.btnMotion.addEventListener("click", requestMotion);

  document.getElementById("copyrightYear").textContent = new Date().getFullYear();

  // initial
  updateUI();
}

init();
