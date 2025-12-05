/**
 * SimpleTuner - Dead-simple audio tuning engine
 * 
 * No FFT, no spectrum synthesis, no Gaussian peaks.
 * Just: are you close enough to the target freq/width? Then play clean audio.
 * Otherwise: static overlay.
 */

import transmissions from '../data/audioTransmissions.json';

const STATIC_PATH = '/audio/static.mp3';
const MIN_GAIN = 0.0001;

export default class SimpleTuner {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.staticSource = null;
    this.staticGain = null;
    this.staticBuffer = null;
    this.signalNodes = new Map(); // id → { source, gain, buffer }
    this.bufferCache = new Map();
    this.volume = 0.75;
    this.isMuted = false;
    this.pausedStaticLevel = 0.3;
    
    // User's current tuning state
    this.centerFreq = 100_000_000; // Hz
    this.bandwidthHz = 200_000;
    this.minDb = -120;
    this.maxDb = -20;
  }

  async init() {
    if (this.context) {
      if (this.context.state === 'suspended') await this.context.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      console.warn('WebAudio not available');
      return;
    }
    this.context = new AudioCtx();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.context.destination);

    // Preload static + all transmission audio
    await this.loadBuffer(STATIC_PATH);
    await Promise.all(transmissions.map(t => this.loadBuffer(t.audioPath)));
    this.startStatic();
  }

  async resume() {
    await this.init();
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
    return this.context?.state === 'running';
  }

  isReady() {
    return this.context?.state === 'running';
  }

  async loadBuffer(path) {
    if (this.bufferCache.has(path)) return this.bufferCache.get(path);
    try {
      const resp = await fetch(path);
      const arrayBuf = await resp.arrayBuffer();
      const audioBuf = await this.context.decodeAudioData(arrayBuf);
      this.bufferCache.set(path, audioBuf);
      return audioBuf;
    } catch (err) {
      console.error('Failed to load', path, err);
      return null;
    }
  }

  startStatic() {
    if (!this.context || this.staticSource) return;
    const buf = this.bufferCache.get(STATIC_PATH);
    if (!buf) return;

    const src = this.context.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const gain = this.context.createGain();
    gain.gain.value = 0.3;

    src.connect(gain);
    gain.connect(this.masterGain);
    src.start();

    this.staticSource = src;
    this.staticGain = gain;
  }

  setVolume(val) {
    this.volume = val;
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0 : val;
    }
  }

  mute() {
    this.isMuted = true;
    const now = this.context?.currentTime || 0;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, now, 0.05);
    }
    if (this.staticGain) {
      this.pausedStaticLevel = this.staticGain.gain.value;
      this.staticGain.gain.setTargetAtTime(0, now, 0.05);
    }
    this.signalNodes.forEach((node) => {
      node.gain.gain.setTargetAtTime(MIN_GAIN, now, 0.05);
    });
  }

  unmute() {
    this.isMuted = false;
    const now = this.context?.currentTime || 0;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.volume, now, 0.05);
    }
    if (this.staticGain) {
      this.staticGain.gain.setTargetAtTime(this.pausedStaticLevel ?? 0.3, now, 0.1);
    }
    // Refresh gains based on latest tuning so signal/static mix comes back cleanly
    this.updateTuning({});
  }

  /**
   * Update tuning parameters and recalculate what should be audible.
   * Now uses gradual fade: as you get closer, static fades out and signal fades in.
   */
  updateTuning({ centerFreq, bandwidthHz, minDb, maxDb }) {
    this.centerFreq = centerFreq ?? this.centerFreq;
    this.bandwidthHz = bandwidthHz ?? this.bandwidthHz;
    this.minDb = minDb ?? this.minDb;
    this.maxDb = maxDb ?? this.maxDb;

    if (!this.isReady()) return;

    const now = this.context.currentTime;

    if (this.isMuted) {
      if (this.staticGain) {
        this.staticGain.gain.setTargetAtTime(0, now, 0.05);
      }
      this.signalNodes.forEach((node) => {
        node.gain.gain.setTargetAtTime(MIN_GAIN, now, 0.05);
      });
      return;
    }

    // For each transmission, compute a proximity score (0 = far, 1 = perfect)
    // Use tighter tolerances so signal is only clear when settings are very close
    let bestProximity = 0;
    transmissions.forEach(tx => {
      const freqError = Math.abs(this.centerFreq - tx.frequencyHz);
      const bwError = Math.abs(this.bandwidthHz - tx.widthHz);
      
      // Much tighter tolerances - require more precise tuning
      const freqTolerance = tx.widthHz * 0.3; // was 0.6, now much tighter
      const bwTolerance = tx.widthHz * 0.15; // was 0.25, now much tighter

      const freqScore = Math.max(0, 1 - freqError / freqTolerance);
      const bwScore = Math.max(0, 1 - bwError / bwTolerance);
      
      // Make minDb and maxDb much more strict - need to be very close
      const minError = Math.max(0, tx.minDb - this.minDb);
      const maxError = Math.max(0, this.maxDb - tx.maxDb);
      const minScore = Math.max(0, 1 - minError / 20); // was binary 1 or 0.2, now gradual
      const maxScore = Math.max(0, 1 - maxError / 20); // was binary 1 or 0.2, now gradual

      const rawProximity = freqScore * bwScore * minScore * maxScore;
      
      // Apply even steeper curve: only near-perfect settings become audible
      const proximity = Math.pow(rawProximity, 4); // was 3, now 4 for steeper falloff
      bestProximity = Math.max(bestProximity, proximity);

      if (proximity > 0.05) {
        // Start playing if not already
        this.ensureSignalPlaying(tx, now);
        // Fade signal in based on proximity
        const node = this.signalNodes.get(tx.id);
        if (node) {
          // Need much higher proximity to hear signal clearly
          const targetGain = proximity < 0.8 ? MIN_GAIN : Math.min(0.85, (proximity - 0.75) * 3.4);
          node.gain.gain.setTargetAtTime(targetGain, now, 0.15);
        }
      } else {
        // Stop signal if too far
        this.stopSignal(tx.id, now);
      }
    });

    // Static dominates much more aggressively when not tuned correctly
    if (this.staticGain) {
      // Static stays at max until you're extremely close
      const staticLevel = bestProximity < 0.85 ? 0.65 : Math.max(0.01, 0.65 * (1 - bestProximity));
      this.staticGain.gain.setTargetAtTime(staticLevel, now, 0.15);
    }
  }

  ensureSignalPlaying(tx, now) {
    // Check if already playing AND source is still valid
    const existing = this.signalNodes.get(tx.id);
    if (existing && existing.source) {
      // Verify the source hasn't been stopped/disconnected
      // If it has a valid gain node connected, we're good
      try {
        // Source is still valid if we can access its properties
        if (existing.source.buffer) return; // already playing
      } catch (e) {
        // Source was stopped, clean it up
        this.signalNodes.delete(tx.id);
      }
    }

    const buf = this.bufferCache.get(tx.audioPath);
    if (!buf) return;

    const src = this.context.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const gain = this.context.createGain();
    gain.gain.value = MIN_GAIN;

    src.connect(gain);
    gain.connect(this.masterGain);
    src.start();

    // Track when source ends (shouldn't happen with loop=true, but just in case)
    src.onended = () => {
      this.signalNodes.delete(tx.id);
    };

    // Don't auto-fade in here; let updateTuning control gain based on proximity

    this.signalNodes.set(tx.id, { source: src, gain, buffer: buf });
  }

  stopSignal(id, now) {
    const node = this.signalNodes.get(id);
    if (!node) return;

    // Immediately remove from map to prevent duplicate creation
    this.signalNodes.delete(id);

    // Fade out and stop
    node.gain.gain.setTargetAtTime(MIN_GAIN, now, 0.2);
    setTimeout(() => {
      try {
        node.source.stop();
        node.source.disconnect();
        node.gain.disconnect();
      } catch (e) { /* ignore */ }
    }, 1000);
  }

  stopAll() {
    const now = this.context?.currentTime || 0;
    this.signalNodes.forEach((node, id) => this.stopSignal(id, now));
    if (this.staticSource) {
      try {
        this.staticSource.stop();
      } catch (e) { /* ignore */ }
      this.staticSource = null;
      this.staticGain = null;
    }
  }
}
