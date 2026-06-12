/* ==========================================================================
   Apex Horizon - Weather System (Rain particle loop, traction reduction)
   ========================================================================== */

import * as THREE from 'three';

export class WeatherSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {WorldMap} worldMap
   */
  constructor(scene, worldMap) {
    this.scene = scene;
    this.map = worldMap;

    // States
    this.activeWeather = 'clear'; // 'clear' or 'rain'
    this.wetness = 0.0;           // 0.0 to 1.0

    // Particle details
    this.rainCount = 10000;
    this.particlesGeo = null;
    this.particlesMesh = null;

    this.initRainEngine();
  }

  /**
   * Set up rain particles around a localized bounding box
   */
  initRainEngine() {
    this.particlesGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.rainCount * 3);
    const velocities = new Float32Array(this.rainCount);

    // Seed coordinates randomly in a box box: X (-50, 50), Y (0, 50), Z (-50, 50)
    for (let i = 0; i < this.rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = Math.random() * 50;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;

      velocities[i] = 15 + Math.random() * 10; // downward speed
    }

    this.particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainVelocities = velocities;

    // Minimal blue-tinted drop material
    const rainMat = new THREE.PointsMaterial({
      color: 0x88ccff,
      size: 0.15,
      transparent: true,
      opacity: 0.0 // Invisible at start
    });

    this.particlesMesh = new THREE.Points(this.particlesGeo, rainMat);
    this.scene.add(this.particlesMesh);
  }

  /**
   * Set weather type: 'clear' or 'rain'
   */
  setWeather(type) {
    this.activeWeather = type;
    const indicator = document.getElementById('indicator-weather');
    
    if (indicator) {
      if (type === 'rain') {
        indicator.textContent = "Road: Wet (Rain)";
        indicator.classList.add('active');
        indicator.style.color = '#ff3c00';
      } else {
        indicator.textContent = "Road: Dry";
        indicator.classList.remove('active');
        indicator.style.color = '';
      }
    }
  }

  /**
   * Update particle positions and fade wetness coefficient
   * @param {number} deltaSeconds
   * @param {THREE.Vector3} cameraPosition - Center particles around camera view
   */
  update(deltaSeconds, cameraPosition) {
    const isRaining = this.activeWeather === 'rain';
    const rainMat = this.particlesMesh.material;

    // 1. Ease Wetness Factor and particle visibility
    if (isRaining) {
      // Fade in rain opacity
      if (rainMat.opacity < 0.6) {
        rainMat.opacity = Math.min(0.6, rainMat.opacity + deltaSeconds * 0.4);
      }
      // Ramp up road wetness (takes approx 4 seconds to fully wet)
      if (this.wetness < 1.0) {
        this.wetness = Math.min(1.0, this.wetness + deltaSeconds * 0.25);
        this.map.setWetness(this.wetness);
      }
    } else {
      // Fade out rain opacity
      if (rainMat.opacity > 0.0) {
        rainMat.opacity = Math.max(0.0, rainMat.opacity - deltaSeconds * 0.6);
      }
      // Evaporate wetness (takes approx 6 seconds to dry)
      if (this.wetness > 0.0) {
        this.wetness = Math.max(0.0, this.wetness - deltaSeconds * 0.16);
        this.map.setWetness(this.wetness);
      }
    }

    // 2. Animate falling rain particles (Only process updates if visible)
    if (rainMat.opacity > 0.001) {
      const posAttr = this.particlesGeo.attributes.position;
      const positions = posAttr.array;

      // Center the particle emitter volume on the player camera coordinates
      this.particlesMesh.position.set(cameraPosition.x, 0, cameraPosition.z);

      for (let i = 0; i < this.rainCount; i++) {
        // Drop Y value
        positions[i * 3 + 1] -= this.rainVelocities[i] * deltaSeconds;

        // Reset drop to clouds if it hits ground (Y = -3 for dunes margin)
        if (positions[i * 3 + 1] < -3) {
          positions[i * 3] = (Math.random() - 0.5) * 120;
          positions[i * 3 + 1] = 40 + Math.random() * 10;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
        }
      }
      
      posAttr.needsUpdate = true;
    }
  }
}
