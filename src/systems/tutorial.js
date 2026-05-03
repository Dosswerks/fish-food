/**
 * Contextual tutorial prompt system.
 * Shows each prompt once per save file, pauses game while displayed.
 */
export class TutorialSystem {
  constructor(stringTable, saveSystem) {
    this._strings = stringTable;
    this._save = saveSystem;
    this._shown = {};
    this._activePrompt = null;
    this._pendingQueue = [];

    // Load shown state from save
    const data = saveSystem.load();
    if (data && data.tutorialShown) {
      this._shown = { ...data.tutorialShown };
    }
  }

  /**
   * Try to show a tutorial prompt. Queues if another is active.
   * @param {string} key - Tutorial key (e.g., 'movement', 'food')
   * @returns {boolean} Whether the prompt was queued (false if already shown)
   */
  tryShow(key) {
    if (this._shown[key]) return false;
    if (this._activePrompt && this._activePrompt.key === key) return false;
    if (this._pendingQueue.some(p => p.key === key)) return false;

    const text = this._strings.get(`tutorial.${key}`);
    const prompt = { key, text };

    if (!this._activePrompt) {
      this._activePrompt = prompt;
    } else {
      this._pendingQueue.push(prompt);
    }
    return true;
  }

  /** Dismiss the current prompt. Advances to next queued prompt if any. */
  dismiss() {
    if (!this._activePrompt) return;

    // Mark as shown
    this._shown[this._activePrompt.key] = true;

    // Persist to save
    const data = this._save.load() || this._save.getDefault();
    data.tutorialShown = { ...this._shown };
    this._save.save(data);

    // Advance queue
    this._activePrompt = this._pendingQueue.shift() || null;
  }

  /** Get the currently active prompt, or null. */
  getActivePrompt() { return this._activePrompt; }

  /** Whether a prompt is currently blocking gameplay. */
  isBlocking() { return this._activePrompt !== null; }

  /** Check if a specific tutorial has been shown. */
  hasShown(key) { return !!this._shown[key]; }

  /**
   * Render the tutorial prompt overlay.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} canvasW
   * @param {number} canvasH
   */
  render(ctx, canvasW, canvasH) {
    if (!this._activePrompt) return;

    // Dim background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Prompt box
    const boxW = Math.min(500, canvasW * 0.7);
    const boxH = 100;
    const boxX = (canvasW - boxW) / 2;
    const boxY = (canvasH - boxH) / 2;

    ctx.fillStyle = '#1a3a5c';
    ctx.strokeStyle = '#88ccff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 12);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this._activePrompt.text, canvasW / 2, boxY + 42);

    // Dismiss hint
    ctx.fillStyle = '#aaa';
    ctx.font = '13px sans-serif';
    ctx.fillText('Press any key to continue', canvasW / 2, boxY + 72);
  }

  /** Reset all shown state (for new game). */
  reset() {
    this._shown = {};
    this._activePrompt = null;
    this._pendingQueue = [];
  }
}
