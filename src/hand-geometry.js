export const FINGERTIPS = Object.freeze({
  thumb: 4,
  index: 8,
  middle: 12,
  pinky: 20
});

export const FINGER_NAMES = Object.freeze(Object.keys(FINGERTIPS));

function centerX(hand) {
  if (!hand?.landmarks?.length) return 0;
  return hand.landmarks.reduce((sum, point) => sum + point.x, 0) / hand.landmarks.length;
}

function normalizeLabel(hand) {
  return String(hand?.label ?? "").toLowerCase();
}

export function normalizeHands(hands) {
  if (!Array.isArray(hands) || hands.length < 2) {
    return {
      left: null,
      right: null,
      status: hands?.length === 1 ? "one-hand" : "no-hands"
    };
  }

  const candidates = hands.slice(0, 2);
  const labeledLeft = candidates.find((hand) => normalizeLabel(hand) === "left");
  const labeledRight = candidates.find((hand) => normalizeLabel(hand) === "right");

  if (labeledLeft && labeledRight && labeledLeft !== labeledRight) {
    return { left: labeledLeft, right: labeledRight, status: "ready" };
  }

  const sorted = candidates.toSorted((a, b) => centerX(a) - centerX(b));
  return { left: sorted[0], right: sorted[1], status: "ready" };
}

export function buildFingerPairs(leftHand, rightHand) {
  if (!leftHand?.landmarks || !rightHand?.landmarks) return [];

  return FINGER_NAMES.flatMap((name) => {
    const index = FINGERTIPS[name];
    const left = leftHand.landmarks[index];
    const right = rightHand.landmarks[index];

    if (!left || !right) return [];
    return [{ name, left, right }];
  });
}

export function buildFingerQuads(pairs) {
  if (!Array.isArray(pairs) || pairs.length < 2) return [];

  return pairs.slice(0, -1).map((startPair, index) => {
    const endPair = pairs[index + 1];

    return {
      name: `${startPair.name}-${endPair.name}`,
      points: [
        startPair.left,
        startPair.right,
        endPair.right,
        endPair.left
      ]
    };
  });
}

export function smoothPoints(previous, next, amount = 0.35) {
  if (!previous) return next;

  return Object.fromEntries(
    Object.entries(next).map(([key, point]) => {
      const oldPoint = previous[key];
      if (!oldPoint) return [key, point];

      return [
        key,
        {
          x: oldPoint.x + (point.x - oldPoint.x) * amount,
          y: oldPoint.y + (point.y - oldPoint.y) * amount
        }
      ];
    })
  );
}

export function flattenPairs(pairs) {
  return Object.fromEntries(
    pairs.flatMap((pair) => [
      [`${pair.name}Left`, pair.left],
      [`${pair.name}Right`, pair.right]
    ])
  );
}

export function unflattenPairs(pairs, points) {
  return pairs.map((pair) => ({
    name: pair.name,
    left: points[`${pair.name}Left`] ?? pair.left,
    right: points[`${pair.name}Right`] ?? pair.right
  }));
}
