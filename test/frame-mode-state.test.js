import test from "node:test";
import assert from "node:assert/strict";

import { createFrameModeState, updateFrameModeState } from "../src/frame-mode-state.js";

const effects = ["halftonePop", "chromaticPunch", "inkBurst", "speedLines", "posterHeat"];

function frame(name = "live-frame") {
  return {
    name,
    points: [
      { x: 0.1, y: 0.1, z: 0 },
      { x: 0.4, y: 0.1, z: 0 },
      { x: 0.4, y: 0.4, z: 0 },
      { x: 0.1, y: 0.4, z: 0 }
    ]
  };
}

test("starts with the thumb-index effect for the live frame", () => {
  const state = createFrameModeState(["halftonePop", "chromaticPunch", "inkBurst"]);

  assert.equal(state.liveEffectId, "halftonePop");
  assert.deepEqual(state.frozenFrames, []);
});

test("copies the live frame once when both hands first pinch in locked frame mode", () => {
  let state = createFrameModeState(["halftonePop", "chromaticPunch", "inkBurst"]);

  state = updateFrameModeState(state, {
    liveFrame: frame(),
    bothHandsPinched: true,
    regionEffects: ["halftonePop", "chromaticPunch", "inkBurst"],
    allEffectIds: effects
  });

  assert.equal(state.frozenFrames.length, 1);
  assert.equal(state.frozenFrames[0].effectId, "halftonePop");
  assert.equal(state.liveEffectId, "chromaticPunch");

  state = updateFrameModeState(state, {
    liveFrame: frame("still-pinched"),
    bothHandsPinched: true,
    regionEffects: ["halftonePop", "chromaticPunch", "inkBurst"],
    allEffectIds: effects
  });

  assert.equal(state.frozenFrames.length, 1);
});

test("copies again after pinch release and advances through region effects", () => {
  let state = createFrameModeState(["halftonePop", "chromaticPunch", "inkBurst"]);

  state = updateFrameModeState(state, {
    liveFrame: frame("first"),
    bothHandsPinched: true,
    regionEffects: ["halftonePop", "chromaticPunch", "inkBurst"],
    allEffectIds: effects
  });
  state = updateFrameModeState(state, {
    liveFrame: frame("released"),
    bothHandsPinched: false,
    regionEffects: ["halftonePop", "chromaticPunch", "inkBurst"],
    allEffectIds: effects
  });
  state = updateFrameModeState(state, {
    liveFrame: frame("second"),
    bothHandsPinched: true,
    regionEffects: ["halftonePop", "chromaticPunch", "inkBurst"],
    allEffectIds: effects
  });

  assert.deepEqual(
    state.frozenFrames.map((item) => item.effectId),
    ["halftonePop", "chromaticPunch"]
  );
  assert.equal(state.liveEffectId, "inkBurst");
});

test("after region effects are used, live frame switches to the first unused selectable effect", () => {
  let state = createFrameModeState(["halftonePop", "chromaticPunch", "inkBurst"]);

  for (const name of ["first", "second", "third"]) {
    state = updateFrameModeState(state, {
      liveFrame: frame(name),
      bothHandsPinched: true,
      regionEffects: ["halftonePop", "chromaticPunch", "inkBurst"],
      allEffectIds: effects
    });
    state = updateFrameModeState(state, {
      liveFrame: frame(`${name}-released`),
      bothHandsPinched: false,
      regionEffects: ["halftonePop", "chromaticPunch", "inkBurst"],
      allEffectIds: effects
    });
  }

  assert.deepEqual(
    state.frozenFrames.map((item) => item.effectId),
    ["halftonePop", "chromaticPunch", "inkBurst"]
  );
  assert.equal(state.liveEffectId, "speedLines");
});
