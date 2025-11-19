import React from "react";
import { TEAMS } from "../utils/constants";
import { Users } from "lucide-react";

export default function TeamStatus() {
    return (
        <div className="bg-slate-950 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                    Network Status
                </p>
                <Users className="w-4 h-4 text-slate-500" />
            </div>

            <div className="space-y-2">
                {TEAMS.filter(t => t.id !== "mission_cmd").map(team => (
                    <div
                        key={team.id}
                        className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800/50 opacity-50"
                    >
                        <div className="flex items-center gap-2">
                            <team.icon className={`w-4 h-4 ${team.color}`} />
                            <span className="text-sm text-slate-400">{team.name}</span>
                        </div>
                        <span className="text-xs font-mono text-slate-600">OFFLINE</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
