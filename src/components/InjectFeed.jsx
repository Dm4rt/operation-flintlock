import React from "react";
import { Terminal } from "lucide-react";

export default function InjectFeed({ scenarioId }) {
    return (
        <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 min-h-[250px]">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-purple-500" />
                    <h3 className="font-bold text-white">Live Inject Feed</h3>
                </div>
            </div>

            <div className="border-l-2 border-slate-800 ml-2 pl-6 space-y-8 relative">
                <div className="relative">
                    <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-600"></div>
                    <p className="text-xs text-slate-500 font-mono mb-1">SYS.INIT</p>
                    <h4 className="text-white font-medium">
                        Scenario parameters locked. Waiting for timer...
                    </h4>
                </div>

                {!scenarioId && (
                    <p className="text-slate-500 text-sm mt-6 italic">
                        Awaiting initialization...
                    </p>
                )}
            </div>
        </div>
    );
}
