import React from 'react';
import { Terminal, AlertTriangle, Zap, Activity } from 'lucide-react';

export default function SdaInjectFeed({ injects }) {
  const getInjectIcon = (type) => {
    switch (type) {
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'maneuver': return <Zap className="w-4 h-4 text-orange-400" />;
      case 'system': return <Activity className="w-4 h-4 text-blue-400" />;
      default: return <Terminal className="w-4 h-4 text-slate-400" />;
    }
  };

  const getInjectColor = (type) => {
    switch (type) {
      case 'error': return 'border-red-600/30 bg-red-900/10';
      case 'maneuver': return 'border-orange-600/30 bg-orange-900/10';
      case 'system': return 'border-blue-600/30 bg-blue-900/10';
      default: return 'border-slate-700 bg-slate-800/30';
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-lg border-2 border-slate-700 shadow-xl h-full flex flex-col overflow-hidden">
      <div className="bg-gradient-to-r from-purple-900/30 to-purple-800/20 border-b border-purple-700/50 px-4 py-3">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Terminal className="w-4 h-4 text-purple-400" />
          Event Feed
        </h3>
      </div>

      <div className="p-4 flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto space-y-2 pr-2">

        {injects.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No events yet...</p>
        ) : (
          injects.map(inject => (
            <div 
              key={inject.id}
              className={`p-2 rounded-lg border ${getInjectColor(inject.type)}`}
            >
              <div className="flex items-start gap-2">
                {getInjectIcon(inject.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white leading-tight">{inject.message}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {inject.timestamp.toLocaleTimeString('en-US', { hour12: false })}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
        </div>
      </div>
    </div>
  );
}
