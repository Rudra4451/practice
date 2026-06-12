/* ==========================================================================
   Apex Horizon - Open World Coordinates & Boundary Coordinator
   ========================================================================== */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { FRICTION } from '../CONSTANTS.js';
import { CityZone } from './CityZone.js';
import { BeachZone } from './BeachZone.js';
import { SpeedZone } from './SpeedZone.js';
import { OffRoadZone } from './OffRoadZone.js';
import { RaceCircuit } from './RaceCircuit.js';

export class WorldMap {
  /**
   * @param {CANNON.World} physicsWorld
   * @param {THREE.Scene} threeScene
   */
  constructor(physicsWorld, threeScene) {
    this.world = physicsWorld;
    this.scene = threeScene;

    // Active environment weather factor (passed from WeatherSystem)
    this.wetnessFactor = 0.0; // 0 (dry) to 1 (pouring)

    // Boundaries configuration (4000x4000 grid from -2000 to 2000)
    this.size = 4000;
    this.halfSize = 2000;

    // Materials map for physics interactions
    this.groundMaterial = new CANNON.Material('groundMaterial');

    // Instantiate Zones
    this.cityZone = new CityZone(this);
    this.beachZone = new BeachZone(this);
    this.speedZone = new SpeedZone(this);
    this.offRoadZone = new OffRoadZone(this);
    // CatmullRom race circuit (from Gemini-3D-Car-Racing-Game reference)
    this.raceCircuit = new RaceCircuit(this.world, this.scene);

    this.initGlobalGround();
    this.buildZones();
    this.populateTrees();
  }

  /**
   * Create base flat physics ground collider
   */
  initGlobalGround() {
    // Cannon-es plane extends infinitely but we only build visual assets within our grid
    const groundShape = new CANNON.Plane();
    this.groundBody = new CANNON.Body({
      mass: 0, // static body
      material: this.groundMaterial
    });
    this.groundBody.addShape(groundShape);
    
    // Rotate plane flat (parallel to X-Z plane)
    this.groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(this.groundBody);
  }

  /**
   * Delegate asset loading and creation to individual zone modules
   */
  buildZones() {
    // Setup and attach sub-zone objects
    this.cityZone.build();
    this.beachZone.build();
    this.speedZone.build();
    this.offRoadZone.build();

    // Create arterial roads connecting the zones
    this.buildArterialFreeways();
  }

  /**
   * Build connecting roads and bridges between coordinates
   */
  buildArterialFreeways() {
    // 1. Central Cross roads intersecting at (0,0,0)
    // Left-to-Right freeway (City to Beach / X: -1000 to +1000)
    const freewayLMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a24,
      roughness: 0.85,
      flatShading: true
    });
    
    const roadXGeo = new THREE.BoxGeometry(2000, 0.05, 30);
    const roadX = new THREE.Mesh(roadXGeo, freewayLMat);
    roadX.position.set(0, 0.02, 0);
    this.scene.add(roadX);

    // North-to-South freeway (Speedway to Offroad / Z: -1000 to +1000)
    const roadZGeo = new THREE.BoxGeometry(30, 0.05, 2000);
    const roadZ = new THREE.Mesh(roadZGeo, freewayLMat);
    roadZ.position.set(0, 0.02, 0);
    this.scene.add(roadZ);
    
    // Add central bridge over beach borders
    // Bridge arches
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x22252b, roughness: 0.6 });
    const archGeo = new THREE.BoxGeometry(160, 15, 34);
    const arch = new THREE.Mesh(archGeo, bridgeMat);
    arch.position.set(500, 2.5, 0); // Bridge over beach lagoon
    this.scene.add(arch);
  }

  /**
   * Scatter cone pine trees across city edges and offroad zone
   * Adapted from Gemini-3D-Car-Racing-Game tree generation
   */
  populateTrees() {
    const trunkMat  = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 });
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.8 });

    // Scatter 200 trees across offroad and city border areas
    for (let i = 0; i < 200; i++) {
      // Random position within specific zones (avoiding roads and circuit)
      let tx, tz;
      const zone = Math.floor(Math.random() * 3);

      if (zone === 0) {
        // City edge (west side, -1800 to -800, Z: 100 to 1800)
        tx = -800 - Math.random() * 1000;
        tz =  100 + Math.random() * 1700;
      } else if (zone === 1) {
        // Offroad zone scattered trees (-1800 to -300, Z: -1800 to -200)
        tx = -300 - Math.random() * 1500;
        tz = -200 - Math.random() * 1600;
      } else {
        // Speedway zone grass patches (200 to 1800, Z: 200 to 1800, away from circuit)
        tx = 200 + Math.random() * 1600;
        tz = 200 + Math.random() * 1600;
        // Skip if too close to circuit (rough AABB check)
        const distFromCircuit = Math.sqrt(tx * tx + tz * tz);
        if (distFromCircuit < 700) continue;
      }

      const treeH   = 3.5 + Math.random() * 5.5;
      const trunkH  = 1.5 + Math.random() * 1.0;
      const coneR   = 1.2 + Math.random() * 1.2;

      // Trunk
      const trunkGeo = new THREE.CylinderGeometry(0.15, 0.3, trunkH, 5);
      const trunk    = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(tx, trunkH / 2, tz);
      trunk.castShadow = true;
      this.scene.add(trunk);

      // Cone foliage (reference repo style)
      const coneGeo = new THREE.ConeGeometry(coneR, treeH, 6);
      const cone    = new THREE.Mesh(coneGeo, leavesMat);
      cone.position.set(tx, trunkH + treeH / 2, tz);
      cone.castShadow = true;
      this.scene.add(cone);
    }
  }

  /**
   * Determine terrain category and returns a friction coefficient multiplier
   * @param {number} x - Car coordinate X
   * @param {number} z - Car coordinate Z
   */
  getTerrainFrictionAt(x, z) {
    let friction = FRICTION.ASPHALT;

    // Quadrant 1: City Zone (X: -2000 to 0, Z: 0 to 2000)
    if (x < 0 && z >= 0) {
      friction = FRICTION.ASPHALT; // 1.0 → gripLevel * 1.0 ≈ 1.4
      if (this.wetnessFactor > 0) friction *= (1.0 - this.wetnessFactor * FRICTION.WET_PENALTY);
    }
    // Quadrant 2: Speed Zone (X: 0 to 2000, Z: 0 to 2000)
    else if (x >= 0 && z >= 0) {
      friction = FRICTION.RACING_ASPHALT; // 1.05 → gripLevel * 1.05 ≈ 1.47
      if (this.wetnessFactor > 0) friction *= (1.0 - this.wetnessFactor * FRICTION.WET_PENALTY);
    }
    // Quadrant 3: Beach Zone (X: 0 to 2000, Z: -2000 to 0)
    else if (x >= 0 && z < 0) {
      if (x > 1400 && z < -1400) {
        friction = FRICTION.WATER; // 0.14 → gripLevel * 0.14 ≈ 0.20
      } else {
        friction = FRICTION.SAND; // 0.36 → gripLevel * 0.36 ≈ 0.50
        if (this.wetnessFactor > 0) friction *= (1.0 - this.wetnessFactor * 0.4);
      }
    }
    // Quadrant 4: Off-Road Zone (X: -2000 to 0, Z: -2000 to 0)
    else if (x < 0 && z < 0) {
      friction = FRICTION.MUD; // 0.22 → gripLevel * 0.22 ≈ 0.30
      if (this.wetnessFactor > 0) friction *= (1.0 - this.wetnessFactor * 0.45);
    }

    return friction;
  }

  /**
   * Determine zone display name based on coordinates
   * @param {number} x
   * @param {number} z
   */
  getZoneNameAt(x, z) {
    // Race circuit zone: roughly covers the circuit waypoint bounding box
    if (z > 300 && z < 650 && x > -650 && x < 650) return 'APEX RACE CIRCUIT';
    if (x < 0 && z >= 0) return "CITY URBAN STREETS";
    if (x >= 0 && z >= 0) return "SPEEDWAY TEST TRACK";
    if (x >= 0 && z < 0) {
      if (x > 1400 && z < -1400) return "OCEAN LAGOON";
      return "SUNSET BEACH ROAD";
    }
    if (x < 0 && z < 0) return "MUDDY OFFROAD TRAILS";
    return "ARTERIAL HIGHWAY";
  }

  /**
   * Update wetness coefficient during rainstorms
   */
  setWetness(wetness) {
    this.wetnessFactor = wetness;
  }

  /**
   * Update dynamic animations (e.g. water ripples)
   */
  update(time) {
    this.beachZone.update(time);
    this.offRoadZone.update(time);
    this.cityZone.update(time);
  }
}
