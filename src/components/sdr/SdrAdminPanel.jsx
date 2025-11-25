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
  if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(3)} MHz`;
  if (hz >= 1_000) return `${(hz / 1_000).toFixed(1)} kHz`;
  return `${hz.toFixed(0)} Hz`;
};

export default function SdrAdminPanel({ operationId }) {
  const navigate = useNavigate();
  const { timeLeft } = useCountdown(operationId);
  const { session } = useSession(operationId);
  const [sdrState, setSdrState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isJamming, setIsJamming] = useState(false);
  const engineRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const audioRef = useRef(null);
  const operationStarted = session?.operationStarted;
  const transmissionMap = useMemo(() => {
    const map = new Map();
    audioTransmissions.forEach((entry) => map.set(entry.id, entry));
    return map;
  }, []);

  useEffect(() => {
    const engine = new AudioEngine();
    audioRef.current = engine;
    let cancelled = false;

    (async () => {
      await engine.init();
      await engine.loadCatalog(audioTransmissions);
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
      engine.stopAll();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!operationId || !operationStarted) return;
    const engine = new FakeRFEngine(operationId);
    engineRef.current = engine;
    engine.startEngine();

    const offload = engine.onFrame((frame) => {
      const timestamp = Date.parse(frame.updatedAt) || Date.now();
      lastUpdateRef.current = timestamp;
      setSdrState(prev => {
        const mergedState = { ...(prev || {}), ...frame };
        if (audioRef.current) {
          audioRef.current.updateState({
            centerFreq: mergedState.centerFreq,
            span: mergedState.span,
            signals: mergedState.signals,
            jamming: mergedState.jamming
          });
        }
        return mergedState;
      });
      setIsJamming(Boolean(frame.jamming));
      setLoading(false);
    });

    return () => {
      offload();
      engine.stopEngine();
      engineRef.current = null;
    };
  }, [operationId, operationStarted]);

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
          fftData: [],
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
        setIsJamming(Boolean(data?.jamming));
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

  const centerFreq = sdrState?.centerFreq ?? DEFAULT_CENTER_FREQ;
  const span = sdrState?.span ?? DEFAULT_SPAN;
  const noiseFloor = sdrState?.noiseFloor ?? DEFAULT_NOISE_FLOOR;
  const fftData = sdrState?.fftData ?? [];
  const signals = sdrState?.signals ?? [];
  const broadcastSignals = signals.filter((signal) => signal.type === 'broadcast');

  const handleCenterFreq = (value) => {
    engineRef.current?.setCenterFreq(value);
    setSdrState((prev) => ({ ...(prev || {}), centerFreq: value }));
  };

  const handleSpan = (value) => {
    engineRef.current?.setSpan(value);
    setSdrState((prev) => ({ ...(prev || {}), span: value }));
  };

  const handleNoiseFloor = (value) => {
    engineRef.current?.setNoiseFloor(value);
    setSdrState((prev) => ({ ...(prev || {}), noiseFloor: value }));
  };

  const addBroadcastSignal = (audioId) => {
    const engine = engineRef.current;
    if (!engine) return;
    const profile = transmissionMap.get(audioId);
    if (!profile) return;

    engine.addSignal({
      type: 'broadcast',
      freq: profile.frequencyHz ?? centerFreq + (profile.offsetHz || span * 0.08),
      power: profile.defaultPower ?? -25,
      width: profile.widthHz ?? span * 0.05,
      audioId: profile.id
    });
  };

  const addEnemySignal = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const offset = (Math.random() - 0.5) * span * 0.6;
    engine.addSignal({
      type: 'enemy',
      freq: centerFreq + offset,
      power: -40,
      width: span * 0.1
    });
  };

  const toggleJamming = () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (isJamming) {
      engine.stopJamming();
      setIsJamming(false);
      return;
    }
    engine.startJamming(centerFreq, span * 0.25);
    setIsJamming(true);
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
                  <path d="M12 4a1 1 0 0 1 1 1v2.764a4 4 0 1 1-2 0V5a1 1 0 0 1 1-1zm6.364.636a1 1 0 0 1 0 1.414 11 11 0 0 1 0 15.556 1 1 0 1 1-1.414-1.414 9 9 0 0 0 0-12.728 1 1 0 0 1 1.414-1.414zM5.636 4.636a1 1 0 0 1 1.414 1.414 9 9 0 0 0 0 12.728 1 1 0 1 1-1.414 1.414 11 11 0 0 1 0-15.556 1 1 0 0 1 0-1.414z"/>
                </svg>
              </div>
              <p className="text-sm uppercase tracking-[0.4em] text-slate-500">Spectrum Uplink</p>
              <h1 className="text-4xl md:text-5xl font-black text-white">UPLINK ESTABLISHED</h1>
              <p className="text-slate-300 text-lg">Awaiting mission initialization...</p>
              <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
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
          <div className="flex items-center gap-6 text-right">
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
                    min={50_000_000}
                    max={250_000_000}
                    value={centerFreq}
                    onChange={(e) => handleCenterFreq(Number(e.target.value))}
                    className="w-full accent-slate-200"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Span</span>
                    <span className="font-mono text-slate-200">{(span / 1_000_000).toFixed(2)} MHz</span>
                  </div>
                  <input
                    type="range"
                    min={1_000_000}
                    max={40_000_000}
                    value={span}
                    onChange={(e) => handleSpan(Number(e.target.value))}
                    className="w-full accent-slate-200"
                  />
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
                    onChange={(e) => handleNoiseFloor(Number(e.target.value))}
                    className="w-full accent-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#090d17] border border-slate-800 rounded-lg p-4 shadow-inner shadow-black/40">
              <p className="text-[11px] uppercase text-slate-500 mb-3">Signal Inject</p>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-400 mb-2">Broadcast Inject</p>
                  <div className="space-y-2">
                    {audioTransmissions.map((profile) => (
                      <button
                        key={profile.id}
                        onClick={() => addBroadcastSignal(profile.id)}
                        className="w-full py-2.5 rounded border border-emerald-400/60 text-emerald-200 text-sm font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 transition flex items-center justify-between"
                      >
                        <span>{profile.name}</span>
                        <span className="font-mono text-[11px] text-emerald-200">{formatFrequency(profile.frequencyHz ?? centerFreq)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-orange-400 mb-2">Other Injects</p>
                  <div className="space-y-2">
                    <button
                      onClick={addEnemySignal}
                      className="w-full py-2.5 rounded border border-orange-400/60 text-orange-200 text-sm font-semibold bg-orange-500/10 hover:bg-orange-500/20 transition"
                    >
                      Enemy Transmission
                    </button>
                    <button
                      onClick={toggleJamming}
                      className={`w-full py-2.5 rounded border text-sm font-semibold transition ${
                        isJamming
                          ? 'border-red-500/60 text-red-200 bg-red-600/20'
                          : 'border-red-500/40 text-red-200 bg-red-500/10 hover:bg-red-500/20'
                      }`}
                    >
                      {isJamming ? 'Stop Jamming' : 'Start Jamming'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#090d17] border border-slate-800 rounded-lg p-4 shadow-inner shadow-black/40 text-[11px] text-slate-500">
              <p>Signals tracked: <span className="text-slate-200 font-semibold">{signals.length}</span></p>
              <p className="mt-1">Firestore sync active.</p>
            </div>
          </aside>

          <main className="flex-1 bg-[#04060c] p-6 flex flex-col gap-4">
            <div className="bg-[#050812] border border-slate-900 rounded-xl shadow-2xl shadow-black/50 p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                <span className="font-semibold text-slate-200 uppercase tracking-[0.3em] text-[10px]">Broadcast Hud</span>
                <span className="font-mono text-blue-200 text-sm">{broadcastSignals.length ? 'ACTIVE' : 'IDLE'}</span>
              </div>
              {broadcastSignals.length === 0 ? (
                <p className="text-slate-500 text-sm">No broadcast signals injected. Use the Broadcast Inject controls to queue one.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {broadcastSignals.map((signal) => {
                    const profile = signal.audioId ? transmissionMap.get(signal.audioId) : null;
                    return (
                      <div key={signal.id} className="bg-[#070b16] border border-slate-800 rounded-lg px-3 py-3">
                        <p className="text-white text-sm font-semibold">{profile?.name || 'Broadcast Signal'}</p>
                        <p className="font-mono text-lg text-blue-200 tracking-widest">{formatFrequency(signal.freq)}</p>
                        <p className="text-[11px] text-slate-400">Dial exactly to hear audio</p>
                        {profile?.notes && (
                          <p className="text-[11px] text-slate-500 mt-1">{profile.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="bg-[#050812] border border-slate-900 rounded-xl shadow-2xl shadow-black/50 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-slate-300 text-sm">
                <span className="font-semibold">Spectrum Display</span>
                <span className="font-mono text-xs text-blue-200">
                  {formatFrequency(centerFreq)} ± {(span / 2_000_000).toFixed(2)} MHz
                </span>
              </div>
              <SpectrumCanvas
                fftData={fftData}
                centerFreq={centerFreq}
                span={span}
                onChangeCenterFreq={handleCenterFreq}
                onChangeSpan={handleSpan}
              />
              <WaterfallCanvas fftData={fftData} />
            </div>

            <div className="bg-[#050812] border border-slate-900 rounded-xl shadow-2xl shadow-black/50 p-4 flex-1 overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                <span className="font-semibold text-slate-200">Signals</span>
                <span>RF Scene Feed</span>
              </div>
              <div className="h-full overflow-y-auto pr-2 space-y-2">
                {signals.length === 0 && (
                  <div className="text-sm text-slate-500">No active transmissions.</div>
                )}
                {signals.map((signal) => (
                  <div key={signal.id} className="flex items-center justify-between bg-[#070b16] border border-slate-800 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-white text-sm font-semibold capitalize">{signal.type}</p>
                      <p className="text-[11px] text-slate-400">{formatFrequency(signal.freq)}</p>
                    </div>
                    <div className="text-right text-[11px] text-slate-400">
                      <p>{signal.power?.toFixed ? signal.power.toFixed(0) : signal.power} dB</p>
                      <p>{(signal.width / 1_000).toFixed(0)} kHz</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
      {loading && (
        <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center text-white">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm uppercase tracking-widest text-slate-400">Linking Spectrum Nodes…</p>
          </div>
        </div>
      )}
    </div>
  );
}
