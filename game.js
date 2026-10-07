'use strict';

const LOGIC_STEP = 1 / 60;
const MAX_FRAME_TIME = 0.25;
const FONT_STACK = '"Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif';

const FOV_Y = 1.22;
const NEAR = 0.5;
const CELL = 50;
const DRAW_DIST = 1200;
const FOG_START = 350;

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

const SKY_TOP = [63, 151, 214];
const SKY_HORIZON = [203, 232, 250];
const GROUND_A = [111, 158, 70];
const GROUND_B = [99, 143, 62];
const FOG_COLOR = [198, 218, 233];

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

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function resetFlight() {
  plane.x = 0;
  plane.y = 0;
  plane.z = 0;
  plane.heading = 0;
  plane.speed = 0;
  plane.vs = 0;
  plane.throttle = 0;
  bankInput = 0;
  climbInput = 0;
  rudder = 0;
  cam.x = plane.x - Math.sin(plane.heading) * CAM_BACK;
  cam.y = plane.y + CAM_HEIGHT;
  cam.z = plane.z - Math.cos(plane.heading) * CAM_BACK;
  cam.yaw = plane.heading;
}

function setState(next) {
  state = next;
  document.body.classList.toggle('playing', state === 'PLAYING');
  if (state === 'PLAYING') {
    playTime = 0;
    resetFlight();
  }
}

window.addEventListener('keydown', (e) => {
  if (CONTROL_KEYS.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Enter' && state === 'TITLE') setState('PLAYING');
  if (e.code === 'Escape' && state === 'PLAYING') setState('TITLE');
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

  const targetSpeed = plane.throttle * MAX_SPEED;
  plane.speed += (targetSpeed - plane.speed) * Math.min(1, dt * SPEED_EASE);

  rudder = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  climbInput = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  bankInput += (rudder - bankInput) * Math.min(1, dt * BANK_EASE);

  const turnEff = TURN_RATE * (0.35 + 0.65 * (plane.speed / MAX_SPEED));
  plane.heading = wrapAngle(plane.heading + rudder * turnEff * dt);

  const targetVs = climbInput * CLIMB_RATE;
  plane.vs += (targetVs - plane.vs) * Math.min(1, dt * CLIMB_EASE);

  plane.x += Math.sin(plane.heading) * plane.speed * dt;
  plane.z += Math.cos(plane.heading) * plane.speed * dt;
  plane.y += plane.vs * dt;
  if (plane.y < 0) {
    plane.y = 0;
    if (plane.vs < 0) plane.vs = 0;
  }

  const tx = plane.x - Math.sin(plane.heading) * CAM_BACK;
  const ty = plane.y + CAM_HEIGHT;
  const tz = plane.z - Math.cos(plane.heading) * CAM_BACK;
  const k = Math.min(1, dt * CAM_LERP);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.z += (tz - cam.z) * k;
  cam.yaw = wrapAngle(cam.yaw + wrapAngle(plane.heading - cam.yaw) * k);
}

function makeCam() {
  const sy = Math.sin(cam.yaw);
  const cy = Math.cos(cam.yaw);
  const sp = Math.sin(CAM_PITCH);
  const cp = Math.cos(CAM_PITCH);
  return {
    px: cam.x,
    py: cam.y,
    pz: cam.z,
    rx: cy,
    ry: 0,
    rz: -sy,
    ux: -sp * sy,
    uy: cp,
    uz: -sp * cy,
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

function clipNear(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const aIn = a.z >= NEAR;
    const bIn = b.z >= NEAR;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = (NEAR - a.z) / (b.z - a.z);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR });
    }
  }
  return out;
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
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return t * t * (3 - 2 * t);
}

function fillWorldPoly(c, worldPts, baseColor, dist) {
  const camPts = [];
  for (let i = 0; i < worldPts.length; i++) {
    const p = worldPts[i];
    camPts.push(toCamera(c, p[0], p[1], p[2]));
  }
  let allBehind = true;
  for (let i = 0; i < camPts.length; i++) {
    if (camPts[i].z >= NEAR) {
      allBehind = false;
      break;
    }
  }
  if (allBehind) return;

  const clipped = clipNear(camPts);
  if (clipped.length < 3) return;

  const screen = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < clipped.length; i++) {
    const s = projectCam(clipped[i]);
    screen.push(s);
    if (s.x < minX) minX = s.x;
    if (s.x > maxX) maxX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.y > maxY) maxY = s.y;
  }
  if (maxX < 0 || minX > viewW || maxY < 0 || minY > viewH) return;

  const color = rgb(lerpColor(baseColor, FOG_COLOR, fogT(dist)));
  ctx.beginPath();
  ctx.moveTo(screen[0].x, screen[0].y);
  for (let i = 1; i < screen.length; i++) {
    ctx.lineTo(screen[i].x, screen[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawSky(c) {
  const horizonY = Math.round(viewH / 2 + focal * Math.tan(CAM_PITCH));
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, rgb(SKY_TOP));
  sky.addColorStop(1, rgb(SKY_HORIZON));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewW, Math.max(0, horizonY));

  ctx.fillStyle = rgb(FOG_COLOR);
  ctx.fillRect(0, Math.max(0, horizonY), viewW, viewH - Math.max(0, horizonY));
}

function drawGround(c) {
  const i0 = Math.floor((c.px - DRAW_DIST) / CELL);
  const i1 = Math.floor((c.px + DRAW_DIST) / CELL);
  const j0 = Math.floor((c.pz - DRAW_DIST) / CELL);
  const j1 = Math.floor((c.pz + DRAW_DIST) / CELL);

  for (let j = j1; j >= j0; j--) {
    for (let i = i1; i >= i0; i--) {
      const x0 = i * CELL;
      const x1 = x0 + CELL;
      const z0 = j * CELL;
      const z1 = z0 + CELL;

      const cxw = (x0 + x1) / 2;
      const czw = (z0 + z1) / 2;
      const dx = cxw - c.px;
      const dz = czw - c.pz;
      const dist = Math.sqrt(dx * dx + dz * dz + c.py * c.py);
      if (dist > DRAW_DIST + CELL) continue;

      const base = ((i + j) & 1) === 0 ? GROUND_A : GROUND_B;
      fillWorldPoly(c, [
        [x0, 0, z0],
        [x1, 0, z0],
        [x1, 0, z1],
        [x0, 0, z1]
      ], base, dist);
    }
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

  ctx.fillStyle = '#8a6a1c';
  ctx.fillRect(-0.42, -0.46, 0.84, 0.09);

  ctx.fillStyle = '#f0c038';
  ctx.fillRect(-1, -0.07, 2, 0.14);

  ctx.fillStyle = '#d9a926';
  ctx.beginPath();
  ctx.ellipse(0, 0.04, 0.17, 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f0c038';
  ctx.fillRect(-0.035, -0.5, 0.07, 0.34);

  ctx.fillStyle = '#e2b02e';
  ctx.fillRect(-1, -0.07, 0.28, 0.14);
  ctx.fillRect(0.72, -0.07, 0.28, 0.14);

  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(-1, -0.02, 2, 0.035);

  ctx.fillStyle = '#9fd4ef';
  ctx.beginPath();
  ctx.ellipse(0, -0.14, 0.1, 0.09, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(40, 30, 5, 0.55)';
  ctx.lineWidth = 0.02;
  ctx.strokeRect(-1, -0.07, 2, 0.14);
  ctx.strokeRect(-0.035, -0.5, 0.07, 0.34);
  ctx.strokeRect(-0.42, -0.46, 0.84, 0.09);

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
  drawText('Stage 1 — free flight test build', viewW / 2, viewH * 0.9, 15, 'rgba(255, 255, 255, 0.7)');
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

  const lines = [
    'ALT  ' + alt.toFixed(1) + ' m      SPD  ' + spd.toFixed(0) + ' km/h      HDG  ' + String(hdg).padStart(3, '0') + '°',
    'THR  ' + Math.round(plane.throttle * 100) + '%      VS  ' + (plane.vs >= 0 ? '+' : '') + plane.vs.toFixed(1) + ' m/s      T  ' + formatTime(playTime)
  ];
  ctx.font = '14px ' + FONT_STACK;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 4;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 14, viewH - 52 + i * 18);
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  ctx.font = '13px ' + FONT_STACK;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.textAlign = 'center';
  ctx.fillText('Esc — back to title', viewW / 2, viewH - 14);
}

let fps = 0;
let frames = 0;
let fpsElapsed = 0;

function render() {
  const c = makeCam();

  drawSky(c);
  drawGround(c);
  drawShadow(c);
  drawPlaneShape(c);

  if (state === 'TITLE') {
    drawTitle();
  } else {
    drawDebug();
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
