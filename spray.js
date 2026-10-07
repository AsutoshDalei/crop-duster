'use strict';

const TANK_CAPACITY = 120000;
const SPRAY_RATE = 900;
const EMIT_PER_SEC = 40;
const PARTICLE_FALL = 4.5;
const MAX_PARTICLES = 600;
const WIND = { x: 2.5, z: 1.0 };
const NOMINAL_SWATH = 15;
const IDEAL_LOW = 3;
const IDEAL_HIGH = 15;
const MAX_WET_STRIPS = 60;
const WET_GAP = 0.6;

const tank = { capacity: TANK_CAPACITY, current: TANK_CAPACITY };
const sprayStats = { released: 0, deposited: 0, missed: 0 };

const particles = [];
let emitAcc = 0;
let refilling = false;

function efficiency(agl) {
  if (agl <= 0) return 0;
  if (agl < IDEAL_LOW) return agl / IDEAL_LOW;
  if (agl <= IDEAL_HIGH) return 1;
  return Math.max(0.15, 1 - (agl - IDEAL_HIGH) / 40);
}

function swathWidth(agl) {
  if (agl < IDEAL_LOW) return NOMINAL_SWATH * (agl / IDEAL_LOW);
  if (agl <= IDEAL_HIGH) return NOMINAL_SWATH;
  return Math.min(40, NOMINAL_SWATH + (agl - IDEAL_HIGH) * 0.4);
}

function findField(x, z) {
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) return f;
  }
  return null;
}

function spawnParticle() {
  const agl = plane.y;
  const eff = efficiency(agl);
  const swath = swathWidth(agl);
  const h = plane.heading;
  const side = (Math.random() - 0.5) * swath;
  const rx = Math.cos(h);
  const rz = -Math.sin(h);
  particles.push({
    x: plane.x - Math.sin(h) * 4 + rx * side,
    y: Math.max(0.3, plane.y - 1.5),
    z: plane.z - Math.cos(h) * 4 + rz * side,
    vy: -(PARTICLE_FALL + Math.random() * 1.5),
    amount: SPRAY_RATE / EMIT_PER_SEC,
    eff: eff,
    swath: swath
  });
}

function addWetMark(f, x, z, width, now) {
  if (!f.strips) {
    f.strips = [];
    f.lastLand = -99;
  }
  if (now - f.lastLand > WET_GAP || f.strips.length === 0) {
    if (f.strips.length >= MAX_WET_STRIPS) {
      f.lastLand = now;
      return;
    }
    f.strips.push({ ax: x, az: z, bx: x, bz: z, width: Math.max(4, width) });
  } else {
    const s = f.strips[f.strips.length - 1];
    s.bx = x;
    s.bz = z;
  }
  f.lastLand = now;
}

function landParticle(p) {
  const f = findField(p.x, p.z);
  const dep = f ? p.amount * p.eff : 0;
  sprayStats.deposited += dep;
  sprayStats.missed += p.amount - dep;
  if (f && dep > 0) {
    const area = (f.x1 - f.x0) * (f.z1 - f.z0);
    f.coverage = Math.min(1, f.coverage + dep / area);
    addWetMark(f, p.x, p.z, p.swath, playTime);
  }
}

function updateSpray(dt) {
  const spraying = keys.has('Space') && tank.current > 0;

  if (spraying) {
    const drain = Math.min(SPRAY_RATE * dt, tank.current);
    tank.current -= drain;
    sprayStats.released += drain;
    emitAcc += dt * EMIT_PER_SEC;
    while (emitAcc >= 1) {
      if (particles.length < MAX_PARTICLES) spawnParticle();
      emitAcc -= 1;
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.y += p.vy * dt;
    p.x += WIND.x * dt;
    p.z += WIND.z * dt;
    if (p.y <= 0) {
      landParticle(p);
      particles.splice(i, 1);
    }
  }

  const inRunway =
    plane.y === 0 &&
    plane.x > RUNWAY.cx - RUNWAY.width / 2 - 5 &&
    plane.x < RUNWAY.cx + RUNWAY.width / 2 + 5 &&
    plane.z > RUNWAY.z0 - 5 &&
    plane.z < RUNWAY.z1 + 5;

  if (inRunway && plane.speed < 3 && tank.current < tank.capacity) {
    tank.current = Math.min(tank.capacity, tank.current + tank.capacity * 0.25 * dt);
    refilling = true;
  } else {
    refilling = false;
  }
}

function resetSpray() {
  particles.length = 0;
  tank.current = tank.capacity;
  sprayStats.released = 0;
  sprayStats.deposited = 0;
  sprayStats.missed = 0;
  emitAcc = 0;
  refilling = false;
  for (let i = 0; i < fields.length; i++) {
    fields[i].coverage = 0;
    fields[i].strips = [];
    fields[i].lastLand = -99;
  }
}

function drawCoverage(c) {
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (!f.strips || f.strips.length === 0) continue;
    const tint = lerpColor(f.color, LUSH_COLOR, f.coverage * 0.85);
    const wet = darken(tint, 0.72);

    for (let j = 0; j < f.strips.length; j++) {
      const st = f.strips[j];
      const dx = st.bx - st.ax;
      const dz = st.bz - st.az;
      const len = Math.sqrt(dx * dx + dz * dz);
      const w2 = st.width / 2;
      let pts;
      if (len < 0.5) {
        pts = [
          [st.ax - w2, 0, st.az - w2],
          [st.ax + w2, 0, st.az - w2],
          [st.ax + w2, 0, st.az + w2],
          [st.ax - w2, 0, st.az + w2]
        ];
      } else {
        const ox = (-dz / len) * w2;
        const oz = (dx / len) * w2;
        pts = [
          [st.ax + ox, 0, st.az + oz],
          [st.ax - ox, 0, st.az - oz],
          [st.bx - ox, 0, st.bz - oz],
          [st.bx + ox, 0, st.bz + oz]
        ];
      }
      const mx = (st.ax + st.bx) / 2;
      const mz = (st.az + st.bz) / 2;
      fillWorldPoly(c, pts, wet, worldDist(c, mx, mz), 0.5);
    }
  }
}

function drawParticles(c) {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const pc = toCamera(c, p.x, p.y, p.z);
    if (pc.z < NEAR) continue;
    const s = projectCam(pc);
    if (s.x < -20 || s.x > viewW + 20 || s.y < -20 || s.y > viewH + 20) continue;
    const r = focal / pc.z;
    if (r < 0.5) continue;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(236, 243, 255, 0.45)';
    ctx.fill();
  }
}

function drawRefillPrompt() {
  if (!refilling) return;
  const pct = Math.round((tank.current / tank.capacity) * 100);
  drawText('Refilling tank — ' + pct + '%', viewW / 2, viewH * 0.78, 22, '#ffffff');
}
