// Exact Kaaba coordinates you provided:
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

let qiblaBearing = null;      // degrees from true North (0-360)
let deviceHeading = null;     // degrees from North (0-360)
let motionEnabled = false;

let rafPending = false;
let dialRotation = 0;
let needleRotation = 0;

function toRad(d){ return d * Math.PI / 180; }
function toDeg(r){ return r * 180 / Math.PI; }
function norm360(d){ return ((d % 360) + 360) % 360; }

function bearingToKaaba(lat, lng){
  // Initial great-circle bearing from (lat,lng) to KAABA
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

/* Theme */
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

function applyTransforms(){
  if (!rafPending){
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      if (els.dial) els.dial.style.transform = `rotate(${dialRotation}deg)`;
      if (els.needleGroup) els.needleGroup.style.transform = `rotate(${needleRotation}deg)`;
    });
  }
}

function updateUI(){
  if (qiblaBearing === null){
    els.deg.textContent = "--°";
    els.cardinal.textContent = "--";
    return;
  }

  els.deg.textContent = `${Math.round(qiblaBearing)}°`;
  els.cardinal.textContent = cardinalFromDegrees(qiblaBearing);

  // Default: direction arrow mode
  dialRotation = 0;
  needleRotation = qiblaBearing;
  els.mode.textContent = "Mode: Direction arrow (no sensor)";

  // Live compass mode (dial rotates to keep N/E/S/W correct)
  if (motionEnabled && deviceHeading !== null){
    dialRotation = -deviceHeading;
    needleRotation = norm360(qiblaBearing - deviceHeading);
    els.mode.textContent = "Mode: Live compass (sensor)";
  }

  applyTransforms();
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
    () => {
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
    motionEnabled = true;
    els.status.textContent = "Trying to enable compass motion…";
  }

  window.addEventListener("deviceorientationabsolute", onOrientation, true);
  window.addEventListener("deviceorientation", onOrientation, true);

  updateUI();
}

function onOrientation(e){
  // Best-effort heading:
  // iOS Safari uses webkitCompassHeading (0 = North).
  // Other browsers often provide alpha (0-360).
  let heading = null;

  if (typeof e.webkitCompassHeading === "number") {
    heading = e.webkitCompassHeading;
  } else if (typeof e.alpha === "number") {
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

  const y = new Date().getFullYear();
  const cy = document.getElementById("copyrightYear");
  if (cy) cy.textContent = y;

  updateUI();
}

init();
