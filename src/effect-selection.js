export const EFFECTS = Object.freeze([
  { id: "halftonePop", label: "Halftone" },
  { id: "chromaticPunch", label: "Chromatic" },
  { id: "inkBurst", label: "Ink Burst" },
  { id: "speedLines", label: "Speed Lines" },
  { id: "posterHeat", label: "Poster Heat" },
  { id: "mangaScreen", label: "Manga Screen" },
  { id: "noirInk", label: "Noir Ink" },
  { id: "comicPanel", label: "Comic Panel" },
  { id: "popArt", label: "Pop Art" }
]);

export const DEFAULT_REGION_EFFECTS = Object.freeze([
  "halftonePop",
  "chromaticPunch",
  "inkBurst"
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
