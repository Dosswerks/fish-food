/**
 * Bonus pickup entity management.
 * Types: speed_boost, energy_shield, stress_relief
 */

const BONUS_TYPES = ['speed_boost', 'energy_shield', 'stress_relief'];
const DESPAWN_TIME = 8; // seconds

/**
 * Try to spawn a bonus pickup based on spawn chance.
 * @param {number} spawnChance - Probability per food spawn cycle (0–1)
 * @param {number} tankWidth - Tank width for random positioning
 * @param {number} tankHeight - Tank height for random positioning
 * @returns {object|null} Bonus pickup entity or null
 */
export function trySpawnBonus(spawnChance, tankWidth, tankHeight) {
  if (Math.random() > spawnChance) return null;

  const type = BONUS_TYPES[Math.floor(Math.random() * BONUS_TYPES.length)];
  const x = Math.random() * (tankWidth - 40) + 20;
  const y = Math.random() * (tankHeight - 100) + 50;

  return {
    type,
    position: { x, y },
    boundingBox: { x, y, w: 16, h: 16 },
    active: true,
    despawnTimer: DESPAWN_TIME,
    collisionType: 'bonus',
    // Visual pulse phase
    pulsePhase: Math.random() * Math.PI * 2,
  };
}

/**
 * Update bonus pickups (despawn timer, animation).
 * @param {object[]} bonuses - Array of active bonus pickups
 * @param {number} dt - Delta time in seconds
 */
export function updateBonuses(bonuses, dt) {
  for (let i = bonuses.length - 1; i >= 0; i--) {
    const b = bonuses[i];
    if (!b.active) { bonuses.splice(i, 1); continue; }
    b.despawnTimer -= dt;
    if (b.despawnTimer <= 0) {
      b.active = false;
      bonuses.splice(i, 1);
    }
    b.pulsePhase += dt * 4;
  }
}

/** Duration of each bonus effect in seconds. */
export const BONUS_DURATIONS = {
  speed_boost: 5,
  energy_shield: 6,
  stress_relief: 0, // instant
};

/** Speed boost multiplier. */
export const SPEED_BOOST_MULTIPLIER = 1.6;

/** Stress relief amount. */
export const STRESS_RELIEF_AMOUNT = 25;
