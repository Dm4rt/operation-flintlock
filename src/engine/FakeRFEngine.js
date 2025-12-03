import missionSignalsData from '../data/missionSignals.json';
import spectrumRangesData from '../data/spectrumRanges.json';

export const FRAME_INTERVAL_MS = 33; // ~30 FPS
export const DEFAULT_CENTER_FREQ = 64_010_000; // 64.01 MHz
export const DEFAULT_SPAN = 160_000_000; // 160 MHz span for UI slider
export const DEFAULT_NOISE_FLOOR = -105;
export const DEFAULT_BANDWIDTH = 200_000;
const BIN_COUNT = 512;
const NOISE_JITTER = 0.85;
const MIN_NOISE = -135;
const MAX_NOISE = -40;

const DEFAULT_JAMMERS = [
  { id: 'jammer-alpha', freq: 64.05, width: 150, power: -20 }
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const hzFromMHz = (value = 0) => value * 1_000_000;
const hzFromKHz = (value = 0) => value * 1_000;

const normalizedSignals = missionSignalsData.signals.map((entry) => ({
  ...entry,
  id: entry.id,
  label: entry.label || entry.id,
  freqHz: hzFromMHz(entry.freq),
  widthHz: hzFromKHz(entry.width),
  audioFile: entry.audioFile,
  strength: clamp(entry.strength ?? 0.65, 0.2, 1)
}));

const rangeLabels = spectrumRangesData.ranges.map((range) => ({
  ...range,
  startHz: hzFromMHz(range.start),
  endHz: hzFromMHz(range.end)
}));

const mapJammer = (jammer) => ({
  ...jammer,
  freqHz: hzFromMHz(jammer.freq),
  widthHz: hzFromKHz(jammer.width)
});

export default class FakeRFEngine {
  constructor(operationId, socket) {
    this.operationId = operationId;
    this.socket = socket;
    this.centerFreq = DEFAULT_CENTER_FREQ;
    this.span = DEFAULT_SPAN;
    this.noiseFloor = DEFAULT_NOISE_FLOOR;
    this.bandwidthHz = DEFAULT_BANDWIDTH;
    this.missionSignals = normalizedSignals;
    this.rangeLabels = rangeLabels;
    this.jammers = DEFAULT_JAMMERS.map(mapJammer);
    this.jamming = null;
    this.running = false;
    this.intervalId = null;
    this.frameCallbacks = new Set();
    this.lastPublishedState = null;
    this.binCount = BIN_COUNT;
    this.noiseBins = new Float32Array(this.binCount).fill(this.noiseFloor);
    this.noiseTargets = new Float32Array(this.binCount);
    for (let i = 0; i < this.binCount; i += 1) {
      this.noiseTargets[i] = this.randomNoiseTarget();
    }
    this.frameIndex = 0;
  }

  startEngine() {
    if (this.running) return;
    this.running = true;
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

  setBandwidthHz(value) {
    this.bandwidthHz = Math.max(5_000, value);
  }
  randomNoiseTarget() {
    return clamp(this.noiseFloor + (Math.random() - 0.5) * 14, MIN_NOISE, MAX_NOISE - 10);
  }

  updateNoiseBins() {
    for (let i = 0; i < this.binCount; i += 1) {
      const current = this.noiseBins[i];
      const target = this.noiseTargets[i];
      const next = current + (target - current) * 0.05;
      this.noiseBins[i] = next + (Math.random() - 0.5) * NOISE_JITTER;
      if (Math.abs(target - next) < 0.45) {
        this.noiseTargets[i] = this.randomNoiseTarget();
      }
    }
  }

  buildSpectrumBins() {
    this.updateNoiseBins();
    const bins = new Float32Array(this.binCount);
    const startFreq = this.centerFreq - this.span / 2;
    const hzPerBin = this.span / this.binCount;

    for (let i = 0; i < this.binCount; i += 1) {
      const drift = Math.sin((this.frameIndex / 180) + (i / 32)) * 1.5;
      bins[i] = clamp(this.noiseBins[i] + drift, MIN_NOISE, MAX_NOISE);
    }

    const signals = this.missionSignals || [];
    signals.forEach((signal) => {
      const relative = (signal.freqHz - startFreq) / this.span;
      if (relative <= 0 || relative >= 1) return;

      const centerIndex = relative * this.binCount;
      const sigmaBins = Math.max(2, (signal.widthHz / hzPerBin) * 0.35);
      const lift = 8 + ((signal.strength ?? 0.65) * 14);
      const peakJitter = 0.65 + Math.sin((this.frameIndex / 50) + centerIndex) * 0.15;
      const maxLift = lift * peakJitter;

      const rangeStart = Math.max(0, Math.floor(centerIndex - sigmaBins * 3));
      const rangeEnd = Math.min(this.binCount - 1, Math.ceil(centerIndex + sigmaBins * 3));
      for (let i = rangeStart; i <= rangeEnd; i += 1) {
        const distance = (i - centerIndex) / sigmaBins;
        const gaussian = Math.exp(-0.5 * distance * distance);
        bins[i] = Math.max(bins[i], clamp(bins[i] + gaussian * maxLift, MIN_NOISE, MAX_NOISE));
      }
    });

    this.frameIndex += 1;
    return bins;
  }

  normalizeForWaterfall(bins) {
    const normalized = new Float32Array(bins.length);
    const min = this.noiseFloor - 35;
    const max = this.noiseFloor + 25;
    for (let i = 0; i < bins.length; i += 1) {
      const value = clamp((bins[i] - min) / (max - min), 0, 1);
      normalized[i] = value;
    }
    return normalized;
  }

  buildControlState() {
    return {
      centerFreq: this.centerFreq,
      span: this.span,
      noiseFloor: this.noiseFloor,
      bandwidthHz: this.bandwidthHz,
      jamming: this.jamming,
      updatedAt: new Date().toISOString()
    };
  }

  generateFrame() {
    const bins = this.buildSpectrumBins();
    return {
      ...this.buildControlState(),
      bins: Array.from(bins),
      waterfallRow: Array.from(this.normalizeForWaterfall(bins)),
      missionSignals: this.missionSignals,
      ranges: this.rangeLabels,
      jammers: this.jammers
    };
  }

  publishFrameIfChanged(frame) {
    const controlState = this.buildControlState();
    
    // Compare with last published state
    if (this.lastPublishedState) {
      const changed = 
        this.lastPublishedState.centerFreq !== controlState.centerFreq ||
        this.lastPublishedState.span !== controlState.span ||
        this.lastPublishedState.noiseFloor !== controlState.noiseFloor ||
        this.lastPublishedState.bandwidthHz !== controlState.bandwidthHz ||
        JSON.stringify(this.lastPublishedState.jamming) !== JSON.stringify(controlState.jamming);
      
      if (!changed) return;
    }

    this.lastPublishedState = controlState;
    this.publishFrame(controlState);
  }

  publishFrame(controlState) {
    if (this.socket?.isConnected) {
      // Emit SDR state via Socket.IO
      this.socket.emitSdrUpdate({
        ...controlState,
        missionSignals: this.missionSignals,
        ranges: this.rangeLabels,
        jammers: this.jammers
      });
    }
  }

  forceSync() {
    const frame = this.generateFrame();
    this.lastPublishedState = this.buildControlState();
    this.publishFrame(this.lastPublishedState);
    this.frameCallbacks.forEach(cb => cb(frame));
  }
}
