import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Timer from "../components/Timer";
import InjectFeed from "../components/InjectFeed";
import SystemLog from "../components/SystemLog";
import TeamStatus from "../components/TeamStatus";
import SignOutButton from "../components/auth/SignOutButton";
import useSession from "../hooks/useSession";
import { useNavigate, useParams } from "react-router-dom";
import { useFlintlockSocket } from "../hooks/useFlintlockSocket";
import { db } from "../services/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { initializeFlintFiles } from "../terminal/initFlintFiles";
import FlintFileAdmin from "../components/cmd/FlintFileAdmin";

const ROUND_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60];

const clampSeconds = (value = 0) => Math.max(0, Math.round(Number(value) || 0));

const getRoundSeconds = (round) => {
  if (!round) return 0;
  if (typeof round.durationSeconds === 'number') return clampSeconds(round.durationSeconds);
  if (typeof round.duration === 'number') return clampSeconds(round.duration * 60);
  return 0;
};

const getRoundMinutes = (round) => {
  if (!round) return 0;
  if (typeof round.duration === 'number') return round.duration;
  return secondsToMinutesValue(getRoundSeconds(round));
};

const secondsToMinutesValue = (seconds) => {
  if (!seconds) return 0;
  return Number((seconds / 60).toFixed(3));
};

const formatRoundLength = (seconds) => {
  const safe = clampSeconds(seconds);
  if (safe === 0) return '0 min';
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (secs === 0) return `${mins} min`;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
};

const ensureRoundShape = (round = {}, idx = 0) => {
  const seconds = getRoundSeconds(round);
  return {
    id: round.id || `round-${idx + 1}`,
    label: round.label || `Round ${idx + 1}`,
    durationSeconds: seconds,
    duration: typeof round.duration === 'number' ? round.duration : secondsToMinutesValue(seconds)
  };
};

const DEFAULT_ROUNDS = [
  ensureRoundShape({ id: 'round-1', label: 'Round 1', duration: 10 }, 0),
  ensureRoundShape({ id: 'round-2', label: 'Round 2', duration: 10 }, 1)
];

const getNextPlayableRound = (rounds, startIndex = 0) => {
  for (let i = startIndex; i < rounds.length; i += 1) {
    if (getRoundSeconds(rounds[i]) > 0) return i;
  }
  return null;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { code: routeCode } = useParams();

  const defaultRoundIndex = getNextPlayableRound(DEFAULT_ROUNDS) ?? 0;

  const [config, setConfig] = useState(() => ({ rounds: DEFAULT_ROUNDS.map(round => ({ ...round })) }));
  const [currentRoundIndex, setCurrentRoundIndex] = useState(defaultRoundIndex);
  const [scenarioId, setScenarioId] = useState(routeCode || null);
  const [timeLeft, setTimeLeft] = useState(getRoundSeconds(DEFAULT_ROUNDS[defaultRoundIndex]));
  const [isRunning, setIsRunning] = useState(false);
  const [operationStarted, setOperationStarted] = useState(false);
  const [logs, setLogs] = useState([]);
  const { session, update } = useSession(scenarioId);
  const socket = useFlintlockSocket(scenarioId, 'admin', 'Mission Control');
  const seededLogsRef = useRef(false);
  const rounds = useMemo(() => {
    const base = config.rounds && config.rounds.length ? config.rounds : DEFAULT_ROUNDS;
    const missingSeconds = base.some((round) => typeof round?.durationSeconds !== 'number');
    if (!missingSeconds) return base;
    return base.map((round, idx) => ensureRoundShape(round, idx));
  }, [config.rounds]);
  const roundsRef = useRef(rounds);
  useEffect(() => {
    roundsRef.current = rounds;
  }, [rounds]);
  const timeLeftRef = useRef(timeLeft);
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);
  const currentRoundRef = useRef(currentRoundIndex);
  useEffect(() => {
    currentRoundRef.current = currentRoundIndex;
  }, [currentRoundIndex]);
  const idleSyncTimeoutRef = useRef(null);
  const totalRounds = rounds.length;
  const activeRound = rounds[currentRoundIndex] || rounds[0] || { label: 'Round', duration: 0 };
  const activeRoundNumber = currentRoundIndex + 1;
  const nextRoundIndex = useMemo(() => getNextPlayableRound(rounds, currentRoundIndex + 1), [rounds, currentRoundIndex]);
  const nextRound = nextRoundIndex !== null ? rounds[nextRoundIndex] : null;

  const broadcastTick = useCallback((seconds, running, roundIdxOverride = currentRoundIndex) => {
    if (!socket.isConnected) return;
    const plannedSeconds = getRoundSeconds(rounds[roundIdxOverride]);
    socket.emitMissionTick({
      timeLeft: seconds,
      isRunning: running,
      currentRound: roundIdxOverride + 1,
      totalRounds,
      roundDurationMinutes: plannedSeconds ? plannedSeconds / 60 : 0
    });
  }, [socket, currentRoundIndex, rounds, totalRounds]);

  const syncRunningBaseline = useCallback(async (seconds, roundIndex = currentRoundIndex) => {
    if (!scenarioId) return;
    try {
      await update({
        isRunning: true,
        operationStarted: true,
        timeLeftAtStart: seconds,
        startedAt: serverTimestamp(),
        currentRoundIndex: roundIndex,
        timeLeft: seconds
      });
    } catch (error) {
      console.error('Failed to sync running baseline', error);
    }
  }, [scenarioId, update, currentRoundIndex]);

  const queueIdleSync = useCallback((overrideTime) => {
    if (!scenarioId || isRunning) return;
    if (idleSyncTimeoutRef.current) {
      clearTimeout(idleSyncTimeoutRef.current);
    }
    idleSyncTimeoutRef.current = setTimeout(async () => {
      idleSyncTimeoutRef.current = null;
      const targetTime = typeof overrideTime === 'number' ? overrideTime : timeLeftRef.current;
      try {
        await update({ timeLeft: targetTime, currentRoundIndex: currentRoundRef.current });
      } catch (error) {
        console.error('Failed to persist idle timer state', error);
      }
    }, 750);
  }, [scenarioId, isRunning, update]);

  useEffect(() => () => {
    if (idleSyncTimeoutRef.current) {
      clearTimeout(idleSyncTimeoutRef.current);
      idleSyncTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (operationStarted) return;
    const firstPlayable = getNextPlayableRound(rounds) ?? 0;
    if (firstPlayable !== currentRoundIndex) {
      setCurrentRoundIndex(firstPlayable);
      setTimeLeft(getRoundSeconds(rounds[firstPlayable]));
    }
  }, [rounds, operationStarted, currentRoundIndex]);

  const formatTime = (seconds = 0) => {
    const safe = Math.max(0, seconds || 0);
    const mins = String(Math.floor(safe / 60)).padStart(2, "0");
    const secs = String(safe % 60).padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs(prev => [{ time, msg }, ...prev]);
  };

  const generateCode = () => {
    const id = "FLINT-" + Math.floor(Math.random() * 900 + 100);
    const startIndex = getNextPlayableRound(rounds) ?? 0;
    const startSeconds = getRoundSeconds(rounds[startIndex]);
    const durationMinutes = rounds.map((round) => getRoundMinutes(round));
    const durationSeconds = rounds.map((round) => getRoundSeconds(round));
    setScenarioId(id);
    setCurrentRoundIndex(startIndex);
    setTimeLeft(startSeconds);
    setOperationStarted(false);
    setIsRunning(false);
    addLog(`Code ${id} Generated`);
    navigate(`/admin/control/${id}`, { replace: true });

    // Create a session document in Firestore with initial state
    (async () => {
      try {
        const sessionRef = doc(db, "sessions", id);
        await setDoc(sessionRef, {
          createdAt: serverTimestamp(),
          admin: null,
          roundDuration: durationMinutes[0] || 0,
          roundDurations: durationMinutes,
          roundDurationSeconds: durationSeconds,
          totalRounds,
          currentRoundIndex: startIndex,
          timeLeft: startSeconds,
          isRunning: false,
          operationStarted: false,
          logs: [{ time: new Date().toLocaleTimeString("en-US", { hour12: false }), msg: `Code ${id} Generated` }],
          injects: [],
        });
        addLog(`Session ${id} created in Firestore`);
      } catch (err) {
        console.error("Failed to create session:", err);
        addLog(`Failed to create session: ${err.message}`);
      }
    })();
  };

  const handleRoundDurationChange = (index, minutes) => {
    const duration = Number(minutes);
    const durationSeconds = clampSeconds(duration * 60);
    setConfig((prev) => {
      const base = prev.rounds && prev.rounds.length ? prev.rounds : DEFAULT_ROUNDS;
      return {
        ...prev,
        rounds: base.map((round, idx) => (
          idx === index ? { ...round, duration, durationSeconds } : round
        ))
      };
    });

    if (!isRunning && index === currentRoundIndex) {
      setTimeLeft(durationSeconds);
      queueIdleSync(durationSeconds);
    }
  };

  const setManualTimeLeft = useCallback((updater) => {
    setTimeLeft((prev) => {
      const nextValue = typeof updater === 'function' ? updater(prev) : updater;
      const safeValue = clampSeconds(nextValue);
      if (!operationStarted) {
        setConfig((prevConfig) => {
          const base = prevConfig.rounds && prevConfig.rounds.length ? prevConfig.rounds : DEFAULT_ROUNDS;
          const updatedRounds = base.map((round, idx) => (
            idx === currentRoundIndex
              ? { ...round, durationSeconds: safeValue, duration: safeValue === 0 ? 0 : secondsToMinutesValue(safeValue) }
              : round
          ));
          return { ...prevConfig, rounds: updatedRounds };
        });
      }
      if (!isRunning) {
        queueIdleSync(safeValue);
      }
      return safeValue;
    });
  }, [operationStarted, currentRoundIndex, isRunning, queueIdleSync]);

  const handlePauseResume = () => {
    if (!operationStarted || !scenarioId) return;
    if (isRunning) {
      setIsRunning(false);
      addLog(`Round ${activeRoundNumber} paused at ${formatTime(timeLeft)}`);
      broadcastTick(timeLeft, false);
    } else {
      setIsRunning(true);
      addLog(`Round ${activeRoundNumber} resumed`);
      broadcastTick(timeLeft, true);
      syncRunningBaseline(timeLeft, currentRoundIndex);
    }
  };

  const handleExtendTime = (minutes) => {
    if (!scenarioId) return;
    const seconds = minutes * 60;
    setTimeLeft((prev) => {
      const next = Math.max(0, prev + seconds);
      if (isRunning) {
        broadcastTick(next, true);
        syncRunningBaseline(next);
      } else {
        broadcastTick(next, false);
        queueIdleSync(next);
      }
      return next;
    });
    addLog(`Adjusted round ${activeRoundNumber} by ${minutes > 0 ? '+' : ''}${minutes} min`);
  };

  const handleEndRoundEarly = () => {
    if (!operationStarted) return;
    const upcomingIndex = getNextPlayableRound(rounds, currentRoundIndex + 1);
    const completedRound = currentRoundIndex + 1;
    if (upcomingIndex === null) {
      setTimeLeft(0);
      setIsRunning(false);
      addLog(`Round ${completedRound} manually ended. Mission complete.`);
      broadcastTick(0, false, currentRoundIndex);
      queueIdleSync(0);
      return;
    }

    const nextSeconds = getRoundSeconds(rounds[upcomingIndex]);
    const wasRunning = isRunning;
    setCurrentRoundIndex(upcomingIndex);
    setTimeLeft(nextSeconds);
    addLog(`Round ${completedRound} manually ended. ${rounds[upcomingIndex].label} ${wasRunning ? 'live now' : 'armed'}.`);
    broadcastTick(nextSeconds, wasRunning, upcomingIndex);
    if (wasRunning) {
      syncRunningBaseline(nextSeconds, upcomingIndex);
    } else {
      queueIdleSync(nextSeconds);
    }
  };

  useEffect(() => {
    if (routeCode && routeCode !== scenarioId) {
      setScenarioId(routeCode);
    }
  }, [routeCode]);

  useEffect(() => {
    if (!session) return;

    const incomingSeconds = (() => {
      if (Array.isArray(session.roundDurationSeconds)) {
        return session.roundDurationSeconds.map(clampSeconds);
      }
      if (Array.isArray(session.roundDurations)) {
        return session.roundDurations.map((dur) => clampSeconds((dur || 0) * 60));
      }
      if (typeof session.roundDuration === 'number') {
        return [clampSeconds(session.roundDuration * 60)];
      }
      return null;
    })();

    if (incomingSeconds) {
      const currentSeconds = roundsRef.current.map((round) => getRoundSeconds(round));
      const differs = incomingSeconds.length !== currentSeconds.length || incomingSeconds.some((seconds, idx) => seconds !== currentSeconds[idx]);
      if (differs) {
        setConfig((prev) => ({
          ...prev,
          rounds: incomingSeconds.map((seconds, idx) => ensureRoundShape({
            id: `round-${idx + 1}`,
            label: `Round ${idx + 1}`,
            durationSeconds: seconds,
            duration: session.roundDurations?.[idx] ?? secondsToMinutesValue(seconds)
          }, idx))
        }));
      }
    }

    if (typeof session.currentRoundIndex === 'number' && session.currentRoundIndex !== currentRoundIndex) {
      setCurrentRoundIndex(session.currentRoundIndex);
    }

    setOperationStarted(Boolean(session.operationStarted));

    const derivedTimeLeft = (() => {
      if (session.isRunning && session.startedAt && typeof session.timeLeftAtStart === 'number') {
        const elapsed = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);
        return Math.max(0, (session.timeLeftAtStart || 0) - elapsed);
      }
      if (typeof session.timeLeft === 'number') {
        return session.timeLeft;
      }
      if (incomingSeconds) {
        const idx = typeof session.currentRoundIndex === 'number' ? session.currentRoundIndex : 0;
        return incomingSeconds[idx] ?? incomingSeconds[0] ?? 0;
      }
      return timeLeft;
    })();

    setTimeLeft(derivedTimeLeft);
    setIsRunning(Boolean(session.isRunning));

    if (!seededLogsRef.current && Array.isArray(session.logs)) {
      setLogs(session.logs);
      seededLogsRef.current = true;
    }
  }, [session, currentRoundIndex]);

  useEffect(() => {
    if (!scenarioId || !session) return;
    const minuteDurations = rounds.map((round) => getRoundMinutes(round));
    const secondDurations = rounds.map((round) => getRoundSeconds(round));
    const docDurations = Array.isArray(session.roundDurations)
      ? session.roundDurations
      : (session.roundDuration ? [session.roundDuration] : []);
    const docDurationSeconds = Array.isArray(session.roundDurationSeconds)
      ? session.roundDurationSeconds.map(clampSeconds)
      : null;
    const minutesChanged = docDurations.length !== minuteDurations.length || docDurations.some((val, idx) => val !== minuteDurations[idx]);
    const secondsChanged = !docDurationSeconds || docDurationSeconds.length !== secondDurations.length || docDurationSeconds.some((val, idx) => val !== secondDurations[idx]);
    const roundIndexChanged = (session.currentRoundIndex ?? 0) !== currentRoundIndex;
    if (!minutesChanged && !secondsChanged && !roundIndexChanged) return;

    (async () => {
      try {
        await update({
          roundDurations: minuteDurations,
          roundDuration: minuteDurations[0] || 0,
          roundDurationSeconds: secondDurations,
          totalRounds,
          currentRoundIndex
        });
      } catch (error) {
        console.error('Failed to sync round configuration', error);
      }
    })();
  }, [scenarioId, session, rounds, totalRounds, currentRoundIndex, update]);

  const initializeOperation = async () => {
    if (!scenarioId) return;
    const startingIndex = getNextPlayableRound(rounds, 0);
    if (startingIndex === null) {
      addLog('Cannot start operation: configure at least one round duration');
      return;
    }
    const startingSeconds = getRoundSeconds(rounds[startingIndex]);
    setCurrentRoundIndex(startingIndex);
    setTimeLeft(startingSeconds);
    setOperationStarted(true);
    
    setIsRunning(true);
    addLog(`Operation ${scenarioId} STARTED`);
    
    // Broadcast initial time immediately
    broadcastTick(startingSeconds, true, startingIndex);
    console.log('[Admin] Broadcasting initial time:', startingSeconds);
    await syncRunningBaseline(startingSeconds, startingIndex);
    
    // Initialize all flint- files in Firestore with visible: false
    try {
      await initializeFlintFiles(scenarioId);
      addLog(`Flint files initialized for ${scenarioId}`);
    } catch (err) {
      console.error('Failed to initialize flint files:', err);
      addLog(`Warning: Flint file initialization failed`);
    }
  };

  // Broadcast mission timer via Socket.IO every second
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          const upcomingIndex = getNextPlayableRound(rounds, currentRoundIndex + 1);
          if (upcomingIndex !== null) {
            const nextSeconds = getRoundSeconds(rounds[upcomingIndex]);
            addLog(`Round ${activeRoundNumber} complete. Initiating ${rounds[upcomingIndex].label}.`);
            setCurrentRoundIndex(upcomingIndex);
            broadcastTick(nextSeconds, true, upcomingIndex);
            syncRunningBaseline(nextSeconds, upcomingIndex);
            return nextSeconds;
          }
          setIsRunning(false);
          addLog('All rounds complete');
          broadcastTick(0, false, currentRoundIndex);
          return 0;
        }

        const next = prev - 1;
        broadcastTick(next, true, currentRoundIndex);
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, rounds, currentRoundIndex, addLog, broadcastTick, syncRunningBaseline, activeRoundNumber]);

  // Admin controls the timer, doesn't need to sync from Socket.IO

  // detect start/pause transitions and write startedAt/timeLeftAtStart for robust sync
  const prevIsRunningRef = useRef(isRunning);
  useEffect(() => {
    if (!scenarioId) {
      prevIsRunningRef.current = isRunning;
      return;
    }

    const prev = prevIsRunningRef.current;
    // paused or stopped
    if (!isRunning && prev) {
      (async () => {
        try {
          await update({ isRunning: false, timeLeft, startedAt: null, timeLeftAtStart: null, currentRoundIndex });
        } catch (e) {}
      })();
    }

    prevIsRunningRef.current = isRunning;
  }, [isRunning, scenarioId, timeLeft, currentRoundIndex, update]);

  // Note: we intentionally don't require sign-in here. Firestore rules can
  // be configured to allow unauthenticated writes for development, or you
  // can enable anonymous auth in the Firebase Console and re-add auth code.

  return (
    <div className="p-6 max-w-7xl mx-auto relative z-20">

      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900 p-6 rounded-xl border border-slate-700">
        <div>
          <h1 className="text-3xl font-black text-white">ADMIN CONTROL PANEL</h1>
          <p className="text-sm text-slate-400">LIVE UPLINK</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 px-6 py-4 text-center">
            <p className="text-xs text-slate-400 uppercase">Access Key</p>
            <div className="mt-2 font-mono tracking-widest text-2xl text-white">
              {scenarioId || "---- ---"}
            </div>
          </div>

          <SignOutButton />

          <button onClick={() => { navigate('/'); }} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold">
            ABORT
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">

        {/* Left column: Timer + Network Status */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase">Round Plan</p>
                <p className="text-[11px] text-slate-500">Auto-advances when the clock hits zero</p>
              </div>
              <span className="text-xs font-mono text-slate-500">{totalRounds} rounds</span>
            </div>

            <div className="space-y-4">
              {rounds.map((round, idx) => {
                const isCurrent = idx === currentRoundIndex;
                const isPast = idx < currentRoundIndex;
                const statusLabel = isCurrent ? 'Active' : isPast ? 'Completed' : 'Queued';
                const canEdit = !operationStarted || idx > currentRoundIndex;
                const selectValues = (() => {
                  const base = [...ROUND_OPTIONS];
                  if (typeof round.duration === 'number' && !base.includes(round.duration)) {
                    base.push(round.duration);
                  }
                  return base.sort((a, b) => a - b);
                })();

                return (
                  <div key={round.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase text-slate-400">{round.label}</p>
                      <p className={`text-[11px] ${isCurrent ? 'text-amber-300' : 'text-slate-500'}`}>
                        {statusLabel} · {formatRoundLength(getRoundSeconds(round))}
                      </p>
                    </div>
                    <select
                      value={round.duration}
                      disabled={!canEdit}
                      onChange={(e) => handleRoundDurationChange(idx, Number(e.target.value))}
                      className={`bg-slate-800 rounded px-3 py-2 text-white text-sm border ${
                        canEdit ? 'border-slate-700' : 'border-slate-900 cursor-not-allowed opacity-70'
                      }`}
                    >
                      {selectValues.map((minutes) => {
                        const isStandard = ROUND_OPTIONS.includes(minutes);
                        const optionLabel = minutes === 0
                          ? 'Skip round'
                          : isStandard
                            ? `${minutes} minutes`
                            : `Custom - ${formatRoundLength(minutes * 60)}`;
                        return (
                          <option key={`${round.id}-${minutes}`} value={minutes}>
                            {optionLabel}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-500">
              Round {activeRoundNumber} is live now. {nextRound ? `${nextRound.label} will auto-start at ${formatRoundLength(getRoundSeconds(nextRound))}.` : 'No additional rounds scheduled.'}
            </p>
          </div>

          {operationStarted ? (
            <div className="bg-orange-600/90 rounded-xl border border-orange-400 px-6 py-8 shadow-lg shadow-orange-500/40">
              <p className="text-xs text-orange-100 uppercase tracking-widest font-bold">
                Round {activeRoundNumber} / {totalRounds}
              </p>
              <div className="text-6xl font-mono font-black text-white mt-4 text-center">
                {formatTime(timeLeft)}
              </div>
              <p className="text-xs text-orange-100/80 mt-3 text-center">
                {isRunning ? 'Broadcasting to all teams' : 'Transmission paused for all teams'}
              </p>
              {nextRound ? (
                <p className="text-[11px] text-orange-50/80 mt-2 text-center">
                  Next: {nextRound.label} · {formatRoundLength(getRoundSeconds(nextRound))} (auto)
                </p>
              ) : (
                <p className="text-[11px] text-orange-50/80 mt-2 text-center">Final round</p>
              )}
              <div className="mt-6 space-y-3">
                <button
                  onClick={handlePauseResume}
                  className={`w-full py-3 rounded-lg font-bold border ${
                    isRunning
                      ? 'bg-slate-900/40 border-white/30 text-white hover:bg-slate-900/60'
                      : 'bg-white/90 border-white text-orange-700 hover:bg-white'
                  }`}
                >
                  {isRunning ? 'Pause Operation' : 'Resume Operation'}
                </button>
                <div className="flex gap-2">
                  {[1, 5].map((min) => (
                    <button
                      key={`extend-${min}`}
                      onClick={() => handleExtendTime(min)}
                      className="flex-1 py-2 rounded-lg bg-white/15 border border-white/30 text-white text-sm hover:bg-white/25"
                    >
                      +{min} min
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleEndRoundEarly}
                  className="w-full py-2 rounded-lg bg-black/30 border border-white/30 text-white text-sm hover:bg-black/50"
                >
                  {nextRound ? 'Skip Round & Advance' : 'End Operation' }
                </button>
              </div>
            </div>
          ) : (
            <Timer
              timeLeft={timeLeft}
              setTimeLeft={setTimeLeft}
              setManualTimeLeft={setManualTimeLeft}
              isRunning={isRunning}
              setIsRunning={setIsRunning}
              addLog={addLog}
              defaultSeconds={getRoundSeconds(activeRound)}
            />
          )}

          <TeamStatus sessionId={scenarioId} />
        </div>

        {/* Center column: Inject Feed + System Log underneath */}
        <div className="lg:col-span-9 space-y-4">
          <InjectFeed scenarioId={scenarioId} className="min-h-[420px]" />

          <SystemLog logs={logs} />

          {/* Flint File Control Panel */}
          <FlintFileAdmin sessionId={scenarioId} />
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="mt-6 flex gap-4">
        <button 
          onClick={() => navigate("/")}
          className="px-6 py-3 bg-slate-800 rounded-lg text-white"
        >
          Cancel
        </button>

        {!scenarioId ? (
          <button 
            onClick={generateCode}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-bold"
          >
            Generate Code
          </button>
        ) : (
          <button 
            onClick={operationStarted ? undefined : initializeOperation}
            disabled={operationStarted}
            className={`px-8 py-3 rounded-lg font-bold ${
              operationStarted
                ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            }`}
          >
            {operationStarted ? (isRunning ? "Mission Active" : "Mission Paused") : "Initialize Operation"}
          </button>
        )}
      </div>
    </div>
  );
}
