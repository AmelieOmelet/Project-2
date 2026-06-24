# Constellation Drift (Asteroids-Style Game)

A browser-based arcade shooter inspired by Asteroids.

## Features

- Directional movement controls with auto-facing ship rotation
- Mobile touch controls for play on phones/tablets
- Multiple asteroid waves with level progression
- Scoring, lives, collision detection, and game-over state
- Dual-missile firing on every shot
- Shield pickups that grant 5 seconds of immunity
- Frenzy mode every 1000 points: constant rapid-fire for 5 seconds
- Built-in retro sound effects for actions and events
- Looping synth background music during gameplay
- Stylized neon space UI with responsive layout

## Controls

- `Left Arrow` or `A`: Move left
- `Right Arrow` or `D`: Move right
- `Up Arrow` or `W`: Move up
- `Down Arrow` or `S`: Move down
- `Space`: Fire dual missiles (hold for continuous shots)
- `Enter`: Restart after game over

Ship rotation now auto-aligns with movement direction.

## Shield Pickups

- Shield orbs spawn during runs.
- Collect one to gain 5 seconds of immunity against asteroid collisions.

## Frenzy Mode

- Every time your score crosses a new `1000` points, frenzy mode starts.
- During frenzy, firing becomes constant rapid-fire for `10` seconds.

## Run Locally

Open `index.html` directly in your browser, or serve the folder with any static file server.

Example with Python:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.
