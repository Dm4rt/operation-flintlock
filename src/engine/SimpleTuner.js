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

    // Preload static + all transmission audio + jamming audio
    await this.loadBuffer(STATIC_PATH);
    await this.loadBuffer('/audio/jamming.mp3'); // Preload jamming audio
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
  }

  unmute() {
    this.isMuted = false;
    const now = this.context?.currentTime || 0;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.volume, now, 0.05);
    }
  }

  /**
   * Update tuning parameters and recalculate what should be audible.
   * Now uses gradual fade: as you get closer, static fades out and signal fades in.
   * Also handles jamming: if signals overlap, highest peakStrength wins.
   */
  async updateTuning({ centerFreq, bandwidthHz, minDb, maxDb, allSignals }) {
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

    // Use provided signals array (includes jammers) or fallback to transmissions
    const allSigs = allSignals || transmissions;
    
    // Separate jammers from regular signals
    const activeJammers = allSigs.filter(s => s.isJammer && s.active);
    const regularSignals = allSigs.filter(s => !s.isJammer);

    console.log('[Tuner] Processing', regularSignals.length, 'signals,', activeJammers.length, 'active jammers');
    
    // Check if current tuning overlaps with any active jammer
    let jammingActive = null;
    for (const jammer of activeJammers) {
      const freqDiff = Math.abs(this.centerFreq - jammer.frequencyHz);
      const combinedBandwidth = (this.bandwidthHz + jammer.widthHz) / 2;
      
      if (freqDiff < combinedBandwidth * 0.5) {
        // We're tuned to a jammed frequency
        jammingActive = jammer;
        console.log('[Tuner] Jamming active at', jammer.frequencyHz, 'Hz');
        break;
      }
    }
    
    const signalsToPlay = new Set();
    let bestProximity = 0;
    
    // If jamming is active, ONLY play the jamming audio, mute everything else
    if (jammingActive) {
      // Stop all regular signals
      regularSignals.forEach(sig => {
        const existing = this.signalNodes.get(sig.id);
        if (existing) {
          this.stopSignal(sig.id, now);
        }
      });
      
      // Play only the jamming audio
      signalsToPlay.add(jammingActive.id);
      await this.ensureSignalPlaying(jammingActive, now, jammingActive.audioPath);
      
      const node = this.signalNodes.get(jammingActive.id);
      if (node) {
        node.gain.gain.setTargetAtTime(0.7, now, 0.15);
      }
      bestProximity = 0.9; // High proximity to reduce static
    } else {
      // No jamming, process regular signals normally
      for (const tx of regularSignals) {
        const freqError = Math.abs(this.centerFreq - tx.frequencyHz);
        const bwError = Math.abs(this.bandwidthHz - tx.widthHz);
        
        const freqTolerance = tx.widthHz * 0.3;
        const bwTolerance = tx.widthHz * 0.15;

        const freqScore = Math.max(0, 1 - freqError / freqTolerance);
        const bwScore = Math.max(0, 1 - bwError / bwTolerance);
        
        const minError = Math.max(0, tx.minDb - this.minDb);
        const maxError = Math.max(0, this.maxDb - tx.maxDb);
        const minScore = Math.max(0, 1 - minError / 20);
        const maxScore = Math.max(0, 1 - maxError / 20);

        const rawProximity = freqScore * bwScore * minScore * maxScore;
        const proximity = Math.pow(rawProximity, 4);
        bestProximity = Math.max(bestProximity, proximity);

        const shouldPlay = proximity > 0.05;

        if (shouldPlay) {
          signalsToPlay.add(tx.id);
          await this.ensureSignalPlaying(tx, now, tx.audioPath);
          
          const node = this.signalNodes.get(tx.id);
          if (node) {
            const targetGain = proximity < 0.8 ? MIN_GAIN : Math.min(0.85, (proximity - 0.75) * 3.4);
            node.gain.gain.setTargetAtTime(targetGain, now, 0.15);
          }
        }
      }
    }
    
    // Stop any signals that shouldn't be playing
    this.signalNodes.forEach((node, id) => {
      if (!signalsToPlay.has(id)) {
        this.stopSignal(id, now);
      }
    });

    // Static dominates much more aggressively when not tuned correctly
    if (this.staticGain) {
      // Static stays at max until you're extremely close
      const staticLevel = bestProximity < 0.85 ? 0.65 : Math.max(0.01, 0.65 * (1 - bestProximity));
      this.staticGain.gain.setTargetAtTime(staticLevel, now, 0.15);
    }
  }

  async ensureSignalPlaying(tx, now, audioPath = null) {
    const audioToUse = audioPath || tx.audioPath;
    
    // Check if already playing AND source is still valid
    const existing = this.signalNodes.get(tx.id);
    if (existing && existing.source && existing.audioPath === audioToUse) {
      // Already playing and valid, don't create duplicate
      return;
    }
    
    // Clean up any existing but disconnected source
    if (existing) {
      this.stopSignal(tx.id, now);
    }
    
    // Make sure audio buffer is loaded (especially for dynamic jammers)
    if (!this.bufferCache.has(audioToUse)) {
      console.log('[Tuner] Loading audio for', tx.name, ':', audioToUse);
      await this.loadBuffer(audioToUse);
    }

    const buf = this.bufferCache.get(audioToUse);
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

    this.signalNodes.set(tx.id, { source: src, gain, buffer: buf, audioPath: audioToUse });
  }

  stopSignal(id, now) {
    const node = this.signalNodes.get(id);
    if (!node) return;

    // Immediately remove from map to prevent duplicate creation
    this.signalNodes.delete(id);

    // Stop immediately without fade for cleaner transitions
    try {
      node.gain.gain.cancelScheduledValues(now);
      node.gain.gain.setValueAtTime(MIN_GAIN, now);
      node.source.stop(now);
      node.source.disconnect();
      node.gain.disconnect();
    } catch (e) { 
      console.warn('[Tuner] Error stopping signal', id, e);
    }
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
