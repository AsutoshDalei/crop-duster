'use strict';

const LOGIC_STEP = 1 / 60;
const MAX_FRAME_TIME = 0.25;
const FONT_STACK = '"Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif';

const FOV_Y = 1.22;
const NEAR = 0.5;
const CELL = 50;
const DRAW_DIST = 1200;
const FOG_START = 300;

const CAM_BACK = 30;
const CAM_HEIGHT = 10;
const CAM_PITCH = -0.13;
const CAM_LERP = 4;

const MAX_SPEED = 62;
const THROTTLE_RATE = 0.6;
const SPEED_EASE = 0.7;
const TURN_RATE = 0.75;
const CLIMB_RATE = 9;
const CLIMB_EASE = 1.8;
const BANK_EASE = 5;
const CLIMB_SPEED_COST = 18;
const MIN_SPEED = 5;
const STALL_SPEED = 13;
const STALL_BAND = 2;
const STALL_SINK = 3;
const STALL_WARN = 17;
const AIRFRAME_WIND = 0.35;
const MAX_DUST = 130;
const SUN_DIR = { x: -0.35, y: 0.62, z: -0.7 };
const DEEP_SKY = [40, 118, 190];

const CONTRACT_FIELDS = [1, 6, 9, 14];
const CONTRACT_TARGET = 0.8;
const CRASH_SPEED = 15;
const CRASH_VS = -4;
const BEST_KEY = 'cropDusterBest';

const SKY_TOP = [63, 151, 214];
const SKY_HORIZON = [203, 232, 250];
const GROUND_A = [111, 158, 70];
const GROUND_B = [99, 143, 62];
const FOG_COLOR = [198, 218, 233];
const FOG_WARM = [236, 217, 194];

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let viewW = 0;
let viewH = 0;
let focal = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = Math.floor(viewW * dpr);
  canvas.height = Math.floor(viewH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  focal = (viewH / 2) / Math.tan(FOV_Y / 2);
}

window.addEventListener('resize', resize);
resize();

const keys = new Set();
const CONTROL_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'Enter', 'Escape', 'KeyR'
]);

let state = 'TITLE';
let playTime = 0;
let failReason = '';
let finalScore = 0;
let crashThisFrame = false;

function loadBest() {
  try {
    return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  } catch (e) {
    return 0;
  }
}

let bestScore = loadBest();

const plane = {
  x: 0,
  y: 0,
  z: 0,
  heading: 0,
  speed: 0,
  vs: 0,
  throttle: 0
};

const cam = {
  x: 0,
  y: CAM_HEIGHT,
  z: -CAM_BACK,
  yaw: 0
};

let bankInput = 0;
let climbInput = 0;
let rudder = 0;
let shake = 0;
let cloudFlash = 0;
let stallWarn = false;
let rollingDustAcc = 0;
const dust = [];
const sunScreen = { front: false, x: 0, y: 0 };
let cloudBankCv = null;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function resetFlight() {
  plane.x = START.x;
  plane.y = START.y;
  plane.z = START.z;
  plane.heading = START.heading;
  plane.speed = 0;
  plane.vs = 0;
  plane.throttle = 0;
  bankInput = 0;
  climbInput = 0;
  rudder = 0;
  stallWarn = false;
  cam.x = plane.x - Math.sin(plane.heading) * CAM_BACK;
  cam.y = plane.y + CAM_HEIGHT;
  cam.z = plane.z - Math.cos(plane.heading) * CAM_BACK;
  cam.yaw = plane.heading;
}

function setState(next) {
  state = next;
  shake = 0;
  cloudFlash = 0;
  document.body.classList.toggle('playing', state === 'PLAYING');
  if (state === 'PLAYING') {
    playTime = 0;
    failReason = '';
    crashThisFrame = false;
    resetFlight();
    resetSpray();
    resetContract();
  }
}

window.addEventListener('keydown', (e) => {
  if (CONTROL_KEYS.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Enter' && state === 'TITLE') setState('PLAYING');
  if (e.code === 'Escape' && state !== 'TITLE') setState('TITLE');
  if (e.code === 'KeyR' && (state === 'COMPLETE' || state === 'FAILED')) setState('PLAYING');
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

window.addEventListener('blur', () => keys.clear());

function update(dt) {
  if (state !== 'PLAYING') return;
  playTime += dt;

  if (keys.has('ArrowUp')) plane.throttle += THROTTLE_RATE * dt;
  if (keys.has('ArrowDown')) plane.throttle -= THROTTLE_RATE * dt;
  plane.throttle = Math.max(0, Math.min(1, plane.throttle));

  rudder = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  climbInput = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  bankInput += (rudder - bankInput) * Math.min(1, dt * BANK_EASE);

  const onGround = plane.y < 0.6;
  const targetSpeed = plane.throttle * MAX_SPEED - climbInput * CLIMB_SPEED_COST;
  plane.speed += (targetSpeed - plane.speed) * Math.min(1, dt * SPEED_EASE);
  plane.speed = Math.max(onGround ? 0 : MIN_SPEED, Math.min(MAX_SPEED * 1.2, plane.speed));

  const stallF = onGround
    ? 1
    : Math.max(0, Math.min(1, (plane.speed - STALL_SPEED) / STALL_BAND));
  stallWarn = !onGround && plane.y > 15 &&
    (stallF === 0 || (plane.speed < STALL_WARN && plane.vs > -1));

  const turnAuth = (0.35 + 0.65 * Math.min(1, plane.speed / MAX_SPEED)) *
    (0.3 + 0.7 * stallF);
  if (onGround) {
    plane.heading = wrapAngle(plane.heading + rudder * TURN_RATE * turnAuth * dt);
  } else {
    plane.heading = wrapAngle(plane.heading + bankInput * TURN_RATE * turnAuth * dt);
  }

  let targetVs = climbInput * CLIMB_RATE * stallF;
  if (!onGround) targetVs -= STALL_SINK * (1 - stallF);
  plane.vs += (targetVs - plane.vs) * Math.min(1, dt * CLIMB_EASE);

  const windK = onGround ? 0 : AIRFRAME_WIND;
  plane.x += (Math.sin(plane.heading) * plane.speed + WIND.x * windK) * dt;
  plane.z += (Math.cos(plane.heading) * plane.speed + WIND.z * windK) * dt;
  const prevY = plane.y;
  const prevVs = plane.vs;
  plane.y += plane.vs * dt;
  if (plane.y < 0) {
    plane.y = 0;
    if (plane.vs < 0) plane.vs = 0;
  }
  crashThisFrame = prevY > 0 && plane.y === 0 &&
    (plane.speed > CRASH_SPEED || prevVs < CRASH_VS);
  if (prevY > 0 && plane.y === 0 && !crashThisFrame) {
    spawnDust(plane.x, plane.z, 28, 9);
    shake = Math.max(shake, 0.8);
  }
  if (plane.x < WORLD.minX + 40) plane.x = WORLD.minX + 40;
  if (plane.x > WORLD.maxX - 40) plane.x = WORLD.maxX - 40;
  if (plane.z < WORLD.minZ + 40) plane.z = WORLD.minZ + 40;
  if (plane.z > WORLD.maxZ - 40) plane.z = WORLD.maxZ - 40;

  const tx = plane.x - Math.sin(plane.heading) * CAM_BACK;
  const ty = plane.y + CAM_HEIGHT;
  const tz = plane.z - Math.cos(plane.heading) * CAM_BACK;
  const k = Math.min(1, dt * CAM_LERP);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.z += (tz - cam.z) * k;
  cam.yaw = wrapAngle(cam.yaw + wrapAngle(plane.heading - cam.yaw) * k);

  const rumble = plane.y === 0 && plane.speed > 4 ? Math.min(0.35, plane.speed / 120) : 0;
  shake = Math.max(rumble, shake - dt * 2);
  updateDust(dt);
  updateCloudFlash();
  updateSpray(dt);

  if (contractDone()) {
    startEnd('COMPLETE', '');
    return;
  }
  if (crashThisFrame) {
    startEnd('FAILED', 'Crash — you hit the ground too hard');
    return;
  }
  if (tank.current <= 0 && refillsLeft <= 0) {
    startEnd('FAILED', 'Out of fertilizer — contract incomplete');
  }
}

function makeCam() {
  const sy = Math.sin(cam.yaw);
  const cy = Math.cos(cam.yaw);
  const sp = Math.sin(CAM_PITCH);
  const cp = Math.cos(CAM_PITCH);
  const rx = cy;
  const ry = 0;
  const rz = -sy;
  const ux = -sp * sy;
  const uy = cp;
  const uz = -sp * cy;
  const ox = (Math.random() - 0.5) * shake * 1.4;
  const oy = (Math.random() - 0.5) * shake * 1.4;
  return {
    px: cam.x + rx * ox + ux * oy,
    py: cam.y + ry * ox + uy * oy,
    pz: cam.z + rz * ox + uz * oy,
    rx: rx,
    ry: ry,
    rz: rz,
    ux: ux,
    uy: uy,
    uz: uz,
    fx: sy * cp,
    fy: sp,
    fz: cy * cp
  };
}

function toCamera(c, wx, wy, wz) {
  const dx = wx - c.px;
  const dy = wy - c.py;
  const dz = wz - c.pz;
  return {
    x: dx * c.rx + dy * c.ry + dz * c.rz,
    y: dx * c.ux + dy * c.uy + dz * c.uz,
    z: dx * c.fx + dy * c.fy + dz * c.fz
  };
}

function projectCam(p) {
  return {
    x: viewW / 2 + (focal * p.x) / p.z,
    y: viewH / 2 - (focal * p.y) / p.z,
    z: p.z
  };
}

const polyCam = [
  { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 },
  { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }
];
const polyClip = [];
const polyScreen = [];
for (let i = 0; i < 16; i++) {
  polyClip.push({ x: 0, y: 0, z: 0 });
  polyScreen.push({ x: 0, y: 0, z: 0 });
}

function lerpColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

function rgb(c, alpha) {
  if (alpha === undefined) {
    return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  }
  return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')';
}

function fogT(dist) {
  let t = (dist - FOG_START) / (DRAW_DIST - FOG_START);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function fillWorldPoly(c, worldPts, baseColor, dist, alpha) {
  const n = worldPts.length;
  let allBehind = true;
  for (let i = 0; i < n; i++) {
    const wp = worldPts[i];
    const p = polyCam[i];
    const dx = wp[0] - c.px;
    const dy = wp[1] - c.py;
    const dz = wp[2] - c.pz;
    p.x = dx * c.rx + dy * c.ry + dz * c.rz;
    p.y = dx * c.ux + dy * c.uy + dz * c.uz;
    p.z = dx * c.fx + dy * c.fy + dz * c.fz;
    if (p.z >= NEAR) allBehind = false;
  }
  if (allBehind) return;

  let m = 0;
  for (let i = 0; i < n; i++) {
    const a = polyCam[i];
    const b = polyCam[(i + 1) % n];
    const aIn = a.z >= NEAR;
    const bIn = b.z >= NEAR;
    if (aIn) {
      const o = polyClip[m++];
      o.x = a.x;
      o.y = a.y;
      o.z = a.z;
    }
    if (aIn !== bIn) {
      const t = (NEAR - a.z) / (b.z - a.z);
      const o = polyClip[m++];
      o.x = a.x + (b.x - a.x) * t;
      o.y = a.y + (b.y - a.y) * t;
      o.z = NEAR;
    }
  }
  if (m < 3) return;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < m; i++) {
    const p = polyClip[i];
    const s = polyScreen[i];
    s.x = viewW / 2 + (focal * p.x) / p.z;
    s.y = viewH / 2 - (focal * p.y) / p.z;
    if (s.x < minX) minX = s.x;
    if (s.x > maxX) maxX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.y > maxY) maxY = s.y;
  }
  if (maxX < 0 || minX > viewW || maxY < 0 || minY > viewH) return;

  const ft = fogT(dist);
  let fr = FOG_COLOR[0];
  let fg = FOG_COLOR[1];
  let fb = FOG_COLOR[2];
  if (sunScreen.front && ft > 0.02) {
    const cxw = (minX + maxX) * 0.5;
    const warmK = Math.max(0, 1 - Math.abs(cxw - sunScreen.x) / (viewW * 0.9)) * 0.6 * ft;
    fr += (FOG_WARM[0] - fr) * warmK;
    fg += (FOG_WARM[1] - fg) * warmK;
    fb += (FOG_WARM[2] - fb) * warmK;
  }
  const mixed = [
    Math.round(baseColor[0] + (fr - baseColor[0]) * ft),
    Math.round(baseColor[1] + (fg - baseColor[1]) * ft),
    Math.round(baseColor[2] + (fb - baseColor[2]) * ft)
  ];
  const color = alpha === undefined ? rgb(mixed) : rgb(mixed, alpha);
  ctx.beginPath();
  ctx.moveTo(polyScreen[0].x, polyScreen[0].y);
  for (let i = 1; i < m; i++) {
    ctx.lineTo(polyScreen[i].x, polyScreen[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function updateSun(c) {
  const d = SUN_DIR;
  const pc = toCamera(c, c.px + d.x * 8000, c.py + d.y * 8000, c.pz + d.z * 8000);
  if (pc.z < NEAR) {
    sunScreen.front = false;
    return;
  }
  const s = projectCam(pc);
  sunScreen.front = true;
  sunScreen.x = s.x;
  sunScreen.y = s.y;
}

function buildCloudBank() {
  const W = 2048;
  const H = 160;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  let seed = 20261007;
  const rr = function () {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 10; i++) {
    const cx = 170 + rr() * (W - 340);
    const base = H - 14 - rr() * 26;
    const scale = 0.7 + rr() * 0.8;
    const count = 5 + Math.floor(rr() * 4);
    for (let p = 0; p < count; p++) {
      const pr = (20 + rr() * 34) * scale;
      const px = cx + (rr() - 0.5) * 150 * scale;
      const py = base - rr() * 50 * scale;
      if (px < pr + 4 || px > W - pr - 4 || py < pr + 4) continue;
      const grad = g.createRadialGradient(px, py, pr * 0.2, px, py, pr);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
      grad.addColorStop(0.55, 'rgba(247, 251, 254, 0.5)');
      grad.addColorStop(1, 'rgba(238, 245, 251, 0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(px, py, pr, 0, Math.PI * 2);
      g.fill();
    }
    for (let p = 0; p < 3; p++) {
      const pr = (24 + rr() * 30) * scale;
      const px = cx + (rr() - 0.5) * 130 * scale;
      const py = base - rr() * 14;
      if (px < pr + 4 || px > W - pr - 4) continue;
      const grad = g.createRadialGradient(px, py, pr * 0.2, px, py, pr);
      grad.addColorStop(0, 'rgba(205, 219, 233, 0.5)');
      grad.addColorStop(1, 'rgba(205, 219, 233, 0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(px, py, pr, 0, Math.PI * 2);
      g.fill();
    }
  }
  return cv;
}

function drawCloudBank(horizonY) {
  if (!cloudBankCv) cloudBankCv = buildCloudBank();
  const tileW = Math.PI * 2 * focal;
  const offset = -cam.yaw * focal;
  const y = Math.round(horizonY - cloudBankCv.height) + 4;
  ctx.globalAlpha = Math.max(0.35, Math.min(1, 1 - plane.y / 600));
  let k = Math.floor(-offset / tileW);
  while (k * tileW + offset < viewW) {
    const x = k * tileW + offset;
    if (x + tileW > 0) {
      ctx.drawImage(cloudBankCv, Math.round(x), y, Math.ceil(tileW), cloudBankCv.height);
    }
    k++;
  }
  ctx.globalAlpha = 1;
}

function drawSky(c) {
  const horizonY = Math.round(viewH / 2 + focal * Math.tan(CAM_PITCH));
  const skyBottom = Math.max(1, horizonY);
  const altT = Math.min(1, plane.y / 400);
  const top = lerpColor(SKY_TOP, DEEP_SKY, altT);
  const mid = lerpColor(top, SKY_HORIZON, 0.55);
  const sky = ctx.createLinearGradient(0, 0, 0, skyBottom);
  sky.addColorStop(0, rgb(top));
  sky.addColorStop(0.6, rgb(mid));
  sky.addColorStop(1, rgb(SKY_HORIZON));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewW, skyBottom);

  drawCloudBank(horizonY);

  const hazeH = Math.min(140, Math.max(50, viewH * 0.14));
  const hazeY = Math.max(0, horizonY - hazeH);
  const haze = ctx.createLinearGradient(0, hazeY, 0, horizonY);
  haze.addColorStop(0, 'rgba(198, 218, 233, 0)');
  haze.addColorStop(1, 'rgba(198, 218, 233, 0.8)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, hazeY, viewW, horizonY - hazeY);

  if (sunScreen.front) {
    const sx = sunScreen.x;
    const sy = Math.min(Math.max(sunScreen.y, 0), horizonY);
    const tr = Math.max(viewW, viewH) * 0.85;
    const warm = ctx.createRadialGradient(sx, sy, 0, sx, sy, tr);
    warm.addColorStop(0, 'rgba(255, 227, 172, 0.24)');
    warm.addColorStop(0.4, 'rgba(255, 233, 189, 0.09)');
    warm.addColorStop(1, 'rgba(255, 240, 205, 0)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, viewW, skyBottom);
  }

  ctx.fillStyle = rgb(FOG_COLOR);
  ctx.fillRect(0, skyBottom, viewW, viewH - skyBottom);
}

function drawSun() {
  if (!sunScreen.front) return;
  const sx = sunScreen.x;
  const sy = sunScreen.y;
  if (sx < -300 || sx > viewW + 300 || sy < -300 || sy > viewH + 300) return;

  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 220);
  glow.addColorStop(0, 'rgba(255, 250, 230, 0.9)');
  glow.addColorStop(0.25, 'rgba(255, 244, 200, 0.4)');
  glow.addColorStop(1, 'rgba(255, 240, 190, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - 220, sy - 220, 440, 440);

  const halo = ctx.createRadialGradient(sx, sy, 8, sx, sy, 44);
  halo.addColorStop(0, 'rgba(255, 252, 235, 0.85)');
  halo.addColorStop(1, 'rgba(255, 247, 214, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sx - 44, sy - 44, 88, 88);

  ctx.beginPath();
  ctx.arc(sx, sy, 13, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 253, 242, 0.98)';
  ctx.fill();
}

function spawnDust(x, z, count, spread) {
  for (let i = 0; i < count; i++) {
    if (dust.length >= MAX_DUST) return;
    dust.push({
      x: x + (Math.random() - 0.5) * spread,
      y: 0.2 + Math.random() * 0.5,
      z: z + (Math.random() - 0.5) * spread,
      vx: (Math.random() - 0.5) * 3,
      vy: 1 + Math.random() * 2.5,
      vz: (Math.random() - 0.5) * 3,
      life: 1,
      r: 1 + Math.random() * 1.5
    });
  }
}

function updateDust(dt) {
  if (plane.y === 0 && plane.speed > 4) {
    rollingDustAcc += dt * 8;
    while (rollingDustAcc >= 1) {
      spawnDust(
        plane.x - Math.sin(plane.heading) * 4,
        plane.z - Math.cos(plane.heading) * 4,
        1, 2
      );
      rollingDustAcc -= 1;
    }
  }
  for (let i = dust.length - 1; i >= 0; i--) {
    const p = dust[i];
    p.x += (p.vx + WIND.x * 0.8) * dt;
    p.y += p.vy * dt;
    p.z += (p.vz + WIND.z * 0.8) * dt;
    p.vy -= 2.5 * dt;
    p.life -= dt * 0.9;
    p.r += dt * 2.5;
    if (p.life <= 0) dust.splice(i, 1);
  }
}

function updateCloudFlash() {
  let hit = 0;
  for (let i = 0; i < PROPS.length; i++) {
    const p = PROPS[i];
    if (p.type !== 'cloud') continue;
    if (Math.abs(plane.x - p.x) < p.w / 2 &&
        Math.abs(plane.z - p.z) < p.w / 2 &&
        Math.abs(plane.y - p.y) < p.h / 2 + 20) {
      hit = 0.45;
      break;
    }
  }
  cloudFlash = Math.max(hit, cloudFlash - 0.03);
}

function drawDust(c) {
  for (let i = 0; i < dust.length; i++) {
    const p = dust[i];
    const pc = toCamera(c, p.x, p.y, p.z);
    if (pc.z < NEAR) continue;
    const s = projectCam(pc);
    if (s.x < -30 || s.x > viewW + 30 || s.y < -30 || s.y > viewH + 30) continue;
    const r = (focal * p.r) / pc.z;
    if (r < 0.5) continue;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(158, 134, 96, ' + Math.max(0, p.life * 0.35) + ')';
    ctx.fill();
  }
}

function drawShadow(c) {
  const p = toCamera(c, plane.x, 0.1, plane.z);
  if (p.z < NEAR) return;
  const s = projectCam(p);
  if (s.x < -100 || s.x > viewW + 100 || s.y < -100 || s.y > viewH + 100) return;

  const radius = (focal * 5.5) / p.z;
  const alpha = Math.max(0.12, Math.min(0.5, 0.5 - plane.y / 240));
  ctx.beginPath();
  ctx.ellipse(s.x, s.y, radius, radius * 0.45, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20, 35, 12, ' + alpha + ')';
  ctx.fill();
}

function drawPlaneShape(c) {
  const p = toCamera(c, plane.x, plane.y, plane.z);
  if (p.z < NEAR) return;
  const s = projectCam(p);
  const half = (focal * 5.5) / p.z;
  if (half < 4) return;

  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.translate(0, climbInput * 4);
  ctx.rotate(bankInput * 0.45);
  ctx.scale(half, half);
  ctx.lineJoin = 'round';

  ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.05 + plane.throttle * 0.28) + ')';
  ctx.beginPath();
  ctx.ellipse(0, -0.04, 0.26, 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f0c038';
  ctx.beginPath();
  ctx.ellipse(0, -0.02, 0.16, 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40, 30, 5, 0.55)';
  ctx.lineWidth = 0.02;
  ctx.stroke();

  ctx.fillStyle = '#c8402c';
  ctx.fillRect(-0.12, 0.08, 0.24, 0.045);

  ctx.fillStyle = '#f0c038';
  ctx.fillRect(-1, 0.05, 2, 0.11);
  ctx.fillStyle = '#c8402c';
  ctx.fillRect(-1, 0.14, 2, 0.02);
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(-1, 0.05, 0.1, 0.11);
  ctx.fillRect(0.9, 0.05, 0.1, 0.11);
  ctx.strokeStyle = 'rgba(40, 30, 5, 0.55)';
  ctx.strokeRect(-1, 0.05, 2, 0.11);

  ctx.fillStyle = '#d9a926';
  ctx.fillRect(-0.78, 0.05 + bankInput * 0.035, 0.3, 0.05);
  ctx.fillRect(0.48, 0.05 - bankInput * 0.035, 0.3, 0.05);

  ctx.strokeStyle = '#555555';
  ctx.lineWidth = 0.03;
  ctx.beginPath();
  ctx.moveTo(-0.12, 0.16);
  ctx.lineTo(-0.3, 0.33);
  ctx.moveTo(0.12, 0.16);
  ctx.lineTo(0.3, 0.33);
  ctx.stroke();
  ctx.fillStyle = '#222222';
  ctx.beginPath();
  ctx.ellipse(-0.3, 0.36, 0.05, 0.065, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.3, 0.36, 0.05, 0.065, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e2b02e';
  ctx.fillRect(-0.42, -0.4 - climbInput * 0.03, 0.84, 0.07);
  ctx.strokeStyle = 'rgba(40, 30, 5, 0.55)';
  ctx.lineWidth = 0.02;
  ctx.strokeRect(-0.42, -0.4 - climbInput * 0.03, 0.84, 0.07);

  ctx.fillStyle = '#f0c038';
  ctx.fillRect(-0.05, -0.72, 0.1, 0.36);
  ctx.fillStyle = '#c8402c';
  ctx.fillRect(-0.05, -0.72, 0.1, 0.07);
  ctx.fillStyle = '#d9a926';
  ctx.fillRect(-0.05 + bankInput * 0.035, -0.65, 0.1, 0.29);
  ctx.strokeStyle = 'rgba(40, 30, 5, 0.55)';
  ctx.strokeRect(-0.05, -0.72, 0.1, 0.36);

  ctx.restore();
}

function drawText(text, x, y, size, color, align) {
  ctx.font = 'bold ' + size + 'px ' + FONT_STACK;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillText(text, x, y);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function drawTitle() {
  drawText('CROP DUSTER', viewW / 2, viewH * 0.36, 64, '#ffffff');
  drawText('Press Enter to start', viewW / 2, viewH * 0.47, 26, '#f4f7ef');
  drawText('W / S  altitude     A / D  lateral', viewW / 2, viewH * 0.58, 20, '#e8f1dd');
  drawText('↑ / ↓  throttle     Space  spray', viewW / 2, viewH * 0.63, 20, '#e8f1dd');
  if (bestScore > 0) {
    drawText('Best score  ' + bestScore, viewW / 2, viewH * 0.9, 15, 'rgba(255, 224, 138, 0.85)');
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function drawDebug() {
  const alt = plane.y;
  const spd = plane.speed * 3.6;
  let hdg = Math.round((plane.heading * 180) / Math.PI) % 360;
  if (hdg < 0) hdg += 360;

  const tankPct = Math.round((tank.current / tank.capacity) * 100);
  const spraying = keys.has('Space') && tank.current > 0;
  const lines = [
    'ALT  ' + alt.toFixed(1) + ' m      SPD  ' + spd.toFixed(0) + ' km/h      HDG  ' + String(hdg).padStart(3, '0') + '°',
    'THR  ' + Math.round(plane.throttle * 100) + '%      VS  ' + (plane.vs >= 0 ? '+' : '') + plane.vs.toFixed(1) + ' m/s      T  ' + formatTime(playTime),
    'TANK ' + String(tankPct).padStart(3, ' ') + '%      ' + (spraying ? 'SPRAYING' : 'SPRAY OFF')
  ];
  ctx.font = '14px ' + FONT_STACK;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 4;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 14, viewH - 70 + i * 18);
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  ctx.font = '13px ' + FONT_STACK;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.textAlign = 'center';
  ctx.fillText('Esc — back to title', viewW / 2, viewH - 14);
}

function drawStallWarning() {
  if (!stallWarn) return;
  if (Math.floor(playTime * 5) % 2 === 0) return;
  drawText('STALL', viewW / 2, viewH * 0.22, 36, '#ff9070');
}

function resetContract() {
  for (let i = 0; i < fields.length; i++) {
    fields[i].contract = false;
    fields[i].contractIndex = 0;
    fields[i].target = CONTRACT_TARGET;
  }
  for (let i = 0; i < CONTRACT_FIELDS.length; i++) {
    const f = fields[CONTRACT_FIELDS[i]];
    f.contract = true;
    f.contractIndex = i + 1;
  }
}

function contractDone() {
  for (let i = 0; i < CONTRACT_FIELDS.length; i++) {
    const f = fields[CONTRACT_FIELDS[i]];
    if (f.coverage < f.target) return false;
  }
  return true;
}

function contractDoneCount() {
  let n = 0;
  for (let i = 0; i < CONTRACT_FIELDS.length; i++) {
    const f = fields[CONTRACT_FIELDS[i]];
    if (f.coverage >= f.target) n++;
  }
  return n;
}

function scoreParts() {
  let sum = 0;
  for (let i = 0; i < CONTRACT_FIELDS.length; i++) {
    const f = fields[CONTRACT_FIELDS[i]];
    sum += Math.min(1, f.coverage / f.target);
  }
  const coverage = (sum / CONTRACT_FIELDS.length) * 600;
  const effRatio = sprayStats.released > 0 ? sprayStats.deposited / sprayStats.released : 0;
  const efficiency = effRatio * 200;
  const time = Math.max(0, 200 - playTime / 2);
  return {
    coverage: Math.round(coverage),
    efficiency: Math.round(efficiency),
    time: Math.round(time),
    total: Math.round(coverage + efficiency + time)
  };
}

function startEnd(kind, reason) {
  failReason = reason;
  const parts = scoreParts();
  finalScore = parts.total;
  if (kind === 'COMPLETE' && finalScore > bestScore) {
    bestScore = finalScore;
    try {
      localStorage.setItem(BEST_KEY, String(bestScore));
    } catch (e) {}
  }
  setState(kind);
}

function drawContractPanel() {
  const x = 14;
  drawText(
    'CONTRACT  ' + contractDoneCount() + '/' + CONTRACT_FIELDS.length + ' complete',
    x, 20, 16, '#ffffff', 'left'
  );
  for (let i = 0; i < CONTRACT_FIELDS.length; i++) {
    const f = fields[CONTRACT_FIELDS[i]];
    const pct = Math.round(f.coverage * 100);
    const ok = f.coverage >= f.target;
    const label = 'F' + (i + 1) + '  ' + String(pct).padStart(3, ' ') + '%' +
      (ok ? '  DONE' : '  → ' + Math.round(f.target * 100) + '%');
    drawText(label, x, 44 + i * 20, 14, ok ? '#9be87d' : '#e8f1dd', 'left');
  }
  drawText('REFILLS  ' + refillsLeft, x, 44 + CONTRACT_FIELDS.length * 20 + 4, 14, '#ffe08a', 'left');
}

function drawTankGauge() {
  const w = 230;
  const h = 12;
  const x = 14;
  const y = viewH - 96;
  const frac = tank.current / tank.capacity;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = frac > 0.25 ? '#7ec850' : '#e08030';
  ctx.fillRect(x, y, w * frac, h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function drawEndScreen() {
  const parts = scoreParts();
  ctx.fillStyle = 'rgba(8, 14, 6, 0.6)';
  ctx.fillRect(viewW / 2 - 340, viewH * 0.2, 680, viewH * 0.6);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(viewW / 2 - 340, viewH * 0.2, 680, viewH * 0.6);
  if (state === 'COMPLETE') {
    drawText('CONTRACT COMPLETE', viewW / 2, viewH * 0.3, 52, '#9be87d');
    drawText('Score  ' + parts.total, viewW / 2, viewH * 0.42, 34, '#ffffff');
    drawText(
      'Coverage ' + parts.coverage + ' / 600      Efficiency ' + parts.efficiency +
      ' / 200      Time ' + parts.time + ' / 200',
      viewW / 2, viewH * 0.52, 18, '#e8f1dd'
    );
    drawText('Best  ' + bestScore, viewW / 2, viewH * 0.6, 20, '#ffe08a');
  } else {
    drawText('CONTRACT FAILED', viewW / 2, viewH * 0.3, 52, '#ff9070');
    drawText(failReason, viewW / 2, viewH * 0.42, 24, '#ffffff');
    drawText(
      'Contract  ' + contractDoneCount() + '/' + CONTRACT_FIELDS.length +
      ' fields      Score  ' + parts.total,
      viewW / 2, viewH * 0.52, 18, '#e8f1dd'
    );
  }
  drawText('R — new contract      Esc — title', viewW / 2, viewH * 0.72, 18, 'rgba(255, 255, 255, 0.75)');
}

let fps = 0;
let frames = 0;
let fpsElapsed = 0;

function render() {
  const c = makeCam();

  updateSun(c);
  drawSky(c);
  drawSun();
  drawTerrain(c);
  drawSurfaces(c);
  drawCoverage(c);
  drawProps(c);
  drawParticles(c);
  drawDust(c);
  drawShadow(c);
  drawPlaneShape(c);

  if (cloudFlash > 0.01) {
    ctx.fillStyle = 'rgba(255, 255, 255, ' + Math.min(0.5, cloudFlash) + ')';
    ctx.fillRect(0, 0, viewW, viewH);
  }

  if (state === 'TITLE') {
    drawTitle();
  } else if (state === 'COMPLETE' || state === 'FAILED') {
    drawEndScreen();
  } else {
    drawDebug();
    drawStallWarning();
    drawContractPanel();
    drawTankGauge();
    drawRefillPrompt();
    drawMinimap();
  }

  ctx.font = '14px ' + FONT_STACK;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(fps + ' FPS', viewW - 12, 10);
}

resetFlight();

let lastTime = performance.now();
let accumulator = 0;

function frame(now) {
  let frameTime = (now - lastTime) / 1000;
  lastTime = now;
  if (frameTime > MAX_FRAME_TIME) frameTime = MAX_FRAME_TIME;
  accumulator += frameTime;

  while (accumulator >= LOGIC_STEP) {
    update(LOGIC_STEP);
    accumulator -= LOGIC_STEP;
  }

  frames += 1;
  fpsElapsed += frameTime;
  if (fpsElapsed >= 0.5) {
    fps = Math.round(frames / fpsElapsed);
    frames = 0;
    fpsElapsed = 0;
  }

  render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
