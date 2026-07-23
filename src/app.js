import {
  buildActiveMagicRegions,
  buildLockedThumbIndexFilterFrame,
  isThumbIndexPinched,
  normalizeHands,
  normalizeHandsForThumbIndexFrame,
  smoothPoints
} from "./hand-geometry.js";
import {
  EFFECTS,
  createRegionEffectState,
  createRegionPickerModels,
  getEffectIndex,
  setRegionEffect
} from "./effect-selection.js";
import { createFrameModeState, updateFrameModeState } from "./frame-mode-state.js";
import { FingerMagicRenderer } from "./webgl-renderer.js";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const MEDIAPIPE_VERSION = "0.10.35";
const MEDIAPIPE_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const WASM_URL = `${MEDIAPIPE_BASE}/wasm`;

const video = document.querySelector("#camera");
const topbar = document.querySelector(".topbar");
const controls = document.querySelector(".controls");
const canvas = document.querySelector("#output");
const debugCanvas = document.querySelector("#debug-canvas");
const effectPickers = document.querySelector("#effect-pickers");
const statusEl = document.querySelector("#status");
const debugToggle = document.querySelector("#debug-toggle");

let renderer;
let handLandmarker;
let regionEffects = createRegionEffectState();
let showDebug = false;
let lastVideoTime = -1;
let latestQuads = [];
let previousRegionPoints = null;
let thumbIndexFrameLocked = false;
let frameModeState = createFrameModeState(regionEffects);

function setStatus(message) {
  statusEl.textContent = message;
}

function getHandLabel(result, index) {
  const category = result.handedness?.[index]?.[0];
  return category?.categoryName ?? category?.displayName ?? "Unknown";
}

async function loadHandTracker() {
  const loadingTimeout = window.setTimeout(() => {
    setStatus("Still loading hand tracker. Confirm http://127.0.0.1:4173/ is running, then refresh.");
  }, 8000);
  try {
    const vision = await import(`${MEDIAPIPE_BASE}/vision_bundle.mjs`);
    const filesetResolver = await vision.FilesetResolver.forVisionTasks(WASM_URL);
    const baseOptions = {
      modelAssetPath: MODEL_URL
    };
    const options = {
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55
    };

    try {
      return await vision.HandLandmarker.createFromOptions(filesetResolver, {
        ...options,
        baseOptions: {
          ...baseOptions,
          delegate: "GPU"
        }
      });
    } catch (error) {
      console.warn("GPU hand tracking failed, falling back to CPU.", error);
      return await vision.HandLandmarker.createFromOptions(filesetResolver, {
        ...options,
        baseOptions: {
          ...baseOptions,
          delegate: "CPU"
        }
      });
    }
  } finally {
    window.clearTimeout(loadingTimeout);
  }
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support camera access.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { exact: "environment" },
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

  document.documentElement.style.setProperty("--camera-aspect", `${width} / ${height}`);
  fitStageToViewport();
}

function fitStageToViewport() {
  const width = video.videoWidth || canvas.width || 1280;
  const height = video.videoHeight || canvas.height || 720;
  const maxWidth = Math.max(300, window.innerWidth - 36);
  const occupiedHeight = topbar.offsetHeight + controls.offsetHeight + 112;
  const maxHeight = Math.max(240, window.innerHeight - occupiedHeight);
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

function clearTracking(message) {
  latestQuads = [];
  previousRegionPoints = null;
  thumbIndexFrameLocked = false;
  frameModeState = createFrameModeState(regionEffects);
  setStatus(message);
}

function flattenRegions(regions) {
  return Object.fromEntries(
    regions.flatMap((region) =>
      region.points.map((point, index) => [`${region.name}-${index}`, point])
    )
  );
}

function unflattenRegions(regions, points) {
  return regions.map((region) => ({
    ...region,
    points: region.points.map((point, index) => points[`${region.name}-${index}`] ?? point)
  }));
}

function updateQuads(result) {
  const hands = buildDetectedHands(result);
  const normalized = thumbIndexFrameLocked ? normalizeHandsForThumbIndexFrame(hands) : normalizeHands(hands);

  if (normalized.status === "no-hands") {
    clearTracking("Show both hands to begin.");
    return;
  }

  if (normalized.status === "one-hand") {
    clearTracking("One hand found. Add your other hand to form the magic zones.");
    return;
  }

  let regions = thumbIndexFrameLocked
    ? [buildLockedThumbIndexFilterFrame(normalized.left, normalized.right)].filter(Boolean)
    : buildActiveMagicRegions(normalized.left, normalized.right);

  if (regions.length < 1) {
    clearTracking("Keep thumb, index, middle, and pinky fingertips visible.");
    return;
  }

  if (regions[0]?.name === "thumb-index-frame") {
    thumbIndexFrameLocked = true;
  }

  const currentPoints = flattenRegions(regions);
  const smoothedPoints = smoothPoints(previousRegionPoints, currentPoints, 0.38);
  previousRegionPoints = smoothedPoints;

  const smoothedRegions = unflattenRegions(regions, smoothedPoints);
  const liveFrame = smoothedRegions.find((quad) => quad.name === "thumb-index-frame");

  if (thumbIndexFrameLocked) {
    frameModeState = updateFrameModeState(frameModeState, {
      liveFrame,
      bothHandsPinched: isThumbIndexPinched(normalized.left) && isThumbIndexPinched(normalized.right),
      regionEffects,
      allEffectIds: EFFECTS.map((effect) => effect.id)
    });
  }

  const frozenQuads = frameModeState.frozenFrames.map((quad) => ({
    ...quad,
    effectIndex: getEffectIndex(quad.effectId)
  }));

  latestQuads = [
    ...frozenQuads,
    ...smoothedRegions.map((quad, index) => {
      const effectId = quad.name === "thumb-index-frame" ? frameModeState.liveEffectId : regionEffects[index];
      return {
        ...quad,
        effectId,
        effectIndex: getEffectIndex(effectId)
      };
    })
  ];
  setStatus(
    liveFrame
      ? "Thumb-index frame locked. Filter frame is live."
      : latestQuads.length === 1
      ? "Thumb and index locked. Single space effect is live."
      : "Two hands locked. Three comic effects are live."
  );
}

function drawDebugOverlay() {
  const ctx = debugCanvas.getContext("2d");
  ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
  if (!showDebug) return;

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(39, 245, 185, 0.95)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";

  latestQuads.forEach((quad, index) => {
    const points = quad.points.map((point) => ({
      x: (1 - point.x) * debugCanvas.width,
      y: point.y * debugCanvas.height
    }));

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.stroke();

    const center = points.reduce(
      (sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }),
      { x: 0, y: 0 }
    );

    ctx.font = "700 16px Inter, system-ui, sans-serif";
    ctx.fillText(String(index + 1), center.x - 4, center.y + 5);

    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  ctx.restore();
}

function renderFrame() {
  if (video.currentTime !== lastVideoTime && handLandmarker) {
    lastVideoTime = video.currentTime;
    updateQuads(handLandmarker.detectForVideo(video, performance.now()));
  }

  renderer.render({
    video,
    quads: latestQuads
  });
  drawDebugOverlay();

  requestAnimationFrame(renderFrame);
}

function updateExistingQuadEffects() {
  frameModeState = {
    ...frameModeState,
    liveEffectId: regionEffects[0]
  };
  latestQuads = latestQuads.map((quad, index) => {
    if (quad.name === "thumb-index-frame") {
      return {
        ...quad,
        effectId: frameModeState.liveEffectId,
        effectIndex: getEffectIndex(frameModeState.liveEffectId)
      };
    }

    if (quad.name?.startsWith("frozen-thumb-index-frame-")) {
      return quad;
    }

    return {
      ...quad,
      effectId: regionEffects[index],
      effectIndex: getEffectIndex(regionEffects[index])
    };
  });
}

function bindControls() {
  effectPickers.innerHTML = "";
  const selects = [];

  createRegionPickerModels(regionEffects).forEach((model) => {
    const wrapper = document.createElement("div");
    wrapper.className = "effect-picker";

    const label = document.createElement("label");
    label.htmlFor = model.id;
    label.textContent = model.label;

    const select = document.createElement("select");
    select.id = model.id;
    select.dataset.region = String(model.regionIndex);
    select.setAttribute("aria-label", `${model.label} effect`);

    model.options.forEach((effect) => {
      const option = document.createElement("option");
      option.value = effect.id;
      option.textContent = effect.label;
      option.selected = effect.id === model.selectedEffectId;
      select.append(option);
    });

    select.addEventListener("change", () => {
      regionEffects = setRegionEffect(regionEffects, model.regionIndex, select.value);
      selects.forEach((item, index) => {
        item.value = regionEffects[index];
      });
      updateExistingQuadEffects();
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

    setStatus("Loading MediaPipe hand tracker...");
    handLandmarker = await loadHandTracker();

    setStatus("Allow camera access to start.");
    await startCamera();

    setStatus("Show both hands to begin.");
    requestAnimationFrame(renderFrame);
  } catch (error) {
    console.error(error);
    latestQuads = [];

    if (String(error?.name).includes("NotAllowed")) {
      setStatus("Camera permission was denied. Enable camera access and reload.");
      return;
    }

    setStatus(error?.message || "Something went wrong while starting Finger Magic Lite.");
  }
}

main();
