/* ==========================================================================
   Apex Horizon - Multi-Input Management System (Keyboard, Touch, Gamepad)
   ========================================================================== */

export class InputManager {
  constructor() {
    // Current input state
    this.throttle = 0;   // 0 to 1
    this.brake = 0;      // 0 to 1
    this.steering = 0;   // -1 (left) to 1 (right)
    this.handbrake = false;
    this.nitro = false;

    // Direct actions (triggers, reset after read)
    this.respawnRequest = false;
    this.cameraToggleRequest = false;
    this.lightsToggleRequest = false;
    this.menuToggleRequest = false;
    this.weatherToggleRequest = false;

    // Keyboard state mapping
    this.keys = {
      w: false, s: false, a: false, d: false,
      arrowup: false, arrowdown: false, arrowleft: false, arrowright: false,
      space: false, keyc: false, keyl: false, keyr: false, escape: false,
      shift: false, keyn: false
    };

    // Touch overlay inputs initialization
    this.touchThrottle = 0;
    this.touchBrake = 0;
    this.touchSteering = 0;
    this.touchHandbrake = false;
    this.touchNitro = false;

    // Initialize inputs
    this.initKeyboard();
    this.initTouchControls();
    this.initGamepad();
  }

  /**
   * Bind Keyboard Listeners
   */
  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      const code = e.code.toLowerCase();
      
      if (key === 'w' || key === 'arrowup') this.keys.w = true;
      if (key === 's' || key === 'arrowdown') this.keys.s = true;
      if (key === 'a' || key === 'arrowleft') this.keys.a = true;
      if (key === 'd' || key === 'arrowright') this.keys.d = true;
      if (key === ' ' || code === 'space') this.keys.space = true;
      
      // Single action triggers
      if (code === 'keyc') this.cameraToggleRequest = true;
      if (code === 'keyl') this.lightsToggleRequest = true;
      if (code === 'keyr') this.respawnRequest = true;
      if (code === 'keyp') this.weatherToggleRequest = true;
      if (key === 'escape') this.menuToggleRequest = true;

      // Nitro keyboard booster
      if (key === 'shift' || code === 'shiftleft') this.keys.shift = true;
      if (code === 'keyn') this.keys.keyn = true;
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      const code = e.code.toLowerCase();
      
      if (key === 'w' || key === 'arrowup') this.keys.w = false;
      if (key === 's' || key === 'arrowdown') this.keys.s = false;
      if (key === 'a' || key === 'arrowleft') this.keys.a = false;
      if (key === 'd' || key === 'arrowright') this.keys.d = false;
      if (key === ' ' || code === 'space') this.keys.space = false;
      if (key === 'shift' || code === 'shiftleft') this.keys.shift = false;
      if (code === 'keyn') this.keys.keyn = false;
    });
  }

  /**
   * Bind Virtual Touch Overlay Listeners
   */
  initTouchControls() {
    // Only make mobile controls overlay visible if a touch interface is detected
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const mobileUI = document.getElementById('mobile-controls');
    
    if (isTouchDevice && mobileUI) {
      mobileUI.classList.remove('hidden');
    } else {
      return; // Not a touch device, skip setup
    }

    // Pedals Integration
    const gasBtn = document.getElementById('pedal-gas');
    const brakeBtn = document.getElementById('pedal-brake');
    const handbrakeBtn = document.getElementById('pedal-handbrake');
    const nitroBtn = document.getElementById('pedal-nitro');
    const camBtn = document.getElementById('mobile-cam-btn');
    const respawnBtn = document.getElementById('mobile-respawn-btn');

    const handleTouchState = (btn, callback) => {
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        callback(true);
      });
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        callback(false);
      });
    };

    if (gasBtn) handleTouchState(gasBtn, (state) => { this.touchThrottle = state ? 1 : 0; });
    if (brakeBtn) handleTouchState(brakeBtn, (state) => { this.touchBrake = state ? 1 : 0; });
    if (handbrakeBtn) handleTouchState(handbrakeBtn, (state) => { this.touchHandbrake = state; });
    if (nitroBtn) handleTouchState(nitroBtn, (state) => { this.touchNitro = state; });
    
    if (camBtn) camBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.cameraToggleRequest = true; });
    if (respawnBtn) respawnBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.respawnRequest = true; });

    // Steering slider/drag logic
    const steeringZone = document.getElementById('virtual-steering-zone');
    const steeringHandle = document.getElementById('steering-handle');

    if (steeringZone && steeringHandle) {
      let zoneRect = steeringZone.getBoundingClientRect();
      const maxRadius = zoneRect.width / 2;
      
      const updateSteering = (touchX) => {
        zoneRect = steeringZone.getBoundingClientRect(); // Recalculate if layout shifted
        const centerX = zoneRect.left + zoneRect.width / 2;
        let deltaX = touchX - centerX;
        
        // Clamp steer value between -maxRadius and maxRadius
        deltaX = Math.max(-maxRadius, Math.min(maxRadius, deltaX));
        
        // Position handle
        steeringHandle.style.transform = `translateX(${deltaX}px)`;
        
        // Convert to steer fraction (-1 to 1)
        this.touchSteering = deltaX / maxRadius;
      };

      const resetSteering = () => {
        steeringHandle.style.transform = `translateX(0px)`;
        this.touchSteering = 0;
      };

      steeringZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length > 0) {
          updateSteering(e.touches[0].clientX);
        }
      });

      steeringZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length > 0) {
          updateSteering(e.touches[0].clientX);
        }
      });

      steeringZone.addEventListener('touchend', (e) => {
        e.preventDefault();
        resetSteering();
      });
    }

    // Touch temporary properties
    this.touchThrottle = 0;
    this.touchBrake = 0;
    this.touchSteering = 0;
    this.touchHandbrake = false;
    this.touchNitro = false;
  }

  /**
   * Gamepad Connection Monitor
   */
  initGamepad() {
    this.gamepadIndex = null;
    window.addEventListener("gamepadconnected", (e) => {
      console.log(`Gamepad connected at index ${e.gamepad.index}: ${e.gamepad.id}`);
      this.gamepadIndex = e.gamepad.index;
    });

    window.addEventListener("gamepaddisconnected", (e) => {
      if (this.gamepadIndex === e.gamepad.index) {
        this.gamepadIndex = null;
        console.log("Gamepad disconnected.");
      }
    });
  }

  /**
   * Update and Poll inputs (called inside game loop before physics update)
   */
  update() {
    // 1. Reset values
    let finalThrottle = 0;
    let finalBrake = 0;
    let finalSteering = 0;
    let finalHandbrake = false;
    let finalNitro = false;

    // 2. Poll Keyboard inputs
    if (this.keys.w) finalThrottle = 1;
    if (this.keys.s) finalBrake = 1;
    if (this.keys.a) finalSteering = -1;
    if (this.keys.d) finalSteering = 1;
    if (this.keys.space) finalHandbrake = true;
    if (this.keys.shift || this.keys.keyn) finalNitro = true;

    // 3. Poll Touch overlay inputs (takes precedence or adds)
    if (this.touchThrottle) finalThrottle = Math.max(finalThrottle, this.touchThrottle);
    if (this.touchBrake) finalBrake = Math.max(finalBrake, this.touchBrake);
    if (this.touchSteering !== 0) finalSteering = this.touchSteering;
    if (this.touchHandbrake) finalHandbrake = true;
    if (this.touchNitro) finalNitro = true;

    // 4. Poll Gamepad API inputs
    if (this.gamepadIndex !== null) {
      const gp = navigator.getGamepads()[this.gamepadIndex];
      if (gp) {
        // Left stick horizontal axis for steering (Axis 0)
        const gpSteer = gp.axes[0];
        if (Math.abs(gpSteer) > 0.1) { // Deadzone threshold
          finalSteering = gpSteer;
        }

        // Right trigger (Button 7) for throttle, Left trigger (Button 6) for brake
        const triggerThrottle = gp.buttons[7] ? gp.buttons[7].value : 0;
        const triggerBrake = gp.buttons[6] ? gp.buttons[6].value : 0;
        
        if (triggerThrottle > 0.05) finalThrottle = Math.max(finalThrottle, triggerThrottle);
        if (triggerBrake > 0.05) finalBrake = Math.max(finalBrake, triggerBrake);

        // A Button (Button 0) or X Button (Button 2) for handbrake
        if (gp.buttons[0]?.pressed || gp.buttons[2]?.pressed) {
          finalHandbrake = true;
        }

        // Left Bumper (Button 4) or Right Bumper (Button 5) for Nitro
        if (gp.buttons[4]?.pressed || gp.buttons[5]?.pressed) {
          finalNitro = true;
        }

        // Y Button (Button 3) for Camera toggle
        if (gp.buttons[3]?.pressed) {
          if (!this.gpCameraPressed) {
            this.cameraToggleRequest = true;
            this.gpCameraPressed = true;
          }
        } else {
          this.gpCameraPressed = false;
        }

        // B Button (Button 1) for Headlights toggle
        if (gp.buttons[1]?.pressed) {
          if (!this.gpLightsPressed) {
            this.lightsToggleRequest = true;
            this.gpLightsPressed = true;
          }
        } else {
          this.gpLightsPressed = false;
        }

        // Back/Select button (Button 8) or Start (Button 9) for menu toggle
        if (gp.buttons[8]?.pressed || gp.buttons[9]?.pressed) {
          if (!this.gpMenuPressed) {
            this.menuToggleRequest = true;
            this.gpMenuPressed = true;
          }
        } else {
          this.gpMenuPressed = false;
        }
      }
    }

    // Assign final inputs
    this.throttle = finalThrottle;
    this.brake = finalBrake;
    this.steering = finalSteering;
    this.handbrake = finalHandbrake;
    this.nitro = finalNitro;
  }
}
