'use strict';

const WORLD = { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2000 };
const START = { x: -700, y: 0, z: -1650, heading: 0 };

const RUNWAY = { cx: -700, width: 45, z0: -1700, z1: -700 };

const FARM_X0 = -100;
const FARM_Z0 = 150;
const FIELD_SIZE = 300;
const FIELD_STEP = 350;
const FIELD_ROWS = 4;
const FIELD_COLS = 4;

const LUSH_COLOR = [95, 143, 58];

const CROPS = [
  [216, 197, 106],
  [185, 200, 78],
  [111, 158, 70],
  [138, 112, 72]
];

let rngSeed = 20261007;

function rnd() {
  rngSeed = (rngSeed * 1664525 + 1013904223) >>> 0;
  return rngSeed / 4294967296;
}

function darken(c, t) {
  return [Math.round(c[0] * t), Math.round(c[1] * t), Math.round(c[2] * t)];
}

const fields = [];

for (let r = 0; r < FIELD_ROWS; r++) {
  for (let col = 0; col < FIELD_COLS; col++) {
    const x0 = FARM_X0 + col * FIELD_STEP;
    const z0 = FARM_Z0 + r * FIELD_STEP;
    fields.push({
      x0: x0,
      z0: z0,
      x1: x0 + FIELD_SIZE,
      z1: z0 + FIELD_SIZE,
      color: CROPS[(r * FIELD_COLS + col) % CROPS.length],
      coverage: 0
    });
  }
}

const PROPS = [];

function addProp(type, x, z, w, h, variant) {
  PROPS.push({ type: type, x: x, z: z, w: w, h: h, variant: variant || 0 });
}

const interiorTrees = [
  [1500, -1200], [-1500, -300], [1600, 1700], [-1600, 900],
  [0, -1000], [-300, 1800], [1700, 100], [-1700, -1500]
];

for (let i = 0; i < 14; i++) {
  addProp('tree', -1900 + rnd() * 3800, 1880 + rnd() * 90, 9 + rnd() * 7, 11 + rnd() * 8, rnd());
  addProp('tree', -1900 + rnd() * 3800, -1970 + rnd() * 90, 9 + rnd() * 7, 11 + rnd() * 8, rnd());
  addProp('tree', 1880 + rnd() * 90, -1900 + rnd() * 3800, 9 + rnd() * 7, 11 + rnd() * 8, rnd());
  addProp('tree', -1970 + rnd() * 90, -1900 + rnd() * 3800, 9 + rnd() * 7, 11 + rnd() * 8, rnd());
}

for (let i = 0; i < interiorTrees.length; i++) {
  addProp('tree', interiorTrees[i][0], interiorTrees[i][1], 11 + rnd() * 6, 13 + rnd() * 7, rnd());
}

addProp('hangar', -800, -1500, 55, 15);
addProp('tank', -762, -1440, 10, 7);
addProp('tank', -746, -1442, 10, 6);
addProp('windsock', -655, -1000, 7, 9);
addProp('barn', 1330, 550, 45, 16);
addProp('silo', 1370, 625, 14, 26);
addProp('silo', 1396, 652, 13, 21);
addProp('hay', -130, 120, 4, 4);
addProp('hay', 225, 475, 4, 4);
addProp('hay', 575, 825, 4, 4);
addProp('hay', 925, 1175, 4, 4);
addProp('hay', 1285, 1450, 4, 4);
addProp('hay', 1285, 200, 4, 4);

function worldDist(c, cx, cz) {
  const dx = cx - c.px;
  const dz = cz - c.pz;
  return Math.sqrt(dx * dx + dz * dz + c.py * c.py);
}

function fillGroundRect(c, x0, z0, x1, z1, color) {
  const dist = worldDist(c, (x0 + x1) / 2, (z0 + z1) / 2);
  fillWorldPoly(c, [
    [x0, 0, z0],
    [x1, 0, z0],
    [x1, 0, z1],
    [x0, 0, z1]
  ], color, dist);
}

function drawTerrain(c) {
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
      if (x1 < WORLD.minX || x0 > WORLD.maxX || z1 < WORLD.minZ || z0 > WORLD.maxZ) continue;

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

function drawRunway(c) {
  const x0 = RUNWAY.cx - RUNWAY.width / 2;
  const x1 = RUNWAY.cx + RUNWAY.width / 2;
  fillGroundRect(c, x0, RUNWAY.z0, x1, RUNWAY.z1, [58, 58, 63]);

  fillGroundRect(c, x0 + 1, RUNWAY.z0, x0 + 2.5, RUNWAY.z1, [232, 232, 226]);
  fillGroundRect(c, x1 - 2.5, RUNWAY.z0, x1 - 1, RUNWAY.z1, [232, 232, 226]);

  for (let z = RUNWAY.z0 + 50; z < RUNWAY.z1 - 40; z += 60) {
    fillGroundRect(c, RUNWAY.cx - 0.7, z, RUNWAY.cx + 0.7, z + 30, [232, 232, 226]);
  }

  for (let k = -2; k <= 2; k++) {
    const sx = RUNWAY.cx + k * 8 - 1.2;
    fillGroundRect(c, sx, RUNWAY.z0 + 8, sx + 2.4, RUNWAY.z0 + 40, [232, 232, 226]);
    fillGroundRect(c, sx, RUNWAY.z1 - 40, sx + 2.4, RUNWAY.z1 - 8, [232, 232, 226]);
  }
}

function drawFields(c) {
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const tint = lerpColor(f.color, LUSH_COLOR, f.coverage * 0.85);
    fillGroundRect(c, f.x0, f.z0, f.x1, f.z1, tint);

    const dark = darken(tint, 0.9);
    const rows = 10;
    const step = FIELD_SIZE / rows;
    for (let k = 1; k < rows; k += 2) {
      fillGroundRect(c, f.x0 + k * step, f.z0, f.x0 + (k + 1) * step, f.z1, dark);
    }
  }
}

function drawSurfaces(c) {
  drawRunway(c);
  drawFields(c);
}

function ellipseAt(x, y, rx, ry, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawPropShape(s, wpx, hpx, prop) {
  const x = s.x;
  const y = s.y;
  const t = prop.type;

  if (t === 'tree') {
    const trunkW = Math.max(1, wpx * 0.14);
    const trunkH = hpx * 0.3;
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(x - trunkW / 2, y - trunkH, trunkW, trunkH);
    const green = prop.variant > 0.5 ? '#3f7a33' : '#4a8a3a';
    ellipseAt(x, y - trunkH - hpx * 0.3, wpx * 0.5, hpx * 0.38, green);
    ellipseAt(x - wpx * 0.22, y - trunkH - hpx * 0.48, wpx * 0.34, hpx * 0.28, green);
    ellipseAt(x + wpx * 0.22, y - trunkH - hpx * 0.46, wpx * 0.32, hpx * 0.26, green);
    return;
  }

  if (t === 'barn') {
    ctx.fillStyle = '#a03a2e';
    ctx.fillRect(x - wpx / 2, y - hpx * 0.65, wpx, hpx * 0.65);
    ctx.fillStyle = '#7a2f26';
    ctx.beginPath();
    ctx.moveTo(x - wpx / 2, y - hpx * 0.65);
    ctx.lineTo(x, y - hpx);
    ctx.lineTo(x + wpx / 2, y - hpx * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5a2018';
    ctx.fillRect(x - wpx * 0.14, y - hpx * 0.32, wpx * 0.28, hpx * 0.32);
    return;
  }

  if (t === 'silo') {
    ctx.fillStyle = '#b8bcc0';
    ctx.fillRect(x - wpx / 2, y - hpx * 0.8, wpx, hpx * 0.8);
    ellipseAt(x, y - hpx * 0.8, wpx / 2, hpx * 0.16, '#a8acb0');
    ctx.fillStyle = '#9aa0a4';
    ctx.fillRect(x - wpx / 2, y - hpx * 0.6, wpx, Math.max(1, hpx * 0.03));
    ctx.fillRect(x - wpx / 2, y - hpx * 0.4, wpx, Math.max(1, hpx * 0.03));
    ctx.fillRect(x - wpx / 2, y - hpx * 0.2, wpx, Math.max(1, hpx * 0.03));
    return;
  }

  if (t === 'hangar') {
    ctx.fillStyle = '#8f959b';
    ctx.beginPath();
    ctx.moveTo(x - wpx / 2, y);
    ctx.lineTo(x - wpx / 2, y - hpx * 0.4);
    ctx.arc(x, y - hpx * 0.4, wpx / 2, Math.PI, 0);
    ctx.lineTo(x + wpx / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#33373b';
    ctx.fillRect(x - wpx * 0.2, y - hpx * 0.4, wpx * 0.4, hpx * 0.4);
    return;
  }

  if (t === 'tank') {
    ctx.fillStyle = '#cfd2cc';
    ctx.fillRect(x - wpx / 2, y - hpx * 0.7, wpx, hpx * 0.7);
    ellipseAt(x, y - hpx * 0.7, wpx / 2, hpx * 0.16, '#c2c5bf');
    ctx.fillStyle = '#b04a3a';
    ctx.fillRect(x - wpx / 2, y - hpx * 0.5, wpx, Math.max(1, hpx * 0.1));
    return;
  }

  if (t === 'windsock') {
    ctx.fillStyle = '#dddddd';
    ctx.fillRect(x - Math.max(1, wpx * 0.04), y - hpx * 0.9, Math.max(2, wpx * 0.08), hpx * 0.9);
    ctx.fillStyle = '#f07820';
    ctx.beginPath();
    ctx.moveTo(x, y - hpx * 0.9);
    ctx.lineTo(x + wpx * 0.85, y - hpx * 0.84);
    ctx.lineTo(x + wpx * 0.78, y - hpx * 0.68);
    ctx.lineTo(x, y - hpx * 0.72);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (t === 'hay') {
    ellipseAt(x, y - hpx * 0.5, wpx * 0.5, hpx * 0.5, '#d9b64e');
    ellipseAt(x, y - hpx * 0.5, wpx * 0.3, hpx * 0.3, '#c7a544');
  }
}

function drawProps(c) {
  const visible = [];
  for (let i = 0; i < PROPS.length; i++) {
    const prop = PROPS[i];
    const p = toCamera(c, prop.x, 0, prop.z);
    if (p.z < NEAR || p.z > DRAW_DIST + 150) continue;
    const ppm = focal / p.z;
    const wpx = prop.w * ppm;
    const hpx = prop.h * ppm;
    if (hpx < 1) continue;
    const s = projectCam(p);
    if (s.x + wpx < -40 || s.x - wpx > viewW + 40) continue;
    if (s.y < -40 || s.y - hpx > viewH + 40) continue;
    visible.push({ d: p.z, s: s, wpx: wpx, hpx: hpx, prop: prop });
  }

  visible.sort(function (a, b) { return b.d - a.d; });

  for (let i = 0; i < visible.length; i++) {
    const v = visible[i];
    drawPropShape(v.s, v.wpx, v.hpx, v.prop);
  }
}

function mapX(x, mx, S) {
  return mx + ((x - WORLD.minX) / (WORLD.maxX - WORLD.minX)) * S;
}

function mapZ(z, my, S) {
  return my + S - ((z - WORLD.minZ) / (WORLD.maxZ - WORLD.minZ)) * S;
}

function drawMinimap() {
  const S = 160;
  const PAD = 14;
  const mx = viewW - S - PAD;
  const my = viewH - S - PAD;

  ctx.save();
  ctx.fillStyle = 'rgba(10, 20, 8, 0.45)';
  ctx.fillRect(mx, my, S, S);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + 0.5, my + 0.5, S - 1, S - 1);

  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const tint = lerpColor(f.color, LUSH_COLOR, f.coverage * 0.85);
    const fx = mapX(f.x0, mx, S);
    const fz = mapZ(f.z1, my, S);
    const fw = ((f.x1 - f.x0) / (WORLD.maxX - WORLD.minX)) * S;
    const fh = ((f.z1 - f.z0) / (WORLD.maxZ - WORLD.minZ)) * S;
    ctx.fillStyle = rgb(tint);
    ctx.fillRect(fx, fz, fw, fh);
    if (f.contract) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 1;
      ctx.strokeRect(fx + 0.5, fz + 0.5, fw - 1, fh - 1);
      ctx.font = '10px ' + FONT_STACK;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(f.contractIndex), fx + fw / 2, fz + fh / 2);
    }
  }

  ctx.fillStyle = '#b9b9bd';
  const rwx = mapX(RUNWAY.cx - RUNWAY.width / 2, mx, S);
  const rwTop = mapZ(RUNWAY.z1, my, S);
  ctx.fillRect(rwx, rwTop, Math.max(2, (RUNWAY.width / (WORLD.maxX - WORLD.minX)) * S), ((RUNWAY.z1 - RUNWAY.z0) / (WORLD.maxZ - WORLD.minZ)) * S);

  const px = mapX(plane.x, mx, S);
  const pz = mapZ(plane.z, my, S);
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(plane.heading);
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.5, 5);
  ctx.lineTo(-4.5, 5);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#1c1c1c';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.font = '11px ' + FONT_STACK;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('N', mx + 5, my + 4);
  ctx.restore();
}
