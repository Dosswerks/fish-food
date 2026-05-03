/**
 * Loads and validates level JSON configurations.
 */

const REQUIRED_FIELDS = [
  'levelIndex', 'tankTheme', 'tankDimensions', 'exitZone', 'entranceZone',
  'exitEnergyThreshold', 'exitMomentumThreshold', 'playerStartPosition',
  'startingEnergy', 'foodSpawnRate', 'foodEnergyValue', 'rottenFoodPenalty',
  'maxFoodSpawnInterval', 'difficultyTier'
];

export class LevelLoader {
  /**
   * Load a level config from a JSON file path.
   * @param {string} path
   * @returns {Promise<object>} Parsed and validated level config
   */
  async load(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load level: ${path} (${response.status})`);
    const config = await response.json();
    const result = this.validate(config);
    if (!result.valid) {
      throw new Error(`Invalid level config: ${result.errors.join(', ')}`);
    }
    return config;
  }

  /**
   * Validate a level config object against the schema.
   * @param {object} config
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validate(config) {
    const errors = [];
    for (const field of REQUIRED_FIELDS) {
      if (config[field] === undefined || config[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    if (config.predators) {
      if (config.predators.length > 4) {
        errors.push('Predator count exceeds maximum of 4');
      }
    }
    if (config.tankDimensions) {
      if (!config.tankDimensions.width || !config.tankDimensions.height) {
        errors.push('tankDimensions must have width and height');
      }
    }
    return { valid: errors.length === 0, errors };
  }

  /** Serialize a level config to JSON. */
  serialize(config) { return JSON.stringify(config); }

  /** Deserialize JSON string to level config. */
  deserialize(json) { return JSON.parse(json); }
}
