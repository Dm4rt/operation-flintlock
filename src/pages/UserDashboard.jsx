import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { TEAMS } from "../utils/constants";
import useSession from "../hooks/useSession";
import useCountdown from "../hooks/useCountdown";
import SdaDashboard from "../components/sda/SdaDashboard";
import SdrAdminPanel from "../components/sdr/SdrAdminPanel";
import CyberTerminal from "../components/cyber/CyberTerminal";
import IntelDashboard from "../components/intel/IntelDashboard";
import CommandDashboard from "../components/cmd/CommandDashboard";

export default function UserDashboard() {
  const { teamId, code } = useParams();
  const navigate = useNavigate();
  const team = TEAMS.find(t => t.id === teamId);
  const { session, join } = useSession(code);

  useEffect(() => {
    if (!code || !teamId || !team) return;
    if (!session) {
      console.log(`⏳ Waiting for session ${code} to load before joining...`);
      return;
    }
    // attempt to join the session's participants list
    (async () => {
      try {
        await join(teamId, { name: team.name });
        console.log(`✅ Joined session ${code} as ${team.name} (${teamId})`);
      } catch (e) {
        console.error('❌ Failed to join session:', e);
      }
    })();
  }, [code, teamId, team, session, join]);

  if (!team) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white">
        <p className="text-lg">Team not found</p>
      </div>
    );
  }

  // live countdown from session
  const { timeLeft, isRunning } = useCountdown(code);

  const minutes = String(Math.floor((timeLeft || 0) / 60)).padStart(2, '0');
  const seconds = String((timeLeft || 0) % 60).padStart(2, '0');

  // Check if operation has started
  const operationStarted = session?.operationStarted || false;

  // Show operational interface when operation starts
  if (operationStarted) {
    // SDA Team gets the full orbital operations dashboard
    if (teamId === 'sda') {
      return <SdaDashboard sessionCode={code} />;
    }

    if (teamId === 'ew') {
      return <SdrAdminPanel operationId={code} />;
    }

    if (teamId === 'cyber') {
      return <CyberTerminal operationId={code} />;
    }

    if (teamId === 'intel') {
      return <IntelDashboard operationId={code} />;
    }

    if (teamId === 'mission_cmd') {
      return <CommandDashboard operationId={code} />;
    }

    // Other teams get placeholder interface (to be built later)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 relative z-10">
        <div className="max-w-5xl w-full space-y-8">
          {/* Header */}
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <team.icon className={`w-12 h-12 ${team.color}`} />
              <div>
                <h1 className="text-3xl font-black text-white">{team.name}</h1>
                <p className="text-sm text-slate-400">{team.description}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 uppercase">Mission Timer</p>
              <div className="text-4xl font-mono font-bold text-white">{minutes}:{seconds}</div>
            </div>
          </div>

          {/* Operational Interface Placeholder */}
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-12 min-h-[500px] flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className={`w-24 h-24 mx-auto rounded-full ${team.color.replace('text-', 'bg-')}/20 flex items-center justify-center`}>
                <team.icon className={`w-12 h-12 ${team.color}`} />
              </div>
              <h2 className="text-2xl font-bold text-white">OPERATIONAL INTERFACE</h2>
              <p className="text-slate-400">Mission in progress...</p>
            </div>
          </div>

          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-500 w-full"
          >
            TERMINATE SESSION
          </button>
        </div>
      </div>
    );
  }

  // Waiting room before operation starts
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4 relative z-10">
      <div className="p-12 bg-slate-900 rounded-3xl border border-slate-800 max-w-3xl text-center space-y-8">
        
        <div className="space-y-2">
          <team.icon className={`w-16 h-16 mx-auto ${team.color}`} />
          <h1 className="text-5xl font-black text-white">UPLINK ESTABLISHED</h1>

          <div className="mt-6">
            <p className="text-lg text-slate-400">Awaiting mission initialization...</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <p className="text-sm text-slate-500">Connected to Mission Control</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-slate-500 uppercase">Role</p>
            <h2 className="text-2xl font-bold text-white mt-1">{team.name}</h2>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase">Cipher</p>
            <p className="text-2xl font-mono font-bold text-red-500 mt-1">{code}</p>
          </div>
        </div>

        <button
          onClick={() => navigate("/")}
          className="py-3 px-8 bg-red-600 text-white rounded-xl font-bold hover:bg-red-500"
        >
          TERMINATE SESSION
        </button>
      </div>
    </div>
  );
}
