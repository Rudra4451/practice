/* ==========================================================================
   RaceCircuit.js — CatmullRom Spline Race Track
   Adapted from Gemini-3D-Car-Racing-Game (wayneeffect/Gemini-3D-Car-Racing-Game)
   ========================================================================== */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ── Track Waypoints (large oval circuit with chicanes) ─────────────────────
// Matches the spirit of the reference repo's CatmullRomCurve track design
const TRACK_WAYPOINTS = [
  new THREE.Vector3(  0,   0,  600),   // Start / Finish
  new THREE.Vector3( 200,  0,  540),
  new THREE.Vector3( 480,  0,  380),
  new THREE.Vector3( 580,  0,  100),
  new THREE.Vector3( 520,  0, -200),
  new THREE.Vector3( 350,  0, -450),
  new THREE.Vector3(  80,  0, -600),
  new THREE.Vector3(-200,  0, -580),
  new THREE.Vector3(-460,  0, -420),
  new THREE.Vector3(-580,  0, -150),
  new THREE.Vector3(-520,  0,  150),
  new THREE.Vector3(-350,  0,  430),
  new THREE.Vector3(-140,  0,  570),
];

const TRACK_WIDTH      = 14;    // Road width in meters
const BARRIER_HEIGHT   = 1.2;   // Armco guard rail height
const BARRIER_WIDTH    = 0.5;
const TRACK_SEGMENTS   = 400;   // Curve tessellation quality

export class RaceCircuit {
  /**
   * @param {CANNON.World} physicsWorld
   * @param {THREE.Scene}  scene
   */
  constructor(physicsWorld, scene) {
    this.physicsWorld = physicsWorld;
    this.scene = scene;

    // Build the closed spline
    this.curve = new THREE.CatmullRomCurve3(TRACK_WAYPOINTS, true, 'catmullrom', 0.5);
    this._barrierBodies = [];

    this._buildRoad();
    this._buildStartFinishLine();
    this._buildBarriers();
    this._buildScenery();
  }

  // ── 1. Road Mesh ──────────────────────────────────────────────────────────
  _buildRoad() {
    // TubeGeometry around the spline, then flattened on Y just like the reference repo
    const tubeGeo = new THREE.TubeGeometry(this.curve, TRACK_SEGMENTS, TRACK_WIDTH / 2, 6, true);

    // Apply road-flat scale: scale Y very small so the tube becomes a flat ribbon
    tubeGeo.applyMatrix4(new THREE.Matrix4().makeScale(1, 0.04, 1));

    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x333333,      // dark tarmac
      roughness: 0.9,
      metalness: 0.0,
    });

    this.roadMesh = new THREE.Mesh(tubeGeo, roadMat);
    this.roadMesh.receiveShadow = true;
    this.roadMesh.name = 'racetrack_road';
    this.scene.add(this.roadMesh);

    // White dashed centreline using a second, thinner tube
    const centerGeo = new THREE.TubeGeometry(this.curve, TRACK_SEGMENTS, 0.25, 4, true);
    centerGeo.applyMatrix4(new THREE.Matrix4().makeScale(1, 0.045, 1));
    const centerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const centerMesh = new THREE.Mesh(centerGeo, centerMat);
    centerMesh.name = 'racetrack_centerline';
    this.scene.add(centerMesh);
  }

  // ── 2. Start / Finish Line ────────────────────────────────────────────────
  _buildStartFinishLine() {
    // Chequered start/finish plane across track width
    const sfGeo = new THREE.PlaneGeometry(TRACK_WIDTH + 2, 4, 10, 2);
    sfGeo.rotateX(-Math.PI / 2);

    // Create procedural chequered texture via canvas
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const sqW = 16;
    for (let x = 0; x < 8; x++) {
      const col = x % 2 === 0 ? '#000000' : '#ffffff';
      ctx.fillStyle = col;
      ctx.fillRect(x * sqW, 0, sqW, 16);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;

    const sfMat = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.8, side: THREE.DoubleSide
    });

    const sfMesh = new THREE.Mesh(sfGeo, sfMat);
    // Place at track start point (t=0)
    const startPoint = this.curve.getPoint(0);
    sfMesh.position.set(startPoint.x, 0.05, startPoint.z);
    // Rotate to match track tangent direction
    const tangent = this.curve.getTangent(0);
    sfMesh.rotation.y = Math.atan2(tangent.x, tangent.z);
    sfMesh.name = 'racetrack_startline';
    this.scene.add(sfMesh);
  }

  // ── 3. Guard Rail Barriers ────────────────────────────────────────────────
  _buildBarriers() {
    const innerMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6 }); // Red inner
    const outerMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 }); // White outer

    const barrierGeo = new THREE.BoxGeometry(BARRIER_WIDTH, BARRIER_HEIGHT, 4.5);
    const steps = 300; // number of barrier segments

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const tNext = (i + 1) / steps;

      const pt       = this.curve.getPoint(t);
      const tangent  = this.curve.getTangent(t);

      // Perpendicular direction (right side of road)
      const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      // Inner barrier (left of road)
      const innerPos = pt.clone().addScaledVector(right, -(TRACK_WIDTH / 2 + 1));
      innerPos.y = BARRIER_HEIGHT / 2;
      const innerMesh = new THREE.Mesh(barrierGeo, innerMat);
      innerMesh.position.copy(innerPos);
      innerMesh.lookAt(innerPos.clone().add(tangent));
      innerMesh.castShadow = true;
      this.scene.add(innerMesh);

      // Outer barrier (right of road)
      const outerPos = pt.clone().addScaledVector(right, TRACK_WIDTH / 2 + 1);
      outerPos.y = BARRIER_HEIGHT / 2;
      const outerMesh = new THREE.Mesh(barrierGeo, outerMat);
      outerMesh.position.copy(outerPos);
      outerMesh.lookAt(outerPos.clone().add(tangent));
      outerMesh.castShadow = true;
      this.scene.add(outerMesh);

      // Physics barriers (Cannon-es static boxes) every 8th segment for performance
      if (i % 8 === 0) {
        [innerPos, outerPos].forEach(wallPos => {
          const shape = new CANNON.Box(new CANNON.Vec3(BARRIER_WIDTH / 2, BARRIER_HEIGHT / 2, 4.5 * 4));
          const body  = new CANNON.Body({ mass: 0 });
          body.addShape(shape);
          body.position.set(wallPos.x, wallPos.y, wallPos.z);
          // Align physics body to track tangent
          const angle = Math.atan2(tangent.x, tangent.z);
          body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
          this.physicsWorld.addBody(body);
          this._barrierBodies.push(body);
        });
      }
    }
  }

  // ── 4. Trackside Scenery (pine trees, reference repo style) ────────────────
  _buildScenery() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5E3C });
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2d7a2d });

    // Sample 80 points along the track and plant trees outside barriers
    for (let i = 0; i < 80; i++) {
      const t = i / 80;
      const pt = this.curve.getPoint(t);
      const tangent = this.curve.getTangent(t);
      const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      // Alternate left / right every 2 trees
      const side = (i % 2 === 0) ? 1 : -1;
      // Random scatter: 4–10m outside the barrier
      const offset = TRACK_WIDTH / 2 + BARRIER_WIDTH + 4 + Math.random() * 8;
      const treePos = pt.clone().addScaledVector(right, side * offset);
      treePos.y = 0;

      // Tree trunk
      const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 2, 6);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(treePos.x, 1, treePos.z);
      trunk.castShadow = true;

      // Foliage cone — exactly as in the Gemini-3D-Car-Racing-Game reference
      const coneH   = 3 + Math.random() * 4;
      const coneGeo = new THREE.ConeGeometry(1.5 + Math.random() * 0.8, coneH, 7);
      const cone    = new THREE.Mesh(coneGeo, leavesMat);
      cone.position.set(treePos.x, 2 + coneH / 2, treePos.z);
      cone.castShadow = true;

      this.scene.add(trunk);
      this.scene.add(cone);
    }

    // Sponsor sign poles at start/finish
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 5, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const signGeo = new THREE.BoxGeometry(10, 2, 0.2);
    const signMat = new THREE.MeshStandardMaterial({ color: 0xff2244 });

    const startPoint = this.curve.getPoint(0);
    const tangent    = this.curve.getTangent(0);
    const right      = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    [-1, 1].forEach(side => {
      const polePos = startPoint.clone().addScaledVector(right, side * (TRACK_WIDTH / 2 + 3));
      const pole    = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(polePos.x, 2.5, polePos.z);
      this.scene.add(pole);
    });

    // Overhead banner
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(startPoint.x, 5, startPoint.z);
    sign.rotation.y = Math.atan2(tangent.x, tangent.z);
    this.scene.add(sign);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Returns the CatmullRomCurve3 for NPC path following
   * @returns {THREE.CatmullRomCurve3}
   */
  getTrackCurve() {
    return this.curve;
  }

  /**
   * Get the world-space start position for the player spawn
   * @returns {THREE.Vector3}
   */
  getStartPosition() {
    return this.curve.getPoint(0).clone().setY(1.5);
  }

  /**
   * Returns start tangent angle in radians for car facing direction
   * @returns {number}
   */
  getStartAngle() {
    const tangent = this.curve.getTangent(0);
    return Math.atan2(tangent.x, tangent.z);
  }

  /**
   * Zone name for HUD display
   */
  get zoneName() {
    return 'APEX RACE CIRCUIT';
  }

  /**
   * Clean up scene objects (call when switching zones)
   */
  dispose() {
    this._barrierBodies.forEach(b => this.physicsWorld.removeBody(b));
    this._barrierBodies = [];
  }
}
