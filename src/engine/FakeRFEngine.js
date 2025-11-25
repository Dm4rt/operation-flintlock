import { doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export const FRAME_INTERVAL_MS = 80;
export const FFT_SIZE = 512;
export const DEFAULT_CENTER_FREQ = 100_000_000; // 100 MHz
export const DEFAULT_SPAN = 10_000_000; // 10 MHz span
export const DEFAULT_NOISE_FLOOR = -110;

const safeCrypto = typeof crypto !== 'undefined' ? crypto : null;

const gaussian = () => {
  // Box-Muller transform for smooth noise
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

const createSignal = (overrides = {}) => ({
  id: overrides.id || `sig-${safeCrypto?.randomUUID ? safeCrypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`}`,
  freq: DEFAULT_CENTER_FREQ,
  power: -50,
  width: 250_000,
  type: 'enemy',
  ...overrides
});

export default class FakeRFEngine {
  constructor(operationId) {
    this.operationId = operationId;
    this.docRef = doc(db, 'sessions', operationId, 'sdrState', 'state');
    this.centerFreq = DEFAULT_CENTER_FREQ;
    this.span = DEFAULT_SPAN;
    this.noiseFloor = DEFAULT_NOISE_FLOOR;
    this.signals = [];
    this.jamming = null;
    this.running = false;
    this.intervalId = null;
    this.frameCallbacks = new Set();
    this.driftPhase = Math.random() * Math.PI * 2;
    this.warpPhase = Math.random() * Math.PI * 2;
    this.autoBootstrapped = false;
    this.lastPublishedState = null;
  }

  async initializeDoc() {
    try {
      await setDoc(this.docRef, {
        centerFreq: this.centerFreq,
        span: this.span,
        noiseFloor: this.noiseFloor,
        signals: this.signals,
        jamming: this.jamming,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error('FakeRFEngine init error:', error);
    }
  }

  startEngine() {
    if (this.running) return;
    this.running = true;
    this.initializeDoc();
    this.intervalId = setInterval(() => {
      const payload = this.generateFrame();
      this.publishFrameIfChanged(payload);
      this.frameCallbacks.forEach(cb => cb(payload));
    }, FRAME_INTERVAL_MS);
  }

  stopEngine() {
    if (!this.running) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.running = false;
  }

  onFrame(callback) {
    this.frameCallbacks.add(callback);
    return () => this.frameCallbacks.delete(callback);
  }

  setCenterFreq(freq) {
    this.centerFreq = freq;
  }

  setSpan(span) {
    this.span = Math.max(100_000, span);
  }

  setNoiseFloor(value) {
    this.noiseFloor = value;
  }

  addSignal(config) {
    const signal = createSignal(config);
    this.signals = [...this.signals, signal];
    return signal;
  }

  setSignals(configs = []) {
    this.signals = configs.map(createSignal);
  }

  ensureSignals(configs = []) {
    if (this.autoBootstrapped) return;
    if (!configs.length) return;
    this.signals = configs.map(createSignal);
    this.autoBootstrapped = true;
  }

  removeSignal(id) {
    this.signals = this.signals.filter(signal => signal.id !== id);
  }

  startJamming(freq, width) {
    this.jamming = {
      freq,
      width,
      power: -30,
      startedAt: Date.now()
    };
  }

  stopJamming() {
    this.jamming = null;
  }

  generateFrame() {
    // Only return signal metadata - no FFT generation
    // FFT visualization now comes from real audio in AudioEngine
    return {
      signals: this.signals,
      centerFreq: this.centerFreq,
      span: this.span,
      noiseFloor: this.noiseFloor,
      jamming: this.jamming,
      updatedAt: new Date().toISOString()
    };
  }

  publishFrameIfChanged(frame) {
    const controlState = frame;
    
    // Compare with last published state
    if (this.lastPublishedState) {
      const changed = 
        this.lastPublishedState.centerFreq !== controlState.centerFreq ||
        this.lastPublishedState.span !== controlState.span ||
        this.lastPublishedState.noiseFloor !== controlState.noiseFloor ||
        JSON.stringify(this.lastPublishedState.signals) !== JSON.stringify(controlState.signals) ||
        JSON.stringify(this.lastPublishedState.jamming) !== JSON.stringify(controlState.jamming);
      
      if (!changed) return;
    }

    this.lastPublishedState = controlState;
    this.publishFrame(controlState);
  }

  async publishFrame(controlState) {
    try {
      await setDoc(this.docRef, { ...controlState, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
      console.error('FakeRFEngine publish error:', error);
    }
  }

  forceSync() {
    const frame = this.generateFrame();
    this.lastPublishedState = frame;
    this.publishFrame(frame);
    this.frameCallbacks.forEach(cb => cb(frame));
  }
}
