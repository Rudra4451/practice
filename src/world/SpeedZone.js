/* ==========================================================================
   Apex Horizon - Speedway & Drag Strip (Timer, Speedtrap sensors)
   ========================================================================== */

import * as THREE from 'three';

export class SpeedZone {
  /**
   * @param {WorldMap} worldMap
   */
  constructor(worldMap) {
    this.map = worldMap;
    this.scene = worldMap.scene;

    // Drag strip state variables
    this.dragActive = false;
    this.dragStartTime = 0;
    this.bestDragTime = Infinity;

    // Coordinates of drag strip (Z = 500, X: 200 to 1800)
    this.dragStartBound = 200;
    this.dragEndBound = 1700;
    this.dragLineZ = 500;
  }

  build() {
    this.buildTracks();
    this.buildSignage();
  }

  /**
   * Create 3D track surfaces for drag strip and oval
   */
  buildTracks() {
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0x111115,
      roughness: 0.95,
      flatShading: true
    });
    
    const linesMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const greenLineMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
    const redLineMat = new THREE.MeshBasicMaterial({ color: 0xff003c });

    // 1. Drag Strip: Width 35m, Length 1700m (X: 100 to 1800)
    const dragGeo = new THREE.BoxGeometry(1700, 0.04, 35);
    const dragStrip = new THREE.Mesh(dragGeo, trackMat);
    dragStrip.position.set(950, 0.02, this.dragLineZ);
    this.scene.add(dragStrip);

    // Lane separators
    const lineXGeo = new THREE.BoxGeometry(1700, 0.05, 0.2);
    const lineX1 = new THREE.Mesh(lineXGeo, linesMat);
    lineX1.position.set(950, 0.025, this.dragLineZ + 8);
    this.scene.add(lineX1);

    const lineX2 = lineX1.clone();
    lineX2.position.z = this.dragLineZ - 8;
    this.scene.add(lineX2);

    // Start Line (Green)
    const startLineGeo = new THREE.BoxGeometry(0.5, 0.06, 35);
    const startLine = new THREE.Mesh(startLineGeo, greenLineMat);
    startLine.position.set(this.dragStartBound, 0.03, this.dragLineZ);
    this.scene.add(startLine);

    // Finish Line (Red checkered)
    const finishLine = new THREE.Mesh(startLineGeo, redLineMat);
    finishLine.position.set(this.dragEndBound, 0.03, this.dragLineZ);
    this.scene.add(finishLine);

    // 2. Oval Speed Ring (4 curves around outer border)
    // Outer boundaries: center at (1000, 1000)
    const ringGeo = new THREE.RingGeometry(850, 900, 48);
    ringGeo.rotateX(-Math.PI / 2); // Lay flat

    const ring = new THREE.Mesh(ringGeo, trackMat);
    ring.position.set(1000, 0.015, 1000);
    this.scene.add(ring);
  }

  /**
   * Add gates and billboards to drag strip
   */
  buildSignage() {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a3c42, roughness: 0.5 });
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x050508 });

    // Drag start gate arches
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 10, 8), frameMat);
    p1.position.set(this.dragStartBound, 5, this.dragLineZ - 18);
    this.scene.add(p1);

    const p2 = p1.clone();
    p2.position.z = this.dragLineZ + 18;
    this.scene.add(p2);

    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 36), frameMat);
    cross.position.set(this.dragStartBound, 10, this.dragLineZ);
    this.scene.add(cross);

    // Start screen
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 12), screenMat);
    screen.position.set(this.dragStartBound - 0.35, 10, this.dragLineZ);
    this.scene.add(screen);
  }

  /**
   * Check player coordinates to trigger speed traps and timer trials
   * @param {THREE.Vector3} playerPos
   * @param {number} playerSpeedKmh
   * @param {Function} notifyCallback - triggers HUD alerts
   * @param {Function} creditCallback - payout credits
   */
  checkTelemetry(playerPos, playerSpeedKmh, notifyCallback, creditCallback) {
    const x = playerPos.x;
    const z = playerPos.z;

    // Check if player is on the drag strip
    const onDragStrip = Math.abs(z - this.dragLineZ) < 18;

    if (onDragStrip) {
      // 1. Check Drag Start (passing X = 200 moving East)
      if (!this.dragActive && x > this.dragStartBound && x < this.dragStartBound + 25) {
        this.dragActive = true;
        this.dragStartTime = performance.now();
        notifyCallback("DRAG TIME TRIAL", "STARTED! SPEED TO THE CHECKERED LINE.");
      }

      // 2. Check Drag Finish (passing X = 1700 moving East)
      if (this.dragActive && x > this.dragEndBound) {
        this.dragActive = false;
        const durationSeconds = (performance.now() - this.dragStartTime) / 1000;
        
        // Payout credits based on performance
        let payout = 150;
        let performanceText = "GOOD TRY!";
        if (durationSeconds < 10) { payout = 800; performanceText = "LEGENDARY RUN!"; }
        else if (durationSeconds < 13) { payout = 500; performanceText = "ULTRA FAST!"; }
        else if (durationSeconds < 16) { payout = 300; performanceText = "GREAT RUN!"; }

        creditCallback(payout);
        notifyCallback(
          "DRAG COMPLETE", 
          `TIME: ${durationSeconds.toFixed(2)}s - ${performanceText} +$${payout} CREDITS`,
          true
        );
      }

      // 3. Speed Trap (Midpoint at X = 1000)
      if (x > 990 && x < 1010) {
        if (!this.speedTrapCooldown) {
          this.speedTrapCooldown = true;
          setTimeout(() => { this.speedTrapCooldown = false; }, 3000); // 3 seconds cooldown

          if (playerSpeedKmh > 100) {
            // Credits = speed * 1.5 rounded
            const earnings = Math.round(playerSpeedKmh * 1.5);
            creditCallback(earnings);
            notifyCallback(
              "SPEED TRAP HIT", 
              `${Math.round(playerSpeedKmh)} KM/H! EARNED +$${earnings} CREDITS`,
              true
            );
          }
        }
      }
    } else {
      // Cancel drag if we veer off the drag strip
      if (this.dragActive) {
        this.dragActive = false;
        notifyCallback("TRIAL FAILED", "LEFT THE DRAG STRIP BOUNDARY.");
      }
    }
  }

  /**
   * Return drag strip timer state if active
   */
  getTimerString() {
    if (!this.dragActive) return "00:00.00";
    const elapsed = performance.now() - this.dragStartTime;
    const minutes = Math.floor(elapsed / 60000).toString().padStart(2, '0');
    const seconds = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
    const centiseconds = Math.floor((elapsed % 1000) / 10).toString().padStart(2, '0');
    return `${minutes}:${seconds}.${centiseconds}`;
  }
}
