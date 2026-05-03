/**
 * Level configuration validator.
 * Checks that levels are completable and meet difficulty constraints.
 * Can be run as a pre-build step or at runtime in debug mode.
 */

/**
 * Validate a level configuration for completability and balance.
 * @param {object} config - Parsed level config
 * @returns {{ valid: boolean, warnings: string[], errors: string[] }}
 */
export function validateLevel(config) {
  const errors = [];
  const warnings = [];

  // 1. Food energy surplus check (15–300% above exit threshold)
  const sessionSeconds = config.targetSessionLength || 90;
  const spawnInterval = config.foodSpawnRate || 2.5;
  const totalSpawns = Math.floor(sessionSeconds / spawnInterval);
  const totalFoodEnergy = totalSpawns * (config.foodEnergyValue || 10);
  const required = config.exitEnergyThreshold || 25;
  const surplusPercent = ((totalFoodEnergy - required) / required) * 100;

  if (surplusPercent < 15) {
    errors.push(`Level ${config.levelIndex}: food energy surplus is ${surplusPercent.toFixed(0)}% (minimum 15%). Total food: ${totalFoodEnergy}, required: ${required}`);
  } else if (surplusPercent > 300) {
    warnings.push(`Level ${config.levelIndex}: food energy surplus is ${surplusPercent.toFixed(0)}% (very generous). Consider reducing food spawn rate.`);
  }

  // 2. Predator count check
  const predators = config.predators || [];
  if (predators.length > 4) {
    errors.push(`Level ${config.levelIndex}: ${predators.length} predators exceeds maximum of 4`);
  }

  // 3. Patrol path doesn't permanently block exit
  const exitZone = config.exitZone;
  if (exitZone && predators.length > 0) {
    for (let i = 0; i < predators.length; i++) {
      const pred = predators[i];
      if (pred.type === 'patrol' && pred.patrolPath) {
        const allInExit = pred.patrolPath.every(pt =>
          pt.x >= exitZone.x && pt.x <= exitZone.x + exitZone.w &&
          pt.y >= exitZone.y && pt.y <= exitZone.y + exitZone.h
        );
        if (allInExit) {
          errors.push(`Level ${config.levelIndex}: predator ${i} patrol path is entirely within exit zone`);
        }
      }
    }
  }

  // 4. Player start position is within tank bounds
  const dims = config.tankDimensions;
  const start = config.playerStartPosition;
  if (dims && start) {
    if (start.x < 0 || start.x > dims.width - 32 || start.y < 0 || start.y > dims.height - 24) {
      errors.push(`Level ${config.levelIndex}: player start position (${start.x}, ${start.y}) is outside tank bounds`);
    }
  }

  // 5. Exit zone is within tank bounds
  if (dims && exitZone) {
    if (exitZone.x + exitZone.w > dims.width || exitZone.y + exitZone.h > dims.height) {
      errors.push(`Level ${config.levelIndex}: exit zone extends outside tank bounds`);
    }
  }

  // 6. Starting energy is within valid range
  if (config.startingEnergy < 1 || config.startingEnergy > 100) {
    errors.push(`Level ${config.levelIndex}: starting energy ${config.startingEnergy} is outside [1, 100]`);
  }

  // 7. Exit threshold is achievable from starting energy + food
  if (config.startingEnergy + totalFoodEnergy < config.exitEnergyThreshold) {
    errors.push(`Level ${config.levelIndex}: impossible to reach exit threshold. Start: ${config.startingEnergy}, food: ${totalFoodEnergy}, threshold: ${config.exitEnergyThreshold}`);
  }

  // 8. Difficulty tier is in range
  if (config.difficultyTier < 1 || config.difficultyTier > 5) {
    warnings.push(`Level ${config.levelIndex}: difficulty tier ${config.difficultyTier} is outside [1, 5]`);
  }

  // 9. Hazard positions are within tank bounds
  for (const h of (config.hazards || [])) {
    if (h.position.x + h.dimensions.w > dims.width || h.position.y + h.dimensions.h > dims.height) {
      warnings.push(`Level ${config.levelIndex}: hazard at (${h.position.x}, ${h.position.y}) extends outside tank`);
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Validate all levels from an array of configs.
 * @param {object[]} configs - Array of level configs
 * @returns {{ allValid: boolean, results: object[] }}
 */
export function validateAllLevels(configs) {
  const results = configs.map(c => ({ levelIndex: c.levelIndex, ...validateLevel(c) }));
  const allValid = results.every(r => r.valid);
  return { allValid, results };
}
