/**
 * Manages game state transitions and orchestrates system lifecycle.
 */

/** Valid states */
export const States = {
  MAIN_MENU: 'main_menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  CUTSCENE: 'cutscene',
  LEVEL_TRANSITION: 'level_transition',
  PROGRESS_MAP: 'progress_map',
  SETTINGS: 'settings',
};

/** Legal transitions: from → [to, ...] */
const TRANSITIONS = {
  [States.MAIN_MENU]: [States.PLAYING, States.SETTINGS, States.CUTSCENE],
  [States.PLAYING]: [States.PAUSED, States.GAME_OVER, States.LEVEL_TRANSITION],
  [States.PAUSED]: [States.PLAYING, States.MAIN_MENU, States.SETTINGS],
  [States.SETTINGS]: [States.MAIN_MENU, States.PAUSED],
  [States.GAME_OVER]: [States.PLAYING, States.MAIN_MENU],
  [States.LEVEL_TRANSITION]: [States.PROGRESS_MAP],
  [States.PROGRESS_MAP]: [States.PLAYING, States.CUTSCENE],
  [States.CUTSCENE]: [States.PLAYING, States.MAIN_MENU],
};

export class GameStateManager {
  constructor() {
    this._state = States.MAIN_MENU;
    this._currentLevelIndex = 0;
    this._listeners = [];
    this._params = {};
  }

  /** Get current state name. */
  getState() { return this._state; }

  /** Get params passed with the last transition. */
  getParams() { return this._params; }

  /**
   * Register a listener called on every state transition.
   * @param {function(string, string, object)} fn - (oldState, newState, params)
   */
  onTransition(fn) { this._listeners.push(fn); }

  /**
   * Transition to a new state. Validates transition is legal.
   * @param {string} newState
   * @param {object} [params] - State-specific parameters
   * @returns {boolean} Whether the transition succeeded
   */
  transition(newState, params = {}) {
    const allowed = TRANSITIONS[this._state];
    if (!allowed || !allowed.includes(newState)) {
      console.warn(`Illegal transition: ${this._state} → ${newState}`);
      return false;
    }
    const oldState = this._state;
    this._state = newState;
    this._params = params;
    for (const fn of this._listeners) {
      fn(oldState, newState, params);
    }
    return true;
  }

  /** Load a level by index. */
  loadLevel(levelIndex) {
    this._currentLevelIndex = levelIndex;
  }

  /** Reload the current level (for retry). */
  reloadLevel() {
    // Index stays the same; callers re-initialize level state
  }

  /** Get current level index. */
  getCurrentLevelIndex() { return this._currentLevelIndex; }
}
