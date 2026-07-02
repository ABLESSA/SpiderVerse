export const EFFECTS = Object.freeze([
  { id: "halftonePop", label: "Halftone" },
  { id: "chromaticPunch", label: "Chromatic" },
  { id: "inkBurst", label: "Ink Burst" },
  { id: "speedLines", label: "Speed Lines" },
  { id: "posterHeat", label: "Poster Heat" }
]);

export const DEFAULT_REGION_EFFECTS = Object.freeze([
  "halftonePop",
  "chromaticPunch",
  "inkBurst"
]);

export const REGION_LABELS = Object.freeze([
  "Thumb to Index",
  "Index to Middle",
  "Middle to Pinky"
]);

export function createRegionEffectState() {
  return [...DEFAULT_REGION_EFFECTS];
}

export function getEffectIndex(effectId) {
  const index = EFFECTS.findIndex((effect) => effect.id === effectId);
  if (index === -1) {
    throw new Error(`Unknown effect: ${effectId}`);
  }
  return index;
}

export function setRegionEffect(state, regionIndex, effectId) {
  if (!Number.isInteger(regionIndex) || regionIndex < 0 || regionIndex >= 3) {
    throw new Error(`Invalid region index: ${regionIndex}`);
  }

  getEffectIndex(effectId);
  const next = [...state];
  const duplicateIndex = next.findIndex(
    (selectedEffect, index) => selectedEffect === effectId && index !== regionIndex
  );

  if (duplicateIndex !== -1) {
    next[duplicateIndex] = next[regionIndex];
  }

  next[regionIndex] = effectId;
  return next;
}

export function createRegionPickerModels(state) {
  if (!Array.isArray(state) || state.length !== REGION_LABELS.length) {
    throw new Error("Region effect state must contain exactly three effects.");
  }

  return REGION_LABELS.map((label, index) => {
    getEffectIndex(state[index]);

    return {
      id: `region-effect-${index}`,
      label,
      regionIndex: index,
      selectedEffectId: state[index],
      options: EFFECTS
    };
  });
}
