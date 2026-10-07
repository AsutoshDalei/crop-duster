# Crop Duster — Game Development Plan

A browser game where the player pilots a crop-dusting (agriculture) plane, takes off
from a local airport, flies to a large farm, and applies fertilizer across contract
fields. Hosted entirely on GitHub Pages with **zero external dependencies**.

---

## 1. Key Decisions (Approved)

| Decision | Choice | Rationale |
|---|---|---|
| Visual style | **Behind-the-plane pseudo-3D**, rendered with Canvas 2D | More immersive than top-down; no libraries needed — perspective projection implemented by hand |
| Mission structure | **Scored contract job** | Fixed set of fields with coverage targets, limited fertilizer tank, refill at airport, win/fail + best score |
| Audio | **Silent game** | No sound effects; all polish is visual. Audio can be added later |
| Stack | **Vanilla HTML/CSS/JS**, no build step, no frameworks, no CDN | GitHub Pages hosts static files only; plain `<script>` tags keep it dependency-free and offline-capable |
| Art / assets | **Procedural drawing in code** | No image or audio files; terrain, fields, plane, clouds, HUD all drawn via Canvas 2D primitives |
| Persistence | **`localStorage`** | Best score stored client-side; works fine on GitHub Pages |
| Deployment | **GitHub Pages from `main` branch, repo root** | Push to `main` = live; no CI, no build pipeline |

---

## 2. Feasibility Check (Completed)

| Aspect | Verdict | Notes |
|---|---|---|
| GitHub Pages hosting | ✅ | Pure static site: `index.html` + JS/CSS at repo root. No server, no backend needed for a single-player keyboard game. |
| Zero dependencies | ✅ | All needed APIs are browser-native: Canvas 2D (rendering), KeyboardEvent (input), requestAnimationFrame (loop), localStorage (high score). No CDN, works offline. |
| Game scope | ✅ | One airport + one large farmland + minimap + spray mechanics ≈ 1,500–3,000 lines of vanilla JS. Canvas 2D handles the field/billboard counts at 60fps. |
| Controls | ✅ | W/S altitude, A/D lateral, ↑/↓ throttle, Space spray — straightforward keydown/keyup state tracking. |
| Pseudo-3D rendering | ✅ | Pinhole camera projection of ground quads + billboard sprites with painter's-algorithm sorting is a well-known, proven technique (classic arcade road/flight games). |
| Risks / limits | ⚠️ | Keyboard-only ⇒ desktop only (mobile/touch out of scope). Projection/clipping edge cases and depth-sorting artifacts must be solved in Stage 1 before content work begins. |

**Conclusion: fully feasible.**

---

## 3. Controls

| Key | Action |
|---|---|
| `W` | Climb (altitude up) |
| `S` | Descend (altitude down) |
| `A` | Bank/lateral left (rudder) |
| `D` | Bank/lateral right (rudder) |
| `↑` Arrow | Throttle up (speed increase) |
| `↓` Arrow | Throttle down (speed decrease) |
| `Space` | Spray fertilizer (hold to spray) |
| `R` | Restart (on game-over / contract-complete screens) |
| `Esc` | Return to title screen |

---

## 4. Stage-by-Stage Plan

### Stage 0 — Scaffold & Deploy Wiring
**Goal:** Empty-but-running page, game loop skeleton, deployment confirmed early.

- Create `index.html` (full-screen canvas, loads `style.css` and scripts in order).
- Create `style.css` (reset, full-viewport canvas, no scrollbars, cursor hiding in-game).
- Create `game.js` with:
  - Canvas setup + HiDPI (`devicePixelRatio`) scaling.
  - Fixed-timestep logic loop (60 Hz update, `requestAnimationFrame` render with accumulator).
  - Central game-state machine: `TITLE → PLAYING → CONTRACT_COMPLETE / FAILED → TITLE`.
  - Resize handling.
- Script layout (plain tags, no bundler): `game.js` first; later split into
  `input.js`, `camera.js`, `world.js`, `plane.js`, `spray.js`, `hud.js` loaded in
  dependency order — still zero build step.
- **Deploy check:** enable GitHub Pages (Settings → Pages → Deploy from branch →
  `main` / root). Push and verify the (empty) page goes live so deployment is a
  non-issue for the rest of the project.
- **Exit criteria:** page loads without console errors; game loop ticking; Pages URL live.

### Stage 1 — Pseudo-3D Engine Core
**Goal:** A camera that flies behind the plane over an infinite checkered ground,
with correct perspective — the technical foundation.

- **Camera & projection:**
  - World coordinates: `x` (east), `y` (altitude), `z` (north/forward).
  - Pinhole camera: position behind/above the plane, pitched slightly down.
  - `world → camera space (translate + rotate) → screen (perspective divide)`.
  - Near-plane clipping: clip polygons/segments against `z_cam > ε` before
    projection to avoid inversion artifacts.
  - Horizon line derived from camera pitch; sky gradient above, ground below.
- **Ground rendering:**
  - Ground plane divided into strips/quads by distance from camera; each quad's
    4 corners projected and filled (checker/grid pattern for motion perception).
  - Depth cue: distance fog (blend ground color toward horizon color).
- **Depth sorting:** painter's algorithm — all renderables (ground quads,
  billboards, particles, plane) assigned a camera-space depth, sorted
  back-to-front, drawn in order.
- **Plane representation:** logical 3D position + heading/pitch/roll state;
  the player's own plane drawn as a fixed overlay near screen center (rear view),
  with a **ground-projected drop shadow** so altitude is readable.
- **Flight model (basic):**
  - Throttle → forward speed (with inertia/lag).
  - W/S → vertical speed; A/D → heading change (banking).
  - Altitude floor: ground collision (bounce/damage TBD in Stage 4).
  - Camera smoothly follows (position lerp + look-at with damping).
- **Input:** `keydown`/`keyup` state map (handles key repeat correctly), arrow
  keys prevent page scroll.
- **Exit criteria:** fly over infinite grid at varying altitude/speed with stable
  horizon, no clipping glitches, 60fps; verified with edge cases (flying nearly
  into ground, looking sideways at quads near the camera).

**Implementation notes (post Stage 1):**
- The player's plane is rendered by **projecting its actual 3D position** (not a
  fixed screen overlay) — it drifts naturally in frame when the camera lags.
- Ground quads are coplanar and non-overlapping, so they need no sort; the
  **generic depth-sorted renderable list** (for billboards, particles, props) is
  deferred to Stage 2 where it first becomes necessary.
- Camera pitch is fixed (horizon stays level); camera roll for bank-tilt is a
  Stage 5 polish item that extends `makeCam()`.
- The flight model is intentionally "basic" per plan; realism upgrades are
  tracked in the Backlog (§9).

### Stage 2 — World Building
**Goal:** A concrete world: airport where you start, large farm to fly to, depth cues.

- **Coordinate world:** bounded map (e.g. 4000×4000 m) with a simple `world.js`
  describing all static geometry.
- **Airport (starting area):**
  - Runway: long projected quad with threshold/centerline markings.
  - Plane starts parked on runway → takeoff roll once throttle applied.
  - Props as billboards: hangar, windsock, windsock pole, fuel tanks.
  - Landing/refill detection zone = runway.
- **Farm (work area):**
  - Grid of crop-field rectangles (e.g. 4×4 fields, several hundred meters each).
  - Each field: base crop color + row texture (lines drawn with perspective
    spacing), plus a `coverage` value (0–100%) that tints the field as it's done.
  - Scattered billboards for scale/depth: trees, barn, silos, fences, hay bales.
- **Depth cues:**
  - Distance fog / draw-distance cutoff.
  - Drop shadow under player's plane (projected to `y = 0`).
- **Minimap:** top-down corner minimap showing runway, fields, plane position +
  heading; used to navigate airport ↔ farm.
- **Exit criteria:** take off from runway, navigate by minimap to the farm, fly
  low over distinguishable fields; world reads clearly at speed.

**Implementation notes (post Stage 2):**
- `world.js` added (loads before `game.js` via plain `<script>` tag — shared
  script scope, still no build step). It owns: bounds, `START`, `RUNWAY`,
  `fields[]` (with `coverage` already wired to renderer + minimap), `PROPS[]`
  (seeded LCG — stable layout), terrain/surface/prop/minimap drawing.
- World is flat, so ground surfaces draw after terrain with no sorting; only
  props are depth-sorted (far → near) — the painter's list arrived here as planned.
- Fences omitted (billboards can't represent long world-aligned lines well);
  hay bales cover the "farm clutter" role. Optional later.
- Plane is clamped at map bounds; border tree belt visually marks the edge.
- Refill zone (`RUNWAY`) is available for Stage 3's refill detection.

### Stage 3 — Crop-Dusting Mechanics
**Goal:** The core loop — spray, cover fields, manage fertilizer.

- **Spray input:** hold `Space` → emission while fertilizer remains.
- **Spray particles:** spawned at plane position (slightly behind/below), fall to
  ground, land as decals/coverage contribution; affected by wind drift.
- **Altitude-based effectiveness:**
  - Correct working band (e.g. 3–15 m AGL): full swath width, full rate.
  - Too high: wider but diluted swath + extra drift/waste (coverage efficiency drops).
  - Too low: narrow swath; risk of ground collision (handled in Stage 4).
  - Visual: shadow gap makes the working band judgeable without HUD help.
- **Coverage model:**
  - Each field has a coarse coverage grid (e.g. 16×16 cells) or analytic
    area-accumulation; increments when spray lands within the field.
  - Field tint updates live: uncovered → partially covered → complete.
- **Fertilizer tank:** finite capacity; gauge shown in HUD; spraying drains it.
- **Refill:** only when the plane is on/near the runway (landed or low pass over
  the airport zone) — refill prompt appears; contract continues.
- **Exit criteria:** cover fields reliably at correct altitude; wasted spray at
  wrong altitude is visibly punished; refill loop works.

**Implementation notes (post Stage 3):**
- `spray.js` added (between `world.js` and `game.js` in script order).
- Coverage model: **analytic scalar** per field (plan allowed grid *or* analytic);
  streak visuals achieved with per-field rotated "wet strip" quads (cap 60/field),
  not a 16×16 cell grid — same look, far fewer polys.
- Refill is **landed-only** (parked on runway, speed < 3 m/s, 25%/s) — a
  simplification of the plan's "landed or low pass".
- Wind exists as a constant `WIND` vector affecting spray particles only;
  airframe wind effect remains in the Backlog (§9).
- `sprayStats {released, deposited, missed}` tracked for Stage 4 scoring.
- `fillWorldPoly()` gained an optional alpha param (wet strips render translucent).

### Stage 4 — Game Flow & HUD
**Goal:** A complete, winnable/losable game.

- **Flow:**
  1. **Title screen** — game name, controls summary, "Press Enter to start".
  2. **Takeoff** — plane on runway, throttle up, climb out, fly to farm.
  3. **Contract** — N target fields, each with a required coverage % (e.g. ≥ 80%).
  4. **Complete** — all targets met → success screen with score.
  5. **Fail** — fertilizer empty (in tank *and* no ability to reach refill? →
     fail only if tank empty and all fields short of target **and** player cannot
     reach the airport — simpler: fail when tank is empty and remaining fields
     are below target and player chooses "give up", or a time/fertilizer budget
     runs out — final rule: **fail when total fertilizer (tank + refills allowed)
     is exhausted and targets unmet**). Exact fail rule to be kept simple and
     explicit in code comments.
- **Score:** weighted combination of coverage %, fertilizer wasted (efficiency),
  and time. Best score persisted in `localStorage`.
- **HUD (Canvas-drawn):**
  - Altitude (m AGL), airspeed (km/h), throttle %, heading indicator.
  - Fertilizer tank gauge.
  - Contract panel: per-field coverage progress / targets remaining.
  - Minimap (from Stage 2), spray-active indicator.
- **Ground collision:** crash → fail screen (restart with `R`).
- **Exit criteria:** full playthrough from title → takeoff → contract complete or
  fail → restart, with correct HUD readouts throughout.

### Stage 5 — Polish (Visual)
**Goal:** Juice and readability, still zero-dependency.

- Cloud billboards at altitude (passing through them = soft white flash).
- Sun glare / lens tint; sky color shifts subtly with altitude.
- Dust kick-up particles when taking off and landing on runway.
- Wind drift visualization (windsock direction affects spray drift; light haze).
- Subtle camera shake on ground contact; bank-tilt of the horizon when turning.
- Field state colors clearly readable from distance (e.g. brown/dark → lush green).
- Title/game-over screen styling; simple typography (system fonts only).
- Performance pass: cull off-screen geometry, cap particle counts, verify 60fps
  with everything on.

### Stage 6 — Deployment & Documentation
**Goal:** Live game + written docs.

- Push everything to `main`; confirm GitHub Pages serves the final build at the
  repo URL.
- Write `README.md`: what the game is, controls table, how to play (takeoff →
  fly → spray → refill → contract), how to run locally
  (`python3 -m http.server`), how to deploy (push to `main`).
- Final smoke test in a clean browser session (no localStorage, cache disabled).

---

## 5. Repository Structure (Target)

```
crop-duster/
├── PLAN.md          # this file
├── README.md        # Stage 6
├── LICENSE
├── index.html
├── style.css
├── game.js          # entry: loop, state machine (may split into modules)
├── input.js         # (Stage 1+) keyboard state
├── camera.js        # (Stage 1+) projection / camera
├── world.js         # (Stage 2+) airport, farm, props
├── plane.js         # (Stage 1+) flight model
├── spray.js         # (Stage 3+) particles + coverage
└── hud.js           # (Stage 4+) HUD, minimap, screens
```
*(Module split is optional and may be consolidated further — the only hard rule
is: no build step, no external dependencies.)*

---

## 6. Risks & Mitigations

| Risk | Stage | Mitigation |
|---|---|---|
| Projection/clipping glitches near ground or at screen edges | 1 | Clip geometry against near plane before projection; test extreme camera angles before building content |
| Depth-sorting artifacts (overlapping billboards) | 1–2 | Consistent painter's sort by camera-space depth; keep props sparse and non-overlapping where possible |
| Altitude readability in pseudo-3D | 2–4 | Drop shadow gap + AGL readout in HUD + camera pitch tied to altitude |
| Performance with many projected polygons | 5 | Distance culling, fog cutoff, field simplification with distance, particle caps |
| Scope creep | all | Stages are ordered so the game is runnable and demonstrable after every stage |
| Deployment surprises | 0 | Enable and verify GitHub Pages at the very start, not at the end |
| GitHub push failures (transient 500s) | all | Commit locally first, push later — see §8 Git Push Policy |

---

## 7. Testing Approach

- Local: `python3 -m http.server` in the repo root, open `http://localhost:8000`.
- After every stage: manual playtest of that stage's **exit criteria**.
- Check browser console for errors every session; no warnings tolerated.
- Final: clean-profile browser test against the live GitHub Pages URL.

---

## 8. Git Push Policy (GitHub outages)

GitHub can return transient errors on push (e.g. `remote: Internal Server Error`,
HTTP 500) even while its status page reports all systems operational. Policy:

- **Always commit locally first.** A local commit is the source of truth; work is
  never blocked on GitHub being reachable.
- **If `git push origin main` fails:** do not retry indefinitely — retry a couple
  of times with short backoff, then stop. Record that there are unpushed commits
  and continue with the next task.
- **To check what is pending:** `git status` shows how far `main` is ahead of
  `origin/main`; `git log origin/main..HEAD --oneline` lists the unpushed commits.
- **Push later, once GitHub recovers:** at the start of the next session or the
  next natural checkpoint, run `git push origin main` to flush all accumulated
  commits, then confirm with `git status` that local and remote match.
- Local commits do not affect GitHub Pages; the live site simply stays on the
  last pushed commit until the next successful push.

---

## 9. Backlog (user-requested enhancements)

Requested during Stage 1 review; not yet scheduled into stage exit criteria.

| Item | Description | Proposed stage |
|---|---|---|
| Plane visual realism | Replace flat rect/ellipse overlay with a detailed rear-view silhouette (crop-duster profile: braced wings, tailwheel stance, exhaust, stripe livery), plus prop-blur disc and control-surface movement on bank/climb | Stage 5 (visual polish) |
| Physics realism — speed coupling | Climb costs airspeed (energy trade), dive gains it; throttle-dependent acceleration curve instead of linear ease | Stage 5, or earlier if Stage 4 crash logic needs it |
| Physics realism — banked turns | A/D rolls the plane first, turn rate follows bank angle (roll→turn coupling) instead of direct heading rate | Stage 5 |
| Physics realism — stall | Below a minimum speed: reduced control authority, nose-drop tendency, warning cue before stall | Stage 5 |
| Physics realism — wind | Steady wind vector drifting the plane and the spray particles (ties into Stage 3 wind-drift and windsock prop) | Stage 3–5 |

---

## 10. Status

| Stage | Status |
|---|---|
| 0 — Scaffold & deploy wiring | ✅ Done (2026-10-07) — live at https://asutoshdalei.github.io/crop-duster/ |
| 1 — Pseudo-3D engine core | ✅ Done (2026-10-07) — playtest passed |
| 2 — World building | ✅ Done (2026-10-07) — playtest passed |
| 3 — Crop-dusting mechanics | ✅ Done (2026-10-07) — playtest passed |
| 4 — Game flow & HUD | ⬜ Not started |
| 5 — Polish | ⬜ Not started |
| 6 — Deployment & docs | ⬜ Not started |
