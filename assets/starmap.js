/*
 * starmap.js
 * ---------------------------------------------------------------
 * Shared engine for the 5 night-sky pages:
 *   1. Access-code gate (SHA-256 check, code never stored in plain text)
 *   2. Real equatorial -> horizontal coordinate astronomy
 *   3. Canvas rendering of the visible sky dome for a given
 *      latitude / longitude / moment in time
 *
 * Because every page runs the same math against the same
 * OBSERVATION_TIME_UTC (see assets/observation-time.js) but a
 * different latitude/longitude, whichever bright stars happen to be
 * above the horizon in more than one location will naturally show
 * up on more than one page -- no faking required, it falls straight
 * out of real sky geometry.
 * ---------------------------------------------------------------
 */

/* ---------- 1. Access code handling -------------------------------- */

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function setupLockScreen(config) {
  const lockScreen = document.getElementById("lock-screen");
  const form = document.getElementById("code-form");
  const input = document.getElementById("code-input");
  const errorEl = document.getElementById("code-error");
  const app = document.getElementById("app");

  input.focus();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const attempt = input.value.trim().toLowerCase();
    if (!attempt) return;

    const hash = await sha256Hex(attempt);

    if (hash === config.accessCodeHash) {
      lockScreen.classList.add("lock-screen--unlocked");
      app.classList.add("app--visible");
      setTimeout(() => lockScreen.remove(), 900);
      startSky(config);
    } else {
      errorEl.textContent = "That code doesn't match. Try again.";
      lockScreen.querySelector(".lock-card").classList.remove("shake");
      // restart animation on consecutive wrong attempts
      void lockScreen.offsetWidth;
      lockScreen.querySelector(".lock-card").classList.add("shake");
      input.select();
    }
  });
}

/* ---------- 2. Astronomy -------------------------------------------- */

const DEG = Math.PI / 180;

function toJulianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// Greenwich Mean Sidereal Time, in degrees, for a given Julian Date.
function gmstDegrees(jd) {
  const T = (jd - 2451545.0) / 36525;
  let gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000;
  gmst = gmst % 360;
  if (gmst < 0) gmst += 360;
  return gmst;
}

/**
 * Convert a star's equatorial coordinates to horizontal (alt/az) for a
 * given observer and moment in time.
 * raHours, decDeg: J2000 catalog position
 * latDeg, lonDeg: observer location (lonDeg is East-positive)
 * date: JS Date (any timezone -- only the absolute instant matters)
 * Returns { altDeg, azDeg } where azDeg is measured from North, clockwise
 * through East (standard compass bearing).
 */
function equatorialToHorizontal(raHours, decDeg, latDeg, lonDeg, date) {
  const jd = toJulianDate(date);
  const lst = (gmstDegrees(jd) + lonDeg + 360) % 360; // local sidereal time, degrees
  let H = lst - raHours * 15; // hour angle, degrees
  H = ((H + 180) % 360) - 180; // normalize to [-180, 180)
  const Hr = H * DEG;
  const decR = decDeg * DEG;
  const latR = latDeg * DEG;

  const sinAlt =
    Math.sin(decR) * Math.sin(latR) + Math.cos(decR) * Math.cos(latR) * Math.cos(Hr);
  const alt = Math.asin(Math.min(1, Math.max(-1, sinAlt)));

  const cosAz = (Math.sin(decR) - Math.sin(alt) * Math.sin(latR)) / (Math.cos(alt) * Math.cos(latR));
  const sinAz = (-Math.cos(decR) * Math.sin(Hr)) / Math.cos(alt);
  let az = Math.atan2(sinAz, cosAz) / DEG;
  az = (az + 360) % 360;

  return { altDeg: alt / DEG, azDeg: az };
}

// Rough visual color for a star from its B-V color index, via an
// approximate blackbody-temperature-to-RGB mapping. This is a stylistic
// approximation for a pleasant sky, not a spectrophotometric result.
function starColor(bv) {
  const clamped = Math.max(-0.4, Math.min(2.0, bv || 0));
  const temp = 4600 * (1 / (0.92 * clamped + 1.7) + 1 / (0.92 * clamped + 0.62));
  const t = temp / 100;
  let r, g, b;

  if (t <= 66) r = 255;
  else r = Math.min(255, Math.max(0, 329.698727446 * Math.pow(t - 60, -0.1332047592)));

  if (t <= 66) g = Math.min(255, Math.max(0, 99.4708025861 * Math.log(t) - 161.1195681661));
  else g = Math.min(255, Math.max(0, 288.1221695283 * Math.pow(t - 60, -0.0755148492)));

  if (t >= 66) b = 255;
  else if (t <= 19) b = 0;
  else b = Math.min(255, Math.max(0, 138.5177312231 * Math.log(t - 10) - 305.0447927307));

  return `${r | 0}, ${g | 0}, ${b | 0}`;
}

/* ---------- 3. Rendering -------------------------------------------- */

function startSky(config) {
  const canvas = document.getElementById("sky");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const observationTime = new Date(OBSERVATION_TIME_UTC);

  document.getElementById("place-name").textContent = config.placeName;
  document.getElementById("place-coords").textContent =
    `${formatCoord(config.lat, "N", "S")}, ${formatCoord(config.lon, "E", "W")}`;
  document.getElementById("place-time").textContent = formatObservationTime(observationTime);

  // Pre-compute alt/az once (time is fixed) and cache visible stars.
  const visible = [];
  for (const [ra, dec, mag, name, con, ci] of STAR_CATALOG) {
    const { altDeg, azDeg } = equatorialToHorizontal(ra, dec, config.lat, config.lon, observationTime);
    if (altDeg > -1) visible.push({ altDeg, azDeg, mag, name, ci });
  }
  visible.sort((a, b) => b.mag - a.mag); // faint first, bright drawn last (on top)

  document.getElementById("star-count").textContent = visible.filter((s) => s.altDeg > 0).length;

  let width, height, cx, cy, radius;
  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = width / 2;
    cy = height / 2;
    radius = Math.min(width, height) * 0.46;
  }
  window.addEventListener("resize", resize);
  resize();

  const twinklePhase = visible.map(() => Math.random() * Math.PI * 2);

  function project(altDeg, azDeg) {
    const r = ((90 - altDeg) / 90) * radius;
    const azR = azDeg * DEG;
    return { x: cx + r * Math.sin(azR), y: cy - r * Math.cos(azR) };
  }

  function drawDome(t) {
    ctx.clearRect(0, 0, width, height);

    // sky gradient
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.05);
    g.addColorStop(0, "#0b1330");
    g.addColorStop(0.7, "#060a1c");
    g.addColorStop(1, "#020308");
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // altitude rings at 60 deg and 30 deg
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (const alt of [30, 60]) {
      const r = ((90 - alt) / 90) * radius;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // horizon
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // cardinal directions
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "600 13px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelR = radius + 18;
    ctx.fillText("N", cx, cy - labelR);
    ctx.fillText("S", cx, cy + labelR);
    ctx.fillText("E", cx + labelR, cy);
    ctx.fillText("W", cx - labelR, cy);

    // stars
    for (let i = 0; i < visible.length; i++) {
      const s = visible[i];
      if (s.altDeg <= 0) continue;
      const { x, y } = project(s.altDeg, s.azDeg);
      const baseRadius = Math.max(0.35, (5.3 - s.mag) * 0.55);
      const twinkle = 0.85 + 0.15 * Math.sin(t * 0.0015 + twinklePhase[i]);
      const alpha = Math.max(0.25, Math.min(1, 1 - (s.mag + 1.5) / 7)) * twinkle;
      const rgb = starColor(s.ci);

      ctx.beginPath();
      ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
      ctx.arc(x, y, baseRadius * twinkle, 0, Math.PI * 2);
      ctx.fill();

      if (s.mag < 1.6) {
        // soft glow for the brightest stars
        const glow = ctx.createRadialGradient(x, y, 0, x, y, baseRadius * 5);
        glow.addColorStop(0, `rgba(${rgb}, ${alpha * 0.35})`);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.fillStyle = glow;
        ctx.arc(x, y, baseRadius * 5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (s.mag < 1.4 && s.name) {
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = "400 11px 'Spectral', serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(s.name, x + baseRadius + 5, y);
      }
    }

    requestAnimationFrame(drawDome);
  }
  requestAnimationFrame(drawDome);
}

function formatCoord(value, posLabel, negLabel) {
  const label = value >= 0 ? posLabel : negLabel;
  return `${Math.abs(value).toFixed(4)}°${label}`;
}

function formatObservationTime(date) {
  return (
    date.toLocaleString("en-US", {
      timeZone: "UTC",
      dateStyle: "long",
      timeStyle: "short",
    }) + " UTC"
  );
}
