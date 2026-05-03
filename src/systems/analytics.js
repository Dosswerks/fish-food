/**
 * Gameplay telemetry logging to browser console.
 * Disabled by default; enable via config flag.
 */
export class AnalyticsSystem {
  constructor(enabled = false) {
    this._enabled = enabled;
    this._sessionId = this._generateId();
    this._levelStats = this._freshStats();
  }

  _generateId() {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  _freshStats() {
    return {
      foodCollected: 0,
      rottenFoodHits: 0,
      predatorHits: 0,
      bonusCollected: 0,
      exitAttempts: 0,
      exitSuccesses: 0,
      stressPeak: 0,
      startTime: 0,
    };
  }

  setEnabled(enabled) { this._enabled = enabled; }

  /** Call when a level starts. */
  levelStart(levelIndex) {
    this._levelStats = this._freshStats();
    this._levelStats.startTime = Date.now();
    this._log('level_start', { levelIndex });
  }

  /** Call when a level is completed. */
  levelComplete(levelIndex) {
    const elapsed = (Date.now() - this._levelStats.startTime) / 1000;
    this._log('level_complete', { levelIndex, timeSpent: elapsed, ...this._levelStats });
  }

  /** Call on game over. */
  gameOver(levelIndex, cause) {
    const elapsed = (Date.now() - this._levelStats.startTime) / 1000;
    this._log('game_over', { levelIndex, cause, timeSpent: elapsed, ...this._levelStats });
  }

  trackFood() { this._levelStats.foodCollected++; }
  trackRottenFood() { this._levelStats.rottenFoodHits++; }
  trackPredatorHit() { this._levelStats.predatorHits++; }
  trackBonus() { this._levelStats.bonusCollected++; }
  trackExitAttempt(success) {
    this._levelStats.exitAttempts++;
    if (success) this._levelStats.exitSuccesses++;
  }
  trackStress(value) {
    if (value > this._levelStats.stressPeak) this._levelStats.stressPeak = value;
  }

  /** Log session end. */
  sessionEnd(lastLevelIndex) {
    this._log('session_end', { lastLevelIndex });
  }

  _log(event, data) {
    if (!this._enabled) return;
    console.log(JSON.stringify({
      event,
      sessionId: this._sessionId,
      timestamp: new Date().toISOString(),
      ...data,
    }));
  }
}
