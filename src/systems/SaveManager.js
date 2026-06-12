/* ==========================================================================
   Apex Horizon - SaveState & Profile Manager (localStorage)
   ========================================================================== */

import { Logger } from './Logger.js';
import { CREDITS_CAP } from '../CONSTANTS.js';

const STORAGE_KEY = "openworld_racing_save";
const STORAGE_KEY_TEMP = "openworld_racing_save_temp";

export const defaultSave = {
  garage: ['bmw'], // Starter car
  selectedCar: 'bmw',
  credits: 5000,
  upgrades: {}, // e.g. { bmw: { engine: 1, handling: 0 } }
  topSpeeds: {},
  settings: {
    sfx: 1,
    music: 0.5,
    graphics: 'medium',
    weather: 'clear'
  }
};

export const SaveManager = {
  profile: null,

  /** True if a corrupted save was detected and reset on load */
  wasCorrupted: false,

  /** True if localStorage is unavailable (private browsing etc.) */
  storageUnavailable: false,

  /**
   * Load profile from localStorage or create a default one
   */
  load() {
    // Check storage availability first
    if (!this._isStorageAvailable()) {
      this.storageUnavailable = true;
      Logger.warn("localStorage is not available. Progress will NOT be saved this session.");
      this.profile = JSON.parse(JSON.stringify(defaultSave));
      return this.profile;
    }

    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        this.profile = JSON.parse(data);
        // Ensure upgrades field exists
        if (!this.profile.upgrades) this.profile.upgrades = {};
        // Merge with defaults to ensure settings properties exist
        this.profile.settings = { ...defaultSave.settings, ...this.profile.settings };
        // Enforce credits cap on load
        if (this.profile.credits > CREDITS_CAP) this.profile.credits = CREDITS_CAP;
      } else {
        this.profile = JSON.parse(JSON.stringify(defaultSave));
        this.save();
      }
    } catch (e) {
      Logger.warn("Save data corrupted — resetting to default profile.", e);
      this.wasCorrupted = true;
      this.profile = JSON.parse(JSON.stringify(defaultSave));
      // Attempt to overwrite the corrupted save
      this.save();
    }
    return this.profile;
  },

  /**
   * Write current profile to localStorage using double-buffer pattern.
   * Writes to temp key first, then copies to main key to prevent corruption.
   */
  save() {
    if (!this.profile || this.storageUnavailable) return;
    try {
      const serialized = JSON.stringify(this.profile);
      // Double-buffer: write to temp first
      localStorage.setItem(STORAGE_KEY_TEMP, serialized);
      // If temp write succeeds, copy to main key
      localStorage.setItem(STORAGE_KEY, serialized);
      // Clean up temp key
      localStorage.removeItem(STORAGE_KEY_TEMP);
    } catch (e) {
      Logger.error("Failed to save profile state", e);
    }
  },

  /**
   * Get active currency credits
   */
  getCredits() {
    return this.profile ? this.profile.credits : 0;
  },

  /**
   * Add credits to profile (capped at CREDITS_CAP)
   */
  addCredits(amount) {
    if (!this.profile) return;
    this.profile.credits = Math.min(CREDITS_CAP, this.profile.credits + Math.round(amount));
    this.save();
  },

  /**
   * Deduct credits from profile if sufficient
   */
  deductCredits(amount) {
    if (!this.profile || this.profile.credits < amount) return false;
    this.profile.credits -= amount;
    this.save();
    return true;
  },

  /**
   * Unlock a specific car by ID
   */
  unlockCar(carId, price) {
    if (!this.profile) return false;
    if (this.profile.garage.includes(carId)) return true;
    if (this.deductCredits(price)) {
      this.profile.garage.push(carId);
      if (!this.profile.upgrades[carId]) {
        this.profile.upgrades[carId] = { engine: 0, handling: 0 };
      }
      this.save();
      return true;
    }
    return false;
  },

  /**
   * Select a car to drive
   */
  selectCar(carId) {
    if (!this.profile) return;
    if (this.profile.garage.includes(carId)) {
      this.profile.selectedCar = carId;
      this.save();
    }
  },

  /**
   * Get upgrade level for a car (max 3 tiers)
   */
  getUpgradeLevel(carId, type) {
    if (!this.profile) return 0;
    if (!this.profile.upgrades[carId]) {
      this.profile.upgrades[carId] = { engine: 0, handling: 0 };
    }
    return this.profile.upgrades[carId][type] || 0;
  },

  /**
   * Upgrade a performance attribute (Engine / Handling) - Max 3 levels
   */
  purchaseUpgrade(carId, type, cost) {
    if (!this.profile) return false;
    if (!this.profile.upgrades[carId]) {
      this.profile.upgrades[carId] = { engine: 0, handling: 0 };
    }
    const currentLevel = this.profile.upgrades[carId][type] || 0;
    if (currentLevel >= 3) return false; // Max level reached (spec: 3 levels each)

    if (this.deductCredits(cost)) {
      this.profile.upgrades[carId][type] = currentLevel + 1;
      this.save();
      return true;
    }
    return false;
  },

  /**
   * Save top speed record
   */
  saveTopSpeed(carId, speed) {
    if (!this.profile) return;
    const currentRecord = this.profile.topSpeeds[carId] || 0;
    if (speed > currentRecord) {
      this.profile.topSpeeds[carId] = Math.round(speed);
      this.save();
      return true; // New record
    }
    return false;
  },

  /**
   * Update setting value
   */
  updateSetting(key, value) {
    if (!this.profile) return;
    this.profile.settings[key] = value;
    this.save();
  },

  /**
   * Check if localStorage is available
   * @returns {boolean}
   * @private
   */
  _isStorageAvailable() {
    try {
      const testKey = '__apex_storage_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }
};
