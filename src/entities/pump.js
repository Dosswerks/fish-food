/**
 * Pump / water current entity factory.
 * Creates pump entities from level config that generate directional currents.
 */

/**
 * Create pump entities from level config.
 * @param {object[]} pumpConfigs - Array of pump definitions from level JSON
 * @returns {object[]} Array of pump entities
 */
export function createPumps(pumpConfigs = []) {
  return pumpConfigs.map((p, i) => ({
    id: `pump_${i}`,
    position: { ...p.position },
    direction: { ...p.direction },
    strength: p.strength || 0.5,
    areaOfEffect: { ...p.areaOfEffect },
    active: true,
  }));
}

/**
 * Apply current forces from all pumps to an entity.
 * @param {{ x: number, y: number }} entityPos - Entity center position
 * @param {object[]} pumps - Array of pump entities
 * @param {number} dt - Delta time in seconds
 * @param {number} [forceScale=60] - Force multiplier
 * @returns {{ x: number, y: number }} Combined force vector
 */
export function computeCurrentForce(entityPos, pumps, dt, forceScale = 60) {
  let fx = 0, fy = 0;
  for (const pump of pumps) {
    if (!pump.active) continue;
    const aoe = pump.areaOfEffect;
    if (entityPos.x > aoe.x && entityPos.x < aoe.x + aoe.w &&
        entityPos.y > aoe.y && entityPos.y < aoe.y + aoe.h) {
      fx += pump.direction.x * pump.strength * dt * forceScale;
      fy += pump.direction.y * pump.strength * dt * forceScale;
    }
  }
  return { x: fx, y: fy };
}
