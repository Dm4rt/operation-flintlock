import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SimpleTuner from '../../engine/SimpleTuner';
import transmissions from '../../data/audioTransmissions.json';
import useCountdown from '../../hooks/useCountdown';
import useSession from '../../hooks/useSession';
import { useFlintlockSocket } from '../../hooks/useFlintlockSocket';
import StarBackground from '../StarBackground';
import SpectrumCanvas from './SpectrumCanvas';
import WaterfallCanvas from './WaterfallCanvas';

const formatFreq = (hz) => {
  if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(3)} MHz`;
  if (hz >= 1_000) return `${(hz / 1_000).toFixed(1)} kHz`;
  return `${hz.toFixed(0)} Hz`;
};

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

export default function SdrAdminPanel({ operationId }) {
  const navigate = useNavigate();
  const { session, join } = useSession(operationId);
  const socket = useFlintlockSocket(operationId, 'ew', 'Space Ops - EW');
  const { timeLeft } = useCountdown(socket);

  const tunerRef = useRef(null);

  const [audioReady, setAudioReady] = useState(false);
  const [volume, setVolume] = useState(0.75);
  const [isPaused, setIsPaused] = useState(false);

  const [centerFreq, setCenterFreq] = useState(100_800_000);
  const [bandwidthHz, setBandwidthHz] = useState(200_000);
  const [minDb, setMinDb] = useState(-120);
  const [maxDb, setMaxDb] = useState(-20);
  const [span, setSpan] = useState(10_000_000);

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

  // Update tuning when controls change
  useEffect(() => {
    tunerRef.current?.updateTuning({ centerFreq, bandwidthHz, minDb, maxDb });
  }, [centerFreq, bandwidthHz, minDb, maxDb]);

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

  const visualsActive = !isPaused;

  if (!operationStarted) {
    return (
      <div className="relative min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <StarBackground />
        <div className="relative z-10 bg-slate-900/80 backdrop-blur-sm border-2 border-blue-500/30 rounded-2xl p-12 max-w-lg">
          <div className="text-center mb-6">
            <div className="inline-block p-4 bg-blue-500/10 rounded-xl border border-blue-500/30 mb-4">
              <span className="text-4xl">⚡</span>
            </div>
            <h1 className="text-3xl font-bold mb-2 text-white">UPLINK ESTABLISHED</h1>
            <p className="text-slate-400 text-sm">Awaiting mission initialization...</p>
          </div>
          <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span>Connected to Mission Control</span>
          </div>
          <div className="mt-6 pt-6 border-t border-slate-700">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-500 uppercase mb-1">Role</p>
                <p className="text-white font-bold">Electronic Warfare</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase mb-1">Cipher</p>
                <p className="text-blue-400 font-mono font-bold">{operationId}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            <div className="bg-[#090d17] border border-slate-800 rounded-lg p-4">
              <p className="text-[11px] uppercase text-slate-500 mb-3">Tuning Controls</p>
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
              <div className="mt-4">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Volume</span>
                  <span className="font-mono text-slate-200">{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-full accent-slate-200"
                />
              </div>
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
              <SpectrumCanvas
                centerFreq={centerFreq}
                span={span}
                minDb={minDb}
                maxDb={maxDb}
                bandwidthHz={bandwidthHz}
                transmissions={transmissions}
                height={220}
                onChangeCenterFreq={handleCenterChange}
                onChangeSpan={handleSpanChange}
                isActive={visualsActive}
              />
              <WaterfallCanvas
                centerFreq={centerFreq}
                span={span}
                transmissions={transmissions}
                height={380}
                isActive={visualsActive}
              />
            </div>

            <div className="bg-[#050812] border border-slate-900 rounded-xl shadow-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-200 uppercase tracking-[0.3em] text-[10px]">
                  Active Signals
                </span>
                <span className="font-mono text-blue-200 text-sm">
                  {transmissions.filter(isLocked).length} / {transmissions.length} LOCKED
                </span>
              </div>
              <div className="space-y-2">
                {transmissions.map((tx) => {
                  const locked = isLocked(tx);
                  const freqOff = Math.abs(centerFreq - tx.frequencyHz);
                  return (
                    <div
                      key={tx.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        locked
                          ? 'bg-emerald-500/10 border-emerald-500/50'
                          : 'bg-[#070b16] border-slate-800'
                      }`}
                    >
                      <div>
                        <p className="text-white text-sm font-semibold">{tx.name}</p>
                        <p className="text-[11px] text-slate-400 mt-1">{tx.description}</p>
                        <p className="text-[10px] uppercase tracking-[0.2em] mt-2 text-slate-500">
                          {locked ? '✅ LOCKED' : `⚠ DETUNE ${formatFreq(freqOff)}`}
                        </p>
                      </div>
                      <div className="text-right text-[11px] text-slate-400">
                        <p>{formatFreq(tx.frequencyHz)}</p>
                        <p>{formatFreq(tx.widthHz)} width</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

