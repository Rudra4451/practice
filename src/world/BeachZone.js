/* ==========================================================================
   Apex Horizon - Ocean & Beach Zone (Sand Dunes, Water Shader, Palms)
   ========================================================================== */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class BeachZone {
  /**
   * @param {WorldMap} worldMap
   */
  constructor(worldMap) {
    this.map = worldMap;
    this.scene = worldMap.scene;
    this.world = worldMap.world;
    
    // Shader uniforms
    this.waterUniforms = {
      uTime: { value: 0 },
      uWaterColor: { value: new THREE.Color(0x00a2ff) },
      uDeepColor: { value: new THREE.Color(0x003366) }
    };
  }

  build() {
    this.buildSandDunes();
    this.buildWaterShaderPlane();
    this.spawnPalmTrees();
  }

  /**
   * Create sand dune terrain by perturbing vertices of a PlaneGeometry
   */
  buildSandDunes() {
    // Sand Plane Geometry: Width 1900, Height 1900
    // Quadrant boundaries: X: 100 to 2000, Z: -2000 to -100
    const segs = 40;
    const sandGeo = new THREE.PlaneGeometry(1900, 1900, segs, segs);
    sandGeo.rotateX(-Math.PI / 2); // Lay flat

    const pos = sandGeo.attributes.position;
    
    // Height generator equation
    const getDuneHeight = (x, z) => {
      // Combination of sines to create dune ridges
      const duneVal1 = Math.sin(x * 0.012) * Math.cos(z * 0.012) * 5;
      const duneVal2 = Math.cos(x * 0.03) * Math.sin(z * 0.03) * 1.5;
      
      // Let it slope down towards the sea at X > 1300
      let baseHeight = duneVal1 + duneVal2;
      if (x > 1200) {
        const seaSlope = (x - 1200) / 700; // 0 to 1
        baseHeight = THREE.MathUtils.lerp(baseHeight, -3, seaSlope);
      }
      return baseHeight;
    };

    // Perturb vertices
    for (let i = 0; i < pos.count; i++) {
      // Map vertex coordinates (global placement is centered at X: 1050, Z: -1050)
      const vx = pos.getX(i) + 1050;
      const vz = pos.getZ(i) - 1050; // pos.getZ maps to global Z coordinate
      
      const height = getDuneHeight(vx, vz);
      pos.setY(i, height); // Y is height
    }

    sandGeo.computeVertexNormals();

    const sandMat = new THREE.MeshStandardMaterial({
      color: 0xe0ca94, // Golden sand
      roughness: 0.9,
      flatShading: true
    });

    const sandMesh = new THREE.Mesh(sandGeo, sandMat);
    sandMesh.position.set(1050, 0, -1050);
    this.scene.add(sandMesh);

    // Create heightfield collision body for Cannon-es physics
    // For simplicity and high FPS, we build local bounding slopes or grid samples
    // Here we sample height values to populate a grid of static boxes or heightfield,
    // but a simplified grid collider is much faster in Javascript.
    // Let's create static boxes for the highest dune ridges so the car handles the jumps.
    // Finer 80m grid gives smooth slope approximation so the car drives over dunes.
    for (let x = 300; x < 1500; x += 80) {
      for (let z = -1700; z < -300; z += 80) {
        const height = getDuneHeight(x, z);
        if (height > 1.0) {
          const hillShape = new CANNON.Box(new CANNON.Vec3(40, 1.0, 40));
          const hillBody = new CANNON.Body({ mass: 0 });
          hillBody.addShape(hillShape);
          hillBody.position.set(x, height - 1.0, z);
          this.world.addBody(hillBody);
        }
      }
    }
  }

  /**
   * Custom water shader using GLSL vertex/fragment code
   */
  buildWaterShaderPlane() {
    const waterGeo = new THREE.PlaneGeometry(1200, 1200, 64, 64);
    waterGeo.rotateX(-Math.PI / 2);

    const waterVertexShader = `
      uniform float uTime;
      varying vec2 vUv;
      varying float vHeight;

      void main() {
        vUv = uv;
        vec4 modelPosition = modelMatrix * vec4(position, 1.0);
        
        // Dynamic wave offsets
        float elevation = sin(modelPosition.x * 0.05 + uTime * 2.0) *
                          cos(modelPosition.z * 0.05 + uTime * 1.5) * 0.4;
        
        // Layer a second high-frequency ripple
        elevation += sin(modelPosition.x * 0.15 - uTime * 3.0) * 0.15;
        
        modelPosition.y += elevation - 1.2; // Sea level is at Y = -1.2
        vHeight = elevation;

        vec4 viewPosition = viewMatrix * modelPosition;
        vec4 projectedPosition = projectionMatrix * viewPosition;
        gl_Position = projectedPosition;
      }
    `;

    const waterFragmentShader = `
      uniform vec3 uWaterColor;
      uniform vec3 uDeepColor;
      varying vec2 vUv;
      varying float vHeight;

      void main() {
        // Blend colors based on wave elevation height
        float mixVal = (vHeight + 0.55); // Normalize to 0-1 approx
        vec3 finalColor = mix(uDeepColor, uWaterColor, mixVal);
        
        // Add glassy reflection specular highlight
        gl_FragColor = vec4(finalColor, 0.85);
      }
    `;

    const waterMat = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: this.waterUniforms,
      transparent: true,
      depthWrite: true
    });

    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(1500, 0, -1500); // Southeastern corner
    this.scene.add(waterMesh);
  }

  /**
   * Spawns palm tree meshes with physics colliders
   */
  spawnPalmTrees() {
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.3, 5, 6);
    const leafGeo = new THREE.BoxGeometry(2, 0.05, 0.6);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.8 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x247a3d, roughness: 0.7 });

    const createPalm = (x, z) => {
      const palmGroup = new THREE.Group();
      palmGroup.position.set(x, 0, z);

      // Trunk
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2.5;
      trunk.rotation.z = (Math.random() - 0.5) * 0.25; // slanted trunk
      palmGroup.add(trunk);

      // Leaves (create 5 fan blades)
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.set(0, 4.9, 0);
        leaf.rotation.y = (i * Math.PI) / 2.5;
        leaf.rotation.z = 0.2; // drooping angle
        palmGroup.add(leaf);
      }

      this.scene.add(palmGroup);

      // Physics trunk collider (so the player has obstacles to avoid)
      const shape = new CANNON.Cylinder(0.2, 0.3, 5, 6);
      const body = new CANNON.Body({ mass: 0 }); // static
      body.addShape(shape);
      body.position.set(x, 2.5, z);
      this.world.addBody(body);
    };

    // Spawn 15 trees dispersed in the zone
    const spawnPoints = [
      { x: 300, z: -400 }, { x: 500, z: -700 }, { x: 450, z: -1200 },
      { x: 800, z: -350 }, { x: 900, z: -900 }, { x: 750, z: -1500 },
      { x: 1100, z: -400 }, { x: 1200, z: -1100 }, { x: 1350, z: -550 },
      { x: 1300, z: -1400 }, { x: 1500, z: -600 }
    ];

    spawnPoints.forEach(pt => createPalm(pt.x, pt.z));
  }

  /**
   * Update water uniforms for shader wave movements
   */
  update(time) {
    this.waterUniforms.uTime.value = time;
  }
}
