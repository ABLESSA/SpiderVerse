function cloneFrame(frame) {
  return {
    ...frame,
    points: frame.points.map((point) => ({ ...point }))
  };
}

function orderedUnique(values) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function chooseNextEffect({ frozenFrames, liveEffectId, regionEffects, allEffectIds }) {
  const usedEffectIds = new Set([...frozenFrames.map((frame) => frame.effectId), liveEffectId]);
  const preferred = orderedUnique([...regionEffects.slice(1), ...allEffectIds]);
  return preferred.find((effectId) => !usedEffectIds.has(effectId)) ?? preferred[0] ?? liveEffectId;
}

export function createFrameModeState(regionEffects) {
  return {
    frozenFrames: [],
    liveEffectId: regionEffects[0],
    wasPinched: false
  };
}

export function updateFrameModeState(state, { liveFrame, bothHandsPinched, regionEffects, allEffectIds }) {
  const next = {
    frozenFrames: state.frozenFrames,
    liveEffectId: state.liveEffectId,
    wasPinched: bothHandsPinched
  };

  if (!liveFrame || !bothHandsPinched || state.wasPinched) {
    return next;
  }

  const frozenFrames = [
    ...state.frozenFrames,
    {
      ...cloneFrame(liveFrame),
      name: `frozen-thumb-index-frame-${state.frozenFrames.length + 1}`,
      effectId: state.liveEffectId
    }
  ];

  return {
    frozenFrames,
    liveEffectId: chooseNextEffect({
      frozenFrames,
      liveEffectId: state.liveEffectId,
      regionEffects,
      allEffectIds
    }),
    wasPinched: bothHandsPinched
  };
}
