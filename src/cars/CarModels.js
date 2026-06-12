/* ==========================================================================
   Apex Horizon - Procedural 3D Car Model Builder & GLTF Fallbacks
   ========================================================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// Configuration details for all vehicles in the game matching PROMPT 2
export const CAR_ROSTER = {
  bmw: {
    name: "BMW M5",
    class: "SPORTS / LUXURY",
    price: 0, // Free starter car
    stats: { speed: 65, accel: 72, handling: 80, braking: 78 },
    physics: {
      mass: 1500, engineForce: 4500, brakeForce: 95, steeringLimit: 0.40,
      gripLevel: 1.4, suspensionStiffness: 30, driveType: 'RWD', powerMultiplier: 0.9
    },
    visual: { bodyColor: 0x242426, style: 'bmw', spoiler: false }
  },
  lamborghini: {
    name: "Lamborghini Huracán",
    class: "SUPERCAR",
    price: 18000,
    stats: { speed: 85, accel: 88, handling: 92, braking: 90 },
    physics: {
      mass: 1500, engineForce: 6200, brakeForce: 120, steeringLimit: 0.36,
      gripLevel: 1.6, suspensionStiffness: 30, driveType: 'AWD', powerMultiplier: 1.1
    },
    visual: { bodyColor: 0xff5500, style: 'lamborghini', spoiler: true }
  },
  ferrari: {
    name: "Ferrari SF90",
    class: "SUPERCAR",
    price: 25000,
    stats: { speed: 92, accel: 95, handling: 95, braking: 92 },
    physics: {
      mass: 1500, engineForce: 7000, brakeForce: 130, steeringLimit: 0.35,
      gripLevel: 1.7, suspensionStiffness: 30, driveType: 'AWD', powerMultiplier: 1.25
    },
    visual: { bodyColor: 0xd60000, style: 'ferrari', spoiler: false }
  },
  porsche: {
    name: "Porsche 911 GT3",
    class: "SPORTS / LUXURY",
    price: 15000,
    stats: { speed: 80, accel: 82, handling: 96, braking: 95 },
    physics: {
      mass: 1500, engineForce: 5200, brakeForce: 130, steeringLimit: 0.42,
      gripLevel: 1.8, suspensionStiffness: 30, driveType: 'RWD', powerMultiplier: 1.0
    },
    visual: { bodyColor: 0x2aff00, style: 'porsche', spoiler: true }
  },
  offroad: {
    name: "Land Rover Defender",
    class: "OFF-ROAD ADVENTURE",
    price: 9500,
    stats: { speed: 40, accel: 50, handling: 50, braking: 55 },
    physics: {
      mass: 1500, engineForce: 3800, brakeForce: 80, steeringLimit: 0.45,
      gripLevel: 1.2, suspensionStiffness: 30, driveType: 'AWD', powerMultiplier: 0.75,
      wheelRadius: 0.5, wheelWidth: 0.42
    },
    visual: { bodyColor: 0x1d301b, style: 'offroad', highClearance: true }
  },
  gemini: {
    name: "Gemini Racer",
    class: "RETRO ARCADE",
    price: 1000,
    stats: { speed: 75, accel: 80, handling: 82, braking: 78 },
    physics: {
      mass: 1500, engineForce: 4800, brakeForce: 110, steeringLimit: 0.42,
      gripLevel: 1.5, suspensionStiffness: 32, driveType: 'AWD', powerMultiplier: 1.0,
      wheelRadius: 0.5, wheelWidth: 0.6,
      chassisWidth: 1.25, chassisHeight: 0.5, chassisLength: 2.5,
      connectionX: 1.3, connectionY: -0.2, connectionZ: 1.6
    },
    visual: { bodyColor: 0xde1738, style: 'gemini', spoiler: false }
  }
};

/**
 * Procedurally build a Three.js visual group for a vehicle based on its geometry layout fallback.
 * @param {string} carId - Key in CAR_ROSTER
 */
export function createProceduralCarMesh(carId) {
  const cfg = CAR_ROSTER[carId] || CAR_ROSTER.bmw;
  const v = cfg.visual;

  const group = new THREE.Group();
  group.name = carId;

  // Materials with metalness and roughness specified in Prompt 2
  // Materials upgraded to MeshPhysicalMaterial for clearcoat showroom shine
  const isGemini = v.style === 'gemini';

  // Materials with metalness and roughness specified in Prompt 2
  // Materials upgraded to MeshPhysicalMaterial for clearcoat showroom shine (except Gemini)
  const bodyMat = isGemini ? new THREE.MeshStandardMaterial({
    color: v.bodyColor,
    roughness: 0.3,
    metalness: 0.1,
    flatShading: true
  }) : new THREE.MeshPhysicalMaterial({
    color: v.bodyColor,
    metalness: 0.9,
    roughness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 1.0,
    flatShading: true
  });
  
  const duoMat = v.duoColor !== undefined ? (isGemini ? new THREE.MeshStandardMaterial({
    color: v.duoColor,
    roughness: 0.3,
    metalness: 0.1,
    flatShading: true
  }) : new THREE.MeshPhysicalMaterial({
    color: v.duoColor,
    metalness: 0.9,
    roughness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 1.0,
    flatShading: true
  })) : bodyMat;

  const trimMat = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.8 });
  const wheelRubberMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
  const wheelRimMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.9, roughness: 0.15 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x05080c,
    roughness: 0.05,
    transmission: 0.9,
    thickness: 0.5,
    transparent: true,
    opacity: 0.7
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffe0,
    emissive: 0xffffe0,
    emissiveIntensity: 4.0
  });
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 4.0
  });

  // 1. Create Chassis Mesh Group
  const chassisGroup = new THREE.Group();
  chassisGroup.name = 'chassis';
  group.add(chassisGroup);

  // Implement styles exactly as requested in PROMPT 2
  if (v.style === 'lamborghini') {
    // Low, wide chassis (2.1w x 0.5h x 4.2l), angled windscreen, rear spoiler box
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.4, 4.2), bodyMat);
    mainBody.position.y = 0.1;
    chassisGroup.add(mainBody);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.2, 1.2), bodyMat);
    nose.position.set(0, -0.05, 1.6);
    nose.rotation.x = -0.12;
    chassisGroup.add(nose);

    // Slanted angled windshield
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 1.8), glassMat);
    cabin.position.set(0, 0.45, 0.1);
    cabin.rotation.x = -0.35;
    chassisGroup.add(cabin);

    // Rear engine cover sloping back
    const engineCover = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.28, 1.4), duoMat);
    engineCover.position.set(0, 0.3, -1.3);
    engineCover.rotation.x = 0.08;
    chassisGroup.add(engineCover);
  }
  else if (v.style === 'ferrari') {
    // Rounded front hood, mid-engine silhouette
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 4.2), bodyMat);
    mainBody.position.y = 0.1;
    chassisGroup.add(mainBody);

    // Rounded front hood: a combination of box and sphere/rounded shapes
    const frontHood = new THREE.Mesh(new THREE.SphereGeometry(1.0, 8, 8), bodyMat);
    frontHood.scale.set(1.0, 0.2, 1.5);
    frontHood.position.set(0, 0.05, 1.1);
    chassisGroup.add(frontHood);

    // Mid-engine cabin position forward
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 1.6), glassMat);
    cabin.position.set(0, 0.45, 0.3);
    cabin.rotation.x = -0.28;
    chassisGroup.add(cabin);

    // Dynamic side scoops
    const scoopL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 1.0), duoMat);
    scoopL.position.set(0.96, 0.25, -0.6);
    chassisGroup.add(scoopL);
    
    const scoopR = scoopL.clone();
    scoopR.position.x = -0.96;
    chassisGroup.add(scoopR);
  }
  else if (v.style === 'bmw') {
    // Boxy luxury, tall roofline
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.52, 4.2), bodyMat);
    mainBody.position.y = 0.15;
    chassisGroup.add(mainBody);

    // Tall boxy cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.55, 2.1), glassMat);
    cabin.position.set(0, 0.65, -0.25);
    chassisGroup.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.04, 1.5), bodyMat);
    roof.position.set(0, 0.93, -0.25);
    chassisGroup.add(roof);

    // Kidney grill front decoration
    const grill = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.06), trimMat);
    grill.position.set(0, 0.15, 2.11);
    chassisGroup.add(grill);
  }
  else if (v.style === 'porsche') {
    // Rear-engine slope, curved rear
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.44, 4.1), bodyMat);
    mainBody.position.y = 0.12;
    chassisGroup.add(mainBody);

    // Rounded sloping front nose
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.25, 1.0), bodyMat);
    nose.position.set(0, 0.02, 1.55);
    nose.rotation.x = -0.16;
    chassisGroup.add(nose);

    // Rear sloping canopy
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 1.9), glassMat);
    cabin.position.set(0, 0.5, -0.2);
    cabin.rotation.x = -0.18; // Slope backward
    chassisGroup.add(cabin);

    // Curved rear deck spoiler
    const rearDeck = new THREE.Mesh(new THREE.SphereGeometry(0.95, 8, 8), bodyMat);
    rearDeck.scale.set(1.0, 0.25, 1.0);
    rearDeck.position.set(0, 0.2, -1.55);
    chassisGroup.add(rearDeck);
  }
  else if (v.style === 'offroad') {
    // High clearance box SUV, large wheel radius (0.5), roof rack bar
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.85, 4.0), bodyMat);
    mainBody.position.y = 0.45; // High clearance
    chassisGroup.add(mainBody);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.65, 2.6), glassMat);
    cabin.position.set(0, 1.1, -0.5);
    chassisGroup.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.05, 2.5), bodyMat);
    roof.position.set(0, 1.43, -0.5);
    chassisGroup.add(roof);

    // Roof rack bar
    const rackFrame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 2.2), trimMat);
    rackFrame.position.set(0, 1.5, -0.5);
    chassisGroup.add(rackFrame);
  }
  else if (v.style === 'gemini') {
    // Retro-arcade chunky chassis matching reference body BoxGeometry(2.5, 1, 5) scaled
    // width 2.0, height 0.8, length 4.0
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 4.0), bodyMat);
    mainBody.position.y = 0.3;
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    chassisGroup.add(mainBody);

    // Glass cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.64, 2.0), glassMat);
    cabin.position.set(0, 1.02, -0.4);
    cabin.castShadow = true;
    chassisGroup.add(cabin);

    // Body-colored roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 1.8), bodyMat);
    roof.position.set(0, 1.34, -0.4);
    roof.castShadow = true;
    chassisGroup.add(roof);

    // Slanted windshield glass panel
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.05), glassMat);
    windshield.position.set(0, 1.02, 0.62);
    windshield.rotation.x = -0.25;
    chassisGroup.add(windshield);
  }

  // 2. Headlights and brake lights
  const headlightGeo = new THREE.BoxGeometry(0.25, 0.1, 0.1);
  const tailLightGeo = new THREE.BoxGeometry(0.3, 0.08, 0.1);

  const lHead = new THREE.Mesh(headlightGeo, headlightMat);
  lHead.position.set(
    v.style === 'lamborghini' ? 0.82 : (v.style === 'gemini' ? 0.7 : 0.7),
    v.style === 'gemini' ? 0.3 : 0.12,
    v.style === 'gemini' ? 2.02 : 2.08
  );
  chassisGroup.add(lHead);

  const rHead = lHead.clone();
  rHead.position.x *= -1;
  chassisGroup.add(rHead);

  const lTail = new THREE.Mesh(tailLightGeo, brakeLightMat);
  lTail.position.set(
    v.style === 'lamborghini' ? 0.85 : (v.style === 'gemini' ? 0.7 : 0.7),
    v.style === 'gemini' ? 0.3 : 0.2,
    v.style === 'gemini' ? -2.02 : -2.08
  );
  chassisGroup.add(lTail);

  const rTail = lTail.clone();
  rTail.position.x *= -1;
  chassisGroup.add(rTail);

  // 3. Add Spoiler (Lamborghini / Porsche)
  if (v.spoiler) {
    const spoiler = new THREE.Group();
    spoiler.position.set(0, v.style === 'lamborghini' ? 0.4 : 0.45, -1.9);

    const strutGeo = new THREE.BoxGeometry(0.05, 0.3, 0.1);
    const strutL = new THREE.Mesh(strutGeo, trimMat);
    strutL.position.x = 0.75;
    spoiler.add(strutL);

    const strutR = strutL.clone();
    strutR.position.x = -0.75;
    spoiler.add(strutR);

    // Box spoiler blade
    const blade = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.35), duoMat);
    blade.position.y = 0.15;
    spoiler.add(blade);

    chassisGroup.add(spoiler);
  }

  // 4. Build Wheel Meshes
  const names = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'];
  
  // Custom wheels size based on configuration specs
  const radius = cfg.physics.wheelRadius !== undefined ? cfg.physics.wheelRadius : (v.highClearance ? 0.5 : 0.35);
  const width = cfg.physics.wheelWidth !== undefined ? cfg.physics.wheelWidth : (v.highClearance ? 0.42 : 0.32);

  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 16);
  tireGeo.rotateZ(Math.PI / 2);

  const rimGeo = new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.02, 12);
  rimGeo.rotateZ(Math.PI / 2);

  const spokeGeo = new THREE.BoxGeometry(0.04, radius * 1.15, radius * 1.15);

  for (let i = 0; i < 4; i++) {
    const wheelGroup = new THREE.Group();
    wheelGroup.name = names[i];

    const tire = new THREE.Mesh(tireGeo, wheelRubberMat);
    wheelGroup.add(tire);

    const rims = new THREE.Mesh(rimGeo, wheelRimMat);
    wheelGroup.add(rims);

    const spokes = new THREE.Mesh(spokeGeo, trimMat);
    wheelGroup.add(spokes);

    group.add(wheelGroup);
  }

  return group;
}

/**
 * Hook to automatically load .glb models if they exist in assets directory.
 * When loaded, extracts wheel nodes from the GLTF scene, classifies them into
 * FL/FR/RL/RR, adds them to the visualGroup, and updates carInstance.wheelMeshes
 * so the physics engine spins and steers them in real-time.
 * @param {string} carId - Vehicle Roster ID
 * @param {THREE.Group} visualGroup - Three.js group containing the vehicle visual elements
 */
export function attemptGLTFAssetLoading(carId, visualGroup) {
  if (carId === 'gemini') {
    console.log(`[CarModels] Bypassing GLTF asset load for retro procedural car: ${carId}`);
    return;
  }
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  loader.setDRACOLoader(draco);

  const path = `/assets/models/${carId}.glb`;

  // Per-model alignment config: normalize the car body length along Z axis.
  const modelConfigs = {
    bmw:         { targetLength: 4.4, rotY: 0,           yOffset: -0.15 },
    ferrari:     { targetLength: 4.4, rotY: Math.PI,     yOffset: -0.18 },
    lamborghini: { targetLength: 4.4, rotY: 0,           yOffset: -0.15 },
    porsche:     { targetLength: 4.3, rotY: 0,           yOffset: -0.15 },
    offroad:     { targetLength: 4.5, rotY: 0,           yOffset: -0.05 }
  };

  fetch(path, { method: 'HEAD' })
    .then(res => {
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && !contentType.includes('text/html')) {
        loader.load(path, (gltf) => {
          console.log(`[CarModels] GLTF loaded for ${carId}, extracting wheels...`);

          const model = gltf.scene;

          // ── Step 1: Detect candidate wheel nodes ─────────────────────────
          // Strategy A: name-based matching (Ferrari has wheel_fl/fr/rl/rr)
          const wheelByName = [];

          model.traverse(child => {
            if (!child.isMesh && !child.isGroup) return;
            const name = child.name.toLowerCase();
            const isWheelName = (
              name.includes('wheel') ||
              name.includes('tire') ||
              name.includes('tyre') ||
              name.includes('rim')  ||
              name.includes('disc') ||
              name.includes('roue') ||
              name.includes('brake') // Lamborghini has BrakeFrLeft_ etc
            );
            if (isWheelName) wheelByName.push(child);
          });

          // Deduplicate: if a child and its ancestor are both collected, keep ancestor
          const deduped = wheelByName.filter(node => {
            let p = node.parent;
            while (p) {
              if (wheelByName.includes(p)) return false;
              p = p.parent;
            }
            return true;
          });

          let wheelCandidates = deduped;

          // Strategy B: position-based fallback when name detection fails
          // (BMW has 1 group "WHeelsandrims", Porsche has no wheel names)
          if (wheelCandidates.length < 4) {
            // Collect all leaf meshes and rank by distance from model centre
            const allMeshes = [];
            model.updateMatrixWorld(true);
            model.traverse(child => {
              if (child.isMesh) {
                const worldPos = new THREE.Vector3();
                child.getWorldPosition(worldPos);
                allMeshes.push({ node: child, worldPos });
              }
            });

            // Centre of the model bounding box
            const modelBox = new THREE.Box3().setFromObject(model);
            const modelCenter = new THREE.Vector3();
            modelBox.getCenter(modelCenter);

            // Sort by horizontal distance from center
            allMeshes.sort((a, b) => {
              const da = new THREE.Vector2(a.worldPos.x - modelCenter.x, a.worldPos.z - modelCenter.z).length();
              const db = new THREE.Vector2(b.worldPos.x - modelCenter.x, b.worldPos.z - modelCenter.z).length();
              return db - da; // furthest first
            });

            // The 8 furthest meshes are likely wheels; group into 4 clusters by position
            const outerMeshes = allMeshes.slice(0, Math.min(24, allMeshes.length));

            // K-means style: pick the 4 outermost as seeds, then group remaining by nearest seed
            const seeds = [
              outerMeshes[0],
              outerMeshes.find(m => {
                const d = m.worldPos.distanceTo(outerMeshes[0].worldPos);
                return d > 0.5;
              }) || outerMeshes[1],
            ];
            // Add two more opposite seeds
            if (seeds[1]) {
              seeds.push(outerMeshes.find(m =>
                !seeds.includes(m) &&
                m.worldPos.distanceTo(seeds[0].worldPos) > 0.5 &&
                m.worldPos.distanceTo(seeds[1].worldPos) > 0.5
              ) || outerMeshes[2]);
            }
            if (seeds[2]) {
              seeds.push(outerMeshes.find(m =>
                !seeds.includes(m) &&
                seeds.every(s => m.worldPos.distanceTo(s.worldPos) > 0.5)
              ) || outerMeshes[3]);
            }

            if (seeds.filter(Boolean).length >= 4) {
              // Build groups: each outer mesh belongs to the nearest seed
              const groups = seeds.filter(Boolean).map(s => ({ seed: s, members: [s.node] }));
              outerMeshes.forEach(m => {
                if (seeds.includes(m)) return;
                let bestGroup = groups[0];
                let bestDist = m.worldPos.distanceTo(groups[0].seed.worldPos);
                groups.forEach(g => {
                  const d = m.worldPos.distanceTo(g.seed.worldPos);
                  if (d < bestDist) { bestDist = d; bestGroup = g; }
                });
                bestGroup.members.push(m.node);
              });

              // Create group objects to mimic the named approach
              wheelCandidates = groups.map((g, idx) => {
                const grp = new THREE.Group();
                grp.name = `auto_wheel_${idx}`;
                g.members.forEach(m => grp.add(m));
                return grp;
              });
              console.log(`[CarModels] Positional wheel detection found ${wheelCandidates.length} wheel groups for ${carId}`);
            }
          }

          // ── Step 2: Scale & align the body model ─────────────────────────
          const cfg = modelConfigs[carId] || { targetLength: 4.4, rotY: 0, yOffset: -0.1 };

          const bodyScene = gltf.scene.clone();

          // Remove wheel candidates from the clone so body-only bounding box is correct
          bodyScene.traverse(child => {
            const name = child.name.toLowerCase();
            if (
              name.includes('wheel') || name.includes('tire') ||
              name.includes('tyre') || name.includes('rim')  ||
              name.includes('disc') || name.includes('roue')
            ) {
              if (child.parent) child.parent.remove(child);
            }
          });

          const bodyBox  = new THREE.Box3().setFromObject(bodyScene);
          const bodySize = new THREE.Vector3();
          bodyBox.getSize(bodySize);

          let scaleFactor = cfg.targetLength / (bodySize.z || 1);
          let extraRotation = cfg.rotY;

          if (bodySize.x > bodySize.z * 1.2) {
            scaleFactor    = cfg.targetLength / bodySize.x;
            extraRotation += Math.PI / 2;
          }

          model.scale.setScalar(scaleFactor);
          if (extraRotation !== 0) model.rotateY(extraRotation);

          // Re-center after scaling
          const newBox    = new THREE.Box3().setFromObject(model);
          const newCenter = new THREE.Vector3();
          newBox.getCenter(newCenter);
          model.position.set(-newCenter.x, -newBox.min.y + cfg.yOffset, -newCenter.z);

          // Force matrix update so worldToLocal is accurate below
          model.updateMatrixWorld(true);

          // ── Step 3: Remove procedural chassis, add GLTF body wrapper ──────
          const proceduralChassis = visualGroup.getObjectByName('chassis');
          if (proceduralChassis) visualGroup.remove(proceduralChassis);

          // Enable shadows on all body meshes
          model.traverse(child => {
            if (child.isMesh) {
              child.castShadow    = true;
              child.receiveShadow = true;
              if (child.material) child.material.envMapIntensity = 1.0;
            }
          });

          const wrapper = new THREE.Group();
          wrapper.name  = 'chassis';
          wrapper.add(model);
          visualGroup.add(wrapper);

          // ── Step 4: Extract wheel nodes from the ORIGINAL (uncloned) scene ─
          if (wheelCandidates.length >= 4) {
            // Convert each candidate's world position into visualGroup local space
            // so we can classify front/rear and left/right.
            const wheelData = wheelCandidates.map(node => {
              const worldPos = new THREE.Vector3();
              node.getWorldPosition(worldPos);

              // Transform into visualGroup space
              const localPos = visualGroup.worldToLocal(worldPos.clone());
              return { node, localPos };
            });

            // Sort by Z descending → front (positive Z) first
            wheelData.sort((a, b) => b.localPos.z - a.localPos.z);

            // The two front-most and two rear-most
            const frontPair = wheelData.slice(0, 2);
            const rearPair  = wheelData.slice(-2);

            // Within each pair, sort by X: positive X = left, negative X = right
            frontPair.sort((a, b) => b.localPos.x - a.localPos.x);
            rearPair .sort((a, b) => b.localPos.x - a.localPos.x);

            // Map to named slots
            const namedWheels = [
              { name: 'wheel_fl', data: frontPair[0] },
              { name: 'wheel_fr', data: frontPair[1] },
              { name: 'wheel_rl', data: rearPair[0]  },
              { name: 'wheel_rr', data: rearPair[1]  }
            ];

            const extractedMeshes = [];

            namedWheels.forEach(({ name, data }) => {
              if (!data) return;

              const wheelNode = data.node;

              // Detach from current parent while preserving world transform
              const worldPos  = new THREE.Vector3();
              const worldQuat = new THREE.Quaternion();
              const worldScl  = new THREE.Vector3();
              wheelNode.getWorldPosition(worldPos);
              wheelNode.getWorldQuaternion(worldQuat);
              wheelNode.getWorldScale(worldScl);

              if (wheelNode.parent) wheelNode.parent.remove(wheelNode);

              // Re-parent to visualGroup
              wheelNode.name = name;
              wheelNode.position.copy(visualGroup.worldToLocal(worldPos));
              // Scale: the node already has the model's scale baked in via getWorldScale
              wheelNode.scale.copy(worldScl);
              // Reset rotation – physics will drive it each frame
              wheelNode.quaternion.identity();

              wheelNode.traverse(child => {
                if (child.isMesh) {
                  child.castShadow    = true;
                  child.receiveShadow = true;
                }
              });

              visualGroup.add(wheelNode);
              extractedMeshes.push(wheelNode);

              console.log(`[CarModels] Registered ${name} at local:`, data.localPos);
            });

            // ── Step 5: Hide procedural wheels and update carInstance ──────
            ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].forEach(wName => {
              const proc = visualGroup.getObjectByName(wName);
              // Only hide if it's NOT one we just added (check type mismatch)
              if (proc && !extractedMeshes.includes(proc)) {
                proc.visible = false;
              }
            });

            // Hook into the live CarBase instance so physics drives these wheels
            if (visualGroup.carInstance && extractedMeshes.length === 4) {
              visualGroup.carInstance.wheelMeshes = extractedMeshes;
              console.log(`[CarModels] Live wheelMeshes updated for ${carId}`);
            }
          } else {
            // No recognisable wheel nodes – hide procedural ones to avoid z-fighting
            // with the GLTF body, but keep them for physics alignment reference.
            console.warn(`[CarModels] Could not find 4 wheel nodes in ${carId} GLTF (found ${wheelCandidates.length}). Keeping procedural wheels.`);
          }
        }, undefined, (err) => {
          console.warn(`[CarModels] Failed to parse GLTF at ${path}. Using procedural fallback.`, err);
        });
      }
    })
    .catch(() => {
      // Quiet fail – procedural model remains
    });
}


/**
 * Procedurally build a simplified visual mesh group for an NPC traffic vehicle.
 * @param {string} type - 'sedan', 'taxi', 'police', 'bus'
 */
export function createNPCCarMesh(type) {
  const group = new THREE.Group();
  group.name = `npc_${type}`;

  const bodyColorMap = {
    sedan: 0x556677, // greyish
    taxi: 0xffcc00,  // yellow
    police: 0x111111, // black
    bus: 0xcc4411    // red-orange
  };

  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColorMap[type] || 0x556677,
    roughness: 0.3,
    metalness: 0.5,
    flatShading: true
  });

  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x223344,
    roughness: 0.1,
    transparent: true,
    opacity: 0.8
  });

  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfffef0 });
  const brakeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

  const chassis = new THREE.Group();
  chassis.name = 'chassis';
  group.add(chassis);

  if (type === 'bus') {
    // Bus dimensions: 2.3w x 1.7h x 7.5l
    const bodyGeo = new THREE.BoxGeometry(2.2, 1.5, 7.3);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.8;
    chassis.add(bodyMesh);

    // Windshield
    const frontWindshield = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.7, 0.1), windowMat);
    frontWindshield.position.set(0, 1.1, 3.61);
    chassis.add(frontWindshield);

    const backWindshield = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.7, 0.1), windowMat);
    backWindshield.position.set(0, 1.1, -3.61);
    chassis.add(backWindshield);

    // Side windows bands
    const sideWindowL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 6.0), windowMat);
    sideWindowL.position.set(1.11, 1.1, 0);
    chassis.add(sideWindowL);

    const sideWindowR = sideWindowL.clone();
    sideWindowR.position.x = -1.11;
    chassis.add(sideWindowR);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 8);
    wheelGeo.rotateZ(Math.PI / 2);

    const wheelPositions = [
      new THREE.Vector3(1.0, 0.2, 2.5),
      new THREE.Vector3(-1.0, 0.2, 2.5),
      new THREE.Vector3(1.0, 0.2, -1.8),
      new THREE.Vector3(-1.0, 0.2, -1.8),
      new THREE.Vector3(1.0, 0.2, -2.6),
      new THREE.Vector3(-1.0, 0.2, -2.6)
    ];

    wheelPositions.forEach((pos, idx) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.copy(pos);
      wheel.name = `wheel_${idx}`;
      group.add(wheel);
    });

  } else {
    // Normal cars
    const bodyGeo = new THREE.BoxGeometry(1.7, 0.45, 4.1);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.25;
    chassis.add(bodyMesh);

    const cabinGeo = new THREE.BoxGeometry(1.4, 0.4, 2.0);
    const cabinMesh = new THREE.Mesh(cabinGeo, windowMat);
    cabinMesh.position.set(0, 0.6, -0.2);
    chassis.add(cabinMesh);

    const roofGeo = new THREE.BoxGeometry(1.36, 0.05, 1.4);
    const roofMesh = new THREE.Mesh(roofGeo, bodyMat);
    roofMesh.position.set(0, 0.8, -0.2);
    chassis.add(roofMesh);

    if (type === 'taxi') {
      const signGeo = new THREE.BoxGeometry(0.3, 0.15, 0.6);
      const signMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(0, 0.9, -0.2);
      chassis.add(sign);
    } else if (type === 'police') {
      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.3 });
      
      const panelL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 1.6), whiteMat);
      panelL.position.set(0.86, 0.25, -0.1);
      chassis.add(panelL);

      const panelR = panelL.clone();
      panelR.position.x = -0.86;
      chassis.add(panelR);

      const barGeo = new THREE.BoxGeometry(0.8, 0.1, 0.15);
      const barMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(0, 0.85, -0.2);
      chassis.add(bar);

      const sirenL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.12), new THREE.MeshBasicMaterial({ color: 0x0022ff }));
      sirenL.position.set(0.2, 0.92, -0.2);
      chassis.add(sirenL);

      const sirenR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.12), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      sirenR.position.set(-0.2, 0.92, -0.2);
      chassis.add(sirenR);
    }

    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.05), lightMat);
    headL.position.set(0.65, 0.25, 2.06);
    chassis.add(headL);

    const headR = headL.clone();
    headR.position.x = -0.65;
    chassis.add(headR);

    const brakeL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.05), brakeMat);
    brakeL.position.set(0.65, 0.3, -2.06);
    chassis.add(brakeL);

    const brakeR = brakeL.clone();
    brakeR.position.x = -0.65;
    chassis.add(brakeR);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 8);
    wheelGeo.rotateZ(Math.PI / 2);

    const wheelPositions = [
      new THREE.Vector3(0.85, 0.15, 1.35),
      new THREE.Vector3(-0.85, 0.15, 1.35),
      new THREE.Vector3(0.85, 0.15, -1.35),
      new THREE.Vector3(-0.85, 0.15, -1.35)
    ];

    const names = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'];
    wheelPositions.forEach((pos, idx) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.copy(pos);
      wheel.name = names[idx];
      group.add(wheel);
    });
  }

  return group;
}
