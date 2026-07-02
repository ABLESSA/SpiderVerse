import test from "node:test";
import assert from "node:assert/strict";

import {
  FINGERTIPS,
  buildFingerPairs,
  buildFingerQuads,
  buildMagicRegions,
  normalizeHands,
  smoothPoints
} from "../src/hand-geometry.js";

function makeHand(label, xOffset) {
  const landmarks = Array.from({ length: 21 }, (_, index) => ({
    x: xOffset + index / 1000,
    y: 0.2 + index / 1000,
    z: 0
  }));

  landmarks[FINGERTIPS.thumb] = { x: xOffset + 0.01, y: 0.2, z: 0 };
  landmarks[FINGERTIPS.index] = { x: xOffset + 0.02, y: 0.3, z: 0 };
  landmarks[FINGERTIPS.middle] = { x: xOffset + 0.03, y: 0.4, z: 0 };
  landmarks[16] = { x: xOffset + 0.04, y: 0.5, z: 0 };
  landmarks[FINGERTIPS.pinky] = { x: xOffset + 0.05, y: 0.6, z: 0 };

  return { label, landmarks };
}

test("normalizes two detected hands by handedness label", () => {
  const right = makeHand("Right", 0.7);
  const left = makeHand("Left", 0.2);

  const result = normalizeHands([right, left]);

  assert.equal(result.left, left);
  assert.equal(result.right, right);
  assert.equal(result.status, "ready");
});

test("falls back to x-position ordering when handedness labels are unclear", () => {
  const highX = makeHand("Unknown", 0.8);
  const lowX = makeHand("Unknown", 0.1);

  const result = normalizeHands([highX, lowX]);

  assert.equal(result.left, lowX);
  assert.equal(result.right, highX);
  assert.equal(result.status, "ready");
});

test("builds four same-name cross-hand fingertip pairs and ignores ring fingers", () => {
  const left = makeHand("Left", 0.2);
  const right = makeHand("Right", 0.7);

  const pairs = buildFingerPairs(left, right);

  assert.deepEqual(
    pairs.map((pair) => pair.name),
    ["thumb", "index", "middle", "pinky"]
  );
  assert.ok(Math.abs(pairs[0].left.x - 0.21) < Number.EPSILON);
  assert.ok(Math.abs(pairs[0].right.x - 0.71) < Number.EPSILON);
  assert.equal(pairs.some((pair) => pair.name === "ring"), false);
});

test("builds three adjacent quadrilateral regions from four finger pairs", () => {
  const pairs = buildFingerPairs(makeHand("Left", 0.2), makeHand("Right", 0.7));

  const quads = buildFingerQuads(pairs);

  assert.equal(quads.length, 3);
  assert.deepEqual(
    quads.map((quad) => quad.name),
    ["thumb-index", "index-middle", "middle-pinky"]
  );
  assert.deepEqual(quads[0].points, [
    pairs[0].left,
    pairs[0].right,
    pairs[1].right,
    pairs[1].left
  ]);
});

test("builds the three requested magic regions directly from two hands", () => {
  const left = makeHand("Left", 0.2);
  const right = makeHand("Right", 0.7);

  const regions = buildMagicRegions(left, right);

  assert.deepEqual(
    regions.map((region) => region.name),
    ["thumb-index", "index-middle", "middle-pinky"]
  );
  assert.equal(regions.every((region) => region.points.length === 4), true);
  assert.deepEqual(regions[2].points, [
    left.landmarks[FINGERTIPS.middle],
    right.landmarks[FINGERTIPS.middle],
    right.landmarks[FINGERTIPS.pinky],
    left.landmarks[FINGERTIPS.pinky]
  ]);
});

test("smooths matching points toward the latest frame", () => {
  const previous = {
    thumb: { x: 0, y: 0 },
    index: { x: 0.5, y: 0.5 }
  };
  const next = {
    thumb: { x: 1, y: 1 },
    index: { x: 1, y: 0 }
  };

  const smoothed = smoothPoints(previous, next, 0.25);

  assert.deepEqual(smoothed.thumb, { x: 0.25, y: 0.25 });
  assert.deepEqual(smoothed.index, { x: 0.625, y: 0.375 });
});
