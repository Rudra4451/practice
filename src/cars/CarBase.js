/* ==========================================================================
   Apex Horizon - RaycastVehicle Physics & Dynamics Controller
   ========================================================================== */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { Logger } from '../systems/Logger.js';
import { VisualEffects } from '../effects/VisualEffects.js';
import {
  ANGULAR_VELOCITY_CAP, SUSPENSION_DEFAULTS, ROLL_INFLUENCE,
  SUSPENSION_REST_LENGTH, MAX_SUSPENSION_FORCE, MAX_SUSPENSION_TRAVEL,
  IDLE_RPM, MAX_RPM, GEAR_SPEED_LIMITS,
  NITRO_DURATION, NITRO_COOLDOWN, NITRO_FORCE_MULTIPLIER
} from '../CONSTANTS.js';

// ─── Pre-allocated temp objects for hot-path (zero GC pressure) ──────────────
const _tmpForwardVec = new CANNON.Vec3();
const _tmpForwardInput = new CANNON.Vec3(0, 0, 1);
const _tmpRightVec = new CANNON.Vec3();
const _tmpRightInput = new CANNON.Vec3(1, 0, 0);
const _tmpStepVec = new CANNON.Vec3();
const _tmpLocalPos = new THREE.Vector3();
const _tmpWorldQuat = new THREE.Quaternion();
const _tmpParentQuat = new THREE.Quaternion();
const _tmpRespawnQuat = new THREE.Quaternion();
const _tmpAxisY = new THREE.Vector3(0, 1, 0);

export class CarBase {
  /**
   * @param {CANNON.World} physicsWorld
   * @param {THREE.Scene} threeScene
   * @param {Object} carStats - Top speed, acceleration, handling, weight multipliers
   * @param {THREE.Group} visualGroup - Three.js group containing the vehicle geometry
   * @param {Function|null} hudNotify - Optional callback(header, body) for HUD notifications
   */
  constructor(physicsWorld, threeScene, carStats, visualGroup, hudNotify = null) {
    this.physicsWorld = physicsWorld;
    this.scene = threeScene;
    this.stats = carStats;
    this.visualGroup = visualGroup;
    this.hudNotify = hudNotify;

    // Dynamics state variables
    this.currentSpeedKmh = 0;
    this.rpm = IDLE_RPM;
    this.currentGear = 1;
    this.isReverse = false;
    this.slipFraction = 0; // 0 to 1 representing tire slide
    this.headlightsOn = false;

    // Nitro parameters
    this.nitroCooldown = 0;
    this.nitroTimer = 0;
    this.isNitroActive = false;

    // Max force thresholds based on carStats
    this.maxEngineForce = carStats.engineForce;
    this.maxBrakeForce = carStats.brakeForce;
    this.maxSteerVal = carStats.steeringLimit;
    this.mass = carStats.mass;

    this.initPhysics();
    this.initVisuals();
    this.effects = new VisualEffects(this.scene);

    // Register self on visualGroup so async GLTF loaders can update wheelMeshes
    this.visualGroup.carInstance = this;
  }

  /**
   * Initialize Physics body and RaycastVehicle constraints
   */
  initPhysics() {
    // 1. Rigid body for chassis
    const chassisWidth = this.stats.chassisWidth !== undefined ? this.stats.chassisWidth : 1.0;
    const chassisHeight = this.stats.chassisHeight !== undefined ? this.stats.chassisHeight : 0.5;
    const chassisLength = this.stats.chassisLength !== undefined ? this.stats.chassisLength : 2.0;

    const chassisShape = new CANNON.Box(new CANNON.Vec3(chassisWidth, chassisHeight, chassisLength));
    this.chassisBody = new CANNON.Body({
      mass: 1500, // standard mass 1500kg
      material: new CANNON.Material('chassisMaterial')
    });
    this.chassisBody.addShape(chassisShape, new CANNON.Vec3(0, 0.4, 0));
    this.chassisBody.position.set(0, 3, 0);
    this.chassisBody.angularDamping = 0.4;
    this.physicsWorld.addBody(this.chassisBody);

    // 2. Instantiate RaycastVehicle
    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2
    });

    // 3. Per-class suspension from carStats (falls back to defaults)
    const suspStiffness = this.stats.suspensionStiffness || SUSPENSION_DEFAULTS.stiffness;
    const suspDampRelax = this.stats.dampingRelaxation || SUSPENSION_DEFAULTS.dampingRelaxation;
    const suspDampComp = this.stats.dampingCompression || SUSPENSION_DEFAULTS.dampingCompression;

    const wheelRadius = this.stats.wheelRadius !== undefined ? this.stats.wheelRadius : 0.35;

    const wheelOptions = {
      radius: wheelRadius,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: suspStiffness,
      suspensionRestLength: SUSPENSION_REST_LENGTH,
      maxSuspensionForce: MAX_SUSPENSION_FORCE,
      maxSuspensionTravel: MAX_SUSPENSION_TRAVEL,
      dampingRelaxation: suspDampRelax,
      dampingCompression: suspDampComp,
      // Cannon-es frictionSlip needs to be in range 8–12 for real traction.
      // gripLevel (~1.4) × 7.5 ≈ 10.5 — stops infinite burnout.
      frictionSlip: this.stats.gripLevel * 7.5,
      rollInfluence: ROLL_INFLUENCE,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true
    };

    const connectionX = this.stats.connectionX !== undefined ? this.stats.connectionX : 1.0;
    const connectionY = this.stats.connectionY !== undefined ? this.stats.connectionY : -0.2;
    const connectionZ = this.stats.connectionZ !== undefined ? this.stats.connectionZ : 1.45;

    // 0: Front Left
    this.vehicle.addWheel({
      ...wheelOptions,
      chassisConnectionPointLocal: new CANNON.Vec3(connectionX, connectionY, connectionZ),
      isFrontWheel: true
    });
    // 1: Front Right
    this.vehicle.addWheel({
      ...wheelOptions,
      chassisConnectionPointLocal: new CANNON.Vec3(-connectionX, connectionY, connectionZ),
      isFrontWheel: true
    });
    // 2: Rear Left
    this.vehicle.addWheel({
      ...wheelOptions,
      chassisConnectionPointLocal: new CANNON.Vec3(connectionX, connectionY, -connectionZ),
      isFrontWheel: false
    });
    // 3: Rear Right
    this.vehicle.addWheel({
      ...wheelOptions,
      chassisConnectionPointLocal: new CANNON.Vec3(-connectionX, connectionY, -connectionZ),
      isFrontWheel: false
    });

    // 4. Attach vehicle constraint to physics world
    this.vehicle.addToWorld(this.physicsWorld);
  }

  /**
   * Set up visual Three.js mesh mappings
   */
  initVisuals() {
    this.scene.add(this.visualGroup);

    this.chassisMesh = this.visualGroup.getObjectByName('chassis');
    this.wheelMeshes = [
      this.visualGroup.getObjectByName('wheel_fl'),
      this.visualGroup.getObjectByName('wheel_fr'),
      this.visualGroup.getObjectByName('wheel_rl'),
      this.visualGroup.getObjectByName('wheel_rr')
    ];

    // Headlight nodes in front of car chassis
    this.headlights = [];
    const lightColor = 0xfffef0;
    
    const leftLight = new THREE.SpotLight(lightColor, 8, 45, Math.PI/6, 0.5, 1);
    leftLight.position.set(0.7, 0.1, 2.2);
    leftLight.target.position.set(0.7, -0.5, 15);
    this.visualGroup.add(leftLight);
    this.visualGroup.add(leftLight.target);
    this.headlights.push(leftLight);

    const rightLight = leftLight.clone();
    rightLight.position.set(-0.7, 0.1, 2.2);
    rightLight.target.position.set(-0.7, -0.5, 15);
    this.visualGroup.add(rightLight);
    this.visualGroup.add(rightLight.target);
    this.headlights.push(rightLight);

    this.toggleHeadlights(false);
  }

  /**
   * Toggle visual spot lights
   */
  toggleHeadlights(state) {
    this.headlightsOn = state !== undefined ? state : !this.headlightsOn;
    this.headlights.forEach(light => {
      light.visible = this.headlightsOn;
    });
  }

  /**
   * Get dynamic friction based on terrain types (asphalt, sand, mud)
   */
  setSurfaceFriction(coefficient) {
    // Keep the 7.5× scale consistent with initPhysics so terrain types stay proportional.
    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      this.vehicle.wheelInfos[i].frictionSlip = this.stats.gripLevel * 7.5 * coefficient;
    }
  }

  /**
   * Handle game loops: physics input mapping, telemetry update, mesh alignment
   * @param {InputManager} inputs
   * @param {number} terrainFriction
   * @param {number} deltaTime
   */
  update(inputs, terrainFriction = 1.0, deltaTime = 0.016) {
    // Tick down Nitro timers
    if (this.nitroCooldown > 0) {
      this.nitroCooldown -= deltaTime;
    }
    if (this.isNitroActive) {
      this.nitroTimer -= deltaTime;
      if (this.nitroTimer <= 0) {
        this.isNitroActive = false;
      }
    } else {
      if (inputs.nitro && this.nitroCooldown <= 0) {
        this.isNitroActive = true;
        this.nitroTimer = NITRO_DURATION;
        this.nitroCooldown = NITRO_COOLDOWN;
        if (this.hudNotify) {
          this.hudNotify("NITRO BOOT", "2X TORQUE BURST ENGAGED!");
        }
      }
    }

    // 0. Update surface friction based on current position
    this.setSurfaceFriction(terrainFriction);

    // 1. Calculate vehicle speed using pre-allocated vectors (zero GC)
    const velocity = this.chassisBody.velocity;
    this.chassisBody.vectorToWorldFrame(_tmpForwardInput, _tmpForwardVec);
    const speedMs = velocity.dot(_tmpForwardVec);
    this.currentSpeedKmh = speedMs * 3.6;

    const movingForward = speedMs > 0.1;
    const movingBackward = speedMs < -0.1;

    // Steering
    const targetSteering = inputs.steering * this.maxSteerVal;
    this.vehicle.setSteeringValue(targetSteering, 0);
    this.vehicle.setSteeringValue(targetSteering, 1);

    // Throttle & Braking logic
    let engineForce = 0;
    let brakeForce = 0;
    let nitroMultiplier = this.isNitroActive ? NITRO_FORCE_MULTIPLIER : 1.0;

    if (inputs.throttle > 0) {
      if (this.currentSpeedKmh < -2 && movingBackward) {
        brakeForce = this.maxBrakeForce * inputs.throttle;
      } else {
        engineForce = this.maxEngineForce * inputs.throttle * this.stats.powerMultiplier * nitroMultiplier;
        this.isReverse = false;
      }
    } else if (inputs.brake > 0) {
      if (this.currentSpeedKmh > 2 && movingForward) {
        brakeForce = this.maxBrakeForce * inputs.brake;
      } else {
        engineForce = -this.maxEngineForce * 0.4 * inputs.brake;
        this.isReverse = true;
      }
    }

    // Handbrake
    if (inputs.handbrake) {
      brakeForce = this.maxBrakeForce * 3.0;
      this.vehicle.setBrake(brakeForce, 2);
      this.vehicle.setBrake(brakeForce, 3);
      this.vehicle.setBrake(brakeForce * 0.2, 0);
      this.vehicle.setBrake(brakeForce * 0.2, 1);
      
      // Handbrake rear slip: still scale by 7.5 so the ratio remains correct
      this.vehicle.wheelInfos[2].frictionSlip = this.stats.gripLevel * 7.5 * 0.2 * terrainFriction;
      this.vehicle.wheelInfos[3].frictionSlip = this.stats.gripLevel * 7.5 * 0.2 * terrainFriction;
    } else {
      this.vehicle.setBrake(brakeForce * 0.7, 0);
      this.vehicle.setBrake(brakeForce * 0.7, 1);
      this.vehicle.setBrake(brakeForce * 0.3, 2);
      this.vehicle.setBrake(brakeForce * 0.3, 3);
    }

    // Apply engine force
    if (this.stats.driveType === 'AWD') {
      this.vehicle.applyEngineForce(engineForce * 0.5, 0);
      this.vehicle.applyEngineForce(engineForce * 0.5, 1);
      this.vehicle.applyEngineForce(engineForce * 0.5, 2);
      this.vehicle.applyEngineForce(engineForce * 0.5, 3);
    } else {
      this.vehicle.applyEngineForce(engineForce, 2);
      this.vehicle.applyEngineForce(engineForce, 3);
    }

    // 2. RPM & Gears
    this.updateRPMAndGears(inputs.throttle);

    // 3. Slip factor
    this.calculateTireSlip(inputs.handbrake);

    // 4. Clamp angular velocity to prevent barrel rolls at high speed
    this.clampAngularVelocity();

    // 5. Align visuals
    this.syncMeshTransforms();

    // 6. Update visual effects (exhaust smoke, skid marks, drift smoke)
    this.updateVisualEffects(inputs, deltaTime);
  }

  /**
   * Prevent uncontrollable barrel rolls by capping angular velocity magnitude
   */
  clampAngularVelocity() {
    const av = this.chassisBody.angularVelocity;
    const magSq = av.x * av.x + av.y * av.y + av.z * av.z;
    const capSq = ANGULAR_VELOCITY_CAP * ANGULAR_VELOCITY_CAP;
    if (magSq > capSq) {
      const scale = ANGULAR_VELOCITY_CAP / Math.sqrt(magSq);
      av.x *= scale;
      av.y *= scale;
      av.z *= scale;
    }
  }

  /**
   * Update visual skid marks and smoke particle emitters based on car telemetry
   * @param {InputManager} inputs 
   * @param {number} deltaTime 
   */
  updateVisualEffects(inputs, deltaTime) {
    if (!this.effects) return;

    // 1. Tick the effects manager (fades existing skids and animates particles)
    this.effects.update(deltaTime);

    const speed = Math.abs(this.currentSpeedKmh);
    const forwardVec = new THREE.Vector3(0, 0, 1).applyQuaternion(this.visualGroup.quaternion);

    // 2. Exhaust smoke generation (emits continuous faint puff from rear exhaust pipe)
    this.exhaustAccumulator = (this.exhaustAccumulator || 0) + deltaTime;
    const exhaustRate = inputs.throttle > 0 ? 0.03 : 0.07;
    if (this.exhaustAccumulator >= exhaustRate) {
      this.exhaustAccumulator = 0;
      
      // Exhaust position is at the rear of the car
      const exhaustLocal = new THREE.Vector3(0, 0.1, -2.1);
      const exhaustWorld = exhaustLocal.applyQuaternion(this.visualGroup.quaternion).add(this.visualGroup.position);
      
      const carVelocity = new THREE.Vector3(
        this.chassisBody.velocity.x,
        this.chassisBody.velocity.y,
        this.chassisBody.velocity.z
      );
      
      // Send exhaust smoke backwards relative to car orientation
      const smokeVel = carVelocity.clone().multiplyScalar(0.3).addScaledVector(forwardVec, -1.0);
      smokeVel.x += (Math.random() - 0.5) * 0.4;
      smokeVel.y += 0.5 + Math.random() * 0.5;
      smokeVel.z += (Math.random() - 0.5) * 0.4;

      this.effects.spawnParticle(exhaustWorld, smokeVel, 'exhaust');
    }

    // 3. Tire skids and drift smoke (Rear wheels check: indices 2 and 3)
    this.driftAccumulator = (this.driftAccumulator || 0) + deltaTime;
    const checkDrift = this.driftAccumulator >= 0.04;
    if (checkDrift) {
      this.driftAccumulator = 0;
    }

    const isSkidding = (inputs.handbrake || this.slipFraction > 0.4) && speed > 15;

    for (let i = 2; i <= 3; i++) {
      const wInfo = this.vehicle.wheelInfos[i];
      if (!wInfo.isInContact) continue;

      const contactPos = new THREE.Vector3(
        wInfo.worldTransform.position.x,
        wInfo.worldTransform.position.y - wInfo.radius,
        wInfo.worldTransform.position.z
      );

      // Add skid marks
      if (isSkidding) {
        const wheelQuat = new THREE.Quaternion(
          wInfo.worldTransform.quaternion.x,
          wInfo.worldTransform.quaternion.y,
          wInfo.worldTransform.quaternion.z,
          wInfo.worldTransform.quaternion.w
        );
        this.effects.addSkidMark(contactPos, wheelQuat);

        // Spawn drift smoke puffs at a capped rate
        if (checkDrift) {
          const smokeVel = new THREE.Vector3(
            -this.chassisBody.velocity.x * 0.15 + (Math.random() - 0.5) * 1.5,
            0.5 + Math.random() * 1.5,
            -this.chassisBody.velocity.z * 0.15 + (Math.random() - 0.5) * 1.5
          );
          this.effects.spawnParticle(contactPos, smokeVel, 'drift');
        }
      }
    }
  }

  /**
   * Simulate engine RPM feedback loop and automatic gearing
   */
  updateRPMAndGears(throttle) {
    const speed = Math.abs(this.currentSpeedKmh);

    if (this.isReverse) {
      this.currentGear = 1;
      this.rpm = Math.min(MAX_RPM, IDLE_RPM + (speed * 180));
      return;
    }

    // Shift up logic
    if (speed > GEAR_SPEED_LIMITS[this.currentGear - 1] && this.currentGear < 6) {
      this.currentGear++;
      this.rpm = IDLE_RPM + (this.rpm * 0.55);
    }
    // Shift down logic
    else if (this.currentGear > 1 && speed < GEAR_SPEED_LIMITS[this.currentGear - 2] * 0.9) {
      this.currentGear--;
      this.rpm = IDLE_RPM + (this.rpm * 1.3);
    }

    const currentGearMinSpeed = this.currentGear === 1 ? 0 : GEAR_SPEED_LIMITS[this.currentGear - 2];
    const currentGearMaxSpeed = GEAR_SPEED_LIMITS[this.currentGear - 1];
    
    const speedInGear = speed - currentGearMinSpeed;
    const gearSpeedRange = currentGearMaxSpeed - currentGearMinSpeed;
    
    let rpmFraction = speedInGear / gearSpeedRange;
    rpmFraction = Math.max(0, Math.min(1, rpmFraction));

    let targetRpm = IDLE_RPM + (rpmFraction * (MAX_RPM - IDLE_RPM));

    if (throttle > 0) {
      targetRpm += throttle * 1200 * (1 - rpmFraction);
    } else {
      targetRpm = Math.max(IDLE_RPM, targetRpm - 1500);
    }

    this.rpm = Math.max(IDLE_RPM, Math.min(MAX_RPM, targetRpm));
  }

  /**
   * Determine lateral slip ratio for tire screech sound intensities.
   * Uses pre-allocated temp vectors.
   */
  calculateTireSlip(handbrake) {
    if (handbrake) {
      this.slipFraction = 1.0;
      return;
    }

    const velocity = this.chassisBody.velocity;
    const speed = velocity.length();

    if (speed < 4) {
      this.slipFraction = 0;
      return;
    }

    // Use pre-allocated temp vector
    _tmpRightInput.set(1, 0, 0);
    this.chassisBody.vectorToWorldFrame(_tmpRightInput, _tmpRightVec);
    
    const lateralSpeed = Math.abs(velocity.dot(_tmpRightVec));
    this.slipFraction = Math.min(1.0, lateralSpeed / 6);
  }

  /**
   * Align Three.js mesh transforms with Cannon-es physics.
   * Uses pre-allocated temp objects for zero GC pressure.
   * Front wheel visual steering adopted from Gemini-3D-Car-Racing-Game reference.
   */
  syncMeshTransforms() {
    // 1. Chassis positioning
    this.visualGroup.position.copy(this.chassisBody.position);
    this.visualGroup.quaternion.copy(this.chassisBody.quaternion);

    if (this.chassisMesh) {
      this.chassisMesh.position.set(0, -0.3, 0);
    }

    // Read actual physics steering angle so wheels visually match steering input
    const steeringAngle = this.vehicle.wheelInfos[0]
      ? this.vehicle.wheelInfos[0].steering
      : 0;

    // 2. Wheels positioning using pre-allocated temps
    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      this.vehicle.updateWheelTransform(i);
      const transform = this.vehicle.wheelInfos[i].worldTransform;
      const wheelMesh = this.wheelMeshes[i];

      if (wheelMesh) {
        _tmpLocalPos.set(transform.position.x, transform.position.y, transform.position.z);
        this.visualGroup.worldToLocal(_tmpLocalPos);
        wheelMesh.position.copy(_tmpLocalPos);

        _tmpWorldQuat.set(transform.quaternion.x, transform.quaternion.y, transform.quaternion.z, transform.quaternion.w);
        this.visualGroup.getWorldQuaternion(_tmpParentQuat);
        
        _tmpParentQuat.invert().multiply(_tmpWorldQuat);
        wheelMesh.quaternion.copy(_tmpParentQuat);

        // ── Front Wheel Visual Steering (from Gemini-3D-Car-Racing-Game) ──────
        // Index 0 = FL, 1 = FR — apply the physics steering angle as a local Y rotation
        // on top of the physics quaternion so the wheel visually turns with input.
        if (i === 0 || i === 1) {
          // Create a yaw rotation equal to the steering angle
          const steerQuat = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            steeringAngle
          );
          // Compose: physics rotation × steering yaw
          wheelMesh.quaternion.multiply(steerQuat);
        }
      }
    }
  }


  /**
   * Reset car position and rotation if flipped or trapped
   */
  respawn(pos = new THREE.Vector3(0, 3, 0), rotY = 0) {
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    
    this.chassisBody.position.set(pos.x, pos.y + 1, pos.z);
    
    _tmpRespawnQuat.setFromAxisAngle(_tmpAxisY, rotY);
    this.chassisBody.quaternion.copy(_tmpRespawnQuat);
    
    this.currentGear = 1;
    this.rpm = IDLE_RPM;
    this.currentSpeedKmh = 0;
    
    Logger.debug("Vehicle respawned at coordinates:", pos);
  }
}
