import React from "react";

export default function SystemLog({ logs }) {
    return (
        <div className="bg-black/50 rounded-xl border border-slate-800 p-4 font-mono text-sm flex flex-col">
            <p className="text-xs font-bold text-slate-600 uppercase mb-2">
                System Log
            </p>

            <div className="flex-1 overflow-y-auto space-y-1 pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent h-32">
                {logs.length === 0 && (
                    <p className="text-slate-500 text-xs italic">No logs yet…</p>
                )}

                {logs.map((log, i) => (
                    <div key={i} className="flex gap-3 text-xs">
                        <span className="text-slate-600 shrink-0">{log.time}</span>
                        <span className="text-blue-400/80">{">"}</span>
                        <span className="text-slate-300">{log.msg}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
