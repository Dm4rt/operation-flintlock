import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { TEAMS } from "../utils/constants";
import useSession from "../hooks/useSession";
import useCountdown from "../hooks/useCountdown";

export default function UserDashboard() {
  const { teamId, code } = useParams();
  const navigate = useNavigate();
  const team = TEAMS.find(t => t.id === teamId);
  const { join } = useSession(code);

  useEffect(() => {
    if (!code || !teamId) return;
    // attempt to join the session's participants list
    (async () => {
      try {
        await join(teamId, { name: team.name });
      } catch (e) {
        console.warn('Failed to join session:', e.message);
      }
    })();
  }, [code, teamId]);

  // live countdown from session
  const { timeLeft, isRunning } = useCountdown(code);

  const minutes = String(Math.floor((timeLeft || 0) / 60)).padStart(2, '0');
  const seconds = String((timeLeft || 0) % 60).padStart(2, '0');

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4 relative z-10">
      <div className="p-12 bg-slate-900 rounded-3xl border border-slate-800 max-w-3xl text-center space-y-8">
        
        <div className="space-y-2">
          <team.icon className={`w-16 h-16 mx-auto ${team.color}`} />
          <h1 className="text-5xl font-black text-white">UPLINK ESTABLISHED</h1>

          <div className="mt-2">
            <p className="text-xs text-slate-400 uppercase">Round Timer</p>
            <div className="text-6xl font-mono font-bold text-white mt-2">{minutes}:{seconds}</div>
            <p className="text-sm text-slate-500 mt-1">{isRunning ? 'Running' : 'Paused'}</p>
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
