import React, { useState, useEffect } from "react";
import { Terminal, Clock, AlertCircle } from "lucide-react";

function InjectItem({ inject, isNew }) {
    const time = new Date(inject.timestamp).toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    return (
        <div className="relative">
            <div className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 ${
                isNew 
                    ? 'bg-purple-500 border-purple-400 animate-pulse' 
                    : 'bg-slate-700 border-slate-600'
            }`}></div>
            
            <div className="flex items-start gap-2 mb-1">
                <p className="text-xs text-slate-500 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {time}
                </p>
                {isNew && (
                    <span className="text-xs text-purple-400 font-bold uppercase">New</span>
                )}
            </div>
            
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
                <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <h4 className="text-white font-semibold text-sm">{inject.title}</h4>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">
                    {inject.description}
                </p>
            </div>
        </div>
    );
}

export default function InjectFeed({ scenarioId, socket, teamId, className = '' }) {
    const [injects, setInjects] = useState([]);
    const [newInjectId, setNewInjectId] = useState(null);

    useEffect(() => {
        if (!socket?.isConnected || !teamId) return;

        // Admin sees all injects via inject:new, teams see only their own via inject:received
        if (teamId === 'admin') {
            const unsubscribeNew = socket.on('inject:new', (data) => {
                console.log('[InjectFeed] Admin received inject:new', data);
                
                // Only show new format injects (with team property)
                if (data.team) {
                    setInjects(prev => {
                        // Prevent duplicates
                        const exists = prev.some(i => i.timestamp === data.timestamp);
                        if (exists) return prev;
                        return [data, ...prev];
                    });
                    setNewInjectId(data.timestamp);
                    setTimeout(() => setNewInjectId(null), 5000);
                }
            });

            return () => unsubscribeNew();
        } else {
            // Teams only see injects sent to them
            const unsubscribeReceived = socket.on('inject:received', (data) => {
                console.log('[InjectFeed] Received inject for team:', teamId, data);
                
                if (data.team === teamId) {
                    setInjects(prev => [data, ...prev]);
                    setNewInjectId(data.timestamp);
                    setTimeout(() => setNewInjectId(null), 5000);
                }
            });

            return () => unsubscribeReceived();
        }
    }, [socket, teamId]);

    return (
        <div className={`bg-slate-950 rounded-xl border border-slate-800 p-6 min-h-[250px] ${className}`}>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-purple-500" />
                    <h3 className="font-bold text-white">Live Inject Feed</h3>
                </div>
                {injects.length > 0 && (
                    <span className="text-xs text-slate-500 font-mono">
                        {injects.length} inject{injects.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            <div className="border-l-2 border-slate-800 ml-2 pl-6 space-y-6 relative">
                {/* System init message */}
                <div className="relative">
                    <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-600"></div>
                    <p className="text-xs text-slate-500 font-mono mb-1">SYS.INIT</p>
                    <h4 className="text-white font-medium">
                        {scenarioId ? 'Scenario active. Monitoring for injects...' : 'Awaiting initialization...'}
                    </h4>
                </div>

                {/* Inject items */}
                {injects.map((inject) => (
                    <InjectItem 
                        key={inject.timestamp} 
                        inject={inject}
                        isNew={inject.timestamp === newInjectId}
                    />
                ))}

                {/* Empty state */}
                {scenarioId && injects.length === 0 && (
                    <p className="text-slate-500 text-sm italic">
                        No injects received yet.
                    </p>
                )}
            </div>
        </div>
    );
}
