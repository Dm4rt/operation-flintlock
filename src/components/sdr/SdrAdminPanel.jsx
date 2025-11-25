import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import SpectrumCanvas from './SpectrumCanvas';
import WaterfallCanvas from './WaterfallCanvas';
import FakeRFEngine, { DEFAULT_CENTER_FREQ, DEFAULT_SPAN, DEFAULT_NOISE_FLOOR } from '../../engine/FakeRFEngine';
import AudioEngine from '../../audio/AudioEngine';
import audioTransmissions from '../../data/audioTransmissions.json';
import { db } from '../../services/firebase';
import useCountdown from '../../hooks/useCountdown';
import useSession from '../../hooks/useSession';
import StarBackground from '../StarBackground';

const formatFrequency = (hz = 0) => {
  if (!Number.isFinite(hz)) return '---';
  if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(3)} MHz`;
  if (hz >= 1_000) return `${(hz / 1_000).toFixed(1)} kHz`;
  return `${hz.toFixed(0)} Hz`;
};

export default function SdrAdminPanel({ operationId }) {
  const navigate = useNavigate();
  const { timeLeft } = useCountdown(operationId);
  const { session, join } = useSession(operationId);

  const [sdrState, setSdrState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState(null);
  const [volume, setVolume] = useState(0.75);
  const [isPaused, setIsPaused] = useState(false); // Start unpaused so spectrum shows immediately
  const [centerField, setCenterField] = useState((DEFAULT_CENTER_FREQ / 1_000_000).toFixed(3));
  const [spanField, setSpanField] = useState((DEFAULT_SPAN / 1_000_000).toFixed(2));

  const engineRef = useRef(null);
  const audioRef = useRef(null);
  const volumeRef = useRef(volume);
  const lastUpdateRef = useRef(0);

  const operationStarted = session?.operationStarted;

  // Register team presence
  useEffect(() => {
    if (!operationId) return;
    (async () => {
      try {
        await join('ew', { name: 'Space Ops - EW' });
        console.log('✅ EW team registered in participants');
      } catch (error) {
        console.error('❌ Failed to register EW team:', error);
      }
    })();
  }, [operationId, join]);

  const transmissionMap = useMemo(() => {
    const map = new Map();
    audioTransmissions.forEach((entry) => map.set(entry.id, entry));
    return map;
  }, []);

  const defaultSignalConfigs = useMemo(() => (
    audioTransmissions.map((profile) => ({
      id: profile.id,
      type: 'broadcast',
      freq: profile.frequencyHz ?? DEFAULT_CENTER_FREQ,
      power: profile.defaultPower ?? -26,
      width: profile.widthHz ?? DEFAULT_SPAN * 0.05,
      audioId: profile.id,
      label: profile.name
    }))
  ), []);

  useEffect(() => {
    if (!operationStarted) return;

    const engine = new AudioEngine();
    audioRef.current = engine;
    let cancelled = false;

    const bootstrap = async () => {
      try {
        await engine.init();
        await engine.loadCatalog(audioTransmissions);
        if (cancelled) return;
        engine.setMasterVolume(volumeRef.current);
        setAudioReady(engine.isReady());
      } catch (error) {
        if (!cancelled) setAudioError(error.message);
      }
    };

    bootstrap();

    const handleFirstInteraction = async () => {
      try {
        const ready = await engine.resume();
        if (!ready) {
          setAudioError('Audio context blocked by browser.');
          return;
        }
        await engine.loadCatalog(audioTransmissions);
        engine.setMasterVolume(volumeRef.current);
        setAudioReady(true);
        setAudioError(null);
      } catch (error) {
        setAudioError(error.message);
      }
    };

    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', handleFirstInteraction);
      engine.stopAll();
      audioRef.current = null;
    };
  }, [operationStarted]);

  useEffect(() => {
    if (!operationId || !operationStarted) return;

    const engine = new FakeRFEngine(operationId);
    engineRef.current = engine;

    const unsubscribe = engine.onFrame((frame) => {
      const timestamp = Date.parse(frame.updatedAt) || Date.now();
      lastUpdateRef.current = timestamp;
      setSdrState((prev) => {
        const merged = { ...(prev || {}), ...frame };
        audioRef.current?.updateState({
          centerFreq: merged.centerFreq,
          span: merged.span,
          signals: merged.signals,
          jamming: merged.jamming
        });
        return merged;
      });
      setLoading(false);
    });

    engine.startEngine();
    engine.ensureSignals(defaultSignalConfigs);
    engine.forceSync();

    return () => {
      unsubscribe();
      engine.stopEngine();
      engineRef.current = null;
    };
  }, [operationId, operationStarted, defaultSignalConfigs]);

  // Real-time FFT from AudioEngine analyser
  useEffect(() => {
    if (!audioReady) return;

    let animationId;
    const updateFFT = () => {
      if (audioRef.current) {
        const fft = audioRef.current.getFFTData();
        setSdrState(prev => ({ ...prev, fftData: Array.from(fft) }));
      }
      animationId = requestAnimationFrame(updateFFT);
    };
    
    updateFFT();
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [audioReady]);

  useEffect(() => {
    if (!operationId) return;
    const stateDoc = doc(db, 'sessions', operationId, 'sdrState', 'state');

    const unsubscribe = onSnapshot(stateDoc, async (snapshot) => {
      if (!snapshot.exists()) {
        await setDoc(stateDoc, {
          centerFreq: DEFAULT_CENTER_FREQ,
          span: DEFAULT_SPAN,
          noiseFloor: DEFAULT_NOISE_FLOOR,
          signals: [],
          jamming: null,
          updatedAt: new Date().toISOString()
        });
        return;
      }

      const data = snapshot.data();
      const timestamp = Date.parse(data.updatedAt || new Date().toISOString());
      if (timestamp >= lastUpdateRef.current) {
        lastUpdateRef.current = timestamp;
        setSdrState(data);
        audioRef.current?.updateState({
          centerFreq: data.centerFreq,
          span: data.span,
          signals: data.signals,
          jamming: data.jamming
        });
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [operationId]);

  useEffect(() => {
    volumeRef.current = volume;
    audioRef.current?.setMasterVolume(volume);
  }, [volume]);

  const centerFreq = sdrState?.centerFreq ?? DEFAULT_CENTER_FREQ;
  const span = sdrState?.span ?? DEFAULT_SPAN;
  const noiseFloor = sdrState?.noiseFloor ?? DEFAULT_NOISE_FLOOR;
  const fftData = sdrState?.fftData ?? [];
  const signals = sdrState?.signals ?? [];

  // Debug: log real audio FFT stats
  useEffect(() => {
    if (fftData.length > 0 && audioReady) {
      const finite = fftData.filter(v => Number.isFinite(v));
      if (finite.length > 0) {
        console.log(`📊 Real Audio FFT: ${fftData.length} bins, range: [${Math.min(...finite).toFixed(1)}, ${Math.max(...finite).toFixed(1)}] dB`);
      }
    }
  }, [fftData, audioReady]);

  useEffect(() => {
    setCenterField((centerFreq / 1_000_000).toFixed(3));
  }, [centerFreq]);

  useEffect(() => {
    setSpanField((span / 1_000_000).toFixed(2));
  }, [span]);

  const dbRange = useMemo(() => {
    if (!fftData?.length) {
      return { min: noiseFloor - 45, max: noiseFloor + 15 };
    }
    const finite = fftData.filter((value) => Number.isFinite(value));
    if (!finite.length) {
      return { min: noiseFloor - 45, max: noiseFloor + 15 };
    }
    const localMin = Math.min(...finite);
    const localMax = Math.max(...finite);
    return {
      min: Math.min(localMin - 8, noiseFloor - 55),
      max: Math.max(localMax + 6, noiseFloor + 20)
    };
  }, [fftData, noiseFloor]);

  const handleCenterFreq = (value) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setCenterFreq(value);
    engine.forceSync();
    setSdrState((prev) => ({ ...(prev || {}), centerFreq: value }));
  };

  const handleSpan = (value) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setSpan(value);
    engine.forceSync();
    setSdrState((prev) => ({ ...(prev || {}), span: value }));
  };

  const handleNoiseFloor = (value) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setNoiseFloor(value);
    engine.forceSync();
    setSdrState((prev) => ({ ...(prev || {}), noiseFloor: value }));
  };

  const commitCenterField = () => {
    const parsed = parseFloat(centerField);
    if (Number.isNaN(parsed)) return;
    handleCenterFreq(Math.round(parsed * 1_000_000));
  };

  const commitSpanField = () => {
    const parsed = parseFloat(spanField);
    if (Number.isNaN(parsed)) return;
    handleSpan(Math.round(parsed * 1_000_000));
  };

  const handleEnableAudio = async () => {
    if (!audioRef.current) return;
    try {
      const ready = await audioRef.current.resume();
      if (!ready) {
        setAudioError('Audio context blocked by browser.');
        return;
      }
      await audioRef.current.loadCatalog(audioTransmissions);
      audioRef.current.setMasterVolume(volumeRef.current);
      setAudioReady(true);
      setIsPaused(false);
      setAudioError(null);
    } catch (error) {
      setAudioError(error.message);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPaused) {
      audioRef.current.unmute();
      setIsPaused(false);
    } else {
      audioRef.current.mute();
      setIsPaused(true);
    }
  };

  if (!operationId) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-white">
        <p className="text-lg font-semibold">No operation selected.</p>
      </div>
    );
  }

  if (!operationStarted) {
    return (
      <div className="relative min-h-screen bg-slate-950 overflow-hidden">
        <StarBackground className="absolute inset-0" />
        <div className="relative z-10 flex items-center justify-center min-h-screen px-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-[32px] max-w-3xl w-full p-12 text-center space-y-8 shadow-2xl shadow-black/70">
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-orange-500/20 border border-orange-400 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-8 h-8 text-orange-400 fill-current">
                  <path d="M12 4a1 1 0 0 1 1 1v2.764a4 4 0 1 1-2 0V5a1 1 0 0 1 1-1zm6.364.636a1 1 0 0 1 0 1.414 11 11 0 0 1 0 15.556 1 1 0 1 1-1.414-1.414 9 9 0 0 0 0-12.728 1 1 0 0 1 1.414-1.414zM5.636 4.636a1 1 0 0 1 1.414 1.414 9 9 0 0 0 0 12.728 1 1 0 1 1-1.414 1.414 11 11 0 0 1 0-15.556 1 1 0 0 1 0-1.414z" />
                </svg>
              </div>
              <p className="text-sm uppercase tracking-[0.4em] text-slate-500">Spectrum Uplink</p>
              <h1 className="text-4xl md:text-5xl font-black text-white">UPLINK ESTABLISHED</h1>
              <p className="text-slate-300 text-lg">Awaiting mission initialization...</p>
              <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Connected to Mission Control</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
              <div>
                <p className="text-xs uppercase text-slate-500">Role</p>
                <p className="text-2xl font-bold text-white mt-1">Space Ops - EW</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Cipher</p>
                <p className="text-2xl font-mono font-black text-red-500 mt-1">{operationId}</p>
              </div>
            </div>

            <button
              onClick={() => navigate('/')}
              className="w-full py-3 rounded-xl bg-red-600 text-white font-bold text-sm tracking-wide hover:bg-red-500"
            >
              TERMINATE SESSION
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-[#05070f] overflow-hidden">
      <StarBackground className="absolute inset-0 opacity-40" />
      <div className="relative z-10 h-full flex flex-col">
        <header className="px-6 py-4 bg-gradient-to-r from-slate-950 via-[#080d1a] to-slate-950 border-b border-slate-800 shadow-lg shadow-black/50 flex items-center justify-between">
          <div className="flex items-center gap-4 text-slate-300">
            <div className="bg-blue-600/20 border border-blue-400/40 text-blue-200 rounded px-3 py-1 text-xs uppercase tracking-[0.3em]">EW</div>
            <div>
              <p className="text-[11px] uppercase text-slate-500">Electronic Warfare Operations</p>
              <h1 className="text-xl font-black text-white">Space Ops Console</h1>
            </div>
          </div>
          <div className="flex items-center gap-8 text-right">
            <div>
              <p className="text-[11px] uppercase text-slate-500">Center Frequency</p>
              <div className="flex items-center gap-1">
                {centerField.split('').map((char, idx) => (
                  char === '.' ? (
                    <span key={idx} className="text-3xl font-mono font-black text-blue-200">.</span>
                  ) : (
                    <input
                      key={idx}
                      type="text"
                      maxLength={1}
                      value={char}
                      onChange={(e) => {
                        const newVal = e.target.value;
                        if (!/^[0-9]$/.test(newVal) && newVal !== '') return;
                        const arr = centerField.split('');
                        arr[idx] = newVal || '0';
                        const newFreq = arr.join('');
                        setCenterField(newFreq);
                        const parsed = parseFloat(newFreq);
                        if (!Number.isNaN(parsed)) {
                          handleCenterFreq(Math.round(parsed * 1_000_000));
                        }
                      }}
                      className="w-7 h-10 text-center text-3xl font-mono font-black text-blue-200 bg-slate-800/50 border border-slate-700 rounded focus:outline-none focus:border-blue-400"
                    />
                  )
                ))}
                <span className="text-base font-semibold text-blue-200 ml-2">MHz</span>
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase text-slate-500">Span</p>
              <p className="text-lg font-mono text-slate-200">{(span / 1_000_000).toFixed(2)} MHz</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-slate-500">Mission Timer</p>
              <p className="text-2xl font-mono font-black text-blue-200">
                {String(Math.floor((timeLeft || 0) / 60)).padStart(2, '0')}:
                {String((timeLeft || 0) % 60).padStart(2, '0')}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-slate-500">Operation ID</p>
              <p className="text-lg font-mono text-slate-200">{operationId}</p>
            </div>
          </div>
        </header>

        <div className="flex-1 flex">
          <aside className="w-72 bg-[#0c111f] border-r border-slate-900 px-4 py-6 flex flex-col gap-6">
            <div className="bg-[#090d17] border border-slate-800 rounded-lg p-4 shadow-inner shadow-black/40">
              <p className="text-[11px] uppercase text-slate-500 mb-3">Band Controls</p>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Center</span>
                    <span className="font-mono text-slate-200">{formatFrequency(centerFreq)}</span>
                  </div>
                  <input
                    type="range"
                    min={80_000_000}
                    max={130_000_000}
                    value={centerFreq}
                    onChange={(event) => handleCenterFreq(Number(event.target.value))}
                    className="w-full accent-slate-200"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      value={centerField}
                      onChange={(event) => setCenterField(event.target.value)}
                      onBlur={commitCenterField}
                      onKeyDown={(event) => { if (event.key === 'Enter') commitCenterField(); }}
                      step={0.001}
                      className="w-full rounded bg-[#0f1424] border border-slate-800 px-2 py-1 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-blue-400"
                    />
                    <span className="text-[11px] text-slate-500">MHz</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Span</span>
                    <span className="font-mono text-slate-200">{(span / 1_000_000).toFixed(2)} MHz</span>
                  </div>
                  <input
                    type="range"
                    min={200_000}
                    max={30_000_000}
                    value={span}
                    onChange={(event) => handleSpan(Number(event.target.value))}
                    className="w-full accent-slate-200"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      value={spanField}
                      onChange={(event) => setSpanField(event.target.value)}
                      onBlur={commitSpanField}
                      onKeyDown={(event) => { if (event.key === 'Enter') commitSpanField(); }}
                      step={0.01}
                      className="w-full rounded bg-[#0f1424] border border-slate-800 px-2 py-1 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-blue-400"
                    />
                    <span className="text-[11px] text-slate-500">MHz</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Noise Floor</span>
                    <span className="font-mono text-slate-200">{noiseFloor.toFixed(0)} dB</span>
                  </div>
                  <input
                    type="range"
                    min={-140}
                    max={-60}
                    value={noiseFloor}
                    onChange={(event) => handleNoiseFloor(Number(event.target.value))}
                    className="w-full accent-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#090d17] border border-slate-800 rounded-lg p-4 shadow-inner shadow-black/40">
              <p className="text-[11px] uppercase text-slate-500 mb-3">Spectrum Control</p>
              {!audioReady ? (
                <button
                  onClick={handleEnableAudio}
                  className="w-full py-2.5 rounded border border-blue-400/60 text-blue-200 bg-blue-500/10 hover:bg-blue-500/20 text-sm font-semibold tracking-wide transition flex items-center justify-center gap-2"
                >
                  Enable Audio
                </button>
              ) : (
                <button
                  onClick={handlePlayPause}
                  className={`w-full py-2.5 rounded border text-sm font-semibold tracking-wide transition flex items-center justify-center gap-2 ${
                    isPaused
                      ? 'border-emerald-400/60 text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20'
                      : 'border-amber-400/60 text-amber-200 bg-amber-500/10 hover:bg-amber-500/20'
                  }`}
                >
                  {isPaused ? '▶ Start Listening' : '⏸ Pause Listening'}
                </button>
              )}
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span>Volume</span>
                  <span className="font-mono text-slate-200">{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  className="w-full accent-slate-200"
                />
              </div>
              {audioError && (
                <p className="text-[10px] text-red-400 mt-2 leading-tight">{audioError}</p>
              )}
              {!audioReady && !audioError && (
                <p className="text-[10px] text-slate-500 mt-2 leading-tight">Browser audio may require a click before playback starts.</p>
              )}
            </div>

            <div className="bg-[#090d17] border border-slate-800 rounded-lg p-4 shadow-inner shadow-black/40 text-[11px] text-slate-500">
              <p>
                Signals tracked: <span className="text-slate-200 font-semibold">{signals.length}</span>
              </p>
              <p className="mt-1">Firestore sync active.</p>
            </div>
          </aside>

          <main className="flex-1 bg-[#04060c] p-6 flex flex-col gap-4">
            <div className="bg-[#050812] border border-slate-900 rounded-xl shadow-2xl shadow-black/50 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-slate-300 text-sm">
                <span className="font-semibold">Spectrum Display</span>
                <span className="font-mono text-xs text-blue-200">
                  {formatFrequency(centerFreq)} ± {(span / 2_000_000).toFixed(2)} MHz
                </span>
              </div>
              <SpectrumCanvas
                fftData={isPaused ? [] : fftData}
                centerFreq={centerFreq}
                span={span}
                onChangeCenterFreq={handleCenterFreq}
                onChangeSpan={handleSpan}
                height={220}
                noiseFloor={noiseFloor}
                minDb={dbRange.min}
                maxDb={dbRange.max}
              />
              {!audioReady && (
                <p className="text-[11px] text-amber-300 uppercase tracking-[0.3em]">Audio muted -- click Enable Audio to monitor broadcasts</p>
              )}
              <WaterfallCanvas
                fftData={isPaused ? [] : fftData}
                height={380}
                minDb={dbRange.min}
                maxDb={dbRange.max}
              />
            </div>

            <div className="bg-[#050812] border border-slate-900 rounded-xl shadow-2xl shadow-black/50 p-4 flex-1 overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                <span className="font-semibold text-slate-200 uppercase tracking-[0.3em] text-[10px]">Active Signals</span>
                <span className="font-mono text-blue-200 text-sm">{signals.length ? 'ONLINE' : 'IDLE'}</span>
              </div>
              <div className="h-full overflow-y-auto pr-2 space-y-2">
                {signals.length === 0 && (
                  <div className="text-sm text-slate-500">No active transmissions.</div>
                )}
                {signals.map((signal) => {
                  const profile = signal.audioId ? transmissionMap.get(signal.audioId) : null;
                  return (
                    <div
                      key={signal.id}
                      className="flex items-center justify-between bg-[#070b16] border border-slate-800 rounded-lg px-3 py-2"
                    >
                      <div>
                        <p className="text-white text-sm font-semibold">{profile?.name || signal.label || signal.type}</p>
                        <p className="text-[11px] text-slate-400">{formatFrequency(signal.freq)}</p>
                      </div>
                      <div className="text-right text-[11px] text-slate-400">
                        <p>{signal.power?.toFixed ? signal.power.toFixed(0) : signal.power} dB</p>
                        <p>{(signal.width / 1_000).toFixed(0)} kHz</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </main>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center text-white">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm uppercase tracking-widest text-slate-400">Linking Spectrum Nodes...</p>
          </div>
        </div>
      )}
    </div>
  );
}

