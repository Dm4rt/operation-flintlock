import React, { useState, useEffect, useRef } from "react";
import Timer from "../components/Timer";
import InjectFeed from "../components/InjectFeed";
import SystemLog from "../components/SystemLog";
import TeamStatus from "../components/TeamStatus";
import useSession from "../hooks/useSession";
import { useNavigate } from "react-router-dom";
import { db } from "../services/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [config, setConfig] = useState({ roundDuration: 10 });
  const [scenarioId, setScenarioId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(600);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const { session, participants, update, pushInject } = useSession(scenarioId);

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs(prev => [{ time, msg }, ...prev]);
  };

  const initializeScenario = () => {
    const id = "FLINT-" + Math.floor(Math.random() * 900 + 100);
    setScenarioId(id);
    setTimeLeft(config.roundDuration * 60);
    addLog(`Scenario ${id} Initialized`);

    // Create a session document in Firestore with initial state
    (async () => {
      try {
        const sessionRef = doc(db, "sessions", id);
        // No auth required in current dev rules; leave admin null when unauthenticated.
        await setDoc(sessionRef, {
          createdAt: serverTimestamp(),
          admin: null,
          roundDuration: config.roundDuration,
          timeLeft: config.roundDuration * 60,
          isRunning: false,
          logs: [{ time: new Date().toLocaleTimeString("en-US", { hour12: false }), msg: `Scenario ${id} Initialized` }],
          injects: [],
        });
        addLog(`Session ${id} created in Firestore`);
      } catch (err) {
        console.error("Failed to create session:", err);
        addLog(`Failed to create session: ${err.message}`);
      }
    })();
  };

  // sync local state to firestore when admin triggers changes (start/stop/modify)
  useEffect(() => {
    if (!scenarioId) return;
    const ref = async () => {
      try {
        await update({ timeLeft, isRunning, roundDuration: config.roundDuration });
      } catch (e) {
        // ignore
      }
    };
    ref();
  // only when these explicit control values change (avoid per-second writes)
  }, [scenarioId, isRunning, config.roundDuration]);

  // sync manual time edits (when timer not running) to Firestore so clients see new time
  useEffect(() => {
    if (!scenarioId) return;
    if (isRunning) return;
    const ref = async () => {
      try {
        await update({ timeLeft });
      } catch (e) {}
    };
    ref();
  }, [scenarioId, timeLeft, isRunning]);

  // detect start/pause transitions and write startedAt/timeLeftAtStart for robust sync
  const prevIsRunningRef = useRef(isRunning);
  useEffect(() => {
    if (!scenarioId) {
      prevIsRunningRef.current = isRunning;
      return;
    }

    const prev = prevIsRunningRef.current;
    // started
    if (isRunning && !prev) {
      (async () => {
        try {
          await update({ isRunning: true, startedAt: serverTimestamp(), timeLeftAtStart: timeLeft });
        } catch (e) {}
      })();
    }

    // paused or stopped
    if (!isRunning && prev) {
      (async () => {
        try {
          await update({ isRunning: false, timeLeft, startedAt: null, timeLeftAtStart: null });
        } catch (e) {}
      })();
    }

    prevIsRunningRef.current = isRunning;
  }, [isRunning, scenarioId, timeLeft, update]);

  // Note: we intentionally don't require sign-in here. Firestore rules can
  // be configured to allow unauthenticated writes for development, or you
  // can enable anonymous auth in the Firebase Console and re-add auth code.

  return (
    <div className="p-6 max-w-7xl mx-auto relative z-20">

      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900 p-6 rounded-xl border border-slate-700">
        <div>
          <h1 className="text-3xl font-black text-white">MISSION CONTROL</h1>
          <p className="text-sm text-slate-400">LIVE UPLINK</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 px-6 py-4 text-center">
            <p className="text-xs text-slate-400 uppercase">Access Key</p>
            <div className="mt-2 font-mono tracking-widest text-2xl text-white">
              {scenarioId || "---- ---"}
            </div>
          </div>

          <button onClick={() => { navigate('/'); }} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold">
            ABORT
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">

        {/* Left column: Timer + Network Status */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4">
            <label className="text-xs text-slate-400 uppercase">Round Duration (min)</label>
            <select
              value={config.roundDuration}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10) || 10;
                setConfig(prev => ({ ...prev, roundDuration: v }));
                // update local timer if not running
                if (!isRunning) setTimeLeft(v * 60);
              }}
              className="mt-2 w-full bg-slate-800 rounded px-3 py-2 text-white"
            >
              {[5,10,15,20,30].map(n => (
                <option key={n} value={n}>{n} minutes</option>
              ))}
            </select>
          </div>

          <Timer
            timeLeft={timeLeft}
            setTimeLeft={setTimeLeft}
            isRunning={isRunning}
            setIsRunning={setIsRunning}
            addLog={addLog}
            duration={config.roundDuration}
          />

          <TeamStatus sessionId={scenarioId} />
        </div>

        {/* Center column: Inject Feed + System Log underneath */}
        <div className="lg:col-span-9 space-y-4">
          <InjectFeed scenarioId={scenarioId} className="min-h-[420px]" />

          <SystemLog logs={logs} />
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="mt-6 flex gap-4">
        <button 
          onClick={() => navigate("/")}
          className="px-6 py-3 bg-slate-800 rounded-lg"
        >
          Cancel
        </button>

        <button 
          onClick={initializeScenario}
          className="px-8 py-3 bg-blue-600 rounded-lg text-white font-bold"
        >
          Initialize Operation
        </button>
      </div>
    </div>
  );
}
