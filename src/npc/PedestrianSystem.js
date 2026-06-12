/* ==========================================================================
   Apex Horizon - AI Pedestrian Sidewalk Simulation System
   ========================================================================== */

import * as THREE from 'three';
import {
  PEDESTRIAN_POOL_SIZE, PEDESTRIAN_WALK_SPEED, PEDESTRIAN_FLEE_MULTIPLIER,
  PEDESTRIAN_FLEE_RADIUS, PEDESTRIAN_Z_MIN, PEDESTRIAN_Z_MAX,
  PEDESTRIAN_X_MIN, PEDESTRIAN_X_MAX
} from '../CONSTANTS.js';

export class PedestrianSystem {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.pedestrians = [];
    this.pedCount = PEDESTRIAN_POOL_SIZE;

    // Sidewalk lanes coordinates inside City Zone
    this.walkLinesX = [-1885, -1435, -985, -535, -85];
    this.walkLinesZ = [85, 535, 985, 1435, 1885];

    // Crosswalk crossing triggers: nodes where sidewalk lines cross horizontal lanes (Z = 550, Z = 1450)
    this.crosswalkZonesZ = [535, 1435];

    this.spawnPedestrians();
  }

  spawnPedestrians() {
    const headGeo = new THREE.SphereGeometry(0.25, 6, 6);
    const bodyGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.2, 6);

    const colors = [0xff3c00, 0x00f0ff, 0x39ff14, 0xff00ff, 0xffff00, 0xffffff];

    for (let i = 0; i < this.pedCount; i++) {
      const pedGroup = new THREE.Group();

      const bodyMat = new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        roughness: 0.8,
        flatShading: true
      });
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 0.6 });

      // Torso cylinder
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.6;
      pedGroup.add(body);

      // Head sphere
      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.y = 1.35;
      pedGroup.add(head);

      // Place randomly along sidewalk lines
      const lineX = this.walkLinesX[i % this.walkLinesX.length];
      const startZ = 150 + Math.random() * 1600;

      pedGroup.position.set(lineX, 0.05, startZ);
      this.scene.add(pedGroup);

      this.pedestrians.push({
        mesh: pedGroup,
        lineX: lineX,
        dir: Math.random() > 0.5 ? 1 : -1,
        speed: PEDESTRIAN_WALK_SPEED,
        fleeing: false,
        bobOffset: Math.random() * Math.PI,
        crossingRoad: false,
        crossingProgress: 0.0
      });
    }
  }

  /**
   * Update walkers, check vehicle fleeing distance, and crosswalk light cycles
   * @param {number} deltaSeconds
   * @param {THREE.Vector3} playerPos
   * @param {boolean} verticalTrafficRed - traffic light state from TrafficSystem
   */
  update(deltaSeconds, playerPos, verticalTrafficRed) {
    this.pedestrians.forEach(ped => {
      const pedPos = ped.mesh.position;
      const distToPlayer = pedPos.distanceTo(playerPos);

      let currentSpeed = ped.speed;

      // 1. Proximity Flee Check: if vehicle within 5m, double speed and run away (PROMPT 2)
      if (distToPlayer < PEDESTRIAN_FLEE_RADIUS) {
        ped.fleeing = true;
        currentSpeed = ped.speed * PEDESTRIAN_FLEE_MULTIPLIER;
        
        // Face away from car
        const angle = Math.atan2(pedPos.x - playerPos.x, pedPos.z - playerPos.z);
        ped.mesh.rotation.y = angle;

        // Run away: move coordinates outwards
        const runDirection = new THREE.Vector3().subVectors(pedPos, playerPos).normalize();
        pedPos.addScaledVector(runDirection, currentSpeed * deltaSeconds);
        
        // Clamp both X and Z bounds to keep pedestrians in city zone
        pedPos.x = Math.max(PEDESTRIAN_X_MIN, Math.min(PEDESTRIAN_X_MAX, pedPos.x));
        pedPos.z = Math.max(PEDESTRIAN_Z_MIN, Math.min(PEDESTRIAN_Z_MAX, pedPos.z));
      } else {
        ped.fleeing = false;

        // 2. Crosswalk Light Cycle Checks: wait at red, cross at green (PROMPT 2)
        // Check if pedestrian is approaching one of the crosswalk intersections along Z
        const nearCrosswalk = this.crosswalkZonesZ.some(cz => Math.abs(pedPos.z - cz) < 8.0);
        
        if (nearCrosswalk && !ped.crossingRoad) {
          // Crosswalk is active when vertical traffic has red light (so pedestrians get green!)
          const pedestrianLightGreen = verticalTrafficRed;

          if (!pedestrianLightGreen) {
            // Pedestrian light is Red. Stop and wait at crosswalk entry
            currentSpeed = 0;
          } else {
            // Pedestrian light is Green. Proceed to cross!
            ped.crossingRoad = true;
            ped.crossingProgress = 0.0;
          }
        }

        // Handle active road crossing animation
        if (ped.crossingRoad) {
          ped.crossingProgress += deltaSeconds * 0.15; // crossing speed
          
          // Steer horizontal relative offset to cross the street lane
          const crossWidth = 24.0; // road width
          if (ped.crossingProgress < 1.0) {
            // Translate X coordinate across the lane
            pedPos.x = ped.lineX + (Math.sin(ped.crossingProgress * Math.PI) * crossWidth);
            pedPos.z += ped.dir * currentSpeed * deltaSeconds;
          } else {
            // Crossing complete
            ped.crossingRoad = false;
            pedPos.x = ped.lineX;
          }
        } else {
          // Normal sidewalk loop walk
          pedPos.z += ped.dir * currentSpeed * deltaSeconds;
          pedPos.x = THREE.MathUtils.lerp(pedPos.x, ped.lineX, 0.05); // Snap back to center line
        }

        // Turn around at map borders
        if (pedPos.z > PEDESTRIAN_Z_MAX) ped.dir = -1;
        if (pedPos.z < PEDESTRIAN_Z_MIN) ped.dir = 1;

        // Face walk direction
        ped.mesh.rotation.y = ped.dir > 0 ? 0 : Math.PI;
      }

      // Visual bobbing animation
      if (currentSpeed > 0) {
        const bob = Math.sin(performance.now() * 0.015 * currentSpeed + ped.bobOffset) * 0.08;
        ped.mesh.position.y = 0.05 + Math.abs(bob);
      } else {
        ped.mesh.position.y = 0.05;
      }
    });
  }
}
