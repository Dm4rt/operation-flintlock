import React, { useEffect } from "react";
import { Play, Pause, RotateCcw, ChevronUp, ChevronDown } from "lucide-react";

export default function Timer({ timeLeft, setTimeLeft, isRunning, setIsRunning, addLog, duration }) {

    // local ticking: when running, decrement timeLeft every second
    useEffect(() => {
        if (!isRunning) return undefined;
        const id = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    // stop when reaching zero
                    setIsRunning(false);
                    addLog('Timer Ended');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(id);
    }, [isRunning, setTimeLeft, setIsRunning, addLog]);

    return (
        <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 flex flex-col items-center relative">
            <p className="text-sm text-slate-400 uppercase tracking-widest mb-3">
                Round Timer
            </p>

            {/* Per-digit controls: minutes and seconds with up/down */}
            <div className="flex items-center gap-6 mb-6">
                <div className="flex flex-col items-center">
                    <button
                        onClick={() => {
                            if (isRunning) return;
                            setTimeLeft(prev => prev + 60);
                        }}
                        className="p-1 bg-slate-800 rounded"
                        aria-label="increase minutes"
                    >
                        <ChevronUp className="w-5 h-5 text-slate-200" />
                    </button>
                    <div className={`text-7xl font-mono font-bold ${timeLeft < 60 ? "text-red-500" : "text-white"}`}>
                        {String(Math.floor(timeLeft / 60)).padStart(2, "0")}
                    </div>
                    <button
                        onClick={() => {
                            if (isRunning) return;
                            setTimeLeft(prev => Math.max(0, prev - 60));
                        }}
                        className="p-1 bg-slate-800 rounded"
                        aria-label="decrease minutes"
                    >
                        <ChevronDown className="w-5 h-5 text-slate-200" />
                    </button>
                </div>

                <div className="text-7xl font-mono font-bold text-white">:</div>

                <div className="flex flex-col items-center">
                    <button
                        onClick={() => {
                            if (isRunning) return;
                            setTimeLeft(prev => Math.min(prev + 1, 24 * 60 * 60));
                        }}
                        className="p-1 bg-slate-800 rounded"
                        aria-label="increase seconds"
                    >
                        <ChevronUp className="w-5 h-5 text-slate-200" />
                    </button>
                    <div className={`text-7xl font-mono font-bold ${timeLeft < 60 ? "text-red-500" : "text-white"}`}>
                        {String(timeLeft % 60).padStart(2, "0")}
                    </div>
                    <button
                        onClick={() => {
                            if (isRunning) return;
                            setTimeLeft(prev => Math.max(0, prev - 1));
                        }}
                        className="p-1 bg-slate-800 rounded"
                        aria-label="decrease seconds"
                    >
                        <ChevronDown className="w-5 h-5 text-slate-200" />
                    </button>
                </div>
            </div>

            <div className="flex gap-3 w-full justify-center">
                <button
                    onClick={() => {
                        setTimeLeft(duration * 60);
                        setIsRunning(false);
                        addLog("Timer Reset");
                    }}
                    disabled={isRunning}
                    className={`px-6 py-3 rounded-lg transition-colors flex items-center gap-2 ${
                        isRunning 
                            ? "bg-slate-900 text-slate-600 cursor-not-allowed" 
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                >
                    <RotateCcw className="w-5 h-5" />
                    <span className="font-bold">RESET</span>
                </button>
            </div>
        </div>
    );
}
