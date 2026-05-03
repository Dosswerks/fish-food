/**
 * Hazard entity factory. Creates static hazards and suction zones from level config.
 */

/**
 * Create hazard entities from level config.
 * @param {object[]} hazardConfigs - Array of hazard definitions from level JSON
 * @returns {object[]} Array of hazard entities with bounding boxes
 */
export function createHazards(hazardConfigs = []) {
  return hazardConfigs.map((h, i) => ({
    id: `hazard_${i}`,
    type: h.type || 'rock',
    position: { ...h.position },
    dimensions: { ...h.dimensions },
    boundingBox: {
      x: h.position.x,
      y: h.position.y,
      w: h.dimensions.w,
      h: h.dimensions.h,
    },
    collisionType: h.type === 'suction' ? 'suction' : 'hazard',
    active: true,
    // Suction-specific properties
    suctionRadius: h.suctionRadius || 100,
    suctionStrength: h.suctionStrength || 200,
  }));
}

/**
 * Check if a position overlaps any static hazard.
 * Used to reposition food pellets that spawn on hazards.
 * @param {{ x, y, w, h }} box - Bounding box to check
 * @param {object[]} hazards - Array of hazard entities
 * @returns {boolean}
 */
export function overlapsHazard(box, hazards) {
  for (const h of hazards) {
    if (h.collisionType !== 'hazard') continue;
    const hb = h.boundingBox;
    if (box.x < hb.x + hb.w && box.x + box.w > hb.x &&
        box.y < hb.y + hb.h && box.y + box.h > hb.y) {
      return true;
    }
  }
  return false;
}

/**
 * Find nearest valid position for a food pellet that spawned on a hazard.
 * Shifts horizontally until clear.
 * @param {number} x - Original x position
 * @param {number} tankWidth - Tank width for bounds
 * @param {object[]} hazards - Hazard entities
 * @returns {number} Adjusted x position
 */
export function findClearFoodX(x, tankWidth, hazards) {
  const testBox = { x, y: 0, w: 12, h: 12 };
  if (!overlapsHazard(testBox, hazards)) return x;

  // Try shifting left and right in increments
  for (let offset = 20; offset < tankWidth; offset += 20) {
    testBox.x = x + offset;
    if (testBox.x + 12 < tankWidth && !overlapsHazard(testBox, hazards)) return testBox.x;
    testBox.x = x - offset;
    if (testBox.x >= 0 && !overlapsHazard(testBox, hazards)) return testBox.x;
  }
  return x; // fallback
}
