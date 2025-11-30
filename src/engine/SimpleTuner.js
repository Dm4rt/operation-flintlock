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
    if (this.masterGain) this.masterGain.gain.value = val;
  }

  mute() {
    if (this.masterGain) this.masterGain.gain.value = 0;
  }

  unmute() {
    if (this.masterGain) this.masterGain.gain.value = this.volume;
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

    // For each transmission, compute a proximity score (0 = far, 1 = perfect)
    // Use very tight tolerances so signal is barely audible until nearly perfect
    let bestProximity = 0;
    transmissions.forEach(tx => {
      const freqError = Math.abs(this.centerFreq - tx.frequencyHz);
      const bwError = Math.abs(this.bandwidthHz - tx.widthHz);
      const freqTolerance = tx.widthHz * 0.6; // tight freq tolerance
      const bwTolerance = tx.widthHz * 0.25; // tight bandwidth tolerance

      const freqScore = Math.max(0, 1 - freqError / freqTolerance);
      const bwScore = Math.max(0, 1 - bwError / bwTolerance);
      const minScore = this.minDb <= tx.minDb + 10 ? 1 : 0.2;
      const maxScore = this.maxDb >= tx.maxDb - 10 ? 1 : 0.2;

      const rawProximity = freqScore * bwScore * minScore * maxScore;
      
      // Apply steep curve: only very high proximity values become audible
      const proximity = Math.pow(rawProximity, 3); // cube it for steep falloff
      bestProximity = Math.max(bestProximity, proximity);

      if (proximity > 0.15) {
        // Start playing if not already
        this.ensureSignalPlaying(tx, now);
        // Fade signal in based on proximity
        const node = this.signalNodes.get(tx.id);
        if (node) {
          // Below 0.7 proximity = mostly cut out by static
          const targetGain = proximity < 0.7 ? MIN_GAIN : Math.min(0.9, (proximity - 0.6) * 2.25);
          node.gain.gain.setTargetAtTime(targetGain, now, 0.15);
        }
      } else {
        // Stop signal if too far
        this.stopSignal(tx.id, now);
      }
    });

    // Static overtakes when proximity is low
    if (this.staticGain) {
      // Static stays loud until you're very close
      const staticLevel = bestProximity < 0.7 ? 0.5 : Math.max(0.02, 0.5 * (1 - bestProximity));
      this.staticGain.gain.setTargetAtTime(staticLevel, now, 0.15);
    }
  }

  ensureSignalPlaying(tx, now) {
    if (this.signalNodes.has(tx.id)) return; // already playing

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

    // Don't auto-fade in here; let updateTuning control gain based on proximity

    this.signalNodes.set(tx.id, { source: src, gain, buffer: buf });
  }

  stopSignal(id, now) {
    const node = this.signalNodes.get(id);
    if (!node) return;

    node.gain.gain.setTargetAtTime(MIN_GAIN, now, 0.2);
    setTimeout(() => {
      try {
        node.source.stop();
      } catch (e) { /* ignore */ }
      this.signalNodes.delete(id);
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
