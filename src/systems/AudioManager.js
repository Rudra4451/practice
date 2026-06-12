/* ==========================================================================
   Apex Horizon - Procedural Audio Engine (Web Audio API)
   ========================================================================== */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.sfxVolume = 0.8;
    this.musicVolume = 0.5;

    // Master nodes
    this.masterSFXGain = null;

    // Engine sound nodes
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineSub = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.engineSubGain = null;
    this.engineShaper = null;
    
    // Tire screech nodes
    this.screechNoise = null;
    this.screechGain = null;
    this.screechFilter = null;

    // Wind rumble nodes
    this.windNoise = null;
    this.windGain = null;

    // Rain noise nodes (PROMPT 2: white noise filtered at 2kHz when weather = rain)
    this.rainNoise = null;
    this.rainGain = null;
    this.rainFilter = null;

    this.isInitialized = false;
    this.engineRunning = false;
  }

  /**
   * Initialize AudioContext. MUST be triggered by user gesture (click/touch).
   */
  init() {
    if (this.isInitialized) return;
    
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn("Web Audio API is not supported in this browser.");
      return;
    }

    try {
      this.ctx = new AudioContextClass();
      
      // Setup Master Gain
      this.masterSFXGain = this.ctx.createGain();
      this.masterSFXGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.masterSFXGain.connect(this.ctx.destination);

      this.setupEngineNodes();
      this.setupScreechNodes();
      this.setupWindNodes();
      this.setupRainNodes();

      this.isInitialized = true;
      console.log("Audio Engine initialized successfully.");
    } catch (e) {
      console.error("Audio Context initialization failed.", e);
    }
  }

  makeDistortionCurve(amount = 20) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  setupEngineNodes() {
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineSub = this.ctx.createOscillator();

    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2.type = 'triangle'; // triangle for throaty mid-range growl
    this.engineSub.type = 'sine';       // sub-bass sine wave rumble

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    this.engineShaper = this.ctx.createWaveShaper();
    this.engineShaper.curve = this.makeDistortionCurve(20);
    this.engineShaper.oversample = '4x';

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.engineSubGain = this.ctx.createGain();
    this.engineSubGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineShaper);
    this.engineShaper.connect(this.engineGain);
    this.engineGain.connect(this.masterSFXGain);

    // Connect sub-bass directly to master to avoid clipping/harsh distortion
    this.engineSub.connect(this.engineSubGain);
    this.engineSubGain.connect(this.masterSFXGain);

    this.engineOsc1.start(0);
    this.engineOsc2.start(0);
    this.engineSub.start(0);
  }

  setupScreechNodes() {
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.screechNoise = this.ctx.createBufferSource();
    this.screechNoise.buffer = noiseBuffer;
    this.screechNoise.loop = true;

    this.screechFilter = this.ctx.createBiquadFilter();
    this.screechFilter.type = 'bandpass';
    this.screechFilter.frequency.setValueAtTime(1200, this.ctx.currentTime);
    this.screechFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    this.screechGain = this.ctx.createGain();
    this.screechGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.screechNoise.connect(this.screechFilter);
    this.screechFilter.connect(this.screechGain);
    this.screechGain.connect(this.masterSFXGain);

    this.screechNoise.start(0);
  }

  setupWindNodes() {
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }

    this.windNoise = this.ctx.createBufferSource();
    this.windNoise.buffer = noiseBuffer;
    this.windNoise.loop = true;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.windNoise.connect(this.windGain);
    this.windGain.connect(this.masterSFXGain);

    this.windNoise.start(0);
  }

  /**
   * Set up Rain noise node: white noise filtered at 2kHz (PROMPT 2)
   */
  setupRainNodes() {
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.rainNoise = this.ctx.createBufferSource();
    this.rainNoise.buffer = noiseBuffer;
    this.rainNoise.loop = true;

    // Filter white noise at 2kHz (Bandpass/Lowpass centered around 2000Hz)
    this.rainFilter = this.ctx.createBiquadFilter();
    this.rainFilter.type = 'bandpass';
    this.rainFilter.frequency.setValueAtTime(2000, this.ctx.currentTime);
    this.rainFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.rainNoise.connect(this.rainFilter);
    this.rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.masterSFXGain);

    this.rainNoise.start(0);
  }

  startEngine() {
    if (!this.isInitialized) return;
    if (this.engineRunning) return;

    this.engineRunning = true;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.engineGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.engineGain.gain.linearRampToValueAtTime(0.20, this.ctx.currentTime + 0.3);

    this.engineSubGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.engineSubGain.gain.linearRampToValueAtTime(0.22, this.ctx.currentTime + 0.3);
    
    this.windGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.windGain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 0.5);
  }

  stopEngine() {
    if (!this.isInitialized || !this.engineRunning) return;

    this.engineRunning = false;
    this.engineGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.engineGain.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 0.2);

    this.engineSubGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.engineSubGain.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 0.2);

    this.windGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.windGain.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 0.2);
    
    this.screechGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.screechGain.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 0.1);

    // Suspend audio context when in menu/garage to silence traffic and save CPU
    setTimeout(() => {
      if (!this.engineRunning && this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(e => console.warn("Audio Context suspend failed", e));
      }
    }, 350);
  }

  setEngineRPM(rpm, load, speedKmh) {
    if (!this.isInitialized || !this.engineRunning) return;

    const t = this.ctx.currentTime;

    // Modulate base frequencies between 45Hz and 450Hz for a realistic V8 rumble
    const baseFreq = 45 + ((rpm - 900) / 8100) * 455;
    const subFreq = baseFreq * 2.0;       // 1st harmonic
    const subHarmonic = baseFreq * 0.5;   // Sub-bass frequency

    this.engineOsc1.frequency.setTargetAtTime(baseFreq, t, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(subFreq, t, 0.05);
    this.engineSub.frequency.setTargetAtTime(subHarmonic, t, 0.05);

    const filterCutoff = 200 + ((rpm - 900) / 8100) * 1100 + (load * 250);
    this.engineFilter.frequency.setTargetAtTime(filterCutoff, t, 0.05);

    const dynamicVolume = 0.12 + (load * 0.18) + ((rpm - 900) / 8100) * 0.06;
    this.engineGain.gain.setTargetAtTime(dynamicVolume, t, 0.05);

    // Sub-bass gain (increase with load, slightly decrease at high RPMs)
    const subVolume = (0.16 + load * 0.14) * (1.0 - ((rpm - 900) / 8100) * 0.35);
    this.engineSubGain.gain.setTargetAtTime(subVolume, t, 0.05);

    const windVol = Math.min(0.20, (speedKmh / 350) * 0.18);
    this.windGain.gain.setTargetAtTime(windVol + 0.02, t, 0.1);
  }

  /**
   * Control rain sound volume based on whether weather = rain
   */
  setRainActive(active, wetness) {
    if (!this.isInitialized) return;
    const targetVolume = active ? Math.min(0.25, wetness * 0.25) : 0.0;
    this.rainGain.gain.setTargetAtTime(targetVolume, this.ctx.currentTime, 0.2);
  }

  setScreech(slipFraction) {
    if (!this.isInitialized || !this.engineRunning) return;

    const t = this.ctx.currentTime;
    if (slipFraction > 0.12) {
      const volume = Math.min(0.25, (slipFraction - 0.12) * 0.4);
      const freq = 1200 + (slipFraction * 800);
      this.screechFilter.frequency.setTargetAtTime(freq, t, 0.05);
      this.screechGain.gain.setTargetAtTime(volume, t, 0.05);
    } else {
      this.screechGain.gain.setTargetAtTime(0.0, t, 0.05);
    }
  }

  setVolumes(sfxVal, musicVal) {
    this.sfxVolume = sfxVal;
    this.musicVolume = musicVal;
    
    if (this.masterSFXGain) {
      this.masterSFXGain.gain.setTargetAtTime(sfxVal, this.ctx ? this.ctx.currentTime : 0, 0.1);
    }
  }
}
