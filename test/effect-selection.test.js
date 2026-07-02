import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_REGION_EFFECTS,
  EFFECTS,
  REGION_LABELS,
  createRegionEffectState,
  createRegionPickerModels,
  setRegionEffect
} from "../src/effect-selection.js";

test("starts with exactly three selected effects for the three regions", () => {
  const state = createRegionEffectState();

  assert.deepEqual(state, DEFAULT_REGION_EFFECTS);
  assert.equal(state.length, 3);
  assert.equal(new Set(state).size, 3);
  assert.ok(EFFECTS.length >= 5);
  assert.deepEqual(REGION_LABELS, ["Thumb to Index", "Index to Middle", "Middle to Pinky"]);
});

test("creates three picker models with labels, selected effects, and full option lists", () => {
  const state = ["posterHeat", "speedLines", "inkBurst"];

  const models = createRegionPickerModels(state);

  assert.equal(models.length, 3);
  assert.deepEqual(
    models.map((model) => model.label),
    REGION_LABELS
  );
  assert.deepEqual(
    models.map((model) => model.selectedEffectId),
    state
  );
  assert.equal(models[0].options, EFFECTS);
});

test("changes only the selected region effect", () => {
  const state = createRegionEffectState();

  const next = setRegionEffect(state, 1, "speedLines");

  assert.deepEqual(next, [state[0], "speedLines", state[2]]);
});

test("swaps duplicate selections so three regions keep different effects", () => {
  const state = createRegionEffectState();

  const next = setRegionEffect(state, 1, state[0]);

  assert.deepEqual(next, [state[1], state[0], state[2]]);
  assert.equal(new Set(next).size, 3);
});

test("rejects unknown effects and invalid region indexes", () => {
  const state = createRegionEffectState();

  assert.throws(() => setRegionEffect(state, 3, EFFECTS[0].id), /region/i);
  assert.throws(() => setRegionEffect(state, 0, "plain-filter"), /effect/i);
});
