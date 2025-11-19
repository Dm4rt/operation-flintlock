import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { TEAMS } from "../utils/constants";

export default function UserDashboard() {
  const { teamId, code } = useParams();
  const navigate = useNavigate();
  const team = TEAMS.find(t => t.id === teamId);

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4 relative z-10">
      <div className="p-12 bg-slate-900 rounded-3xl border border-slate-800 max-w-3xl text-center space-y-8">
        
        <div className="space-y-4">
          <team.icon className={`w-16 h-16 mx-auto ${team.color}`} />
          <h1 className="text-5xl font-black text-white">UPLINK ESTABLISHED</h1>
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
