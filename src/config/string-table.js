/**
 * Loads and provides access to externalized player-facing strings.
 */
export class StringTable {
  constructor() {
    this._strings = {};
  }

  /** Load string table from JSON file. */
  async load(path) {
    const response = await fetch(path);
    if (!response.ok) {
      console.warn(`StringTable: failed to load ${path}`);
      return;
    }
    this._strings = await response.json();
  }

  /**
   * Get a string by dot-notation key.
   * @param {string} key - e.g., "menu.start", "tutorial.movement"
   * @returns {string} The string, or the key itself if not found
   */
  get(key) {
    return this._strings[key] !== undefined ? this._strings[key] : key;
  }

  /** Serialize the string table to JSON. */
  serialize() { return JSON.stringify(this._strings); }

  /** Deserialize JSON string to string table data. */
  deserialize(json) { this._strings = JSON.parse(json); }
}
