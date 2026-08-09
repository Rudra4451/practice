export type SwitchType = 'thock' | 'clicky' | 'tactile' | 'spacebar';

class MechanicalSynth {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.3;
  private currentSwitch: SwitchType = 'thock';

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public setSwitchType(type: SwitchType) {
    this.currentSwitch = type;
  }

  public getSwitchType(): SwitchType {
    return this.currentSwitch;
  }

  public playKey(key: string = 'a') {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const isSpace = key === ' ' || key === 'SPACE' || key === 'ENTER';
    const switchProfile = isSpace ? 'spacebar' : this.currentSwitch;

    // Master Gain
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(this.volume * (isSpace ? 1.2 : 0.8), now);
    masterGain.connect(this.ctx.destination);

    if (switchProfile === 'thock' || switchProfile === 'spacebar') {
      // Deep Linear Thock: Noise burst + Sub sine bump
      const bufferSize = this.ctx.sampleRate * 0.04;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isSpace ? 450 : 800, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.035);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.9, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(masterGain);
      noise.start(now);

      // Low frequency thump oscillator
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isSpace ? 90 : 160, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.04);

      oscGain.gain.setValueAtTime(0.6, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.045);

    } else if (switchProfile === 'clicky') {
      // Crisp MX Blue dual-click sound: high frequency click + spring ping
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2400, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.015);

      oscGain.gain.setValueAtTime(1.0, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.025);

      // High metallic release click
      const osc2 = this.ctx.createOscillator();
      const osc2Gain = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(3200, now + 0.005);
      osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.02);

      osc2Gain.gain.setValueAtTime(0.5, now + 0.005);
      osc2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      osc2.connect(osc2Gain);
      osc2Gain.connect(masterGain);
      osc2.start(now + 0.005);
      osc2.stop(now + 0.025);

    } else {
      // Tactile Holy Panda: Medium bump + housing snap
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.03);

      oscGain.gain.setValueAtTime(0.7, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.035);
    }
  }
}

export const mechanicalSynth = new MechanicalSynth();
