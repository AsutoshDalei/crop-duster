'use strict';

const WORLD = { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2000 };
const START = { x: -700, y: 0, z: -1650, heading: 0 };

const RUNWAY = { cx: -700, width: 45, z0: -1700, z1: -700 };

const LAKE = { cx: -430, cz: -350, rx: 170, rz: 240 };

const FARM_X0 = -100;
const FARM_Z0 = 150;
const FIELD_SIZE = 300;
const FIELD_STEP = 350;
const FIELD_ROWS = 4;
const FIELD_COLS = 4;

const LUSH_COLOR = [95, 143, 58];

const CROPS = [
  [126, 96, 66],
  [112, 86, 58],
  [138, 108, 76],
  [120, 92, 62]
];

let rngSeed = 20261007;

function rnd() {
  rngSeed = (rngSeed * 1664525 + 1013904223) >>> 0;
  return rngSeed / 4294967296;
}

function darken(c, t) {
  return [Math.round(c[0] * t), Math.round(c[1] * t), Math.round(c[2] * t)];
}

function hash1(n) {
  let h = (n ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hash2(i, j) {
  return hash1((Math.imul(i, 73856093) ^ Math.imul(j, 19349663)) | 0);
}

let rngSeed2 = 20261008;

function rnd2() {
  rngSeed2 = (rngSeed2 * 1664525 + 1013904223) >>> 0;
  return rngSeed2 / 4294967296;
}

const GROUND_RAW = [
  [111, 158, 70],
  [99, 143, 62],
  [118, 163, 78],
  [104, 150, 64],
  [132, 155, 84]
];

const GROUND_CELL = [];
for (let a = 0; a < GROUND_RAW.length; a++) {
  for (let b = 0; b < 8; b++) {
    const k = 0.94 + b * 0.018;
    GROUND_CELL.push(darken(GROUND_RAW[a], k));
  }
}

function groundTone(i, j) {
  const t = (hash2(i >> 1, j >> 1) * GROUND_RAW.length) | 0;
  const k = (hash2(i + 8191, j - 4093) * 8) | 0;
  return GROUND_CELL[t * 8 + k];
}

const fields = [];

for (let r = 0; r < FIELD_ROWS; r++) {
  for (let col = 0; col < FIELD_COLS; col++) {
    const x0 = FARM_X0 + col * FIELD_STEP;
    const z0 = FARM_Z0 + r * FIELD_STEP;
      const base = CROPS[(r * FIELD_COLS + col) % CROPS.length];
      const vk = 0.93 + rnd2() * 0.14;
      fields.push({
        x0: x0,
        z0: z0,
        x1: x0 + FIELD_SIZE,
        z1: z0 + FIELD_SIZE,
        color: [
          Math.round(base[0] * vk),
          Math.round(base[1] * vk),
          Math.round(base[2] * vk)
        ],
        rowDir: (r + col) & 1,
        coverage: 0
      });
  }
}

const PROPS = [];

function addProp(type, x, z, w, h, variant, y, d) {
  PROPS.push({ type: type, x: x, z: z, w: w, h: h, variant: variant || 0, y: y || 0, d: d || 0 });
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

addProp('hangar', -800, -1500, 55, 15, 0, 0, 30);
addProp('tank', -762, -1440, 10, 7);
addProp('tank', -746, -1442, 10, 6);
addProp('windsock', -655, -1000, 7, 9);
addProp('barn', 1330, 550, 45, 16, 0, 0, 26);
addProp('silo', 1370, 625, 14, 26);
addProp('silo', 1396, 652, 13, 21);
addProp('hay', -130, 120, 4, 4);
addProp('hay', 225, 475, 4, 4);
addProp('hay', 575, 825, 4, 4);
addProp('hay', 925, 1175, 4, 4);
addProp('hay', 1285, 1450, 4, 4);
addProp('hay', 1285, 200, 4, 4);

addProp('house', 1305, 1420, 18, 8, 0, 0, 13);
addProp('shed', 1315, 180, 26, 7, 0, 0, 12);
addProp('coop', -215, 1450, 12, 5, 0, 0, 9);
addProp('barn', -230, 300, 20, 9, 0, 0, 14);

for (let i = 0; i < 10; i++) {
  addProp(
    'cloud',
    -1700 + rnd() * 3400,
    -1700 + rnd() * 3400,
    170 + rnd() * 230,
    50 + rnd() * 45,
    rnd(),
    140 + rnd() * 240
  );
}

function worldDist(c, cx, cz) {
  const dx = cx - c.px;
  const dz = cz - c.pz;
  return Math.sqrt(dx * dx + dz * dz + c.py * c.py);
}

const DIRT_COLOR = [158, 136, 100];
const TRACKS = [];

TRACKS.push([218, 110, 232, 1540]);
TRACKS.push([568, 110, 582, 1540]);
TRACKS.push([918, 110, 932, 1540]);
TRACKS.push([-140, 468, 1290, 482]);
TRACKS.push([-140, 818, 1290, 832]);
TRACKS.push([-140, 1168, 1290, 1182]);
TRACKS.push([-140, 110, 1290, 124]);
TRACKS.push([-140, 1526, 1290, 1540]);
TRACKS.push([-140, 110, -126, 1540]);
TRACKS.push([1276, 110, 1290, 1540]);
TRACKS.push([-677, -693, -133, -679]);
TRACKS.push([-140, -693, -126, 110]);

function treeSpotOK(x, z) {
  if (x < -1750 || x > 1750 || z < -1750 || z > 1750) return false;
  if (x > -280 && x < 1380 && z > -40 && z < 1620) return false;
  if (x > -920 && x < -480 && z > -1820 && z < -580) return false;
  const lkx = (x - LAKE.cx) / (LAKE.rx + 55);
  const lkz = (z - LAKE.cz) / (LAKE.rz + 55);
  if (lkx * lkx + lkz * lkz < 1) return false;
  for (let i = 0; i < TRACKS.length; i++) {
    const t = TRACKS[i];
    if (x > t[0] - 50 && x < t[2] + 50 && z > t[1] - 50 && z < t[3] + 50) return false;
  }
  return true;
}

let groveCount = 0;
for (let attempt = 0; attempt < 500 && groveCount < 24; attempt++) {
  const gx = -1750 + rnd2() * 3500;
  const gz = -1750 + rnd2() * 3500;
  if (!treeSpotOK(gx, gz)) continue;
  groveCount++;
  const count = 3 + ((rnd2() * 4) | 0);
  for (let k = 0; k < count; k++) {
    const tx = gx + (rnd2() - 0.5) * 110;
    const tz = gz + (rnd2() - 0.5) * 110;
    if (!treeSpotOK(tx, tz)) continue;
    addProp('tree', tx, tz, 9 + rnd2() * 8, 11 + rnd2() * 9, rnd2());
  }
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

      const base = groundTone(i, j);
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
  if (worldDist(c, RUNWAY.cx, (RUNWAY.z0 + RUNWAY.z1) / 2) > DRAW_DIST + 500) return;
  const x0 = RUNWAY.cx - RUNWAY.width / 2;
  const x1 = RUNWAY.cx + RUNWAY.width / 2;
  const WHITE = [232, 232, 226];

  fillGroundRect(c, x0 - 9, RUNWAY.z0 - 10, x0, RUNWAY.z1 + 10, [92, 132, 56]);
  fillGroundRect(c, x1, RUNWAY.z0 - 10, x1 + 9, RUNWAY.z1 + 10, [92, 132, 56]);

  const SEG = 5;
  const segLen = (RUNWAY.z1 - RUNWAY.z0) / SEG;
  for (let s = 0; s < SEG; s++) {
    const k = 0.92 + hash1(7000 + s) * 0.16;
    fillGroundRect(c, x0, RUNWAY.z0 + s * segLen, x1, RUNWAY.z0 + (s + 1) * segLen,
      darken([58, 58, 63], k));
  }

  fillGroundRect(c, x0 + 4, RUNWAY.z0 + 16, x1 - 4, RUNWAY.z0 + 96, [44, 44, 48]);
  fillGroundRect(c, x0 + 7, RUNWAY.z1 - 96, x1 - 7, RUNWAY.z1 - 16, [44, 44, 48]);

  fillGroundRect(c, x0 + 1, RUNWAY.z0, x0 + 2.5, RUNWAY.z1, WHITE);
  fillGroundRect(c, x1 - 2.5, RUNWAY.z0, x1 - 1, RUNWAY.z1, WHITE);

  for (let z = RUNWAY.z0 + 50; z < RUNWAY.z1 - 40; z += 60) {
    fillGroundRect(c, RUNWAY.cx - 0.7, z, RUNWAY.cx + 0.7, z + 30, WHITE);
  }

  for (let k = -2; k <= 2; k++) {
    const sx = RUNWAY.cx + k * 8 - 1.2;
    fillGroundRect(c, sx, RUNWAY.z0 + 8, sx + 2.4, RUNWAY.z0 + 40, WHITE);
    fillGroundRect(c, sx, RUNWAY.z1 - 40, sx + 2.4, RUNWAY.z1 - 8, WHITE);
  }

  fillGroundRect(c, RUNWAY.cx - 9, RUNWAY.z0 + 150, RUNWAY.cx - 4, RUNWAY.z0 + 200, WHITE);
  fillGroundRect(c, RUNWAY.cx + 4, RUNWAY.z0 + 150, RUNWAY.cx + 9, RUNWAY.z0 + 200, WHITE);
  fillGroundRect(c, RUNWAY.cx - 9, RUNWAY.z1 - 200, RUNWAY.cx - 4, RUNWAY.z1 - 150, WHITE);
  fillGroundRect(c, RUNWAY.cx + 4, RUNWAY.z1 - 200, RUNWAY.cx + 9, RUNWAY.z1 - 150, WHITE);

  fillGroundRect(c, RUNWAY.cx - 12, RUNWAY.z0 + 300, RUNWAY.cx - 5, RUNWAY.z0 + 356, WHITE);
  fillGroundRect(c, RUNWAY.cx + 5, RUNWAY.z0 + 300, RUNWAY.cx + 12, RUNWAY.z0 + 356, WHITE);
  fillGroundRect(c, RUNWAY.cx - 12, RUNWAY.z1 - 356, RUNWAY.cx - 5, RUNWAY.z1 - 300, WHITE);
  fillGroundRect(c, RUNWAY.cx + 5, RUNWAY.z1 - 356, RUNWAY.cx + 12, RUNWAY.z1 - 300, WHITE);
}

function drawFields(c) {
  const rows = 10;
  const step = FIELD_SIZE / rows;
  const HEAD = 12;
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (worldDist(c, (f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2) > DRAW_DIST + 250) continue;
    const tint = lerpColor(f.color, LUSH_COLOR, f.coverage * 0.85);
    fillGroundRect(c, f.x0, f.z0, f.x1, f.z1, tint);

    const dark0 = darken(tint, 0.9);
    for (let k = 1; k < rows; k += 2) {
      const dark = darken(dark0, 0.9 + hash1(i * 64 + k) * 0.16);
      if (f.rowDir === 0) {
        fillGroundRect(c, f.x0 + k * step, f.z0, f.x0 + (k + 1) * step, f.z1, dark);
      } else {
        fillGroundRect(c, f.x0, f.z0 + k * step, f.x1, f.z0 + (k + 1) * step, dark);
      }
    }

    const head = darken(tint, 0.86);
    fillGroundRect(c, f.x0, f.z0, f.x1, f.z0 + HEAD, head);
    fillGroundRect(c, f.x0, f.z1 - HEAD, f.x1, f.z1, head);
    fillGroundRect(c, f.x0, f.z0 + HEAD, f.x0 + HEAD, f.z1 - HEAD, head);
    fillGroundRect(c, f.x1 - HEAD, f.z0 + HEAD, f.x1, f.z1 - HEAD, head);
  }
}

function drawTracks(c) {
  for (let i = 0; i < TRACKS.length; i++) {
    const t = TRACKS[i];
    fillGroundRect(c, t[0], t[1], t[2], t[3], DIRT_COLOR);
  }
}

const CORN_H = 2.4;
const CORN_DIST = 380;
const CORN_FADE = 70;
const CORN_STEP = 6;
const CORN_HEAD = 14;
let cornSprites = null;
const cornBatch = [];

function buildCornSprites() {
  const list = [];
  for (let v = 0; v < 2; v++) {
    let seed = 910247 + v * 7717;
    const rr = function () {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const W = 240;
    const H = 96;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    for (let s = 0; s < 6; s++) {
      const bx = 18 + s * 37 + rr() * 12;
      const hh = H - 8 - rr() * 16;
      const lean = (rr() - 0.5) * 9;
      const midY = H - hh * 0.5;
      g.strokeStyle = 'rgb(96, 132, 48)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(bx, H);
      g.quadraticCurveTo(bx + lean * 0.3, midY, bx + lean, H - hh);
      g.stroke();
      const leafCount = 4;
      for (let l = 0; l < leafCount; l++) {
        const side = l % 2 === 0 ? 1 : -1;
        const ly = H - 16 - l * (hh / 5.4);
        const lx = bx + lean * ((H - ly) / hh);
        const dx = side * (13 + rr() * 9);
        const dy = 7 + rr() * 6;
        g.fillStyle = l % 2 === 0 ? 'rgb(112, 152, 58)' : 'rgb(92, 130, 48)';
        g.beginPath();
        g.moveTo(lx, ly);
        g.quadraticCurveTo(lx + dx * 0.5, ly - dy * 0.9, lx + dx, ly - dy * 0.35);
        g.quadraticCurveTo(lx + dx * 0.45, ly + dy * 0.35, lx, ly + 2);
        g.closePath();
        g.fill();
      }
      g.strokeStyle = 'rgb(186, 164, 96)';
      g.lineWidth = 1.5;
      for (let t = -2; t <= 2; t++) {
        g.beginPath();
        g.moveTo(bx + lean, H - hh);
        g.lineTo(bx + lean + t * 3, H - hh - 6 + Math.abs(t) * 2);
        g.stroke();
      }
    }
    list.push(cv);
  }
  return list;
}

function drawCorn(c) {
  if (!cornSprites) cornSprites = buildCornSprites();
  cornBatch.length = 0;
  const rows = 10;
  const step = FIELD_SIZE / rows;
  const bands = [0, 2, 4, 6, 8];
  const offs = [-8, 8];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (worldDist(c, (f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2) > CORN_DIST + 220) continue;
    let lineId = i * 32;
    for (let bi = 0; bi < bands.length; bi++) {
      for (let oi = 0; oi < offs.length; oi++) {
        const base = bands[bi] * step + step / 2 + offs[oi];
        let ax;
        let az;
        let bx;
        let bz;
        if (f.rowDir === 0) {
          ax = f.x0 + base;
          bx = ax;
          az = f.z0 + CORN_HEAD;
          bz = f.z1 - CORN_HEAD;
        } else {
          az = f.z0 + base;
          bz = az;
          ax = f.x0 + CORN_HEAD;
          bx = f.x1 - CORN_HEAD;
        }
        if (worldDist(c, (ax + bx) / 2, (az + bz) / 2) > CORN_DIST + 150) continue;
        const len = Math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az));
        const n = Math.floor(len / CORN_STEP);
        if (n < 1) continue;
        for (let k = 0; k < n; k++) {
          const u = (k + 0.5 + (hash1(lineId * 97 + k) - 0.5) * 0.7) / n;
          const wx = ax + (bx - ax) * u;
          const wz = az + (bz - az) * u;
          const cp = toCamera(c, wx, 0, wz);
          if (cp.z < NEAR || cp.z > CORN_DIST) continue;
          const s = projectCam(cp);
          const hpx = (CORN_H * focal) / cp.z;
          if (hpx < 1.6) continue;
          if (s.x < -80 || s.x > viewW + 80 || s.y < 0 || s.y > viewH + 10) continue;
          cornBatch.push({
            z: cp.z,
            img: cornSprites[hash1(lineId * 31 + k) < 0.5 ? 0 : 1],
            x: s.x,
            y: s.y,
            w: (hpx * 240) / 96,
            h: hpx
          });
        }
        lineId++;
      }
    }
  }
  cornBatch.sort(function (a, b) { return b.z - a.z; });
  for (let i = 0; i < cornBatch.length; i++) {
    const e = cornBatch[i];
    if (e.z > CORN_DIST - CORN_FADE) {
      const fade = (CORN_DIST - e.z) / CORN_FADE;
      if (fade <= 0.02) continue;
      ctx.globalAlpha = fade;
      ctx.drawImage(e.img, e.x - e.w / 2, e.y - e.h, e.w, e.h);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(e.img, e.x - e.w / 2, e.y - e.h, e.w, e.h);
    }
  }
}

const LAKE_PTS = [];
const LAKE_SHORE = [];
const LAKE_DEEP = [];
for (let i = 0; i < 14; i++) {
  const a = (i / 14) * Math.PI * 2;
  const r = 1 + 0.055 * Math.sin(a * 3 + 1.1) + 0.012 * Math.sin(a * 5 + 2.7);
  LAKE_PTS.push([
    LAKE.cx + Math.cos(a) * LAKE.rx * r,
    0,
    LAKE.cz + Math.sin(a) * LAKE.rz * r
  ]);
  LAKE_SHORE.push([
    LAKE.cx + Math.cos(a) * (LAKE.rx + 13) * r,
    0,
    LAKE.cz + Math.sin(a) * (LAKE.rz + 13) * r
  ]);
}
for (let i = 0; i < 9; i++) {
  const a = (i / 9) * Math.PI * 2;
  const r = 1 + 0.07 * Math.sin(a * 3 + 2.4);
  LAKE_DEEP.push([
    LAKE.cx + Math.cos(a) * LAKE.rx * 0.55 * r + 12,
    0,
    LAKE.cz + Math.sin(a) * LAKE.rz * 0.55 * r - 18
  ]);
}

function drawLake(c) {
  const dist = worldDist(c, LAKE.cx, LAKE.cz);
  if (dist > DRAW_DIST + 400) return;
  fillWorldPoly(c, LAKE_SHORE, [186, 168, 122], dist);
  fillWorldPoly(c, LAKE_PTS, [86, 132, 168], dist);
  fillWorldPoly(c, LAKE_DEEP, [66, 108, 146], dist);
  fillWorldPoly(c, [
    [-520, 0, -392], [-344, 0, -392], [-344, 0, -382], [-520, 0, -382]
  ], [172, 202, 222], worldDist(c, -432, -387), 0.35);
  fillWorldPoly(c, [
    [-476, 0, -306], [-332, 0, -306], [-332, 0, -300], [-476, 0, -300]
  ], [172, 202, 222], worldDist(c, -404, -303), 0.3);
}

function drawSurfaces(c) {
  drawLake(c);
  drawTracks(c);
  drawRunway(c);
  drawFields(c);
}

let ridgeCv = null;

function buildRidge() {
  const W = 2048;
  const H = 120;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  const back = [
    { n: 1, a: 14, p: 0.0 },
    { n: 2, a: 10, p: 1.3 },
    { n: 4, a: 7, p: 2.7 },
    { n: 9, a: 4, p: 0.4 }
  ];
  const front = [
    { n: 1, a: 20, p: 3.4 },
    { n: 3, a: 13, p: 0.9 },
    { n: 6, a: 8, p: 5.2 },
    { n: 13, a: 4, p: 1.7 },
    { n: 64, a: 2.5, p: 2.2 }
  ];
  function fillLayer(comps, base, color) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) {
      let y = base;
      for (let i = 0; i < comps.length; i++) {
        const c = comps[i];
        y -= c.a * Math.sin((Math.PI * 2 * c.n * x) / W + c.p);
      }
      g.lineTo(x, y);
    }
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  }
  fillLayer(back, H - 26, 'rgb(176,199,210)');
  fillLayer(front, H - 12, 'rgb(152,184,154)');
  return cv;
}

function drawBackdrop(horizonY) {
  if (!ridgeCv) ridgeCv = buildRidge();
  const tileW = Math.PI * 2 * focal;
  const offset = -cam.yaw * focal;
  const y = Math.round(horizonY - ridgeCv.height) + 2;
  let k = Math.floor(-offset / tileW);
  while (k * tileW + offset < viewW) {
    const x = k * tileW + offset;
    if (x + tileW > 0) {
      ctx.drawImage(ridgeCv, Math.round(x), y, Math.ceil(tileW), ridgeCv.height);
    }
    k++;
  }
}

function ellipseAt(x, y, rx, ry, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function pc(r, g, b, f, a) {
  if (f > 0) {
    r += (FOG_COLOR[0] - r) * f;
    g += (FOG_COLOR[1] - g) * f;
    b += (FOG_COLOR[2] - b) * f;
  }
  r = Math.round(r);
  g = Math.round(g);
  b = Math.round(b);
  if (a === undefined) return 'rgb(' + r + ',' + g + ',' + b + ')';
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

let litX = -0.55;
let litY = -0.75;

function updateLit(x, y) {
  if (sunScreen.front) {
    const dx = sunScreen.x - x;
    const dy = sunScreen.y - y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1) {
      litX = dx / len;
      litY = dy / len;
      return;
    }
  }
  litX = -0.55;
  litY = -0.75;
}

const BOX_STYLE = {
  hangar: { wall: [143, 149, 155], roof: [166, 172, 178], accent: [51, 55, 59], door: 'x1', dw: 9, dh: 7 },
  barn: { wall: [160, 58, 46], roof: [96, 34, 26], accent: [70, 28, 20], door: 'x0', dw: 7, dh: 7.5 },
  shed: { wall: [134, 122, 102], roof: [98, 90, 76], accent: [80, 70, 56], door: 'x1', dw: 5, dh: 5 },
  house: { wall: [214, 206, 190], roof: [122, 76, 58], accent: [94, 58, 46], door: 'x0', dw: 3, dh: 6, win: 1 },
  coop: { wall: [224, 220, 208], roof: [144, 136, 122], accent: [118, 110, 98], door: 'x0', dw: 2.5, dh: 4 }
};

function drawBoxProp(c, prop) {
  const dist = worldDist(c, prop.x, prop.z);
  const st = BOX_STYLE[prop.type] || BOX_STYLE.shed;
  const x0 = prop.x - prop.w / 2;
  const x1 = prop.x + prop.w / 2;
  const z0 = prop.z - prop.d / 2;
  const z1 = prop.z + prop.d / 2;
  const y1 = prop.h;
  const wall = st.wall;
  const roofCol = st.roof;
  const xf = c.px >= prop.x ? x1 : x0;
  const xk = ((xf === x0) === (SUN_DIR.x < 0)) ? 1 : 0.8;
  const zf = c.pz >= prop.z ? z1 : z0;
  const zk = ((zf === z0) === (SUN_DIR.z < 0)) ? 1 : 0.8;

  fillWorldPoly(c, [[xf, 0, z0], [xf, 0, z1], [xf, y1, z1], [xf, y1, z0]], darken(wall, xk), dist);
  fillWorldPoly(c, [[x0, 0, zf], [x1, 0, zf], [x1, y1, zf], [x0, y1, zf]], darken(wall, zk), dist);
  if (c.py > y1) {
    fillWorldPoly(c, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], darken(roofCol, 1.05), dist);
  }
  const dw = st.dw;
  const dh = st.dh;
  if (st.door === 'x1' && xf === x1) {
    fillWorldPoly(c, [[x1, 0, prop.z - dw], [x1, 0, prop.z + dw], [x1, dh, prop.z + dw], [x1, dh, prop.z - dw]], st.accent, dist);
  }
  if (st.door === 'x0' && xf === x0) {
    fillWorldPoly(c, [[x0, 0, prop.z - dw], [x0, 0, prop.z + dw], [x0, dh, prop.z + dw], [x0, dh, prop.z - dw]], st.accent, dist);
  }
  if (st.win) {
    const wy0 = y1 * 0.35;
    const wy1 = Math.min(y1 - 1, wy0 + 2.4);
    const ww = 1.3;
    for (let k = -1; k <= 1; k += 2) {
      const wx = prop.x + k * prop.w * 0.26;
      fillWorldPoly(c, [
        [wx - ww, wy0, zf], [wx + ww, wy0, zf],
        [wx + ww, wy1, zf], [wx - ww, wy1, zf]
      ], [86, 104, 120], dist);
    }
  }
}

let cloudSprites = null;

function buildCloudSprites() {
  const list = [];
  let seed = 555000111;
  const rr = function () {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let s = 0; s < 3; s++) {
    const W = 320;
    const H = 160;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    const base = H - 30 - rr() * 16;
    const count = 7 + ((rr() * 5) | 0);
    for (let p = 0; p < count; p++) {
      const pr = 26 + rr() * 44;
      const px = 46 + rr() * (W - 92);
      const py = base - rr() * (H * 0.42);
      if (px < pr + 4 || px > W - pr - 4 || py < pr + 4) continue;
      const grad = g.createRadialGradient(px, py, pr * 0.25, px, py, pr);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(0.55, 'rgba(248, 251, 254, 0.55)');
      grad.addColorStop(1, 'rgba(240, 246, 252, 0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(px, py, pr, 0, Math.PI * 2);
      g.fill();
    }
    for (let p = 0; p < 4; p++) {
      const pr = 28 + rr() * 34;
      const px = 54 + rr() * (W - 108);
      const py = base + 6 - rr() * 18;
      if (px < pr + 4 || px > W - pr - 4) continue;
      const grad = g.createRadialGradient(px, py, pr * 0.25, px, py, pr);
      grad.addColorStop(0, 'rgba(205, 218, 232, 0.55)');
      grad.addColorStop(1, 'rgba(205, 218, 232, 0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(px, py, pr, 0, Math.PI * 2);
      g.fill();
    }
    list.push(cv);
  }
  return list;
}

function drawPropShape(c, fog, s, wpx, hpx, prop) {
  const x = s.x;
  const y = s.y;
  const t = prop.type;

  if (t === 'tree') {
    updateLit(x, y);
    const trunkW = Math.max(1, wpx * 0.13);
    const trunkH = hpx * 0.3;
    ctx.fillStyle = pc(96, 66, 38, fog);
    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, y);
    ctx.lineTo(x + trunkW / 2, y);
    ctx.lineTo(x + trunkW * 0.32, y - trunkH);
    ctx.lineTo(x - trunkW * 0.32, y - trunkH);
    ctx.closePath();
    ctx.fill();

    const ch = Math.max(2, hpx - trunkH);
    const cy = y - trunkH - ch / 2;
    let lobes;
    if (prop.variant < 0.4) {
      lobes = [[0, 0.05, 0.5, 0.45], [-0.22, -0.18, 0.32, 0.32], [0.2, -0.14, 0.3, 0.3]];
    } else if (prop.variant < 0.7) {
      lobes = [[0, 0.2, 0.24, 0.34], [0, -0.1, 0.2, 0.34], [0, -0.34, 0.15, 0.22]];
    } else {
      lobes = [[-0.26, 0.18, 0.3, 0.3], [0.27, 0.16, 0.28, 0.28], [0, -0.1, 0.36, 0.36], [0.02, 0.3, 0.42, 0.24]];
    }
    const dark = pc(58, 105, 46, fog);
    const lite = pc(95, 155, 72, fog);
    for (let i = 0; i < lobes.length; i++) {
      const L = lobes[i];
      ellipseAt(x + L[0] * wpx, cy + L[1] * ch, L[2] * wpx, L[3] * ch, dark);
    }
    const ox = litX * wpx * 0.13;
    const oy = litY * ch * 0.13;
    for (let i = 0; i < lobes.length; i++) {
      const L = lobes[i];
      ellipseAt(x + L[0] * wpx + ox, cy + L[1] * ch + oy, L[2] * wpx * 0.72, L[3] * ch * 0.72, lite);
    }
    return;
  }

  if (prop.d > 0) {
    drawBoxProp(c, prop);
    return;
  }

  if (t === 'barn') {
    ctx.fillStyle = pc(160, 58, 46, fog);
    ctx.fillRect(x - wpx / 2, y - hpx * 0.65, wpx, hpx * 0.65);
    ctx.fillStyle = pc(122, 47, 38, fog);
    ctx.beginPath();
    ctx.moveTo(x - wpx / 2, y - hpx * 0.65);
    ctx.lineTo(x, y - hpx);
    ctx.lineTo(x + wpx / 2, y - hpx * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pc(90, 32, 24, fog);
    ctx.fillRect(x - wpx * 0.14, y - hpx * 0.32, wpx * 0.28, hpx * 0.32);
    return;
  }

  if (t === 'silo') {
    updateLit(x, y);
    const gw = wpx / 2;
    const g = ctx.createLinearGradient(x - gw, 0, x + gw, 0);
    const lite = pc(198, 202, 206, fog);
    const mid = pc(184, 188, 192, fog);
    const dk = pc(146, 150, 154, fog);
    if (litX > 0) {
      g.addColorStop(0, dk);
      g.addColorStop(0.45, mid);
      g.addColorStop(1, lite);
    } else {
      g.addColorStop(0, lite);
      g.addColorStop(0.55, mid);
      g.addColorStop(1, dk);
    }
    ctx.fillStyle = g;
    ctx.fillRect(x - gw, y - hpx * 0.8, wpx, hpx * 0.8);
    ellipseAt(x, y - hpx * 0.8, gw, hpx * 0.16, pc(176, 180, 184, fog));
    ctx.fillStyle = pc(150, 156, 160, fog);
    ctx.fillRect(x - gw, y - hpx * 0.6, wpx, Math.max(1, hpx * 0.03));
    ctx.fillRect(x - gw, y - hpx * 0.4, wpx, Math.max(1, hpx * 0.03));
    ctx.fillRect(x - gw, y - hpx * 0.2, wpx, Math.max(1, hpx * 0.03));
    return;
  }

  if (t === 'hangar') {
    ctx.fillStyle = pc(143, 149, 155, fog);
    ctx.beginPath();
    ctx.moveTo(x - wpx / 2, y);
    ctx.lineTo(x - wpx / 2, y - hpx * 0.4);
    ctx.arc(x, y - hpx * 0.4, wpx / 2, Math.PI, 0);
    ctx.lineTo(x + wpx / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pc(51, 55, 59, fog);
    ctx.fillRect(x - wpx * 0.2, y - hpx * 0.4, wpx * 0.4, hpx * 0.4);
    return;
  }

  if (t === 'tank') {
    updateLit(x, y);
    const gw = wpx / 2;
    const g = ctx.createLinearGradient(x - gw, 0, x + gw, 0);
    const lite = pc(214, 217, 211, fog);
    const mid = pc(207, 210, 204, fog);
    const dk = pc(178, 181, 175, fog);
    if (litX > 0) {
      g.addColorStop(0, dk);
      g.addColorStop(0.45, mid);
      g.addColorStop(1, lite);
    } else {
      g.addColorStop(0, lite);
      g.addColorStop(0.55, mid);
      g.addColorStop(1, dk);
    }
    ctx.fillStyle = g;
    ctx.fillRect(x - gw, y - hpx * 0.7, wpx, hpx * 0.7);
    ellipseAt(x, y - hpx * 0.7, gw, hpx * 0.16, pc(194, 197, 191, fog));
    ctx.fillStyle = pc(176, 74, 58, fog);
    ctx.fillRect(x - gw, y - hpx * 0.5, wpx, Math.max(1, hpx * 0.1));
    return;
  }

  if (t === 'windsock') {
    ctx.fillStyle = pc(221, 221, 221, fog);
    ctx.fillRect(x - Math.max(1, wpx * 0.04), y - hpx * 0.9, Math.max(2, wpx * 0.08), hpx * 0.9);
    ctx.fillStyle = pc(240, 120, 32, fog);
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
    updateLit(x, y);
    const gp = toCamera(c, prop.x, 0.05, prop.z);
    if (gp.z >= NEAR) {
      const gs = projectCam(gp);
      const sr = (focal * prop.w * 0.8) / gp.z;
      if (sr > 1) {
        ellipseAt(gs.x, gs.y, sr, sr * 0.5, pc(24, 36, 14, fog, 0.4));
      }
    }
    ellipseAt(x, y - hpx * 0.5, wpx * 0.5, hpx * 0.5, pc(185, 150, 58, fog));
    ellipseAt(
      x + litX * wpx * 0.16,
      y - hpx * 0.5 + litY * hpx * 0.16,
      wpx * 0.32,
      hpx * 0.32,
      pc(222, 189, 92, fog)
    );
    return;
  }

  if (t === 'cloud') {
    if (!cloudSprites) cloudSprites = buildCloudSprites();
    const idx = prop.variant < 0.34 ? 0 : prop.variant < 0.67 ? 1 : 2;
    ctx.drawImage(cloudSprites[idx], x - wpx * 0.5, y - hpx * 0.7, wpx, hpx * 1.4);
  }
}

function drawProps(c) {
  const visible = [];
  for (let i = 0; i < PROPS.length; i++) {
    const prop = PROPS[i];
    const p = toCamera(c, prop.x, prop.y, prop.z);
    if (p.z < NEAR || p.z > DRAW_DIST + 150) continue;
    const ppm = focal / p.z;
    const wpx = prop.w * ppm;
    const hpx = prop.h * ppm;
    if (hpx < 1) continue;
    const s = projectCam(p);
    if (s.x + wpx < -40 || s.x - wpx > viewW + 40) continue;
    const isCloud = prop.y > 0;
    const top = isCloud ? s.y - hpx * 0.7 : s.y - hpx;
    const bottom = isCloud ? s.y + hpx * 0.7 : s.y;
    if (bottom < -40 || top > viewH + 40) continue;
    visible.push({ d: p.z, s: s, wpx: wpx, hpx: hpx, prop: prop });
  }

  visible.sort(function (a, b) { return b.d - a.d; });

  for (let i = 0; i < visible.length; i++) {
    const v = visible[i];
    const fog = fogT(v.d);
    if (v.prop.type === 'cloud') {
      ctx.globalAlpha = Math.max(0.25, 1 - fog * 0.75);
    }
    drawPropShape(c, fog, v.s, v.wpx, v.hpx, v.prop);
    ctx.globalAlpha = 1;
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

  ctx.beginPath();
  ctx.ellipse(
    mapX(LAKE.cx, mx, S),
    mapZ(LAKE.cz, my, S),
    (LAKE.rx / (WORLD.maxX - WORLD.minX)) * S,
    (LAKE.rz / (WORLD.maxZ - WORLD.minZ)) * S,
    0, 0, Math.PI * 2
  );
  ctx.fillStyle = 'rgb(76, 124, 164)';
  ctx.fill();

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
