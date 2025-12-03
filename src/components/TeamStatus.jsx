import React, { useState, useEffect } from "react";
import { TEAMS } from "../utils/constants";
import { Users } from "lucide-react";
import useSession from "../hooks/useSession";
import { useFlintlockSocket } from "../hooks/useFlintlockSocket";

export default function TeamStatus({ sessionId }) {
    const { participants } = useSession(sessionId);
    const socket = useFlintlockSocket(sessionId, null, null);
    const [onlineTeams, setOnlineTeams] = useState(new Set());

    // Initialize from Firebase participants
    React.useEffect(() => {
        const onlineSet = new Set(participants.map(p => p.teamId));
        setOnlineTeams(onlineSet);
    }, [participants]);

    // Listen for real-time Socket.IO connect/disconnect events
    useEffect(() => {
        if (!socket.isConnected) return;

        const unsubscribeJoined = socket.on('team:joined', ({ teamId }) => {
            console.log(`[TeamStatus] Team joined: ${teamId}`);
            setOnlineTeams(prev => new Set([...prev, teamId]));
        });

        const unsubscribeLeft = socket.on('team:left', ({ teamId }) => {
            console.log(`[TeamStatus] Team left: ${teamId}`);
            setOnlineTeams(prev => {
                const newSet = new Set(prev);
                newSet.delete(teamId);
                return newSet;
            });
        });

        return () => {
            unsubscribeJoined();
            unsubscribeLeft();
        };
    }, [socket]);

    return (
        <div className="bg-slate-950 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                    Network Status
                </p>
                <Users className="w-4 h-4 text-slate-500" />
            </div>

            <div className="space-y-2">
                {TEAMS.map(team => {
                    const online = onlineTeams.has(team.id);
                    return (
                        <div
                            key={team.id}
                            className={`flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800/50 ${online ? 'opacity-100' : 'opacity-50'}`}
                        >
                            <div className="flex items-center gap-2">
                                <team.icon className={`w-4 h-4 ${team.color}`} />
                                <span className={`text-sm ${online ? 'text-slate-200' : 'text-slate-400'}`}>{team.name}</span>
                            </div>
                            <span className={`text-xs font-mono ${online ? 'text-emerald-400' : 'text-slate-600'}`}>{online ? 'ONLINE' : 'OFFLINE'}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
