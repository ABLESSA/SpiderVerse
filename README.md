# Finger Magic Lite

Finger Magic Lite is a static browser camera experiment. It uses MediaPipe Hand Landmarker to detect two hands, pairs matching thumb, index, middle, and pinky fingertips, then renders three comic-style WebGL effect zones between adjacent finger pairs.

## Run

```bash
npm install
npm run serve
```

Open `http://127.0.0.1:4173/` in Chrome or Edge and allow camera access.

## Start Automatically on Windows

Run this once in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-startup-task.ps1
```

This creates a Windows scheduled task named `Finger Magic Local Server`. It starts the local server at login so restored browser tabs can load `http://127.0.0.1:4173/` after a reboot.

To start the server manually:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-finger-magic.ps1
```

## Test

```bash
npm test
```

## Use

Show both hands to the camera. The app pairs left/right thumb, index, middle, and pinky fingertips, then creates these three regions:

- Thumb to Index
- Index to Middle
- Middle to Pinky

The three selectors choose one comic shader per region: Halftone, Chromatic, Ink Burst, Speed Lines, or Poster Heat. Enable `Debug` to see the detected region wireframes.

## Notes

- This project is frontend-only: native HTML, CSS, and JavaScript.
- It has no login, upload, backend, deployment step, or color/glove fallback detector.
- Camera access usually requires `localhost`, `127.0.0.1`, or HTTPS.
