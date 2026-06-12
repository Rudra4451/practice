/* ==========================================================================
   Apex Horizon - AI Traffic Simulation System (Waypoint Pathing, Raycasts)
   ========================================================================== */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createNPCCarMesh } from '../cars/CarModels.js';
import { Logger } from '../systems/Logger.js';
import {
  NPC_CAR_POOL_SIZE, NPC_RECYCLE_DISTANCE, NPC_RESPAWN_MIN_DIST,
  NPC_RESPAWN_MAX_DIST, NPC_SPEED_MIN, NPC_SPEED_MAX,
  NPC_STUCK_SPEED_THRESHOLD, NPC_STUCK_TIME_LIMIT,
  TRAFFIC_LIGHT_CYCLE_SECONDS
} from '../CONSTANTS.js';

// ─── Pre-allocated temp objects (zero GC in update loop) ─────────────────────
const _tmpForward = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpVecToTarget = new THREE.Vector3();
const _tmpVecToOther = new THREE.Vector3();
const _tmpEuler = new CANNON.Vec3();
const _tmpAxisY = new CANNON.Vec3(0, 1, 0);
const _tmpStep = new CANNON.Vec3();

export class TrafficSystem {
  /**
   * @param {CANNON.World} physicsWorld
   * @param {THREE.Scene} threeScene
   * @param {AudioManager} audioManager
   */
  constructor(physicsWorld, threeScene, audioManager) {
    this.world = physicsWorld;
    this.scene = threeScene;
    this.audio = audioManager;

    this.npcCount = NPC_CAR_POOL_SIZE;
    this.vehicles = [];

    // Global intersection lights state
    this.lightCycleTimer = 0;
    this.verticalRed = false;

    // Define Waypoint Nodes Graph
    this.waypoints = [
      // City Loop Outer Lane
      new THREE.Vector3(-1900, 0.2, 100),
      new THREE.Vector3(-1900, 0.2, 550),
      new THREE.Vector3(-1900, 0.2, 1000),
      new THREE.Vector3(-1900, 0.2, 1450),
      new THREE.Vector3(-1900, 0.2, 1900),
      new THREE.Vector3(-1000, 0.2, 1900),
      new THREE.Vector3(-100, 0.2, 1900),
      new THREE.Vector3(-100, 0.2, 1000),
      new THREE.Vector3(-100, 0.2, 100),
      new THREE.Vector3(-1000, 0.2, 100),

      // Highway loop arterial
      new THREE.Vector3(-1000, 0.2, 1000),
      new THREE.Vector3(0, 0.2, 1000),
      new THREE.Vector3(1000, 0.2, 1000),
      new THREE.Vector3(1000, 0.2, 0),
      new THREE.Vector3(1000, 0.2, -1000),
      new THREE.Vector3(0, 0.2, -1000),
      new THREE.Vector3(-1000, 0.2, -1000),
      new THREE.Vector3(-1000, 0.2, 0)
    ];

    this.spawnTraffic();
  }

  spawnTraffic() {
    const types = ['sedan', 'taxi', 'police', 'bus'];

    for (let i = 0; i < this.npcCount; i++) {
      const startNodeIdx = i % this.waypoints.length;
      const spawnPos = this.waypoints[startNodeIdx].clone();
      
      const nextNodeIdx = (startNodeIdx + 1) % this.waypoints.length;
      const direction = new THREE.Vector3().subVectors(this.waypoints[nextNodeIdx], spawnPos).normalize();
      spawnPos.addScaledVector(direction, Math.random() * 80);

      const type = types[i % types.length];
      const visualGroup = createNPCCarMesh(type);
      this.scene.add(visualGroup);

      // Physics box shapes
      const width = type === 'bus' ? 2.3 : 1.8;
      const height = type === 'bus' ? 1.7 : 0.8;
      const length = type === 'bus' ? 7.5 : 4.2;

      const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, length / 2));
      const body = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.KINEMATIC,
        material: new CANNON.Material('npcMaterial')
      });
      body.addShape(shape);
      body.position.set(spawnPos.x, height / 2 + 0.1, spawnPos.z);
      this.world.addBody(body);

      // Create Web Audio spatial sound nodes for engine buzz
      let pannerNode = null;
      let soundSource = null;
      if (this.audio.ctx && this.audio.isInitialized) {
        pannerNode = this.audio.ctx.createPanner();
        pannerNode.panningModel = 'HRTF';
        pannerNode.distanceModel = 'inverse';
        pannerNode.refDistance = 5;
        pannerNode.maxDistance = 150;
        pannerNode.rolloffFactor = 1.5;
        pannerNode.connect(this.audio.masterSFXGain);

        soundSource = this.audio.ctx.createOscillator();
        soundSource.type = 'triangle';
        soundSource.frequency.setValueAtTime(80 + Math.random() * 20, this.audio.ctx.currentTime);
        
        const soundGain = this.audio.ctx.createGain();
        soundGain.gain.setValueAtTime(0.06, this.audio.ctx.currentTime);

        soundSource.connect(soundGain);
        soundGain.connect(pannerNode);
        soundSource.start(0);
      }

      this.vehicles.push({
        visual: visualGroup,
        body: body,
        targetNodeIdx: nextNodeIdx,
        speedKmh: NPC_SPEED_MIN + Math.random() * (NPC_SPEED_MAX - NPC_SPEED_MIN),
        type: type,
        audioSource: soundSource,
        audioPanner: pannerNode,
        // Stuck detection state
        stuckTimer: 0,
        // Physics body active state
        physicsActive: true
      });
    }
  }

  /**
   * Update all NPC cars, check red lights, stuck detection, and recycle far vehicles
   * @param {number} deltaSeconds
   * @param {CarBase} playerCar
   */
  update(deltaSeconds, playerCar) {
    const playerPos = playerCar ? playerCar.chassisBody.position : null;
    const playerX = playerPos ? playerPos.x : 0;
    const playerZ = playerPos ? playerPos.z : 0;

    // Update global traffic lights cycle
    this.lightCycleTimer += deltaSeconds;
    if (this.lightCycleTimer >= TRAFFIC_LIGHT_CYCLE_SECONDS) {
      this.lightCycleTimer = 0;
      this.verticalRed = !this.verticalRed;
    }

    this.vehicles.forEach(npc => {
      const npcPos = npc.body.position;

      // 1. RECYCLE ENGINE: check distance
      const dx = playerX - npcPos.x;
      const dz = playerZ - npcPos.z;
      const distToPlayer = Math.sqrt(dx * dx + dz * dz);

      if (distToPlayer > NPC_RECYCLE_DISTANCE) {
        // Remove physics body for out-of-range NPCs
        if (npc.physicsActive) {
          this.world.removeBody(npc.body);
          npc.physicsActive = false;
        }
        this.recycleNPC(npc, playerX, playerZ);
        return;
      }

      // Re-add physics body if returning to range
      if (!npc.physicsActive) {
        this.world.addBody(npc.body);
        npc.physicsActive = true;
      }

      // 2. Path node navigation
      const targetNode = this.waypoints[npc.targetNodeIdx];
      const tDx = targetNode.x - npcPos.x;
      const tDz = targetNode.z - npcPos.z;
      const distToTarget = Math.sqrt(tDx * tDx + tDz * tDz);

      if (distToTarget < 15) {
        npc.targetNodeIdx = (npc.targetNodeIdx + 1) % this.waypoints.length;
      }

      // 3. Speed overrides
      let slowMultiplier = 1.0;

      // Front-facing collision check using pre-allocated vectors
      _tmpForward.set(0, 0, 1);
      _tmpQuat.set(npc.body.quaternion.x, npc.body.quaternion.y, npc.body.quaternion.z, npc.body.quaternion.w);
      _tmpForward.applyQuaternion(_tmpQuat);

      // Player collision avoidance
      _tmpVecToTarget.set(playerX - npcPos.x, 0, playerZ - npcPos.z);
      const angleToPlayer = _tmpForward.angleTo(_tmpVecToTarget);

      if (distToPlayer < 30 && angleToPlayer < Math.PI / 6) {
        if (distToPlayer < 8) {
          slowMultiplier = 0.0;
        } else {
          slowMultiplier = (distToPlayer - 8) / 22;
        }
      }

      // NPC-to-NPC collision avoidance
      this.vehicles.forEach(other => {
        if (other === npc) return;
        const otherPos = other.body.position;
        const oDx = otherPos.x - npcPos.x;
        const oDz = otherPos.z - npcPos.z;
        const distToOther = Math.sqrt(oDx * oDx + oDz * oDz);

        if (distToOther < 20) {
          _tmpVecToOther.set(oDx, 0, oDz);
          const angleToOther = _tmpForward.angleTo(_tmpVecToOther);
          if (angleToOther < Math.PI / 6 && otherPos.y > 0.1) {
            if (distToOther < 9) {
              slowMultiplier = 0.0;
            } else {
              slowMultiplier = Math.min(slowMultiplier, (distToOther - 9) / 11);
            }
          }
        }
      });

      // 4. Red Light Zones
      const targetIsIntersection = targetNode.x < 0 && (
        Math.abs(targetNode.z - 100) < 5 ||
        Math.abs(targetNode.z - 1000) < 5 ||
        Math.abs(targetNode.z - 1900) < 5
      );

      if (targetIsIntersection && distToTarget < 35) {
        const travelDirectionZ = Math.abs(_tmpForward.z) > 0.8;
        
        if (travelDirectionZ && this.verticalRed) {
          slowMultiplier = 0.0;
        }
        else if (!travelDirectionZ && !this.verticalRed) {
          slowMultiplier = 0.0;
        }
      }

      // 5. Stuck Detection: if barely moving for NPC_STUCK_TIME_LIMIT seconds, skip waypoint
      const speedMs = (npc.speedKmh / 3.6) * slowMultiplier;
      if (speedMs < NPC_STUCK_SPEED_THRESHOLD && slowMultiplier > 0.01) {
        // NPC wants to move but can't — potentially stuck
        npc.stuckTimer += deltaSeconds;
        if (npc.stuckTimer >= NPC_STUCK_TIME_LIMIT) {
          // Teleport to next waypoint
          npc.targetNodeIdx = (npc.targetNodeIdx + 1) % this.waypoints.length;
          const nextWP = this.waypoints[npc.targetNodeIdx];
          npc.body.position.set(nextWP.x, npcPos.y, nextWP.z);
          npc.stuckTimer = 0;
          Logger.debug(`Unstuck NPC ${npc.type} — skipped to waypoint ${npc.targetNodeIdx}`);
        }
      } else {
        npc.stuckTimer = 0;
      }

      // 6. Apply kinematics
      const targetAngle = Math.atan2(targetNode.x - npcPos.x, targetNode.z - npcPos.z);
      npc.body.quaternion.toEuler(_tmpEuler);
      const currentAngle = _tmpEuler.y;
      
      let angleDiff = targetAngle - currentAngle;
      angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      const nextAngle = currentAngle + angleDiff * 0.08;

      _tmpAxisY.set(0, 1, 0);
      npc.body.quaternion.setFromAxisAngle(_tmpAxisY, nextAngle);

      // Move kinematic body using pre-allocated vector
      _tmpStep.set(0, 0, speedMs * deltaSeconds);
      const rotatedStep = npc.body.quaternion.vmult(_tmpStep);
      npc.body.position.x += rotatedStep.x;
      npc.body.position.z += rotatedStep.z;

      // Align visual mesh
      npc.visual.position.copy(npc.body.position);
      npc.visual.quaternion.copy(npc.body.quaternion);
      npc.visual.position.y += (npc.type === 'bus' ? -0.45 : -0.2);

      // 7. Update Web Audio Panner
      if (this.audio.ctx && this.audio.isInitialized) {
        if (!npc.audioPanner) {
          npc.audioPanner = this.audio.ctx.createPanner();
          npc.audioPanner.panningModel = 'HRTF';
          npc.audioPanner.distanceModel = 'inverse';
          npc.audioPanner.refDistance = 5;
          npc.audioPanner.maxDistance = 150;
          npc.audioPanner.rolloffFactor = 1.5;
          npc.audioPanner.connect(this.audio.masterSFXGain);

          npc.audioSource = this.audio.ctx.createOscillator();
          npc.audioSource.type = 'triangle';
          npc.audioSource.frequency.setValueAtTime(80 + Math.random() * 20, this.audio.ctx.currentTime);
          
          const soundGain = this.audio.ctx.createGain();
          soundGain.gain.setValueAtTime(0.06, this.audio.ctx.currentTime);

          npc.audioSource.connect(soundGain);
          soundGain.connect(npc.audioPanner);
          npc.audioSource.start(0);
        }

        const p = npc.body.position;
        if (pannerNodeSupportsPositionAPI(npc.audioPanner)) {
          npc.audioPanner.positionX.setValueAtTime(p.x, this.audio.ctx.currentTime);
          npc.audioPanner.positionY.setValueAtTime(p.y, this.audio.ctx.currentTime);
          npc.audioPanner.positionZ.setValueAtTime(p.z, this.audio.ctx.currentTime);
        } else {
          npc.audioPanner.setPosition(p.x, p.y, p.z);
        }
        
        const activePitch = 60 + (speedMs * 3.5);
        npc.audioSource.frequency.setTargetAtTime(activePitch, this.audio.ctx.currentTime, 0.1);
      }
    });
  }

  /**
   * Recycles far away traffic cars, spawning them close ahead of player
   */
  recycleNPC(npc, playerX, playerZ) {
    let targetSpawnNode = null;
    let targetIdx = 0;

    for (let i = 0; i < this.waypoints.length; i++) {
      const node = this.waypoints[i];
      const dx = node.x - playerX;
      const dz = node.z - playerZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > NPC_RESPAWN_MIN_DIST && dist < NPC_RESPAWN_MAX_DIST) {
        targetSpawnNode = node;
        targetIdx = i;
        break;
      }
    }

    if (!targetSpawnNode) {
      targetSpawnNode = this.waypoints[0];
      targetIdx = 0;
    }

    const spawnPos = targetSpawnNode.clone();
    npc.body.position.set(spawnPos.x, spawnPos.y + 0.1, spawnPos.z);
    
    const nextNodeIdx = (targetIdx + 1) % this.waypoints.length;
    const lookTarget = this.waypoints[nextNodeIdx];
    const angle = Math.atan2(lookTarget.x - spawnPos.x, lookTarget.z - spawnPos.z);
    _tmpAxisY.set(0, 1, 0);
    npc.body.quaternion.setFromAxisAngle(_tmpAxisY, angle);

    npc.targetNodeIdx = nextNodeIdx;
    npc.stuckTimer = 0;

    // Re-add body to physics world on respawn
    if (!npc.physicsActive) {
      this.world.addBody(npc.body);
      npc.physicsActive = true;
    }
    
    Logger.debug(`Recycled NPC ${npc.type} to coordinate point:`, spawnPos);
  }
}

// Check for modern Web Audio panner positioning compatibility
function pannerNodeSupportsPositionAPI(panner) {
  return panner.positionX !== undefined;
}
