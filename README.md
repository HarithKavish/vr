# VR

A room you can look around, from a phone in a headset — [vr.harithkavish.com](https://vr.harithkavish.com).

Open the site on a phone, put the phone into a Cardboard-style viewer, and tap
**Enter VR**. You stand in a glassy night high-rise office above a 3D city; turning
your head turns the view.

## How it works

Tracking is DeviceOrientation only, read through `FallbackMotion`. WebXR's
`immersive-vr` path requires a paired headset runtime most phones don't have, so
it is detected and reported but never used for tracking.

The render path is a hand-rolled stereo compositor in `StereoRenderer`:

```
scene -> render target (left half / right half) -> barrel-distortion pass -> canvas
```

Headset lenses pincushion the screen, so each eye's half is pre-warped with the
inverse (barrel) distortion — the two cancel and the world looks rectilinear
through the glass. Eye separation, field of view and warp strength are adjustable
at runtime because browsers expose neither the phone's true pixel density nor the
lens spacing.

`Calibration` records a reference heading and re-expresses later orientations
against it, so CENTER makes the current facing forward. Only yaw is cancelled —
yaw physically happens about gravity, so folding pitch/roll into the reference
would tilt the room's axis and drift the horizon as you turn.

## Controls

In-headset, the viewer's button is a tap wherever the lever lands, so any tap
selects whatever the reticle is on:

- **CENTER** — recentre the view on the current heading
- **INFO** — toggle the diagnostics panel (FPS, tracking, current settings)
- **EXIT** — leave VR
- **EYE − / +** — move the two images together or apart until they fuse
- **FOV − / +** — match the rendered field of view to what the lenses show
- **WARP − / +** — adjust counter-distortion for lenses that need more or less

Three taps on empty space recentres. Taps that hit a button deliberately don't
count toward that, so adjusting never recentres by accident.

## Layout

```
src/vr/            tracking, stereo rendering, calibration, capability detection
src/environment/   the room, the city, procedural textures
src/ui/            landing screen, permission status
src/app/App.tsx    session lifecycle and the render loop
```

React + Three.js, built with Vite. The landing page uses the shared design
system from harithkavish.com, so it follows the ecosystem theme.

## Deploy

Pushes to `main` build and deploy to GitHub Pages via
`.github/workflows/deploy.yml`.

Part of the HarithKavish ecosystem.
