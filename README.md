# Crop Duster

A zero-dependency, pseudo-3D crop-dusting game that runs entirely in the
browser. Fly a crop duster over a 4 x 4 km farm, cover your four contract
fields with fertilizer, and bring the plane home in one piece.

**Play:** https://asutoshdalei.github.io/crop-duster/

No build step, no packages, no assets — one HTML file, three JavaScript files,
one stylesheet, Canvas 2D.

## Controls

| Key | Action |
|---|---|
| `Enter` | Start (title screen) |
| `W` / `S` | Climb / dive |
| `A` / `D` | Bank (turn rate follows bank angle in flight, steers on the ground) |
| `↑` / `↓` | Throttle up / down |
| `Space` | Spray (hold) |
| `R` | New contract (after win/fail) |
| `Esc` | Back to title |

## How to play

1. **Takeoff** — full throttle, roll down the runway, lift off below the
   tree line.
2. **Find the contract** — the four contract fields are numbered on the
   minimap (top-right) and outlined in the world.
3. **Spray** — fly low (ideal band is 3-15 m above the crop) and hold
   `Space`. The wet strip width depends on altitude; too high and you waste
   fertilizer, too low and the contract is slow to build.
4. **Refill** — land on the runway and stop over the refill marker when the
   tank runs dry. You get 3 refills total.
5. **Win** — all four contract fields at 80% coverage. Score is coverage
   (max 600) + efficiency (max 200) + time (max 200); your best score is
   saved in `localStorage`.

**You fail if** you crash (touchdown faster than 15 m/s or descending harder
than 4 m/s) or you run out of fertilizer with the contract incomplete.

## Flight model notes

- Climb costs airspeed, dive gains it — watch the speed, not just the
  throttle.
- Below ~15 m/s the wings start to lose authority: reduced control, a
  nose-drop, and a blinking `STALL` warning above 15 m.
- Steady wind drifts both the spray pattern and (slightly) the airframe;
  the windsock by the runway shows its direction.

## Run locally

```sh
python3 -m http.server 8123
```

Open http://localhost:8123/ — any static file server works; there is nothing
to install or compile.

## Deploy

Push to `main`; GitHub Pages serves the repository root automatically. The
game is live at https://asutoshdalei.github.io/crop-duster/.

## Repository layout

| File | Role |
|---|---|
| `index.html` / `style.css` | Shell, fullscreen canvas |
| `world.js` | Terrain, runway, fields, props, minimap |
| `spray.js` | Tank, spray particles, coverage marks, wind |
| `game.js` | Game loop, camera/projection, flight model, HUD, states |
| `PLAN.md` | Stage-by-stage design plan and status |

All files load as classic scripts in this order (`world.js` → `spray.js` →
`game.js`); the rules engine and renderer live in `game.js`.
