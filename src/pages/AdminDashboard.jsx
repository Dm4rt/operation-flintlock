import React, { useState, useEffect } from "react";
import Timer from "../components/Timer";
import InjectFeed from "../components/InjectFeed";
import SystemLog from "../components/SystemLog";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [config, setConfig] = useState({ roundDuration: 10 });
  const [scenarioId, setScenarioId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(600);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs(prev => [{ time, msg }, ...prev]);
  };

  const initializeScenario = () => {
    const id = "FLINT-" + Math.floor(Math.random() * 900 + 100);
    setScenarioId(id);
    setTimeLeft(config.roundDuration * 60);
    addLog(`Scenario ${id} Initialized`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto relative z-20">

      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900 p-6 rounded-xl border border-slate-700">
        <h1 className="text-3xl font-black text-white">MISSION CONTROL</h1>
        <button onClick={() => navigate("/")} className="text-red-500 font-bold">
          Abort
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">

        {/* Timer Column */}
        <div className="lg:col-span-4 space-y-4">
          <Timer 
            timeLeft={timeLeft}
            setTimeLeft={setTimeLeft}
            isRunning={isRunning}
            setIsRunning={setIsRunning}
            addLog={addLog}
            duration={config.roundDuration}
          />

          <SystemLog logs={logs} />
        </div>

        {/* Inject Column */}
        <div className="lg:col-span-8">
          <InjectFeed scenarioId={scenarioId} />
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
