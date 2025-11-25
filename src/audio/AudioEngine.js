const DEFAULT_AUDIO_PATH = '/audio/broadcast_1.mp3';
const STATIC_AUDIO_PATH = '/audio/static.mp3';
const FADE_TIME = 0.25;
const MIN_GAIN = 0.0001;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default class AudioEngine {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.analyser = null;
    this.signalNodes = new Map();
    this.noiseNode = null;
    this.noiseGain = null;
    this.staticSource = null;
    this.staticGain = null;
    this.lastState = null;
    this.catalogMap = new Map();
    this.bufferCache = new Map();
    this.pendingLoads = new Map();
    this.volume = 0.8;
    this.muted = false;
  }

  async init() {
    if (this.context) {
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('WebAudio not supported in this browser.');
      return;
    }
    this.context = new AudioContextClass();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.volume;
    
    // Create analyser for FFT generation from audio output
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 1024; // 512 frequency bins
    this.analyser.smoothingTimeConstant = 0.75;
    
    // Connect: masterGain -> analyser -> destination
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    
    await Promise.all([
      this.ensureBuffer(DEFAULT_AUDIO_PATH),
      this.ensureBuffer(STATIC_AUDIO_PATH)
    ]);
    this.ensureStaticBed();
  }

  async resume() {
    await this.init();
    if (!this.context) return false;
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    this.ensureStaticBed();
    return this.isReady();
  }

  isReady() {
    return Boolean(this.context && this.context.state === 'running');
  }

  setMasterVolume(value) {
    this.volume = value;
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.value = value;
    }
  }

  mute() {
    this.muted = true;
    if (this.masterGain) {
      this.masterGain.gain.value = 0;
    }
  }

  unmute() {
    this.muted = false;
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  getFFTData() {
    if (!this.analyser) return new Float32Array(512);
    const dataArray = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatFrequencyData(dataArray);
    return dataArray;
  }

  async loadBuffer(url) {
    if (!this.context) return null;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await this.context.decodeAudioData(arrayBuffer);
  }

  async loadCatalog(entries = []) {
    this.catalogMap = new Map(entries.map(entry => [entry.id, entry]));
    if (!this.context) return;
    const uniquePaths = new Set(entries.map(entry => entry.audioPath).filter(Boolean));
    uniquePaths.add(DEFAULT_AUDIO_PATH);
    uniquePaths.add(STATIC_AUDIO_PATH);
    await Promise.all(Array.from(uniquePaths, path => this.ensureBuffer(path)));
    this.ensureStaticBed();
  }

  async ensureBuffer(path) {
    if (!this.context || !path) return null;
    if (this.bufferCache.has(path)) return this.bufferCache.get(path);
    if (this.pendingLoads.has(path)) return this.pendingLoads.get(path);

    const pending = this.loadBuffer(path)
      .then(buffer => {
        if (buffer) {
          this.bufferCache.set(path, buffer);
        }
        this.pendingLoads.delete(path);
        return buffer;
      })
      .catch(error => {
        console.error('Failed to load audio asset', path, error);
        this.pendingLoads.delete(path);
        return null;
      });

    this.pendingLoads.set(path, pending);
    return pending;
  }

  getBufferKeyForSignal(signal) {
    if (!signal) return DEFAULT_AUDIO_PATH;
    const catalogEntry = signal.audioId ? this.catalogMap.get(signal.audioId) : null;
    return catalogEntry?.audioPath || signal.audioPath || DEFAULT_AUDIO_PATH;
  }

  getBufferForSignal(signal) {
    const key = this.getBufferKeyForSignal(signal);
    const buffer = this.bufferCache.get(key);
    if (!buffer) {
      // Fire off a load so future updates have audio
      this.ensureBuffer(key);
    }
    return { buffer, key };
  }

  updateState({ centerFreq, span, signals = [], jamming }) {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.lastState = { centerFreq, span, jamming };

    const activeSignalIds = new Set(signals.map((signal) => signal.id));
    let strongestTuning = 0;

    this.signalNodes.forEach((node, id) => {
      if (!activeSignalIds.has(id)) {
        this.fadeOutAndStop(node.gainNode, node.source, now);
        this.signalNodes.delete(id);
      }
    });

    signals.forEach((signal) => {
      if (signal.type !== 'broadcast') return;
      const { buffer, key } = this.getBufferForSignal(signal);
      if (!buffer) return;

      const distance = Math.abs(centerFreq - signal.freq);
      const normalized = clamp(1 - distance / (signal.width * 0.8), 0, 1);
      const targetGain = clamp(normalized * (Math.abs(signal.power || -40) / 60), 0, 1);
      strongestTuning = Math.max(strongestTuning, normalized);

      const existingNode = this.signalNodes.get(signal.id);
      if (existingNode && existingNode.bufferKey !== key) {
        this.fadeOutAndStop(existingNode.gainNode, existingNode.source, now);
        this.signalNodes.delete(signal.id);
      }

      if (!this.signalNodes.has(signal.id)) {
        this.signalNodes.set(
          signal.id,
          this.createSignalNode({ buffer, bufferKey: key, normalized })
        );
      }

      const node = this.signalNodes.get(signal.id);
      node.filterNode.frequency.setTargetAtTime(8000 * normalized + 200, now, 0.25);
      node.gainNode.gain.setTargetAtTime(targetGain || MIN_GAIN, now, FADE_TIME);
    });

    if (jamming) {
      this.startNoise(now);
    } else {
      this.stopNoise(now);
    }

    this.ensureStaticBed();
    if (this.staticGain) {
      const baseLevel = 0.35;
      const attenuation = 1 - strongestTuning;
      const targetStatic = clamp(baseLevel * attenuation, MIN_GAIN, baseLevel);
      this.staticGain.gain.setTargetAtTime(targetStatic, now, 0.12);
    }
  }

  createSignalNode({ buffer, bufferKey, normalized }) {
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gainNode = this.context.createGain();
    gainNode.gain.value = MIN_GAIN;

    const filterNode = this.context.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = 8000 * normalized + 200;

    source.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.masterGain);

    source.start();
    return { source, gainNode, filterNode, bufferKey };
  }

  startNoise(now) {
    if (!this.context) return;
    if (this.noiseNode) return;

    const bufferSize = 2 * this.context.sampleRate;
    const noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.context.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const gainNode = this.context.createGain();
    gainNode.gain.value = 0.4;

    noiseSource.connect(gainNode);
    gainNode.connect(this.masterGain);
    noiseSource.start();

    this.noiseNode = noiseSource;
    this.noiseGain = gainNode;
  }

  stopNoise(now) {
    if (!this.noiseNode || !this.noiseGain) return;
    this.fadeOutAndStop(this.noiseGain, this.noiseNode, now);
    this.noiseNode = null;
    this.noiseGain = null;
  }

  ensureStaticBed() {
    if (!this.context) return;
    if (this.staticSource && this.staticGain) return;

    const buffer = this.bufferCache.get(STATIC_AUDIO_PATH);
    if (!buffer) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gainNode = this.context.createGain();
    gainNode.gain.value = 0.25;

    source.connect(gainNode);
    gainNode.connect(this.masterGain);
    source.start();

    this.staticSource = source;
    this.staticGain = gainNode;
  }

  fadeOutAndStop(gainNode, source, now = this.context?.currentTime || 0) {
    if (!gainNode || !source) return;
    gainNode.gain.setTargetAtTime(MIN_GAIN, now, FADE_TIME);
    setTimeout(() => {
      try {
        source.stop();
      } catch (error) {
        // ignore
      }
    }, FADE_TIME * 1000 * 4);
  }

  stopAll() {
    const now = this.context?.currentTime || 0;
    this.signalNodes.forEach(({ source, gainNode }) => {
      this.fadeOutAndStop(gainNode, source, now);
    });
    this.signalNodes.clear();
    this.stopNoise(now);
    if (this.staticGain && this.staticSource) {
      this.fadeOutAndStop(this.staticGain, this.staticSource, now);
      this.staticGain = null;
      this.staticSource = null;
    }
  }

  getFFTData() {
    if (!this.analyser) return new Float32Array(512);
    const dataArray = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatFrequencyData(dataArray);
    return dataArray;
  }
}
