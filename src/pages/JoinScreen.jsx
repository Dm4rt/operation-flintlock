import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { TEAMS } from "../utils/constants";

export default function JoinScreen() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const team = TEAMS.find(t => t.id === teamId);
  const [code, setCode] = useState("");

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4 relative z-10">
      <div className="flex flex-col space-y-6 p-10 bg-slate-900/90 rounded-2xl border border-slate-700 max-w-md w-full">
        
        <div className="text-center space-y-4">
          <div className="p-4 bg-slate-950 rounded-full inline-flex border border-slate-800">
            <team.icon className={`w-10 h-10 ${team.color}`} />
          </div>
          <h2 className="text-3xl font-bold text-white">{team.name}</h2>
        </div>

        <div>
          <label className="text-xs uppercase text-blue-400">Enter Access Key</label>
          <input
            type="text"
            placeholder="ALPHA-731"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xl text-center tracking-[0.2em]"
          />
        </div>

        <button
          onClick={() => navigate(`/dashboard/${teamId}/${code}`)}
          disabled={!code.trim()}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold"
        >
          UPLINK
        </button>

        <button
          onClick={() => navigate("/")}
          className="text-xs text-slate-500 hover:text-slate-300 uppercase"
        >
          Abort
        </button>
      </div>
    </div>
  );
}
