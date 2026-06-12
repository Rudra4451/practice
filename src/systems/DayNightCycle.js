/* ==========================================================================
   Apex Horizon - Day/Night Cycle System (Lighting, Ambient Color Shifts)
   ========================================================================== */

import * as THREE from 'three';
import { DAY_NIGHT_CYCLE_DURATION, HEADLIGHT_AUTO_THRESHOLD } from '../CONSTANTS.js';

export class DayNightCycle {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;

    // Cycle configurations (Default: 10-minute loop = 600 seconds)
    this.cycleDuration = DAY_NIGHT_CYCLE_DURATION;
    this.elapsedTime = 60; // Start at 60s (morning sun)

    this.initLights();
  }

  initLights() {
    // 1. Directional Sun/Moon light source
    this.dirLight = new THREE.DirectionalLight(0xfffaed, 2.0);
    this.dirLight.position.set(0, 100, 0);
    
    // Configure shadows (higher resolution shadow map)
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 1000;
    
    // Tightened frustum centered on player for ultra-crisp shadows
    const d = 65; 
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target); // Add light target to scene for updates

    // 2. Sun visual representation (glowing yellow sphere in sky)
    const sunVisualGeo = new THREE.SphereGeometry(15, 8, 8);
    const sunVisualMat = new THREE.MeshBasicMaterial({ color: 0xfff4c2 });
    this.sunVisual = new THREE.Mesh(sunVisualGeo, sunVisualMat);
    this.scene.add(this.sunVisual);

    // 3. Starfield night sky (800 glowing particles mapped on a distant shell)
    const starCount = 800;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 1200; // Sky dome radius
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = Math.abs(r * Math.sin(phi) * Math.sin(theta)); // Keep stars above horizon
      starPositions[i * 3 + 2] = r * Math.cos(phi);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.8,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });
    this.starfield = new THREE.Points(starGeo, this.starMat);
    this.scene.add(this.starfield);

    // 4. Ambient light (global bounce light)
    this.ambientLight = new THREE.AmbientLight(0xd9efff, 0.4);
    this.scene.add(this.ambientLight);

    // 5. Scene fog for depth blending and sunset silhouettes
    this.scene.fog = new THREE.FogExp2(0xd9efff, 0.0006);
  }

  /**
   * Update cycle states
   * @param {number} deltaSeconds
   * @param {CarBase} activeCar
   */
  update(deltaSeconds, activeCar) {
    this.elapsedTime = (this.elapsedTime + deltaSeconds) % this.cycleDuration;
    
    // Normalized time fraction (0.0 to 1.0)
    // 0 = Dawn, 0.25 = Noon, 0.5 = Dusk, 0.75 = Midnight
    const dayFraction = this.elapsedTime / this.cycleDuration;

    // Angle of the sun along the sky dome
    const sunAngle = dayFraction * Math.PI * 2;

    // Position sun along Y-Z arc
    const sunY = Math.sin(sunAngle);
    const sunZ = Math.cos(sunAngle);

    // Track active vehicle coordinate space to center shadows
    const playerPos = activeCar ? activeCar.chassisBody.position : new THREE.Vector3(0, 0, 0);
    
    // Lock directional light and its target to player position (maintains shadows open-world)
    this.dirLight.position.set(playerPos.x, playerPos.y + sunY * 400, playerPos.z + sunZ * 400);
    this.dirLight.target.position.copy(playerPos);
    this.dirLight.target.updateMatrixWorld();

    // Align sun visual mesh
    if (this.sunVisual) {
      this.sunVisual.position.copy(this.dirLight.position);
    }

    // Determine Day/Night parameters based on sun height Y
    let intensity = 0;
    let sunColor = new THREE.Color(0xffffff);
    let skyColor = new THREE.Color(0x87ceeb); // Light blue sky
    let ambientIntensity = 0.1;
    let isNight = false;

    // Dawn (sun rising)
    if (sunY >= 0 && sunY < 0.2) {
      const lerpVal = sunY / 0.2;
      intensity = lerpVal * 1.5;
      sunColor = new THREE.Color(0xff5500).lerp(new THREE.Color(0xfff5d9), lerpVal);
      skyColor = new THREE.Color(0x1a0f2e).lerp(new THREE.Color(0xff8c00), lerpVal);
      ambientIntensity = 0.1 + lerpVal * 0.3;
    }
    // High Noon (peak sun height)
    else if (sunY >= 0.2) {
      intensity = 2.0;
      sunColor.setHex(0xffffff);
      skyColor.setHex(0xd9efff);
      ambientIntensity = 0.5;
    }
    // Sunset (sun setting)
    else if (sunY < 0 && sunY > -0.2) {
      const lerpVal = Math.abs(sunY) / 0.2;
      intensity = (1.0 - lerpVal) * 1.5;
      sunColor = new THREE.Color(0xfff5d9).lerp(new THREE.Color(0xff3c00), lerpVal);
      skyColor = new THREE.Color(0xd9efff).lerp(new THREE.Color(0x2c103d), lerpVal);
      ambientIntensity = 0.5 * (1.0 - lerpVal) + 0.05;
    }
    // Midnight (sun is below horizon)
    else {
      isNight = true;
      const nightIntensity = Math.min(1.0, (Math.abs(sunY) - 0.2) / 0.8);
      
      // Moonlight is dim blue
      intensity = nightIntensity * 0.4;
      sunColor.setHex(0x3d668f);
      skyColor.setHex(0x020308);
      ambientIntensity = 0.05;
    }

    // Apply values to lights
    this.dirLight.intensity = intensity;
    this.dirLight.color.copy(sunColor);
    
    this.ambientLight.intensity = ambientIntensity;
    this.ambientLight.color.copy(skyColor);

    // Apply color to background and fog
    this.scene.background = skyColor;
    if (this.scene.fog) {
      this.scene.fog.color.copy(skyColor);
    }

    // Celestial sky animation (center starfield on player, rotate and fade in/out)
    if (this.starfield) {
      this.starfield.position.copy(playerPos);
      this.starfield.rotation.y += deltaSeconds * 0.003;

      if (isNight) {
        this.starMat.opacity = Math.min(1.0, this.starMat.opacity + deltaSeconds * 0.2);
      } else {
        this.starMat.opacity = Math.max(0.0, this.starMat.opacity - deltaSeconds * 0.4);
      }
    }

    // Headlight auto-trigger during dark/twilight phases
    // Use HEADLIGHT_AUTO_THRESHOLD (sunY < 0.1) to engage headlights during twilight
    if (activeCar) {
      const shouldHaveLights = sunY < HEADLIGHT_AUTO_THRESHOLD;
      if (shouldHaveLights && !activeCar.headlightsOn) {
        activeCar.toggleHeadlights(true);
        this.updateHUDHeadlightIndicator(true);
      } else if (!shouldHaveLights && activeCar.headlightsOn) {
        activeCar.toggleHeadlights(false);
        this.updateHUDHeadlightIndicator(false);
      }
    }
  }

  updateHUDHeadlightIndicator(state) {
    const el = document.getElementById('indicator-headlights');
    if (el) {
      if (state) {
        el.textContent = "Lights: Active (Auto)";
        el.classList.add('active');
      } else {
        el.textContent = "Lights: Off [L]";
        el.classList.remove('active');
      }
    }
  }
}
