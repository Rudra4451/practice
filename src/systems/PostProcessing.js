/* ==========================================================================
   Apex Horizon - Bloom Post-Processing System (Composer, Bloom & Output Passes)
   ========================================================================== */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class PostProcessing {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.PerspectiveCamera} camera
   */
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    // Create composer and configure WebGLRenderTarget
    this.composer = new EffectComposer(this.renderer);

    // 1. Basic rendering pass (Draws the standard 3D scene)
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // 2. Unreal Bloom Pass (Captures high-frequency luminances for bloom glow)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.5,   // bloom strength
      0.3,   // bloom radius
      0.85   // bloom luminance threshold
    );
    this.composer.addPass(this.bloomPass);

    // 3. Color Space output pass (converts linear space tone mapping to sRGB)
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  /**
   * Resize composer viewport size to match canvas dimensions
   * @param {number} width 
   * @param {number} height 
   */
  resize(width, height) {
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
  }

  /**
   * Run the post-processing render pipeline
   */
  render() {
    this.composer.render();
  }
}
