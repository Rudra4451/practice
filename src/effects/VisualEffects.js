/* ==========================================================================
   Apex Horizon - Visual Effects System (Skid marks, exhaust smoke, drift smoke)
   ========================================================================== */

import * as THREE from 'three';

export class VisualEffects {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;

    // ─── Tire Skid Marks ───────────────────────────────────────────────────────
    this.skids = [];
    this.maxSkids = 150; // Cap to keep draw calls low
    this.skidGeom = new THREE.PlaneGeometry(0.35, 0.6);
    this.skidGeom.rotateX(-Math.PI / 2); // Align flat on X-Z plane

    this.skidMatBase = new THREE.MeshBasicMaterial({
      color: 0x070707,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    });

    // ─── Particle Systems (Exhaust & Drift Smoke) ────────────────────────────────
    this.maxParticles = 100;
    this.particleGeom = new THREE.BoxGeometry(0.2, 0.2, 0.2);

    // Create a pool of materials with varying opacities to avoid individual allocations
    this.exhaustMats = Array.from({ length: 6 }, (_, i) => new THREE.MeshBasicMaterial({
      color: 0x7a7d85,
      transparent: true,
      opacity: 0.25 * (1.0 - i / 6),
      depthWrite: false
    }));

    this.driftMats = Array.from({ length: 6 }, (_, i) => new THREE.MeshBasicMaterial({
      color: 0xdce0eb,
      transparent: true,
      opacity: 0.35 * (1.0 - i / 6),
      depthWrite: false
    }));

    // Pre-allocate particles pool (zero garbage collection)
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      const mesh = new THREE.Mesh(this.particleGeom, this.exhaustMats[0]);
      mesh.visible = false;
      this.scene.add(mesh);

      this.particles.push({
        mesh: mesh,
        active: false,
        velocity: new THREE.Vector3(),
        life: 0.0,
        maxLife: 1.0,
        type: 'exhaust' // 'exhaust' or 'drift'
      });
    }
  }

  /**
   * Spawn a skid mark segment behind a tire
   * @param {THREE.Vector3} position - Localized wheel contact point
   * @param {THREE.Quaternion} rotation - World quaternion of the tire
   */
  addSkidMark(position, rotation) {
    if (this.skids.length >= this.maxSkids) {
      const oldest = this.skids.shift();
      this.scene.remove(oldest.mesh);
      oldest.mesh.material.dispose();
    }

    const uniqueMat = this.skidMatBase.clone();
    const mesh = new THREE.Mesh(this.skidGeom, uniqueMat);
    
    // Position slightly above ground to prevent Z-fighting
    mesh.position.copy(position);
    mesh.position.y = 0.035;
    mesh.quaternion.copy(rotation);

    this.scene.add(mesh);
    this.skids.push({
      mesh: mesh,
      life: 0.0,
      maxLife: 12.0 // Stays for 12 seconds before fading
    });
  }

  /**
   * Activate an inactive particle from the pre-allocated pool
   * @param {THREE.Vector3} position 
   * @param {THREE.Vector3} velocity 
   * @param {string} type - 'exhaust' | 'drift'
   */
  spawnParticle(position, velocity, type = 'exhaust') {
    const p = this.particles.find(item => !item.active);
    if (!p) return; // Pool full, drop particle

    p.active = true;
    p.type = type;
    p.mesh.visible = true;
    p.mesh.position.copy(position);
    p.velocity.copy(velocity);
    p.life = 0.0;

    if (type === 'exhaust') {
      p.maxLife = 0.8 + Math.random() * 0.4; // Exists for ~1s
      p.mesh.material = this.exhaustMats[0];
      p.mesh.scale.setScalar(1.0);
    } else {
      p.maxLife = 0.6 + Math.random() * 0.3; // Exists for ~0.8s
      p.mesh.material = this.driftMats[0];
      p.mesh.scale.setScalar(1.5 + Math.random() * 2.0); // Drift smoke is larger
    }
  }

  /**
   * Tick all visual effect systems
   * @param {number} dt 
   */
  update(dt) {
    // 1. Skid marks lifetime management
    for (let i = this.skids.length - 1; i >= 0; i--) {
      const skid = this.skids[i];
      skid.life += dt;

      if (skid.life > skid.maxLife) {
        const fadeRatio = (skid.life - skid.maxLife) / 2.0; // Fade out over 2 seconds
        if (fadeRatio >= 1.0) {
          this.scene.remove(skid.mesh);
          skid.mesh.material.dispose();
          this.skids.splice(i, 1);
        } else {
          skid.mesh.material.opacity = 0.6 * (1.0 - fadeRatio);
        }
      }
    }

    // 2. Dynamic particles physics & fade transitions
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
      } else {
        // Move particle along its velocity
        p.mesh.position.addScaledVector(p.velocity, dt);

        // Add upward float drift (simulating thermal dispersion)
        p.velocity.y += 0.8 * dt;

        // Expand smoke particle size
        const growth = p.type === 'exhaust' ? 1.05 : 1.15;
        p.mesh.scale.multiplyScalar(growth);

        // Choose pre-allocated material matching age fraction to create fade effect
        const progressFraction = p.life / p.maxLife;
        const matIndex = Math.min(5, Math.floor(progressFraction * 6));
        p.mesh.material = p.type === 'exhaust' ? this.exhaustMats[matIndex] : this.driftMats[matIndex];
      }
    }
  }
}
