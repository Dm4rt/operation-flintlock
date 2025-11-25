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
  id: `sig-${safeCrypto?.randomUUID ? safeCrypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`}`,
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
  }

  async initializeDoc() {
    try {
      await setDoc(this.docRef, {
        centerFreq: this.centerFreq,
        span: this.span,
        noiseFloor: this.noiseFloor,
        signals: this.signals,
        jamming: this.jamming,
        fftData: new Array(FFT_SIZE / 2).fill(this.noiseFloor),
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
      this.publishFrame(payload);
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
    this.driftPhase = (this.driftPhase + 0.012) % (Math.PI * 2);
    this.warpPhase = (this.warpPhase + 0.02) % (Math.PI * 2);

    const baseFreq = this.centerFreq - this.span / 2;
    const binCount = FFT_SIZE / 2;
    const binWidth = this.span / binCount;

    const spectrum = Array.from({ length: binCount }, (_, index) => {
      const binFreq = baseFreq + index * binWidth;
      const harmonic = Math.sin(((binFreq - this.centerFreq) / this.span) * Math.PI * 4 + this.driftPhase) * 6;
      const absoluteTexture = Math.sin(binFreq * 0.0000004 + this.warpPhase) * 7;
      const layeredTexture = Math.sin(binFreq * 0.0000009 + this.driftPhase * 0.5) * 4;
      let db = this.noiseFloor + harmonic + absoluteTexture + layeredTexture + gaussian() * 2;

      this.signals.forEach(signal => {
        const distance = Math.abs(binFreq - signal.freq);
        const width = Math.max(signal.width, this.span * 0.01);
        const influence = Math.exp(-(distance * distance) / (2 * width * width));
        db = Math.max(db, signal.power * influence);
      });

      if (this.jamming) {
        const distance = Math.abs(binFreq - this.jamming.freq);
        if (distance < this.jamming.width) {
          db = Math.max(db, -25 + gaussian() * 8);
        }
      }

      return Math.max(-140, Math.min(-5, db));
    });

    return {
      fftData: spectrum,
      signals: this.signals,
      centerFreq: this.centerFreq,
      span: this.span,
      noiseFloor: this.noiseFloor,
      jamming: this.jamming,
      updatedAt: new Date().toISOString()
    };
  }

  async publishFrame(frame) {
    try {
      await setDoc(this.docRef, frame, { merge: true });
    } catch (error) {
      console.error('FakeRFEngine publish error:', error);
    }
  }
}
