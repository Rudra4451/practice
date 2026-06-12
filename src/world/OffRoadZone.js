/* ==========================================================================
   Apex Horizon - Off-Road Zone (Hilly Terrains, Mud Pits, Rock Colliders)
   ========================================================================== */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class OffRoadZone {
  /**
   * @param {WorldMap} worldMap
   */
  constructor(worldMap) {
    this.map = worldMap;
    this.scene = worldMap.scene;
    this.world = worldMap.world;

    // Dust particle state
    this.particles = [];
    this.maxParticles = 100;
  }

  build() {
    this.buildHillyTerrain();
    this.spawnRocks();
    this.buildMudPits();
    this.initDustParticleEngine();
  }

  /**
   * Create bumpy displacement terrain for off-road jumps
   */
  buildHillyTerrain() {
    // Quadrant: X: -2000 to -100, Z: -2000 to -100
    const segs = 32;
    const hillGeo = new THREE.PlaneGeometry(1900, 1900, segs, segs);
    hillGeo.rotateX(-Math.PI / 2); // Lay flat

    const pos = hillGeo.attributes.position;

    // Bumpy terrain function
    const getHillHeight = (x, z) => {
      const hillVal1 = Math.sin(x * 0.012) * Math.cos(z * 0.012) * 14;
      const hillVal2 = Math.cos(x * 0.04) * Math.sin(z * 0.04) * 3;
      return hillVal1 + hillVal2;
    };

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i) - 1050; // offset relative to global center (-1050, -1050)
      const vz = pos.getZ(i) - 1050;
      
      const height = getHillHeight(vx, vz);
      pos.setY(i, height);
    }

    hillGeo.computeVertexNormals();

    const hillMat = new THREE.MeshStandardMaterial({
      color: 0x5c4033, // Muddy brown
      roughness: 0.95,
      flatShading: true
    });

    const hillMesh = new THREE.Mesh(hillGeo, hillMat);
    hillMesh.position.set(-1050, 0, -1050);
    this.scene.add(hillMesh);

    // Create heightfield collision bodies using a finer 80m grid.
    // Smaller boxes prevent the stepped "cliff" effect that blocks the car.
    for (let x = -1700; x < -300; x += 80) {
      for (let z = -1700; z < -300; z += 80) {
        const height = getHillHeight(x, z);
        if (Math.abs(height) > 1.5) {
          // Thin, tightly-spaced boxes approximate the slope smoothly
          const shape = new CANNON.Box(new CANNON.Vec3(40, Math.abs(height) / 2 + 0.5, 40));
          const body = new CANNON.Body({ mass: 0 });
          body.addShape(shape);
          body.position.set(x, height / 2 - 0.5, z);
          this.world.addBody(body);
        }
      }
    }
  }

  /**
   * Spawn low-poly boulders/rocks with physical spheres/boxes
   */
  spawnRocks() {
    const rockGeo = new THREE.DodecahedronGeometry(3, 1);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x423e3b, roughness: 0.8 });

    const createRock = (x, z, scale = 1.0) => {
      const rock = new THREE.Mesh(rockGeo, rockMat);
      
      // Randomize scale
      rock.scale.set(scale, scale * (1.0 + Math.random() * 0.5), scale);
      rock.position.set(x, scale * 1.5, z);
      this.scene.add(rock);

      // Physics body
      const shape = new CANNON.Sphere(scale * 2.5);
      const body = new CANNON.Body({ mass: 0 }); // static
      body.addShape(shape);
      body.position.set(x, scale * 1.5, z);
      this.world.addBody(body);
    };

    // Spawn 15 rocks around the trail coordinates
    const rockPoints = [
      { x: -300, z: -350, s: 1.5 }, { x: -600, z: -450, s: 2.0 }, { x: -500, z: -900, s: 2.5 },
      { x: -1000, z: -500, s: 3.0 }, { x: -1100, z: -1000, s: 1.8 }, { x: -800, z: -1500, s: 2.0 },
      { x: -1500, z: -400, s: 2.5 }, { x: -1600, z: -1200, s: 3.5 }, { x: -1300, z: -1600, s: 2.2 }
    ];

    rockPoints.forEach(pt => createRock(pt.x, pt.z, pt.s));
  }

  /**
   * Add flat muddy patches overlaying the ground
   */
  buildMudPits() {
    const mudMat = new THREE.MeshStandardMaterial({
      color: 0x3d271d, // Very dark wet mud
      roughness: 0.95,
      flatShading: true
    });

    const mudGeo = new THREE.PlaneGeometry(250, 250);
    mudGeo.rotateX(-Math.PI / 2);

    // Spawn 4 mud pit panels at coordinate centers
    const mudCoordinates = [
      { x: -700, z: -700 },
      { x: -1200, z: -600 },
      { x: -1400, z: -1400 },
      { x: -500, z: -1200 }
    ];

    mudCoordinates.forEach(coord => {
      const pit = new THREE.Mesh(mudGeo, mudMat);
      pit.position.set(coord.x, 0.05, coord.z);
      this.scene.add(pit);
    });
  }

  /**
   * Set up instanced particle group for dirt dust kicks
   */
  initDustParticleEngine() {
    this.particleGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    this.particleMaterial = new THREE.MeshBasicMaterial({
      color: 0xc2b280, // Sand/dust color
      transparent: true,
      opacity: 0.8
    });

    // Create a pool of particle meshes
    this.particlesGroup = new THREE.Group();
    this.scene.add(this.particlesGroup);

    for (let i = 0; i < this.maxParticles; i++) {
      const p = new THREE.Mesh(this.particleGeometry, this.particleMaterial);
      p.visible = false;
      p.userData = {
        active: false,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0
      };
      this.particlesGroup.add(p);
      this.particles.push(p);
    }
  }

  /**
   * Kick off dust particles behind tires
   * @param {THREE.Vector3} emitterPos
   * @param {THREE.Vector3} direction - moving direction
   * @param {number} intensity - wheel rotation slip
   */
  emitDust(emitterPos, direction, intensity) {
    if (intensity < 0.1) return;

    let emitted = 0;
    const toEmit = Math.min(5, Math.ceil(intensity * 10));

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.userData.active) {
        p.visible = true;
        p.userData.active = true;
        p.position.copy(emitterPos);
        
        // Randomize spawn offset slightly
        p.position.x += (Math.random() - 0.5) * 1.5;
        p.position.z += (Math.random() - 0.5) * 1.5;

        // Kick backwards
        const kickDir = direction.clone().multiplyScalar(-1.2);
        p.userData.velocity.set(
          kickDir.x + (Math.random() - 0.5) * 2,
          1 + Math.random() * 4,
          kickDir.z + (Math.random() - 0.5) * 2
        );

        p.userData.life = 0;
        p.userData.maxLife = 20 + Math.random() * 20; // frame counts
        
        emitted++;
        if (emitted >= toEmit) break;
      }
    }
  }

  /**
   * Update particle velocities and lifespans
   */
  update(time) {
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (p.userData.active) {
        // Move particle
        p.position.addScaledVector(p.userData.velocity, 0.056);
        
        // Apply gravity
        p.userData.velocity.y -= 0.15;
        
        // Spin and scale down over time
        p.scale.multiplyScalar(0.95);
        p.userData.life++;

        if (p.userData.life >= p.userData.maxLife || p.scale.x < 0.05) {
          p.userData.active = false;
          p.visible = false;
          p.scale.set(1, 1, 1); // Reset scale for next emit
        }
      }
    }
  }
}
