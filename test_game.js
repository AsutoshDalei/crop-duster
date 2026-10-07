'use strict';

// Regression guard for the ground-speed floor bug: MIN_SPEED (Stage 5B)
// applied at all times made `speed < 3` (the Stage 3/4 refill threshold)
// unreachable — deadlocking runs that ran out of fertilizer — and left the
// plane idling at 5 m/s (spurious dust + rumble at standstill).
//
// Dev-side check only; not loaded by index.html, adds no dependency.
// Run from the repo root:  jsc test_game.js
// (jsc = system JavaScriptCore at
//  /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc)

if (typeof performance === 'undefined' || typeof performance.now !== 'function') {
  globalThis.performance = { now: function () { return Date.now(); } };
}
globalThis.window = {
  addEventListener: function () {},
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1
};
globalThis.document = {
  getElementById: function () {
    return {
      width: 0,
      height: 0,
      getContext: function () {
        return new Proxy({}, {
          get: function () { return function () {}; },
          set: function () { return true; }
        });
      }
    };
  },
  body: { classList: { toggle: function () {} } }
};
globalThis.requestAnimationFrame = function () {};

load('world.js');
load('spray.js');
load('game.js');

const STEP = 1 / 60;

function run(ticks) {
  for (let i = 0; i < ticks; i++) update(STEP);
}

function ok(cond, msg) {
  if (!cond) {
    print('FAIL: ' + msg);
    throw new Error(msg);
  }
}

// Parked plane must reach the refill threshold; no dust at standstill.
setState('PLAYING');
run(120);
ok(plane.speed < 3, 'parked plane must stop, speed=' + plane.speed);
ok(dust.length === 0, 'no dust while parked');

// Landing rollout from crash-limit speed must decay below the threshold.
setState('PLAYING');
plane.speed = 15;
run(600);
ok(plane.speed < 3, 'rollout must reach refill threshold, speed=' + plane.speed);

// Stopped on the runway: tank refills to full and the refill is charged.
setState('PLAYING');
plane.x = -700;
plane.z = -1200;
plane.y = 0;
plane.speed = 0;
tank.current = tank.capacity - 400;
run(60);
ok(tank.current === tank.capacity, 'tank must refill to full');
ok(refillsLeft === 2, 'completed refill must be charged');

// Takeoff: full throttle rolls to flying speed, then climb input lifts off.
setState('PLAYING');
plane.throttle = 1;
run(360);
ok(plane.speed > 30, 'runway roll must accelerate, speed=' + plane.speed);
keys.add('KeyW');
run(120);
ok(plane.y > 2, 'plane must climb, y=' + plane.y);

print('ok - 6 checks passed');
