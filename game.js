'use strict';

const LOGIC_STEP = 1 / 60;
const MAX_FRAME_TIME = 0.25;
const FONT_STACK = '"Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let viewW = 0;
let viewH = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = Math.floor(viewW * dpr);
  canvas.height = Math.floor(viewH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

function setState(next) {
  state = next;
  document.body.classList.toggle('playing', state === 'PLAYING');
  if (state === 'PLAYING') {
    playTime = 0;
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
  if (state === 'PLAYING') {
    playTime += dt;
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function drawBackground() {
  const horizon = Math.floor(viewH * 0.5);

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#3f97d6');
  sky.addColorStop(1, '#cbe8fa');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewW, horizon);

  const ground = ctx.createLinearGradient(0, horizon, 0, viewH);
  ground.addColorStop(0, '#8fbc5e');
  ground.addColorStop(1, '#4a7a30');
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, viewW, viewH - horizon);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillRect(0, horizon - 1, viewW, 2);
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
}

function drawPlaying() {
  drawText('STAGE 0 — ENGINE SKELETON', viewW / 2, viewH * 0.4, 40, '#ffffff');
  drawText('Flight model arrives in Stage 1', viewW / 2, viewH * 0.48, 22, '#f4f7ef');
  drawText('Elapsed  ' + formatTime(playTime), viewW / 2, viewH * 0.57, 22, '#e8f1dd');
  drawText('Esc  back to title', viewW / 2, viewH * 0.88, 16, 'rgba(255, 255, 255, 0.75)');
}

let fps = 0;
let frames = 0;
let fpsElapsed = 0;

function render() {
  drawBackground();

  if (state === 'TITLE') {
    drawTitle();
  } else {
    drawPlaying();
  }

  ctx.font = '14px ' + FONT_STACK;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(fps + ' FPS', viewW - 12, 10);
}

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
