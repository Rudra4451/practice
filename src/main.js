/* ==========================================================================
   Apex Horizon - Main Game Bootstrap & Animation Loop
   ========================================================================== */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import { QUALITY_TIERS } from './CONSTANTS.js';
import { PostProcessing } from './systems/PostProcessing.js';

// Game Sub-Systems imports
import { Logger } from './systems/Logger.js';
import { SaveManager } from './systems/SaveManager.js';
import { InputManager } from './systems/InputManager.js';
import { AudioManager } from './systems/AudioManager.js';
import { DayNightCycle } from './systems/DayNightCycle.js';
import { WeatherSystem } from './systems/WeatherSystem.js';

// Physical assets imports
import { WorldMap } from './world/WorldMap.js';
import { CarBase } from './cars/CarBase.js';
import { createProceduralCarMesh, CAR_ROSTER, attemptGLTFAssetLoading } from './cars/CarModels.js';

// NPC simulation systems imports
import { TrafficSystem } from './npc/TrafficSystem.js';
import { PedestrianSystem } from './npc/PedestrianSystem.js';

// HUD Overlay interfaces imports
import { HUD } from './hud/HUD.js';
import { Garage } from './hud/Garage.js';

class GameController {
  constructor() {
    this.clock = new THREE.Clock();
    this.inGarageMode = true;

    // Camera viewpoints: 'chase', 'hood', 'orbit' (turntable)
    this.cameraMode = 'orbit';
    this.orbitAngle = 0;

    this.initWebGL();
    this.initPhysics();
    this.initSystems();

    // Track distance / Speedway timer
    this.lastPlayerPosition = new THREE.Vector3();
    this.distanceAccumulator = 0;
    this.speedwayTimer = 0;
    this.debugFrameCount = 0;

    // Remove loading screen overlay once loaded
    const loader = document.getElementById('loading-screen');
    if (loader) loader.classList.remove('active');
    
    // Open Main Garage Overlay
    document.getElementById('garage-screen').classList.add('active');

    // Bind resize listener
    window.addEventListener('resize', () => this.onWindowResize());

    // Auto-save every 30 seconds (PROMPT 2)
    setInterval(() => {
      SaveManager.save();
    }, 30000);

    // Boot game animation loop
    this.animate();
  }

  /**
   * Set up WebGL scene, camera, and renderer parameters
   */
  initWebGL() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; // PROMPT 2

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd9efff);
    // Atmospheric fog matching sky color — from Gemini-3D-Car-Racing-Game reference
    this.scene.fog = new THREE.FogExp2(0xd9efff, 0.0006);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 3000);
    this.camera.position.set(0, 10, -15);

    // Setup OrbitControls for developer view (enabled only in orbit cameraMode) (PROMPT 2)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enabled = false;
  }

  /**
   * Set up Cannon-es physics parameters and equations
   */
  initPhysics() {
    this.physicsWorld = new CANNON.World();
    this.physicsWorld.gravity.set(0, -9.82, 0);

    // Dynamic contact material pairings (decrease friction when tires slip)
    this.physicsWorld.solver.iterations = 8;
    this.physicsWorld.defaultContactMaterial.contactEquationRelaxation = 3.0;
    this.physicsWorld.defaultContactMaterial.contactEquationStiffness = 1e7;
  }

  /**
   * Initialize dynamic game layers
   */
  initSystems() {
    // Save-States and Volume parameters
    SaveManager.load();
    
    this.audio = new AudioManager();
    this.inputs = new InputManager();

    // Map landscape and boundary trackers
    this.map = new WorldMap(this.physicsWorld, this.scene);
    
    // DayNight orbits and precipitation systems
    this.dayNight = new DayNightCycle(this.scene);
    this.weather = new WeatherSystem(this.scene, this.map);

    // AI Traffic loops and pedestrian sidewalk wanderers
    this.traffic = new TrafficSystem(this.physicsWorld, this.scene, this.audio);
    this.pedestrians = new PedestrianSystem(this.scene);

    // HUD dashboard layers
    this.hud = new HUD();

    // Garage menus Carousel setup
    this.garage = new Garage(SaveManager, this.audio, (carId) => this.spawnPlayerCar(carId));

    // Initial weather state setup
    const initialWeather = SaveManager.profile.settings.weather || 'clear';
    this.setWeatherState(initialWeather);

    // Apply sliders volumes
    this.audio.setVolumes(SaveManager.profile.settings.sfx, SaveManager.profile.settings.music);

    // Apply saved graphics configurations on boot
    const initialGraphics = SaveManager.profile.settings.graphics || 'medium';
    this.applyGraphicsQuality(initialGraphics);
  }

  /**
   * Handle player spawning when selected from Garage Menu
   * @param {string} carId - key in CAR_ROSTER
   */
  spawnPlayerCar(carId) {
    // 1. Remove previous vehicle assets and garage dummy if spawning new one
    if (this.playerCar) {
      this.scene.remove(this.playerCar.visualGroup);
      this.physicsWorld.removeBody(this.playerCar.chassisBody);
      this.playerCar.vehicle.removeFromWorld(this.physicsWorld);
    }
    if (this.garageDummyMesh) {
      this.scene.remove(this.garageDummyMesh);
      this.garageDummyMesh = null;
    }

    // 2. Build visual mesh group procedurally and hook GLTF loader
    const visualGroup = createProceduralCarMesh(carId);
    attemptGLTFAssetLoading(carId, visualGroup);
    
    // 3. Retrieve stats tuning levels from profile save state
    const lvlEngine = SaveManager.getUpgradeLevel(carId, 'engine');
    const lvlHandling = SaveManager.getUpgradeLevel(carId, 'handling');

    // Retrieve active physics specifications from CAR_ROSTER
    const carData = CAR_ROSTER[carId] || CAR_ROSTER.bmw;
    const basePhysics = carData.physics;

    // Apply upgrade multipliers to physical specs (PROMPT 2)
    const upgradedPhysics = {
      ...basePhysics,
      powerMultiplier: basePhysics.powerMultiplier + lvlEngine * 0.1,
      gripLevel: basePhysics.gripLevel + lvlHandling * 0.12
    };

    this.playerCar = new CarBase(
      this.physicsWorld,
      this.scene,
      upgradedPhysics,
      visualGroup
    );

    // Place player initially on central highway (0, 0.5, 50) heading North
    this.playerCar.respawn(new THREE.Vector3(0, 0.8, 50), 0);

    // Track initial position for distance accumulator
    this.lastPlayerPosition.copy(this.playerCar.chassisBody.position);
    this.distanceAccumulator = 0;

    // Swap camera mode to dynamic driving chase view
    this.cameraMode = 'chase';
    this.inGarageMode = false;
    
    // Set hud active car label
    const hudCar = document.getElementById('hud-car-name');
    if (hudCar) hudCar.textContent = carData.name;
  }

  /**
   * Set weather type state
   */
  setWeatherState(value) {
    this.weather.setWeather(value);

    // Sync settings modal options UI (PROMPT 2)
    const btns = document.querySelectorAll('#weather-select .option-btn');
    btns.forEach(btn => {
      if (btn.getAttribute('data-value') === value) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  /**
   * Apply graphics quality configuration parameters dynamically
   * @param {string} tier - 'low' | 'medium' | 'high'
   */
  applyGraphicsQuality(tier) {
    const config = QUALITY_TIERS[tier] || QUALITY_TIERS.medium;

    // 1. Shadow settings (Toggle shadow rendering in real-time)
    if (this.dayNight && this.dayNight.dirLight) {
      this.dayNight.dirLight.castShadow = config.shadows;
    }

    // 2. Pixel ratio adjustment
    this.renderer.setPixelRatio(config.pixelRatio === 2 ? Math.min(window.devicePixelRatio, 2) : config.pixelRatio);

    // 3. Bloom post-processing pipeline
    if (config.bloom) {
      if (!this.postProcessing) {
        this.postProcessing = new PostProcessing(this.renderer, this.scene, this.camera);
      } else {
        this.postProcessing.resize(window.innerWidth, window.innerHeight);
      }
      this.usePostProcessing = true;
    } else {
      this.usePostProcessing = false;
    }
  }

  /**
   * Responsive window resizer
   */
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.postProcessing) {
      this.postProcessing.resize(window.innerWidth, window.innerHeight);
    }
  }

  /**
   * Orchestrate chase, hood, and cinematic cameras
   */
  updateCamera(deltaTime) {
    if (this.inGarageMode) {
      // Rotate camera around origin turntable style
      this.orbitAngle += deltaTime * 0.2;
      const radius = 9.5;
      this.camera.position.set(
        Math.sin(this.orbitAngle) * radius,
        3.2,
        Math.cos(this.orbitAngle) * radius
      );
      this.camera.lookAt(new THREE.Vector3(0, 1.2, 0));
      return;
    }

    if (!this.playerCar) return;

    const pos = this.playerCar.chassisBody.position;

    if (this.cameraMode === 'orbit') {
      this.controls.enabled = true;
      this.controls.target.copy(pos);
      this.controls.update();
      
      // Handle view swaps on user trigger even in orbit mode
      if (this.inputs.cameraToggleRequest) {
        this.inputs.cameraToggleRequest = false;
        this.cameraMode = 'chase';
        this.controls.enabled = false;
        this.hud.showNotification("CAMERA CHANGED", `ACTIVE VIEW: ${this.cameraMode.toUpperCase()}`);
      }
      return;
    } else {
      this.controls.enabled = false;
    }

    // Handle view swaps on user trigger
    if (this.inputs.cameraToggleRequest) {
      this.inputs.cameraToggleRequest = false;
      if (this.cameraMode === 'chase') {
        this.cameraMode = 'hood';
      } else if (this.cameraMode === 'hood') {
        this.cameraMode = 'orbit';
        // Reset camera offset when switching to orbit mode so OrbitControls don't snap weirdly
        this.camera.position.set(pos.x, pos.y + 3, pos.z - 8);
      } else {
        this.cameraMode = 'chase';
      }
      this.hud.showNotification("CAMERA CHANGED", `ACTIVE VIEW: ${this.cameraMode.toUpperCase()}`);
      if (this.cameraMode === 'orbit') return; // Exit early to avoid standard camera offsets
    }

    const forward = new THREE.Vector3(0, 0, 1);
    const quat = new THREE.Quaternion(
      this.playerCar.chassisBody.quaternion.x,
      this.playerCar.chassisBody.quaternion.y,
      this.playerCar.chassisBody.quaternion.z,
      this.playerCar.chassisBody.quaternion.w
    );
    forward.applyQuaternion(quat);

    if (this.cameraMode === 'chase') {
      // Position camera behind vehicle pointing along forward velocity
      const targetCamPos = new THREE.Vector3();
      // Back vector: 6.2 meters behind, Up vector: 2.8 meters high
      // Speed-adaptive: camera pulls back a bit more at high speed
      const speed = Math.abs(this.playerCar?.currentSpeedKmh || 0);
      const pullback = 6.2 + Math.min(speed * 0.015, 3.0); // max +3m extra at 200km/h
      targetCamPos.copy(pos).addScaledVector(forward, -pullback);
      targetCamPos.y += 2.8;

      // Smooth camera translation
      this.camera.position.lerp(targetCamPos, 0.08);

      // Look-ahead target: 8m in front of chassis (from Gemini-3D-Car-Racing-Game)
      // This makes high-speed driving feel natural — you see where you're going.
      const lookAheadDist = 4.0 + Math.min(speed * 0.04, 8.0); // 4m at 0 km/h, up to 12m at 200 km/h
      const lookTarget = new THREE.Vector3().copy(pos).addScaledVector(forward, lookAheadDist);
      lookTarget.y += 0.5;
      
      this.camera.lookAt(lookTarget);
    } 
    else if (this.cameraMode === 'hood') {
      // Position inside cockpit looking straight forward
      const cockpitPos = new THREE.Vector3().copy(pos).addScaledVector(forward, 0.6);
      cockpitPos.y += 0.72; // windshield height
      this.camera.position.copy(cockpitPos);

      const lookTarget = new THREE.Vector3().copy(pos).addScaledVector(forward, 25);
      lookTarget.y += 0.4;
      this.camera.lookAt(lookTarget);
    }
  }

  /**
   * Global physics step and render loop (stable 60fps)
   */
  animate() {
    requestAnimationFrame(() => this.animate());

    // Cap delta time to prevent physics anomalies when tab is suspended
    let dt = this.clock.getDelta();
    if (dt > 0.1) dt = 0.1;

    // 1. Step Cannon-es rigid bodies
    this.physicsWorld.step(1 / 60, dt, 3);

    // 2. Poll user keyboard, gamepad and touch events
    this.inputs.update();

    // Handle ESC menu toggles
    if (this.inputs.menuToggleRequest) {
      this.inputs.menuToggleRequest = false;
      this.garage.toggleHUDMenu();
    }

    let currentZone = "MAIN CONCOURSE";
    let friction = 1.0;
    
    // 3. Update player car state
    if (this.playerCar && !this.inGarageMode) {
      const pPos = this.playerCar.chassisBody.position;
      const speed = Math.abs(this.playerCar.currentSpeedKmh);

      // Retrieve zone and terrain traction coefficients
      friction = this.map.getTerrainFrictionAt(pPos.x, pPos.z);
      currentZone = this.map.getZoneNameAt(pPos.x, pPos.z);

      // Core mechanics physics update
      this.playerCar.update(this.inputs, friction, dt);

      // Throttled debug logging once every 60 frames (~1 second)
      this.debugFrameCount++;
      if (this.debugFrameCount % 60 === 0) {
        Logger.debug("VEHICLE STATE LOG:", {
          physicsPosition: { x: pPos.x, y: pPos.y, z: pPos.z },
          visualPosition: { x: this.playerCar.visualGroup.position.x, y: this.playerCar.visualGroup.position.y, z: this.playerCar.visualGroup.position.z },
          cameraPosition: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
          velocity: { x: this.playerCar.chassisBody.velocity.x, y: this.playerCar.chassisBody.velocity.y, z: this.playerCar.chassisBody.velocity.z },
          wheelRPM: this.playerCar.rpm,
          currentGear: this.playerCar.currentGear,
          worldZone: currentZone
        });
      }

      // Distance credit accumulator: 50 credits per km (PROMPT 2)
      const dx = pPos.x - this.lastPlayerPosition.x;
      const dy = pPos.y - this.lastPlayerPosition.y;
      const dz = pPos.z - this.lastPlayerPosition.z;
      const distTraveled = Math.sqrt(dx * dx + dy * dy + dz * dz);
      this.lastPlayerPosition.copy(pPos);

      // Avoid teleport/respawn jumps adding distance credits
      if (distTraveled < 100) {
        this.distanceAccumulator += distTraveled;
        if (this.distanceAccumulator >= 100) {
          SaveManager.addCredits(5); // 5 credits per 100m (equivalent to 50 credits per km)
          this.garage.refreshUI();
          this.distanceAccumulator -= 100;
        }
      }

      // Speedway test track 10s credits accumulator (PROMPT 2)
      if (currentZone === "SPEEDWAY TEST TRACK") {
        this.speedwayTimer += dt;
        if (this.speedwayTimer >= 10.0) {
          this.speedwayTimer -= 10.0;
          SaveManager.addCredits(100);
          this.garage.refreshUI();
          this.hud.showNotification("ZONE BONUS", "+$100 Speedway track time bonus!");
        }
      } else {
        this.speedwayTimer = 0; // Reset speedway accumulator when leaving the zone
      }

      // Handle Key P weather shift (PROMPT 2)
      if (this.inputs.weatherToggleRequest) {
        this.inputs.weatherToggleRequest = false;
        const nextWeather = this.weather.activeWeather === 'clear' ? 'rain' : 'clear';
        this.setWeatherState(nextWeather);
        SaveManager.updateSetting('weather', nextWeather);
        this.hud.showNotification(
          "WEATHER CHANGED",
          `STATE: ${nextWeather.toUpperCase()}`
        );
      }

      // Dust emission check when driving off-road (slip factor > 0.1)
      if (currentZone === "MUDDY OFFROAD TRAILS") {
        // Emit from rear tires (wheel indexes 2 and 3)
        const tireLPos = this.playerCar.vehicle.wheelInfos[2].worldTransform.position;
        const tireRPos = this.playerCar.vehicle.wheelInfos[3].worldTransform.position;
        const speedVec = new THREE.Vector3(
          this.playerCar.chassisBody.velocity.x,
          this.playerCar.chassisBody.velocity.y,
          this.playerCar.chassisBody.velocity.z
        );

        this.map.offRoadZone.emitDust(
          new THREE.Vector3(tireLPos.x, tireLPos.y, tireLPos.z),
          speedVec,
          this.playerCar.slipFraction
        );
        this.map.offRoadZone.emitDust(
          new THREE.Vector3(tireRPos.x, tireRPos.y, tireRPos.z),
          speedVec,
          this.playerCar.slipFraction
        );
      }

      // Check speedway drag strip timer checkpoints
      this.map.speedZone.checkTelemetry(
        pPos,
        speed,
        (head, body, isGreen) => this.hud.showNotification(head, body, isGreen),
        (credits) => {
          SaveManager.addCredits(credits);
          this.garage.refreshUI();
        }
      );

      // Handle keyboard overrides: Respawns
      if (this.inputs.respawnRequest) {
        this.inputs.respawnRequest = false;
        // Respawn flat on central road
        this.playerCar.respawn(new THREE.Vector3(0, 0.8, 50), 0);
        this.lastPlayerPosition.copy(this.playerCar.chassisBody.position);
        this.distanceAccumulator = 0;
        this.hud.showNotification("CAR RESPAWNED", "POSITION CLEARED.");
      }

      // Handle headlights toggle override
      if (this.inputs.lightsToggleRequest) {
        this.inputs.lightsToggleRequest = false;
        this.playerCar.toggleHeadlights();
        this.hud.showNotification(
          "LIGHTS TOGGLED",
          `STATE: ${this.playerCar.headlightsOn ? 'ACTIVE' : 'OFF'}`
        );
        this.dayNight.updateHUDHeadlightIndicator(this.playerCar.headlightsOn);
      }

      // 4. Update dynamic audio synthesizers
      this.audio.setEngineRPM(this.playerCar.rpm, this.inputs.throttle, speed);
      this.audio.setScreech(this.playerCar.slipFraction);
    } 
    else {
      // In Garage Mode: Render default start scene and preview selected vehicle
      const activeCarId = this.garage.getActiveCarId();
      if (!this.garageDummyMesh || this.garageDummyMesh.name !== activeCarId) {
        if (this.garageDummyMesh) {
          this.scene.remove(this.garageDummyMesh);
        }
        this.garageDummyMesh = createProceduralCarMesh(activeCarId);
        attemptGLTFAssetLoading(activeCarId, this.garageDummyMesh);
        this.scene.add(this.garageDummyMesh);
        this.garageDummyMesh.position.set(0, 0, 0);
      }
    }

    // 5. Update NPC traffic agents and pedestrians walking
    this.traffic.update(dt, this.playerCar);
    this.pedestrians.update(dt, this.playerCar ? this.playerCar.chassisBody.position : new THREE.Vector3(), this.traffic.verticalRed);

    // 6. Update landscape animations, sun shifts, rain particle clouds
    const sysTime = performance.now() * 0.001;
    this.map.update(sysTime);
    this.dayNight.update(dt, this.playerCar);
    this.weather.update(dt, this.camera.position);

    // Update audio rain level dynamically (PROMPT 2)
    this.audio.setRainActive(this.weather.activeWeather === 'rain', this.weather.wetness);

    // 7. Orchestrate cameras
    this.updateCamera(dt);

    // 8. Update HUD overlays dashboard
    if (this.playerCar && !this.inGarageMode) {
      const activeTimer = this.map.speedZone.getTimerString();
      this.hud.update(
        this.playerCar,
        currentZone,
        SaveManager.getCredits(),
        activeTimer,
        this.traffic.vehicles
      );
    }

    // Render WebGL Viewport (either post-processing or default renderer path)
    if (this.usePostProcessing && this.postProcessing) {
      this.postProcessing.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

// Instantiate game context on load window event
window.addEventListener('load', () => {
  window.gameInstance = new GameController();
});
