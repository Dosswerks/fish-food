/**
 * Settings menu UI. Renders audio, accessibility, and controls sections.
 * Accessible from main menu and pause menu.
 */
export class SettingsMenu {
  constructor(stringTable, saveSystem) {
    this._strings = stringTable;
    this._save = saveSystem;
    this._settings = this._loadSettings();
    this._selectedIndex = 0;
    this._items = [
      { key: 'masterVolume', label: 'settings.master_volume', type: 'slider', min: 0, max: 1, step: 0.1 },
      { key: 'musicVolume', label: 'settings.music_volume', type: 'slider', min: 0, max: 1, step: 0.1 },
      { key: 'sfxVolume', label: 'settings.sfx_volume', type: 'slider', min: 0, max: 1, step: 0.1 },
      { key: 'muted', label: 'settings.mute', type: 'toggle' },
      { key: 'motionReduction', label: 'settings.motion_reduction', type: 'toggle' },
      { key: 'inputMode', label: 'settings.input_mode', type: 'cycle', values: ['hold', 'toggle'] },
      { key: 'inputSensitivity', label: 'settings.sensitivity', type: 'slider', min: 0.2, max: 2.0, step: 0.1 },
      { key: 'back', label: 'settings.back', type: 'action' },
    ];
  }

  _loadSettings() {
    const data = this._save.load();
    if (data) {
      return {
        masterVolume: data.audioSettings?.masterVolume ?? 1.0,
        musicVolume: data.audioSettings?.musicVolume ?? 0.7,
        sfxVolume: data.audioSettings?.sfxVolume ?? 1.0,
        muted: data.audioSettings?.muted ?? false,
        motionReduction: data.accessibilitySettings?.motionReduction ?? false,
        inputMode: data.accessibilitySettings?.inputMode ?? 'hold',
        inputSensitivity: data.accessibilitySettings?.inputSensitivity ?? 1.0,
      };
    }
    return {
      masterVolume: 1.0, musicVolume: 0.7, sfxVolume: 1.0, muted: false,
      motionReduction: false, inputMode: 'hold', inputSensitivity: 1.0,
    };
  }

  getSettings() { return { ...this._settings }; }

  /**
   * Handle input. Returns 'back' if back was selected, null otherwise.
   * @param {object} input - InputSystem instance
   * @returns {string|null}
   */
  handleInput(input) {
    const dir = input.getDirection();
    if (dir.y < -0.5) {
      this._selectedIndex = Math.max(0, this._selectedIndex - 1);
    } else if (dir.y > 0.5) {
      this._selectedIndex = Math.min(this._items.length - 1, this._selectedIndex + 1);
    }

    const item = this._items[this._selectedIndex];
    if (item.type === 'action' && input.isConfirmPressed()) {
      if (item.key === 'back') return 'back';
    }

    if (item.type === 'slider') {
      if (dir.x > 0.5) {
        this._settings[item.key] = Math.min(item.max,
          Math.round((this._settings[item.key] + item.step) * 10) / 10);
        this._persist();
      } else if (dir.x < -0.5) {
        this._settings[item.key] = Math.max(item.min,
          Math.round((this._settings[item.key] - item.step) * 10) / 10);
        this._persist();
      }
    }

    if (item.type === 'toggle' && input.isConfirmPressed()) {
      this._settings[item.key] = !this._settings[item.key];
      this._persist();
    }

    if (item.type === 'cycle' && input.isConfirmPressed()) {
      const vals = item.values;
      const idx = vals.indexOf(this._settings[item.key]);
      this._settings[item.key] = vals[(idx + 1) % vals.length];
      this._persist();
    }

    return null;
  }

  _persist() {
    const data = this._save.load() || this._save.getDefault();
    data.audioSettings = {
      masterVolume: this._settings.masterVolume,
      musicVolume: this._settings.musicVolume,
      sfxVolume: this._settings.sfxVolume,
      muted: this._settings.muted,
    };
    data.accessibilitySettings = {
      motionReduction: this._settings.motionReduction,
      inputMode: this._settings.inputMode,
      inputSensitivity: this._settings.inputSensitivity,
    };
    this._save.save(data);
  }

  /**
   * Render the settings menu.
   */
  render(ctx, canvasW, canvasH) {
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const centerX = canvasW / 2;
    let y = canvasH * 0.15;

    // Title
    ctx.fillStyle = '#88ccff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this._strings.get('settings.title'), centerX, y);
    y += 50;

    // Items
    for (let i = 0; i < this._items.length; i++) {
      const item = this._items[i];
      const selected = i === this._selectedIndex;
      ctx.fillStyle = selected ? '#ffcc00' : '#ccc';
      ctx.font = selected ? 'bold 16px sans-serif' : '16px sans-serif';
      ctx.textAlign = 'left';

      const label = this._strings.get(item.label);
      const labelX = centerX - 160;

      if (item.type === 'slider') {
        ctx.fillText(label, labelX, y);
        // Draw slider bar
        const barX = centerX + 40;
        const barW = 120;
        const pct = (this._settings[item.key] - item.min) / (item.max - item.min);
        ctx.fillStyle = '#444';
        ctx.fillRect(barX, y - 10, barW, 8);
        ctx.fillStyle = selected ? '#ffcc00' : '#88ccff';
        ctx.fillRect(barX, y - 10, barW * pct, 8);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'right';
        ctx.fillText(this._settings[item.key].toFixed(1), barX + barW + 40, y);
      } else if (item.type === 'toggle') {
        const val = this._settings[item.key] ? 'ON' : 'OFF';
        ctx.fillText(label, labelX, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = this._settings[item.key] ? '#44ff66' : '#ff4444';
        ctx.fillText(val, centerX + 200, y);
      } else if (item.type === 'cycle') {
        ctx.fillText(label, labelX, y);
        ctx.textAlign = 'right';
        ctx.fillText(this._settings[item.key], centerX + 200, y);
      } else if (item.type === 'action') {
        ctx.textAlign = 'center';
        ctx.fillText(label, centerX, y);
      }

      y += 34;
    }

    // Navigation hint
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('↑↓ Navigate  ←→ Adjust  Enter/Space Confirm', centerX, canvasH - 30);
  }
}
