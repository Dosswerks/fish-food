/**
 * Difficulty scaling system.
 * Scales game parameters by difficulty tier (1–5) following a linear curve.
 */

/** Base values at tier 1. */
const BASE = {
  energyDrainRate: 2.0,      // per second while moving
  foodSpawnInterval: 2.5,    // seconds between spawns
  stressRate: 0,             // per second (0 = disabled)
  predatorSpeedMult: 1.0,
};

/** Per-tier increments. */
const SCALE = {
  energyDrainRate: 0.5,
  foodSpawnInterval: -0.2,   // faster spawns at higher tiers (shorter interval)
  stressRate: 1.5,
  predatorSpeedMult: 0.15,
};

export class DifficultySystem {
  constructor() {
    this._tier = 1;
    this._params = { ...BASE };
  }

  /** Set difficulty tier and recalculate parameters. */
  setTier(tier) {
    this._tier = Math.max(1, Math.min(5, tier));
    const t = this._tier - 1; // 0-indexed offset
    this._params = {
      energyDrainRate: BASE.energyDrainRate + SCALE.energyDrainRate * t,
      foodSpawnInterval: Math.max(1.0, BASE.foodSpawnInterval + SCALE.foodSpawnInterval * t),
      stressRate: BASE.stressRate + SCALE.stressRate * t,
      predatorSpeedMult: BASE.predatorSpeedMult + SCALE.predatorSpeedMult * t,
    };
  }

  getTier() { return this._tier; }
  getEnergyDrainRate() { return this._params.energyDrainRate; }
  getFoodSpawnInterval() { return this._params.foodSpawnInterval; }
  getStressRate() { return this._params.stressRate; }
  getPredatorSpeedMult() { return this._params.predatorSpeedMult; }

  /**
   * Validate that a level config has sufficient food energy surplus.
   * @param {object} config - Level config
   * @returns {{ valid: boolean, surplusPercent: number }}
   */
  validateSurplus(config) {
    const sessionSeconds = config.targetSessionLength || 90;
    const totalFoodSpawns = sessionSeconds / (config.foodSpawnRate || 2.5);
    const totalFoodEnergy = totalFoodSpawns * (config.foodEnergyValue || 10);
    const required = config.exitEnergyThreshold || 25;
    const surplusPercent = ((totalFoodEnergy - required) / required) * 100;
    return {
      valid: surplusPercent >= 15 && surplusPercent <= 300, // generous upper bound
      surplusPercent: Math.round(surplusPercent),
    };
  }
}
