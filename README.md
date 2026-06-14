# Finger Magic

A static browser camera experiment that detects two hands, pairs matching fingertips, and applies live WebGL filters inside quadrilateral zones between the fingers.

## Run

```bash
npm install
npm run serve
```

Open `http://127.0.0.1:4173/` in Chrome or Edge and allow camera access.

## Use

Show both hands to the camera. The app pairs left/right thumb, index, middle, and pinky fingertips, then creates three filter zones between adjacent finger pairs. The three selectors at the bottom choose one comic-style shader for each zone, so three effects can run at the same time. Enable `Debug` to see the detected regions.
