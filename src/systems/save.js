/**
 * Persists player progress to browser localStorage.
 */
const SAVE_KEY = 'fishfood_save';
const SAVE_VERSION = 1;

function defaultSave() {
  return {
    version: SAVE_VERSION,
    currentLevel: 0,
    completedLevels: [],
    starRatings: {},
    tutorialShown: {
      movement: false, food: false, energy_warning: false,
      exit: false, predator: false, stress: false, rotten_food: false,
    },
    audioSettings: { masterVolume: 1.0, musicVolume: 0.7, sfxVolume: 1.0, muted: false },
    accessibilitySettings: { motionReduction: false, inputMode: 'hold', inputSensitivity: 1.0 },
  };
}

export class SaveSystem {
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return this.validate(data);
    } catch (e) {
      console.warn('SaveSystem: corrupted save data, discarding.', e);
      this.clearSave();
      return null;
    }
  }

  save(data) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('SaveSystem: failed to write save data.', e);
    }
  }

  hasSaveData() {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  clearSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  validate(data) {
    if (!data || typeof data !== 'object') return null;
    if (data.version !== SAVE_VERSION) return null;
    if (typeof data.currentLevel !== 'number') return null;
    if (!Array.isArray(data.completedLevels)) return null;
    return data;
  }

  /** Get a fresh default save object. */
  getDefault() { return defaultSave(); }
}
