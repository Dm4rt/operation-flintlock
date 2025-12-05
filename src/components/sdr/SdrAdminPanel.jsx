import React, { useEffect, useMemo, useRef, useState } from 'react';
import SimpleTuner from '../../engine/SimpleTuner';
import transmissions from '../../data/audioTransmissions.json';
import useCountdown from '../../hooks/useCountdown';
import useSession from '../../hooks/useSession';
import { useFlintlockSocket } from '../../hooks/useFlintlockSocket';
import StarBackground from '../StarBackground';
import SpectrumCanvas from './SpectrumCanvas';
import WaterfallCanvas from './WaterfallCanvas';
import { INJECT_CATALOG } from '../../data/injectCatalog';

const formatFreq = (hz) => {
  if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(3)} MHz`;
  if (hz >= 1_000) return `${(hz / 1_000).toFixed(1)} kHz`;
  return `${hz.toFixed(0)} Hz`;
};

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

export default function SdrAdminPanel({ operationId }) {
  const { session, join } = useSession(operationId);
  const socket = useFlintlockSocket(operationId, 'ew', 'Space Ops - EW');
  const { timeLeft } = useCountdown(socket);

  const tunerRef = useRef(null);
  const ewInjectCatalog = useMemo(() => INJECT_CATALOG.ew || [], []);
  const [injectStatus, setInjectStatus] = useState(() =>
    ewInjectCatalog.map((item) => ({
      ...item,
      status: 'idle',
      lastTriggered: null
    }))
  );

  const [audioReady, setAudioReady] = useState(false);
  const [volume, setVolume] = useState(0.75);
  const [isPaused, setIsPaused] = useState(false);

  const [centerFreq, setCenterFreq] = useState(100_800_000);
  const [bandwidthHz, setBandwidthHz] = useState(200_000);
  const [minDb, setMinDb] = useState(-120);
  const [maxDb, setMaxDb] = useState(-20);
  const [span, setSpan] = useState(10_000_000);

  // Jamming state - track modified transmissions with active jammers
  const [jammerSignals, setJammerSignals] = useState(transmissions);
  const [newJammer, setNewJammer] = useState({
    frequencyHz: 100000000,
    widthHz: 180000,
    minDb: -120,
    maxDb: -20,
    peakStrength: 0.85
  });
  const [showJammerForm, setShowJammerForm] = useState(false);

  // Spectrum outage state
  const [spectrumOutage, setSpectrumOutage] = useState({
    active: false,
    component: null // 'waterfall', 'spectrum', or 'tuning'
  });

  const operationStarted = session?.operationStarted;

  // Register EW team
  useEffect(() => {
    if (!operationId) return;
    (async () => {
      try {
        await join('ew', { name: 'Space Ops - EW' });
        console.log('✅ EW team registered');
      } catch (err) {
        console.error('❌ EW registration failed', err);
      }
    })();
  }, [operationId, join]);

  // Init tuner
  useEffect(() => {
    if (!operationStarted) return;

    const tuner = new SimpleTuner();
    tunerRef.current = tuner;

    const bootstrap = async () => {
      await tuner.init();
      tuner.setVolume(volume);
      setAudioReady(tuner.isReady());
    };
    bootstrap();

    const handleClick = async () => {
      const ready = await tuner.resume();
      if (ready) {
        tuner.setVolume(volume);
        setAudioReady(true);
      }
    };
    window.addEventListener('pointerdown', handleClick, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handleClick);
      tuner.stopAll();
      tunerRef.current = null;
    };
  }, [operationStarted, volume]);

  // Get count of active jammers
  const activeJammerCount = useMemo(() => 
    jammerSignals.filter(s => s.isJammer && s.active).length,
    [jammerSignals]
  );

  // Update tuning when controls change or jammers update
  useEffect(() => {
    console.log('[SDR] Updating tuner with', jammerSignals.length, 'signals');
    tunerRef.current?.updateTuning({ 
      centerFreq, 
      bandwidthHz, 
      minDb, 
      maxDb,
      allSignals: jammerSignals 
    });
  }, [centerFreq, bandwidthHz, minDb, maxDb, jammerSignals]);

  useEffect(() => {
    tunerRef.current?.setVolume(volume);
  }, [volume]);

  const handleEnableAudio = async () => {
    if (!tunerRef.current) return;
    const ready = await tunerRef.current.resume();
    if (ready) {
      tunerRef.current.setVolume(volume);
      setAudioReady(true);
      setIsPaused(false);
    }
  };

  const handlePlayPause = () => {
    if (!tunerRef.current) return;
    if (isPaused) {
      tunerRef.current.unmute();
      setIsPaused(false);
    } else {
      tunerRef.current.mute();
      setIsPaused(true);
    }
  };

  const handleCenterChange = (freq) => {
    setCenterFreq(freq);
  };

  const handleSpanChange = (newSpan) => {
    const limited = clamp(newSpan, 2_000_000, 40_000_000);
    setSpan(limited);
  };

  const isLocked = (tx) => {
    const freqError = Math.abs(centerFreq - tx.frequencyHz);
    const bwError = Math.abs(bandwidthHz - tx.widthHz);
    const freqTolerance = tx.widthHz * 0.5;
    const bwTolerance = tx.widthHz * 0.3;
    const freqOk = freqError <= freqTolerance;
    const bwOk = bwError <= bwTolerance;
    const minOk = minDb <= tx.minDb + 5;
    const maxOk = maxDb >= tx.maxDb - 5;
    return freqOk && bwOk && minOk && maxOk;
  };

  // Jamming functions
  const handleAddJammer = () => {
    if (activeJammerCount >= 4) {
      alert('Maximum 4 jammers allowed. Remove one to add another.');
      return;
    }

    // Find the first inactive jammer slot
    const jammerIndex = jammerSignals.findIndex(s => s.isJammer && !s.active);
    if (jammerIndex === -1) {
      alert('No jammer slots available');
      return;
    }

    // Update the jammer signal with new settings
    const updatedSignals = [...jammerSignals];
    updatedSignals[jammerIndex] = {
      ...updatedSignals[jammerIndex],
      frequencyHz: newJammer.frequencyHz,
      widthHz: newJammer.widthHz,
      minDb: newJammer.minDb,
      maxDb: newJammer.maxDb,
      peakStrength: newJammer.peakStrength,
      active: true
    };

    console.log('[SDR] Activating jammer:', updatedSignals[jammerIndex]);
    setJammerSignals(updatedSignals);
    setShowJammerForm(false);

    // Broadcast via Socket.IO
    if (socket.isConnected) {
      socket.emitJammingUpdate(updatedSignals);
    }

    // Reset form
    setNewJammer({
      frequencyHz: 100000000,
      widthHz: 180000,
      minDb: -120,
      maxDb: -20,
      peakStrength: 0.85
    });
  };

  const handleRemoveJammer = (jammerId) => {
    const updatedSignals = jammerSignals.map(s => 
      s.id === jammerId ? { ...s, active: false } : s
    );
    setJammerSignals(updatedSignals);

    // Broadcast via Socket.IO
    if (socket.isConnected) {
      socket.emitJammingUpdate(updatedSignals);
    }
  };

  // Listen for jamming updates from other clients
  useEffect(() => {
    if (!socket?.isConnected) return;

    const unsubscribeJamming = socket.on('jamming:update', ({ signals }) => {
      console.log('[SDR] Received jamming update');
      if (signals) {
        setJammerSignals(signals);
      }
    });

    return () => {
      unsubscribeJamming();
    };
  }, [socket, socket?.isConnected]);

  // Subscribe to Firestore inject state (like Flint files)
  useEffect(() => {
    if (!operationId) return;

    const setupSubscription = async () => {
      const { collection, onSnapshot, query, where } = await import('firebase/firestore');
      const { db } = await import('../../services/firebase');
      
      const injectsRef = collection(db, 'sessions', operationId, 'injects');
      const q = query(injectsRef, where('team', '==', 'ew'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log('[SDR/EW] Firestore snapshot:', snapshot.size, 'injects');
        
        setInjectStatus((prev) => {
          const updated = [...prev];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            console.log('[SDR/EW] 📡 INJECT UPDATE:', data);
            const index = updated.findIndex(i => i.id === data.type);
            if (index >= 0) {
              updated[index] = {
                ...updated[index],
                status: data.status || 'idle',
                lastTriggered: data.updatedAt ? new Date(data.updatedAt) : null
              };
            }

            // Handle satellite-dropout inject: add bad signal to spectrum
            if (data.type === 'satellite-dropout' && data.status === 'active' && data.payload?.badFrequency) {
              const badFreqHz = data.payload.badFrequency;
              
              console.log('[SDR/EW] Adding bad signal at', badFreqHz / 1_000_000, 'MHz');
              setJammerSignals(prev => {
                // Check if bad signal already exists
                const existingBadSignal = prev.find(s => s.id === 'bad-signal-dropout');
                if (existingBadSignal) {
                  return prev;
                }
                
                return [
                  ...prev,
                  {
                    id: 'bad-signal-dropout',
                    frequencyHz: badFreqHz,
                    widthHz: 250_000,
                    minDb: -100,
                    maxDb: -30,
                    peakStrength: 0.9,
                    active: true,
                    isBadSignal: true,
                    name: 'Unknown Interference',
                    audioPath: '/audio/jamming.mp3'
                  }
                ];
              });
            }

            // Handle morse code signal injects: add morse signal to spectrum
            if ((data.type === 'morse-coords' || data.type === 'morse-island' || data.type === 'morse-sam') && 
                data.status === 'active' && data.payload?.frequency) {
              const signalFreqHz = data.payload.frequency;
              const audioFile = data.payload.audioFile || 'coordsMorse.wav';
              const signalId = `morse-signal-${data.type}`;
              
              console.log('[SDR/EW] Adding morse signal at', signalFreqHz / 1_000_000, 'MHz');
              setJammerSignals(prev => {
                // Check if signal already exists
                const existingSignal = prev.find(s => s.id === signalId);
                if (existingSignal) {
                  return prev;
                }
                
                return [
                  ...prev,
                  {
                    id: signalId,
                    frequencyHz: signalFreqHz,
                    widthHz: 200_000,
                    minDb: -100,
                    maxDb: -35,
                    peakStrength: 0.85,
                    active: true,
                    name: 'Unidentified Signal',
                    audioPath: `/audio/${audioFile}`
                  }
                ];
              });
            }

            // Remove morse signal when inject is reset to idle
            if ((data.type === 'morse-coords' || data.type === 'morse-island' || data.type === 'morse-sam') && 
                data.status === 'idle') {
              const signalId = `morse-signal-${data.type}`;
              console.log('[SDR/EW] Removing morse signal (inject reset)');
              
              setJammerSignals(prev => {
                const hasSignal = prev.some(s => s.id === signalId);
                if (!hasSignal) {
                  return prev;
                }
                
                if (tunerRef.current) {
                  tunerRef.current.stopAll();
                }
                
                return prev.filter(s => s.id !== signalId);
              });
            }

            // Handle spectrum outage inject
            if (data.type === 'spectrum-outage' && data.status === 'active' && data.payload?.component) {
              console.log('[SDR/EW] Spectrum outage -', data.payload.component, 'failed');
              setSpectrumOutage({
                active: true,
                component: data.payload.component
              });
            }

            // Clear spectrum outage when resolved or reset
            if (data.type === 'spectrum-outage' && (data.status === 'resolved' || data.status === 'idle')) {
              console.log('[SDR/EW] 🔧 Spectrum outage cleared - status:', data.status);
              console.log('[SDR/EW] 🔧 Resolved by:', data.resolvedBy);
              setSpectrumOutage({
                active: false,
                component: null
              });
            }

            // Remove bad signal when inject is resolved or reset to idle
            if (data.type === 'satellite-dropout' && (data.status === 'resolved' || data.status === 'idle')) {
              console.log('[SDR/EW] Removing bad signal (inject resolved/reset)');
              
              setJammerSignals(prev => {
                const hasBadSignal = prev.some(s => s.id === 'bad-signal-dropout');
                if (!hasBadSignal) {
                  console.log('[SDR/EW] Bad signal already removed');
                  return prev;
                }
                
                // Force stop and remove bad signal from tuner
                if (tunerRef.current) {
                  tunerRef.current.stopAll();
                  console.log('[SDR/EW] Stopped all tuner signals to force refresh');
                }
                
                const filtered = prev.filter(s => s.id !== 'bad-signal-dropout');
                console.log('[SDR/EW] Signals after removal:', filtered.length, 'from', prev.length);
                return filtered;
              });
            }
          });
          return updated;
        });
      });

      return unsubscribe;
    };

    let unsubscribe;
    setupSubscription().then(unsub => { unsubscribe = unsub; });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [operationId]);

  // Check for jammer resolution of satellite-dropout inject
  useEffect(() => {
    if (!operationId) return;

    const checkJammerResolution = async () => {
      const { collection, getDocs, query, where, doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../../services/firebase');

      const injectsRef = collection(db, 'sessions', operationId, 'injects');
      const q = query(injectsRef, where('team', '==', 'ew'), where('type', '==', 'satellite-dropout'), where('status', '==', 'active'));
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return;

      snapshot.forEach(async (docSnap) => {
        const data = docSnap.data();
        const badFreqHz = data.payload?.badFrequency;
        
        if (!badFreqHz) return;

        // Check if any jammer is within range
        const resolvedByJammer = jammerSignals.find(s => 
          s.isJammer && 
          s.active && 
          Math.abs(s.frequencyHz - badFreqHz) <= 50_000
        );

        if (resolvedByJammer) {
          console.log('[SDR/EW] ✅ Jammer detected at bad frequency! Resolving inject...');
          const resolvedData = {
            status: 'resolved',
            resolvedAt: new Date().toISOString()
          };
          
          // Update both EW and SDA inject documents
          const ewInjectRef = doc(db, 'sessions', operationId, 'injects', 'ew-satellite-dropout');
          const sdaInjectRef = doc(db, 'sessions', operationId, 'injects', 'sda-satellite-dropout');
          
          await Promise.all([
            updateDoc(ewInjectRef, resolvedData).catch(err => console.error('[SDR/EW] Failed to resolve EW inject:', err)),
            updateDoc(sdaInjectRef, resolvedData).catch(err => console.error('[SDR/EW] Failed to resolve SDA inject:', err))
          ]);
        }
      });
    };

    // Check every 2 seconds
    const interval = setInterval(checkJammerResolution, 2000);

    return () => clearInterval(interval);
  }, [operationId, jammerSignals]);

  const visualsActive = !isPaused;

  return (
    <div className="relative min-h-screen bg-slate-950 text-white flex flex-col">
      <StarBackground />

      <div className="relative z-10 flex flex-col h-screen">
        <header className="bg-[#0a0f1e] border-b border-slate-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="px-3 py-1.5 rounded border border-blue-500 bg-blue-500/10">
                <span className="text-sm font-bold text-blue-200">E W</span>
              </div>
              <h1 className="text-xl font-bold text-slate-100">Space Ops Console</h1>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Electronic Warfare Operations</p>
            </div>
            <div className="flex items-center gap-6 text-right">
              <div>
                <p className="text-[11px] uppercase text-slate-500">Center Frequency</p>
                <div className="flex items-center gap-0.5">
                  {(() => {
                    const freqStr = String(centerFreq).padStart(9, '0');
                    const digits = freqStr.split('');
                    return digits.map((digit, idx) => {
                      const power = digits.length - 1 - idx;
                      const increment = Math.pow(10, power);
                      return (
                        <div key={idx} className="relative group">
                          <button
                            onClick={() => {
                              const newFreq = centerFreq + increment;
                              if (newFreq <= 130_000_000) setCenterFreq(newFreq);
                            }}
                            className="absolute -top-3 left-0 right-0 h-3 opacity-0 hover:opacity-100 flex items-center justify-center cursor-pointer"
                          >
                            <span className="text-[10px] text-blue-400">▲</span>
                          </button>
                          <span className="text-3xl font-mono font-black text-blue-200 hover:text-blue-300 cursor-pointer select-none">
                            {digit}
                          </span>
                          <button
                            onClick={() => {
                              const newFreq = centerFreq - increment;
                              if (newFreq >= 80_000_000) setCenterFreq(newFreq);
                            }}
                            className="absolute -bottom-3 left-0 right-0 h-3 opacity-0 hover:opacity-100 flex items-center justify-center cursor-pointer"
                          >
                            <span className="text-[10px] text-blue-400">▼</span>
                          </button>
                          {(idx === 2 || idx === 5) && <span className="text-3xl font-mono font-black text-blue-200/40 mx-0.5">.</span>}
                        </div>
                      );
                    });
                  })()}
                  <span className="text-lg font-mono text-slate-400 ml-2">MHz</span>
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase text-slate-500">Bandwidth</p>
                <p className="text-lg font-mono text-slate-200">{formatFreq(bandwidthHz)}</p>
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
          </div>
        </header>

        <div className="flex-1 flex">
          <aside className="w-72 bg-[#0c111f] border-r border-slate-900 px-4 py-6 flex flex-col gap-6">
            <div className={`bg-[#090d17] border border-slate-800 rounded-lg p-4 ${spectrumOutage.active && spectrumOutage.component === 'tuning' ? 'opacity-50 pointer-events-none' : ''}`}>
              <p className="text-[11px] uppercase text-slate-500 mb-3">
                Tuning Controls
                {spectrumOutage.active && spectrumOutage.component === 'tuning' && (
                  <span className="text-red-500 ml-2">⚠ OFFLINE</span>
                )}
              </p>
              {spectrumOutage.active && spectrumOutage.component === 'tuning' ? (
                <div className="h-48 bg-black rounded flex items-center justify-center border border-red-900/50">
                  <div className="text-center">
                    <p className="text-red-500 font-mono text-xs mb-1">⚠ SYSTEM OFFLINE ⚠</p>
                    <p className="text-red-500/60 font-mono text-[10px]">Contact Cyber for repair</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Center Frequency</span>
                      <span className="font-mono text-slate-200">{formatFreq(centerFreq)}</span>
                    </div>
                    <input
                      type="range"
                      min={80_000_000}
                      max={130_000_000}
                      step={10_000}
                      value={centerFreq}
                      onChange={(e) => setCenterFreq(Number(e.target.value))}
                      className="w-full accent-slate-200"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Bandwidth</span>
                      <span className="font-mono text-slate-200">{formatFreq(bandwidthHz)}</span>
                    </div>
                    <input
                      type="range"
                      min={50_000}
                      max={500_000}
                      step={10_000}
                      value={bandwidthHz}
                      onChange={(e) => setBandwidthHz(Number(e.target.value))}
                      className="w-full accent-slate-200"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Display Span</span>
                      <span className="font-mono text-slate-200">± {(span / 2_000_000).toFixed(2)} MHz</span>
                    </div>
                    <input
                      type="range"
                      min={2_000_000}
                      max={40_000_000}
                      step={250_000}
                      value={span}
                      onChange={(e) => handleSpanChange(Number(e.target.value))}
                      className="w-full accent-slate-200"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#090d17] border border-slate-800 rounded-lg p-4">
              <p className="text-[11px] uppercase text-slate-500 mb-3">Display Range</p>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Min</span>
                    <span className="font-mono text-slate-200">{minDb} dB</span>
                  </div>
                  <input
                    type="range"
                    min={-140}
                    max={-20}
                    value={minDb}
                    onChange={(e) => setMinDb(Number(e.target.value))}
                    className="w-full accent-slate-200"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Max</span>
                    <span className="font-mono text-slate-200">{maxDb} dB</span>
                  </div>
                  <input
                    type="range"
                    min={-100}
                    max={0}
                    value={maxDb}
                    onChange={(e) => setMaxDb(Number(e.target.value))}
                    className="w-full accent-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#090d17] border border-slate-800 rounded-lg p-4">
              <p className="text-[11px] uppercase text-slate-500 mb-3">Audio Control</p>
              {!audioReady ? (
                <button
                  onClick={handleEnableAudio}
                  className="w-full py-2.5 rounded border border-blue-400/60 text-blue-200 bg-blue-500/10 hover:bg-blue-500/20 text-sm font-semibold"
                >
                  Enable Audio
                </button>
              ) : (
                <button
                  onClick={handlePlayPause}
                  className={`w-full py-2.5 rounded border text-sm font-semibold ${
                    isPaused
                      ? 'border-emerald-400/60 text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20'
                      : 'border-amber-400/60 text-amber-200 bg-amber-500/10 hover:bg-amber-500/20'
                  }`}
                >
                  {isPaused ? '▶ Start Listening' : '⏸ Pause Listening'}
                </button>
              )}
            </div>
          </aside>

          <main className="flex-1 bg-[#04060c] p-6 flex flex-col gap-4">
            <div className="bg-[#050812] border border-slate-900 rounded-xl shadow-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-slate-300 text-sm">
                <span className="font-semibold">Spectrum Display</span>
                <span className="font-mono text-xs text-blue-200">
                  {formatFreq(centerFreq)} ± {(span / 2_000_000).toFixed(2)} MHz
                </span>
              </div>
              {spectrumOutage.active && spectrumOutage.component === 'spectrum' ? (
                <div className="h-[220px] bg-black rounded flex items-center justify-center border border-red-900/50">
                  <div className="text-center">
                    <p className="text-red-500 font-mono text-sm mb-1">⚠ SYSTEM OFFLINE ⚠</p>
                    <p className="text-red-500/60 font-mono text-xs">Contact Cyber for repair</p>
                  </div>
                </div>
              ) : (
                <SpectrumCanvas
                  centerFreq={centerFreq}
                  span={span}
                  minDb={minDb}
                  maxDb={maxDb}
                  bandwidthHz={bandwidthHz}
                  transmissions={jammerSignals}
                  height={220}
                  onChangeCenterFreq={handleCenterChange}
                  onChangeSpan={handleSpanChange}
                  isActive={visualsActive}
                />
              )}
              {spectrumOutage.active && spectrumOutage.component === 'waterfall' ? (
                <div className="h-[380px] bg-black rounded flex items-center justify-center border border-red-900/50">
                  <div className="text-center">
                    <p className="text-red-500 font-mono text-sm mb-1">⚠ SYSTEM OFFLINE ⚠</p>
                    <p className="text-red-500/60 font-mono text-xs">Contact Cyber for repair</p>
                  </div>
                </div>
              ) : (
                <WaterfallCanvas
                  centerFreq={centerFreq}
                  span={span}
                  transmissions={jammerSignals}
                  height={380}
                  isActive={visualsActive}
                />
              )}
            </div>

            <div className="bg-[#050812] border border-slate-900 rounded-xl shadow-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Admin Inject Board</h3>
                  <p className="text-xs text-slate-400">Preloaded locally, toggled via Socket.IO</p>
                </div>
                <span className="text-xs text-slate-500 uppercase">{injectStatus.length} injects</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {injectStatus.map((inject) => (
                  <div key={inject.id} className="border border-slate-800 rounded-lg p-3 bg-slate-900/30">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl" role="img" aria-label="inject-icon">{inject.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-white">{inject.title}</p>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                            inject.status === 'active'
                              ? 'border-amber-500/40 text-amber-300 bg-amber-500/10'
                              : 'border-slate-500/40 text-slate-300 bg-slate-500/10'
                          }`}>
                            {inject.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{inject.description}</p>
                        {inject.lastTriggered && (
                          <p className="text-[11px] text-slate-500 mt-1">
                            Last update: {inject.lastTriggered.toLocaleTimeString('en-US', { hour12: false })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Jamming Control Panel */}
            <div className="bg-[#050812] border border-slate-900 rounded-xl shadow-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Jamming Control</h3>
                  <p className="text-xs text-slate-400">Deploy up to 4 jamming signals</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Active Jammers</p>
                  <p className="text-2xl font-bold text-red-400">{activeJammerCount} / 4</p>
                </div>
              </div>

              {/* Bad Signals (Interference) */}
              {jammerSignals.some(s => s.isBadSignal && s.active) && (
                <div className="mb-4 space-y-2">
                  <p className="text-xs text-amber-400 font-semibold uppercase mb-2">⚠️ Unknown Interference Detected</p>
                  {jammerSignals.filter(s => s.isBadSignal && s.active).map((signal) => (
                    <div
                      key={signal.id}
                      className="bg-amber-950/30 border border-amber-500/50 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-amber-400 text-xl">⚡</span>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {signal.name || 'Unknown Interference'}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatFreq(signal.frequencyHz)} | BW: {formatFreq(signal.widthHz)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Active Jammers List */}
              {activeJammerCount > 0 && (
                <div className="mb-4 space-y-2">
                  {jammerSignals.filter(s => s.isJammer && s.active).map((jammer) => (
                    <div
                      key={jammer.id}
                      className="bg-red-950/30 border border-red-500/50 rounded-lg p-3 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-red-400 text-xl">📡</span>
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {formatFreq(jammer.frequencyHz)}
                            </p>
                            <p className="text-xs text-slate-400">
                              BW: {formatFreq(jammer.widthHz)} | Peak: {jammer.peakStrength.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveJammer(jammer.id)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-sm font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Jammer Button */}
              {!showJammerForm && (
                <button
                  onClick={() => setShowJammerForm(true)}
                  disabled={activeJammerCount >= 4}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                    activeJammerCount >= 4
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-500 text-white'
                  }`}
                >
                  {activeJammerCount >= 4 ? 'Max Jammers Deployed' : '+ Deploy New Jammer'}
                </button>
              )}

              {/* Jammer Configuration Form */}
              {showJammerForm && (
                <div className="bg-slate-950/50 border border-slate-700 rounded-lg p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-white mb-3">Configure Jammer</h4>
                  
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Frequency (Hz): {formatFreq(newJammer.frequencyHz)}
                    </label>
                    <input
                      type="number"
                      value={newJammer.frequencyHz}
                      onChange={(e) => setNewJammer({ ...newJammer, frequencyHz: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm"
                      min={80000000}
                      max={130000000}
                      step={100000}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Bandwidth (Hz): {formatFreq(newJammer.widthHz)}
                    </label>
                    <input
                      type="number"
                      value={newJammer.widthHz}
                      onChange={(e) => setNewJammer({ ...newJammer, widthHz: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm"
                      min={50000}
                      max={500000}
                      step={10000}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Min dB: {newJammer.minDb}
                    </label>
                    <input
                      type="range"
                      value={newJammer.minDb}
                      onChange={(e) => setNewJammer({ ...newJammer, minDb: Number(e.target.value) })}
                      className="w-full accent-red-500"
                      min={-140}
                      max={-20}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Max dB: {newJammer.maxDb}
                    </label>
                    <input
                      type="range"
                      value={newJammer.maxDb}
                      onChange={(e) => setNewJammer({ ...newJammer, maxDb: Number(e.target.value) })}
                      className="w-full accent-red-500"
                      min={-100}
                      max={0}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Peak Strength: {newJammer.peakStrength.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      value={newJammer.peakStrength}
                      onChange={(e) => setNewJammer({ ...newJammer, peakStrength: Number(e.target.value) })}
                      className="w-full accent-red-500"
                      min={0.1}
                      max={1.0}
                      step={0.05}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleAddJammer}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-semibold text-sm"
                    >
                      Deploy Jammer
                    </button>
                    <button
                      onClick={() => setShowJammerForm(false)}
                      className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-semibold text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

