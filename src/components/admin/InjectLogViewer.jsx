import React, { useState, useEffect } from 'react';
import { Clock, Satellite, Shield, Eye, Radio } from 'lucide-react';

const TEAM_CONFIG = {
  sda: {
    name: 'SDA',
    icon: Satellite,
    color: 'text-blue-400',
    bg: 'bg-blue-950/30',
    border: 'border-blue-500/50'
  },
  cyber: {
    name: 'Cyber',
    icon: Shield,
    color: 'text-green-400',
    bg: 'bg-green-950/30',
    border: 'border-green-500/50'
  },
  intel: {
    name: 'Intel',
    icon: Eye,
    color: 'text-purple-400',
    bg: 'bg-purple-950/30',
    border: 'border-purple-500/50'
  },
  ew: {
    name: 'EW',
    icon: Radio,
    color: 'text-red-400',
    bg: 'bg-red-950/30',
    border: 'border-red-500/50'
  }
};

function InjectLogItem({ inject }) {
  const config = TEAM_CONFIG[inject.team] || TEAM_CONFIG.sda;
  const Icon = config.icon;
  const time = new Date(inject.timestamp).toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div className={`border rounded-lg p-3 ${config.bg} ${config.border}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 ${config.color} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold ${config.color} uppercase`}>
              {config.name}
            </span>
            <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {time}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-white">
              {inject.title}
            </h4>
            <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded ${
              inject.status === 'active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-500/20 text-slate-200 border border-slate-500/40'
            }`}>
              {inject.status || 'active'}
            </span>
          </div>
          <p className="text-xs text-slate-400 line-clamp-2">
            {inject.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function InjectLogViewer({ socket, sessionId }) {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!sessionId) {
      console.log('[InjectLogViewer] Session not set yet, skipping listeners');
      return;
    }

    if (!socket?.isConnected) {
      console.log('[InjectLogViewer] Socket not connected yet, waiting');
      return;
    }

    if (!socket?.on) {
      console.warn('[InjectLogViewer] Socket helpers unavailable');
      return;
    }

    console.log('[InjectLogViewer] Setting up listeners for sessionId:', sessionId);

    // Listen for inject logs (sent when admin sends inject)
    const unsubscribeLog = socket.on('inject:log', (data) => {
      console.log('[InjectLogViewer] ✓ Received inject:log:', data);
      setLogs(prev => [data, ...prev]); // Add to beginning (newest first)
    });

    // Also listen to inject:new for general feed updates
    const unsubscribeNew = socket.on('inject:new', (data) => {
      console.log('[InjectLogViewer] ✓ Received inject:new:', data);
      // Only add if it has team property (new format)
      if (data.team) {
        setLogs(prev => {
          // Prevent duplicates
          const exists = prev.some(log => 
            log.timestamp === data.timestamp && log.team === data.team && log.type === data.type
          );
          if (exists) {
            console.log('[InjectLogViewer] Duplicate detected, skipping');
            return prev;
          }
          console.log('[InjectLogViewer] Adding inject to log');
          return [data, ...prev];
        });
      }
    });

    return () => {
      unsubscribeLog();
      unsubscribeNew();
    };
  }, [socket, socket?.isConnected, sessionId]);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white mb-1">Inject Log</h3>
        <p className="text-sm text-slate-400">
          Real-time log of all sent injects
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-500 text-sm">
            No injects sent yet. Send your first inject above.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
          {logs.map((inject, idx) => (
            <InjectLogItem key={`${inject.timestamp}-${idx}`} inject={inject} />
          ))}
        </div>
      )}
    </div>
  );
}
