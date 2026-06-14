import {
  buildFingerPairs,
  buildFingerQuads,
  flattenPairs,
  normalizeHands,
  smoothPoints,
  unflattenPairs
} from "./hand-geometry.js";
import {
  EFFECTS,
  createRegionEffectState,
  getEffectIndex,
  setRegionEffect
} from "./effect-selection.js";
import { FingerMagicRenderer } from "./webgl-renderer.js";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const MEDIAPIPE_VERSION = "0.10.35";
const MEDIAPIPE_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const WASM_URL = `${MEDIAPIPE_BASE}/wasm`;

const video = document.querySelector("#camera");
const stage = document.querySelector("#stage");
const topbar = document.querySelector(".topbar");
const controls = document.querySelector(".controls");
const canvas = document.querySelector("#output");
const debugCanvas = document.querySelector("#debug-canvas");
const effectPickers = document.querySelector("#effect-pickers");
const statusEl = document.querySelector("#status");
const debugToggle = document.querySelector("#debug-toggle");

let renderer;
let handLandmarker;
let runningMode = "VIDEO";
let regionEffects = createRegionEffectState();
let showDebug = false;
let lastVideoTime = -1;
let latestQuads = [];
let previousFingerPoints = null;

function setStatus(message) {
  statusEl.textContent = message;
}

function getHandLabel(result, index) {
  const category = result.handedness?.[index]?.[0];
  return category?.categoryName ?? category?.displayName ?? "Unknown";
}

async function loadHandTracker() {
  const timeoutId = window.setTimeout(() => {
    setStatus("Hand tracker is still loading. Check network access to jsDelivr and Google model files.");
  }, 8000);

  try {
    const vision = await import(`${MEDIAPIPE_BASE}/vision_bundle.mjs`);
    const filesetResolver = await vision.FilesetResolver.forVisionTasks(WASM_URL);

    const options = {
      runningMode,
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55
    };

    try {
      const tracker = await vision.HandLandmarker.createFromOptions(filesetResolver, {
        ...options,
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "GPU"
        }
      });
      window.clearTimeout(timeoutId);
      return tracker;
    } catch (error) {
      console.warn("GPU hand tracking failed, falling back to CPU.", error);
      const tracker = await vision.HandLandmarker.createFromOptions(filesetResolver, {
        ...options,
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "CPU"
        }
      });
      window.clearTimeout(timeoutId);
      return tracker;
    }
  } catch (error) {
    window.clearTimeout(timeoutId);
    throw error;
  }
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support camera access.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  });

  video.srcObject = stream;
  await video.play();
  syncStageToCamera();
  window.addEventListener("resize", fitStageToViewport);
}

function syncStageToCamera() {
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;

  canvas.width = width;
  canvas.height = height;
  debugCanvas.width = width;
  debugCanvas.height = height;

  document.documentElement.style.setProperty("--camera-width", `${width}px`);
  document.documentElement.style.setProperty("--camera-aspect", `${width} / ${height}`);
  fitStageToViewport();
}

function fitStageToViewport() {
  const width = video.videoWidth || canvas.width || 1280;
  const height = video.videoHeight || canvas.height || 720;
  const maxWidth = Math.max(280, window.innerWidth - 36);
  const occupiedHeight = topbar.offsetHeight + controls.offsetHeight + 72;
  const maxHeight = Math.max(220, window.innerHeight - occupiedHeight);
  const scale = Math.min(1, maxWidth / width, maxHeight / height);

  document.documentElement.style.setProperty("--stage-width", `${Math.floor(width * scale)}px`);
  document.documentElement.style.setProperty("--stage-height", `${Math.floor(height * scale)}px`);
}

function buildDetectedHands(result) {
  return result.landmarks.map((landmarks, index) => ({
    label: getHandLabel(result, index),
    landmarks
  }));
}

function updateQuads(result) {
  const hands = buildDetectedHands(result);
  const normalized = normalizeHands(hands);

  if (normalized.status === "no-hands") {
    latestQuads = [];
    previousFingerPoints = null;
    setStatus("Show both hands to begin.");
    return;
  }

  if (normalized.status === "one-hand") {
    latestQuads = [];
    previousFingerPoints = null;
    setStatus("One hand found. Add your other hand to form the magic zones.");
    return;
  }

  const pairs = buildFingerPairs(normalized.left, normalized.right);
  if (pairs.length < 4) {
    latestQuads = [];
    setStatus("Keep thumb, index, middle, and pinky fingertips visible.");
    return;
  }

  const currentPoints = flattenPairs(pairs);
  const smoothedPoints = smoothPoints(previousFingerPoints, currentPoints, 0.38);
  previousFingerPoints = smoothedPoints;

  latestQuads = buildFingerQuads(unflattenPairs(pairs, smoothedPoints)).map((quad, index) => ({
    ...quad,
    effectId: regionEffects[index],
    effectIndex: getEffectIndex(regionEffects[index])
  }));
  setStatus("Two hands locked. Three comic effects are active at once.");
}

function drawDebugOverlay() {
  const ctx = debugCanvas.getContext("2d");
  ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
  if (!showDebug) return;

  ctx.save();
  ctx.strokeStyle = "rgba(113, 246, 214, 0.95)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 2;

  for (const quad of latestQuads) {
    const points = quad.points.map((point) => ({
      x: (1 - point.x) * debugCanvas.width,
      y: point.y * debugCanvas.height
    }));

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.closePath();
    ctx.stroke();

    for (const point of points) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function predictFrame() {
  if (video.currentTime !== lastVideoTime && handLandmarker) {
    lastVideoTime = video.currentTime;
    const result = handLandmarker.detectForVideo(video, performance.now());
    updateQuads(result);
  }

  renderer.render({
    video,
    quads: latestQuads
  });
  drawDebugOverlay();

  requestAnimationFrame(predictFrame);
}

function bindControls() {
  effectPickers.innerHTML = "";
  const regionLabels = ["Thumb -> Index", "Index -> Middle", "Middle -> Pinky"];
  const selects = [];

  regionEffects.forEach((effectId, regionIndex) => {
    const wrapper = document.createElement("div");
    wrapper.className = "effect-picker";

    const label = document.createElement("label");
    label.htmlFor = `region-effect-${regionIndex}`;
    label.textContent = regionLabels[regionIndex];

    const select = document.createElement("select");
    select.id = `region-effect-${regionIndex}`;
    select.dataset.region = String(regionIndex);

    for (const effect of EFFECTS) {
      const option = document.createElement("option");
      option.value = effect.id;
      option.textContent = effect.label;
      option.selected = effect.id === effectId;
      select.append(option);
    }

    select.addEventListener("change", () => {
      regionEffects = setRegionEffect(regionEffects, regionIndex, select.value);
      selects.forEach((item, index) => {
        item.value = regionEffects[index];
      });
      latestQuads = latestQuads.map((quad, index) => ({
        ...quad,
        effectId: regionEffects[index],
        effectIndex: getEffectIndex(regionEffects[index])
      }));
    });

    wrapper.append(label, select);
    effectPickers.append(wrapper);
    selects.push(select);
  });

  debugToggle.addEventListener("change", () => {
    showDebug = debugToggle.checked;
  });
}

async function main() {
  try {
    bindControls();
    renderer = new FingerMagicRenderer(canvas);

    setStatus("Loading hand tracker...");
    handLandmarker = await loadHandTracker();

    setStatus("Allow camera access to start.");
    await startCamera();

    if (runningMode !== "VIDEO") {
      runningMode = "VIDEO";
      await handLandmarker.setOptions({ runningMode });
    }

    setStatus("Show both hands to begin.");
    requestAnimationFrame(predictFrame);
  } catch (error) {
    console.error(error);
    latestQuads = [];

    if (String(error?.name).includes("NotAllowed")) {
      setStatus("Camera permission was denied. Enable camera access and reload.");
      return;
    }

    setStatus(error?.message || "Something went wrong while starting Finger Magic.");
  }
}

main();
