import React from "react";
import { Play, Pause, RotateCcw } from "lucide-react";

export default function Timer({ timeLeft, setTimeLeft, isRunning, setIsRunning, addLog, duration }) {
    return (
        <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 flex flex-col items-center relative">
            <p className="text-sm text-slate-400 uppercase tracking-widest mb-3">
                Round Timer
            </p>

            <div className={`text-7xl font-mono font-bold mb-6 ${timeLeft < 60 ? "text-red-500" : "text-white"}`}>
                {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:
                {String(timeLeft % 60).padStart(2, "0")}
            </div>

            <div className="flex gap-3 w-full">
                <button
                    onClick={() => {
                        setIsRunning(!isRunning);
                        addLog(isRunning ? "Timer Paused" : "Timer Started");
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-colors ${
                        isRunning
                            ? "bg-yellow-600 hover:bg-yellow-500 text-white"
                            : "bg-green-600 hover:bg-green-500 text-white"
                    }`}
                >
                    {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    {isRunning ? "PAUSE" : "START"}
                </button>

                <button
                    onClick={() => {
                        setTimeLeft(duration * 60);
                        setIsRunning(false);
                        addLog("Timer Reset");
                    }}
                    className="px-4 py-3 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                >
                    <RotateCcw className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
