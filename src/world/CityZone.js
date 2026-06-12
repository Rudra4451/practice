/* ==========================================================================
   Apex Horizon - City Zone (Skyscrapers, Intersections, street grids)
   ========================================================================== */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CITY_BUILDING_COUNT, CITY_BLOCK_SPACING, CITY_LANE_WIDTH } from '../CONSTANTS.js';

function createBuildingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Skyscraper facade: dark steel grey/blue
  ctx.fillStyle = '#0a0d16';
  ctx.fillRect(0, 0, 512, 512);

  const cols = 8;
  const rows = 16;
  const cellWidth = 512 / cols;
  const cellHeight = 512 / rows;

  for (let r = 0; r < rows; r++) {
    // Draw floor divider (metallic horizontal band)
    ctx.fillStyle = '#222736';
    ctx.fillRect(0, r * cellHeight, 512, 2);

    for (let c = 0; c < cols; c++) {
      // Draw vertical window divider
      if (r === 0) {
        ctx.fillStyle = '#222736';
        ctx.fillRect(c * cellWidth, 0, 2, 512);
      }

      // Window dimensions (slightly inset from divider)
      const wx = c * cellWidth + 4;
      const wy = r * cellHeight + 4;
      const ww = cellWidth - 8;
      const wh = cellHeight - 8;

      // Random state for the window
      const rand = Math.random();
      if (rand > 0.82) {
        // Lit window: Warm gold/yellow office light
        ctx.fillStyle = '#ffdf7a';
        ctx.shadowColor = '#ffb700';
        ctx.shadowBlur = 4;
      } else if (rand > 0.70) {
        // Lit window: Cool cyan/blue light
        ctx.fillStyle = '#8ce8ff';
        ctx.shadowColor = '#00a6ff';
        ctx.shadowBlur = 4;
      } else if (rand > 0.65) {
        // Lit window: Crisp clean white
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 4;
      } else {
        // Dark glass: deep black-blue
        ctx.fillStyle = '#05070c';
        ctx.shadowBlur = 0;
      }
      ctx.fillRect(wx, wy, ww, wh);
      
      // Reset shadow for subsequent drawings
      ctx.shadowBlur = 0;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4); // Dense repeating grid
  return texture;
}

export class CityZone {
  /**
   * @param {WorldMap} worldMap
   */
  constructor(worldMap) {
    this.map = worldMap;
    this.scene = worldMap.scene;
    this.world = worldMap.world;
  }

  build() {
    this.buildRoadGrid();
    this.buildInstancedSkyscrapers();
    this.buildDetails();
  }

  /**
   * Create urban asphalt road grids with merged road lines (single draw call)
   */
  buildRoadGrid() {
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x15161c,
      roughness: 0.9,
      flatShading: true
    });

    // Grid coordinates
    const startX = -1900;
    const endX = -100;
    const startZ = 100;
    const endZ = 1900;

    const laneWidth = CITY_LANE_WIDTH;
    const spacing = CITY_BLOCK_SPACING;

    // Collect geometries for road lines to merge into one draw call
    const lineGeometries = [];
    const roadLineMat = new THREE.MeshBasicMaterial({ color: 0xffdd00 });

    for (let x = startX; x <= endX; x += spacing) {
      // Vertical street mesh
      const streetGeo = new THREE.BoxGeometry(laneWidth, 0.03, 1800);
      const street = new THREE.Mesh(streetGeo, roadMat);
      street.position.set(x, 0.015, 1000);
      this.scene.add(street);

      // Collect dash road line geometries for batch merge
      for (let lineZ = startZ; lineZ <= endZ; lineZ += 40) {
        const lineGeo = new THREE.BoxGeometry(0.15, 0.04, 8);
        lineGeo.translate(x, 0.02, lineZ);
        lineGeometries.push(lineGeo);
      }
    }

    for (let z = startZ; z <= endZ; z += spacing) {
      // Horizontal street mesh
      const streetGeo = new THREE.BoxGeometry(1800, 0.03, laneWidth);
      const street = new THREE.Mesh(streetGeo, roadMat);
      street.position.set(-1000, 0.015, z);
      this.scene.add(street);

      // Collect dash road line geometries for batch merge
      for (let lineX = startX; lineX <= endX; lineX += 40) {
        const lineGeo = new THREE.BoxGeometry(8, 0.04, 0.15);
        lineGeo.translate(lineX, 0.02, z);
        lineGeometries.push(lineGeo);
      }
    }

    // Merge all road line geometries into ONE mesh (single draw call)
    if (lineGeometries.length > 0) {
      const mergedGeo = BufferGeometryUtils.mergeGeometries(lineGeometries);
      const mergedLines = new THREE.Mesh(mergedGeo, roadLineMat);
      this.scene.add(mergedLines);
    }
  }

  /**
   * Procedural Skyscrapers using InstancedMesh for maximum rendering performance
   */
  buildInstancedSkyscrapers() {
    const buildingCount = CITY_BUILDING_COUNT;
    
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const buildingTex = createBuildingTexture();
    
    const material = new THREE.MeshStandardMaterial({
      map: buildingTex,
      emissiveMap: buildingTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.8,
      metalness: 0.8,
      roughness: 0.15,
      flatShading: false
    });

    const instMesh = new THREE.InstancedMesh(geometry, material, buildingCount);
    this.scene.add(instMesh);

    const dummy = new THREE.Object3D();
    
    const blockCenterOffsets = [
      { x: -1675, z: 325 }, { x: -1225, z: 325 }, { x: -775, z: 325 }, { x: -325, z: 325 },
      { x: -1675, z: 775 }, { x: -1225, z: 775 }, { x: -775, z: 775 }, { x: -325, z: 775 },
      { x: -1675, z: 1225 }, { x: -1225, z: 1225 }, { x: -775, z: 1225 }, { x: -325, z: 1225 },
      { x: -1675, z: 1675 }, { x: -1225, z: 1675 }, { x: -775, z: 1675 }, { x: -325, z: 1675 }
    ];

    let instanceIndex = 0;

    blockCenterOffsets.forEach(block => {
      const subLocations = [
        { dx: -120, dz: -120 },
        { dx: 120, dz: -120 },
        { dx: -120, dz: 120 },
        { dx: 120, dz: 120 },
        { dx: 0, dz: 0 }
      ];

      subLocations.forEach(sub => {
        if (instanceIndex >= buildingCount) return;

        const x = block.x + sub.dx;
        const z = block.z + sub.dz;
        
        const bWidth = 60 + Math.random() * 40;
        const bDepth = 60 + Math.random() * 40;
        const bHeight = 150 + Math.random() * 250;

        dummy.position.set(x, bHeight / 2, z);
        dummy.scale.set(bWidth, bHeight, bDepth);
        dummy.updateMatrix();

        // Use setMatrixAt (correct API for Three.js r159+)
        instMesh.setMatrixAt(instanceIndex, dummy.matrix);

        // Add collision box to Cannon-es world
        const shape = new CANNON.Box(new CANNON.Vec3(bWidth / 2, bHeight / 2, bDepth / 2));
        const body = new CANNON.Body({
          mass: 0,
          material: new CANNON.Material('buildingMaterial')
        });
        body.addShape(shape);
        body.position.set(x, bHeight / 2, z);
        this.world.addBody(body);

        instanceIndex++;
      });
    });

    instMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Add street details using InstancedMesh for poles and bulbs (2 draw calls total)
   */
  buildDetails() {
    const poleGeo = new THREE.CylinderGeometry(0.15, 0.15, 8, 5);
    const bulbGeo = new THREE.SphereGeometry(0.5, 4, 4);

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x33333b, roughness: 0.6 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffeaad });

    const spacing = CITY_BLOCK_SPACING;
    const startX = -1900;
    const endX = -100;
    const startZ = 100;
    const endZ = 1900;

    // Count intersection positions for instanced mesh sizing
    const offsets = [
      { dx: 12, dz: 12 }, { dx: -12, dz: -12 },
      { dx: 12, dz: -12 }, { dx: -12, dz: 12 }
    ];

    let xCount = 0;
    for (let x = startX; x <= endX; x += spacing) xCount++;
    let zCount = 0;
    for (let z = startZ; z <= endZ; z += spacing) zCount++;
    const totalLights = xCount * zCount * offsets.length;

    // Create InstancedMesh for poles and bulbs
    const poleInstMesh = new THREE.InstancedMesh(poleGeo, poleMat, totalLights);
    const bulbInstMesh = new THREE.InstancedMesh(bulbGeo, bulbMat, totalLights);

    const poleDummy = new THREE.Object3D();
    const bulbDummy = new THREE.Object3D();

    let lightIndex = 0;

    for (let x = startX; x <= endX; x += spacing) {
      for (let z = startZ; z <= endZ; z += spacing) {
        offsets.forEach(offset => {
          const px = x + offset.dx;
          const pz = z + offset.dz;

          // Pole instance
          poleDummy.position.set(px, 4, pz);
          poleDummy.updateMatrix();
          poleInstMesh.setMatrixAt(lightIndex, poleDummy.matrix);

          // Bulb instance
          bulbDummy.position.set(px, 8.2, pz);
          bulbDummy.updateMatrix();
          bulbInstMesh.setMatrixAt(lightIndex, bulbDummy.matrix);

          lightIndex++;
        });
      }
    }

    poleInstMesh.instanceMatrix.needsUpdate = true;
    bulbInstMesh.instanceMatrix.needsUpdate = true;

    this.scene.add(poleInstMesh);
    this.scene.add(bulbInstMesh);
  }

  update(time) {
    // No animations needed in city zone currently
  }
}
