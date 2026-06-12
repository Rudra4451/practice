/* ==========================================================================
   Apex Horizon - Menu, Garage Carousel, & Upgrades UI Manager
   ========================================================================== */

import { CAR_ROSTER } from '../cars/CarModels.js';
import { SaveManager } from '../systems/SaveManager.js';

export class Garage {
  /**
   * @param {SaveManager} saveManager
   * @param {AudioManager} audioManager
   * @param {Function} onDriveCallback - triggered when user hits "DRIVE CAR"
   */
  constructor(saveManager, audioManager, onDriveCallback) {
    this.saveManager = saveManager;
    this.audio = audioManager;
    this.onDrive = onDriveCallback;

    // Carousel state
    this.rosterKeys = Object.keys(CAR_ROSTER);
    this.currentCarIndex = 0;

    // Cache active car key
    const profile = this.saveManager.load();
    const activeCarKey = profile.selectedCar;
    const initialIndex = this.rosterKeys.indexOf(activeCarKey);
    this.currentCarIndex = initialIndex !== -1 ? initialIndex : 0;

    this.initDOMElements();
    this.bindEvents();
    this.refreshUI();
    this.initSettingsUI();
  }

  /**
   * Synchronize the settings menu controls with the loaded profile configuration
   */
  initSettingsUI() {
    const profile = this.saveManager.profile;
    if (!profile || !profile.settings) return;

    const settings = profile.settings;

    // 1. Sync graphics option buttons
    document.querySelectorAll('#graphics-select .option-btn').forEach(btn => {
      if (btn.getAttribute('data-value') === settings.graphics) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 2. Sync weather option buttons
    document.querySelectorAll('#weather-select .option-btn').forEach(btn => {
      if (btn.getAttribute('data-value') === settings.weather) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 3. Sync volume sliders
    const sfxSlider = document.getElementById('sfx-slider');
    if (sfxSlider) sfxSlider.value = settings.sfx;

    const musicSlider = document.getElementById('music-slider');
    if (musicSlider) musicSlider.value = settings.music;
  }

  initDOMElements() {
    this.elGarageScreen = document.getElementById('garage-screen');
    this.elCreditsText = document.getElementById('credits-amount');
    
    // Card elements
    this.elCarName = document.getElementById('car-card-name');
    this.elCarClass = document.getElementById('car-card-class');
    
    this.elBarSpeed = document.getElementById('stat-bar-speed');
    this.elBarAccel = document.getElementById('stat-bar-accel');
    this.elBarHandling = document.getElementById('stat-bar-handling');
    this.elBarBraking = document.getElementById('stat-bar-braking');

    this.elValSpeed = document.getElementById('stat-val-speed');
    this.elValAccel = document.getElementById('stat-val-accel');
    this.elValHandling = document.getElementById('stat-val-handling');
    this.elValBraking = document.getElementById('stat-val-braking');

    // Action buttons
    this.btnPrev = document.getElementById('prev-car-btn');
    this.btnNext = document.getElementById('next-car-btn');
    this.btnUnlock = document.getElementById('unlock-btn');
    this.btnDrive = document.getElementById('drive-btn');
    this.btnUpgrade = document.getElementById('upgrade-btn');

    // Upgrades Subpanel
    this.elCostEngine = document.getElementById('upgrade-cost-engine');
    this.elLevelEngine = document.getElementById('upgrade-level-engine');
    this.elDotsEngine = document.getElementById('upgrade-dots-engine');

    this.elCostHandling = document.getElementById('upgrade-cost-handling');
    this.elLevelHandling = document.getElementById('upgrade-level-handling');
    this.elDotsHandling = document.getElementById('upgrade-dots-handling');

    // Modals
    this.elSettingsModal = document.getElementById('settings-modal');
    this.btnOpenSettings = document.getElementById('open-settings-btn');
    this.btnCloseSettings = document.getElementById('close-settings-btn');
    this.btnHUDMenu = document.getElementById('hud-menu-btn');
    this.btnMobileHUDMenu = document.getElementById('mobile-hud-menu-btn');

    // Upgrades panel reference for scroll-to
    this.elUpgradesPanel = document.querySelector('.upgrades-panel');
  }

  bindEvents() {
    // Carousel navigation
    if (this.btnPrev) this.btnPrev.addEventListener('click', () => this.navigateCarousel(-1));
    if (this.btnNext) this.btnNext.addEventListener('click', () => this.navigateCarousel(1));

    // Upgrade CAR button — scroll upgrades panel into view
    if (this.btnUpgrade) {
      this.btnUpgrade.addEventListener('click', () => {
        if (this.elUpgradesPanel) {
          this.elUpgradesPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          // Flash a highlight border so the user knows where to click
          this.elUpgradesPanel.style.boxShadow = '0 0 20px rgba(0, 240, 255, 0.6)';
          setTimeout(() => {
            this.elUpgradesPanel.style.boxShadow = '';
          }, 1200);
        }
      });
    }

    // Unlock / Drive triggers
    if (this.btnUnlock) {
      this.btnUnlock.addEventListener('click', () => {
        const carId = this.getActiveCarId();
        const price = CAR_ROSTER[carId].price;
        const success = this.saveManager.unlockCar(carId, price);
        
        if (success) {
          this.audio.init(); // Init AudioContext on user action
          this.refreshUI();
          this.showPopup("UNLOCKED!", `${CAR_ROSTER[carId].name} is now yours.`, true);
        } else {
          this.showPopup("INSUFFICIENT FUNDS", "Complete drag races or speed traps to earn credits.", false);
        }
      });
    }

    if (this.btnDrive) {
      this.btnDrive.addEventListener('click', () => {
        const carId = this.getActiveCarId();
        this.saveManager.selectCar(carId);
        
        // Audio resume contextual check
        this.audio.init();
        this.audio.startEngine();
        
        // Hide garage, load HUD
        this.elGarageScreen.classList.remove('active');
        document.getElementById('game-hud').classList.add('active');
        
        // Callback to main controller
        this.onDrive(carId);
      });
    }

    // Upgrades bindings
    const handleUpgradePurchase = (type) => {
      const carId = this.getActiveCarId();
      const currentLevel = this.saveManager.getUpgradeLevel(carId, type);
      if (currentLevel >= 3) {
        this.showPopup("MAXED OUT", "This performance element is at maximum level.", false);
        return;
      }

      const cost = this.getUpgradeCost(currentLevel);
      const success = this.saveManager.purchaseUpgrade(carId, type, cost);

      if (success) {
        this.audio.init();
        this.refreshUI();
        this.showPopup("UPGRADED", `${type.toUpperCase()} level increased to ${currentLevel + 1}!`, true);
      } else {
        this.showPopup("UPGRADE FAILED", "You do not have enough credits.", false);
      }
    };

    // Bind upgrade cards (click inside upgrades panel)
    document.querySelectorAll('.upgrade-card').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.getAttribute('data-upgrade');
        handleUpgradePurchase(type);
      });
    });

    // Settings modal triggers
    if (this.btnOpenSettings) {
      this.btnOpenSettings.addEventListener('click', () => {
        this.audio.init();
        this.elSettingsModal.classList.add('active');
      });
    }

    if (this.btnCloseSettings) {
      this.btnCloseSettings.addEventListener('click', () => {
        this.elSettingsModal.classList.remove('active');
      });
    }

    // Volume sliders mapping
    const sfxSlider = document.getElementById('sfx-slider');
    const musicSlider = document.getElementById('music-slider');

    if (sfxSlider) {
      sfxSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.saveManager.updateSetting('sfx', val);
        this.audio.setVolumes(val, parseFloat(musicSlider?.value || 0.5));
      });
    }

    if (musicSlider) {
      musicSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.saveManager.updateSetting('music', val);
        this.audio.setVolumes(parseFloat(sfxSlider?.value || 0.8), val);
      });
    }

    // Option selections: graphics
    document.querySelectorAll('#graphics-select .option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#graphics-select .option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const qValue = btn.getAttribute('data-value');
        this.saveManager.updateSetting('graphics', qValue);
        if (window.gameInstance) {
          window.gameInstance.applyGraphicsQuality(qValue);
        }
      });
    });

    // Option selections: weather
    document.querySelectorAll('#weather-select .option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#weather-select .option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const wValue = btn.getAttribute('data-value');
        this.saveManager.updateSetting('weather', wValue);
        
        // Trigger weather change
        if (window.gameInstance) {
          window.gameInstance.setWeatherState(wValue);
        }
      });
    });

    // HUD Menu button
    if (this.btnHUDMenu) {
      this.btnHUDMenu.addEventListener('click', () => this.toggleHUDMenu());
    }

    // Mobile HUD Menu button (same action)
    if (this.btnMobileHUDMenu) {
      this.btnMobileHUDMenu.addEventListener('click', () => this.toggleHUDMenu());
    }

    // Handle ESC key to toggle menu
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.toggleHUDMenu();
      }
    });
  }

  toggleHUDMenu() {
    const isHUDActive = document.getElementById('game-hud').classList.contains('active');
    if (isHUDActive) {
      // Open Garage
      document.getElementById('game-hud').classList.remove('active');
      this.elGarageScreen.classList.add('active');
      this.audio.stopEngine();
      this.refreshUI();
      if (window.gameInstance) {
        window.gameInstance.inGarageMode = true;
      }
    } else {
      // Resume driving if car is unlocked
      const carId = this.getActiveCarId();
      if (this.saveManager.profile.garage.includes(carId)) {
        // Auto-save on garage close (PROMPT 2)
        this.saveManager.save();
        
        document.getElementById('game-hud').classList.remove('active');
        this.elGarageScreen.classList.remove('active'); // ensure clean screen swap
        document.getElementById('game-hud').classList.add('active');
        this.audio.startEngine();
        this.onDrive(carId);
      }
    }
  }

  navigateCarousel(direction) {
    this.currentCarIndex = (this.currentCarIndex + direction + this.rosterKeys.length) % this.rosterKeys.length;
    this.refreshUI();
  }

  getActiveCarId() {
    return this.rosterKeys[this.currentCarIndex];
  }

  getUpgradeCost(level) {
    // Upgrades: Lvl 0->1: $1500, Lvl 1->2: $2500, etc.
    return 1500 + level * 1000;
  }

  /**
   * Refreshes stats, colors, ownership states, and upgrade metrics
   */
  refreshUI() {
    const carId = this.getActiveCarId();
    const cfg = CAR_ROSTER[carId];
    const profile = this.saveManager.profile;

    if (!cfg || !profile) return;

    // 1. Text elements
    if (this.elCarName) this.elCarName.textContent = cfg.name;
    if (this.elCarClass) this.elCarClass.textContent = cfg.class.toUpperCase();
    if (this.elCreditsText) this.elCreditsText.textContent = `$${profile.credits.toLocaleString()}`;

    // Get current upgrade levels
    const lvlEngine = this.saveManager.getUpgradeLevel(carId, 'engine');
    const lvlHandling = this.saveManager.getUpgradeLevel(carId, 'handling');

    // Upgrade stat calculations
    const finalSpeed = Math.min(100, cfg.stats.speed + lvlEngine * 3);
    const finalAccel = Math.min(100, cfg.stats.accel + lvlEngine * 3.5);
    const finalHandling = Math.min(100, cfg.stats.handling + lvlHandling * 4);
    const finalBraking = Math.min(100, cfg.stats.braking + lvlHandling * 3);

    // 2. Adjust stats bars
    if (this.elBarSpeed) this.elBarSpeed.style.width = `${finalSpeed}%`;
    if (this.elBarAccel) this.elBarAccel.style.width = `${finalAccel}%`;
    if (this.elBarHandling) this.elBarHandling.style.width = `${finalHandling}%`;
    if (this.elBarBraking) this.elBarBraking.style.width = `${finalBraking}%`;

    // 3. Stats label text values
    // Map stat fraction to realistic speedometer metrics
    const speedKmh = 160 + (finalSpeed / 100) * 260; // 160 to 420 km/h
    const accel0_100 = 8.5 - (finalAccel / 100) * 6.3; // 8.5s down to 2.2s
    const handlingG = 0.5 + (finalHandling / 100) * 1.0; // 0.5G to 1.5G
    const brakingMet = 50 - (finalBraking / 100) * 22; // 50m down to 28m

    if (this.elValSpeed) this.elValSpeed.textContent = `${Math.round(speedKmh)} km/h`;
    if (this.elValAccel) this.elValAccel.textContent = `${accel0_100.toFixed(1)}s`;
    if (this.elValHandling) this.elValHandling.textContent = `${handlingG.toFixed(2)} G`;
    if (this.elValBraking) this.elValBraking.textContent = `${Math.round(brakingMet)} m`;

    // 4. Check Ownership state and lock/unlock buttons
    const owned = profile.garage.includes(carId);

    if (owned) {
      if (this.btnUnlock) this.btnUnlock.classList.add('hidden');
      if (this.btnDrive) this.btnDrive.classList.remove('hidden');
      if (this.btnUpgrade) this.btnUpgrade.removeAttribute('disabled');
      document.querySelector('.upgrades-panel').style.opacity = '1';
      document.querySelector('.upgrades-panel').style.pointerEvents = 'auto';
    } else {
      if (this.btnUnlock) {
        this.btnUnlock.classList.remove('hidden');
        this.btnUnlock.textContent = `UNLOCK FOR $${cfg.price.toLocaleString()}`;
      }
      if (this.btnDrive) this.btnDrive.classList.add('hidden');
      if (this.btnUpgrade) this.btnUpgrade.setAttribute('disabled', 'true');
      document.querySelector('.upgrades-panel').style.opacity = '0.4';
      document.querySelector('.upgrades-panel').style.pointerEvents = 'none';
    }

    // 5. Update Upgrade panels UI
    // Engine UI
    if (lvlEngine >= 3) {
      if (this.elCostEngine) this.elCostEngine.textContent = "MAXED OUT";
      if (this.elLevelEngine) this.elLevelEngine.textContent = "Lvl 3 / 3";
    } else {
      if (this.elCostEngine) this.elCostEngine.textContent = `$${this.getUpgradeCost(lvlEngine).toLocaleString()}`;
      if (this.elLevelEngine) this.elLevelEngine.textContent = `Lvl ${lvlEngine} / 3`;
    }
    this.refreshDots(this.elDotsEngine, lvlEngine);

    // Handling UI
    if (lvlHandling >= 3) {
      if (this.elCostHandling) this.elCostHandling.textContent = "MAXED OUT";
      if (this.elLevelHandling) this.elLevelHandling.textContent = "Lvl 3 / 3";
    } else {
      if (this.elCostHandling) this.elCostHandling.textContent = `$${this.getUpgradeCost(lvlHandling).toLocaleString()}`;
      if (this.elLevelHandling) this.elLevelHandling.textContent = `Lvl ${lvlHandling} / 3`;
    }
    this.refreshDots(this.elDotsHandling, lvlHandling);
  }

  refreshDots(container, level) {
    if (!container) return;
    const dots = container.querySelectorAll('.dot');
    dots.forEach((dot, idx) => {
      if (idx < level) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    });
  }

  showPopup(title, msg, isGreen) {
    const hudCenter = document.getElementById('notification-center');
    if (!hudCenter) return;
    
    // Reuse HUD notification styled container
    const banner = document.createElement('div');
    banner.className = `game-notification ${isGreen ? 'green' : ''}`;
    banner.innerHTML = `
      <span class="header">${title.toUpperCase()}</span>
      <span class="body">${msg}</span>
    `;
    hudCenter.appendChild(banner);
    setTimeout(() => { banner.remove(); }, 3000);
  }
}
