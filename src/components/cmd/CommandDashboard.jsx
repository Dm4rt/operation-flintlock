import React, { useState, useEffect } from 'react';
import StarBackground from '../StarBackground';
import useSession from '../../hooks/useSession';
import { ExternalLink } from 'lucide-react';

export default function CommandDashboard({ operationId }) {
  const { participants } = useSession(operationId);
  const [eventLog, setEventLog] = useState([
    {
      id: 1,
      timestamp: new Date().toISOString(),
      type: 'system',
      message: 'Mission Command Center Online'
    }
  ]);

  // Track team join/leave events
  useEffect(() => {
    if (participants) {
      const teams = ['sda', 'ew', 'cyber', 'intel'];
      teams.forEach(teamId => {
        const teamParticipants = Object.entries(participants).filter(([id, p]) => p.teamId === teamId);
        if (teamParticipants.length > 0) {
          setEventLog(prev => {
            const alreadyLogged = prev.some(e => e.message.includes(`${teamId.toUpperCase()} team connected`));
            if (!alreadyLogged) {
              return [{
                id: Date.now() + Math.random(),
                timestamp: new Date().toISOString(),
                type: 'team-join',
                message: `${teamId.toUpperCase()} team connected`
              }, ...prev];
            }
            return prev;
          });
        }
      });
    }
  }, [participants]);

  const teams = [
    { id: 'sda', name: 'SDA', color: 'text-green-400' },
    { id: 'ew', name: 'Electronic Warfare', color: 'text-blue-400' },
    { id: 'cyber', name: 'Cyber', color: 'text-purple-400' },
    { id: 'intel', name: 'Intelligence', color: 'text-amber-400' }
  ];

  const formatTimestamp = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-white flex flex-col">
      <StarBackground />

      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <header className="bg-[#0a0f1e] border-b border-slate-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="px-3 py-1.5 rounded border border-blue-500 bg-blue-500/10">
                <span className="text-sm font-bold text-blue-200">CMD</span>
              </div>
              <h1 className="text-xl font-bold text-slate-100">Mission Command Center</h1>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Tactical Operations Coordination</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-[11px] uppercase text-slate-500">Operation ID</p>
                <p className="text-lg font-mono text-slate-200">{operationId}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase text-slate-500">Active Teams</p>
                <p className="text-lg font-mono text-emerald-400">{Object.keys(participants || {}).length}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Team Status Sidebar */}
          <aside className="w-72 bg-[#0c111f] border-r border-slate-900 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-[11px] uppercase text-slate-500 font-semibold mb-3">Team Status</h3>
              <div className="space-y-2">
                {teams.map(team => {
                  const teamParticipants = participants ? Object.entries(participants).filter(([id, p]) => p.teamId === team.id) : [];
                  const isOnline = teamParticipants.length > 0;
                  
                  return (
                    <div
                      key={team.id}
                      className="bg-[#090d17] border border-slate-800 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-semibold ${team.color}`}>{team.name}</span>
                        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></div>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {isOnline ? (
                          <>
                            <span className="text-emerald-400">● ONLINE</span>
                            <span className="text-slate-600 mx-1">•</span>
                            <span>{teamParticipants.length} operator{teamParticipants.length !== 1 ? 's' : ''}</span>
                          </>
                        ) : (
                          <span className="text-slate-600">● OFFLINE</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6">
                <h3 className="text-[11px] uppercase text-slate-500 font-semibold mb-3">Mission Resources</h3>
                <div className="space-y-2">
                  <a
                    href="https://docs.google.com/document/d/1cQXbxycgMOh3TSpIpaLFgKWxfKfZWyCm3gnUFxrpfhc/edit?usp=sharing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-between group"
                  >
                    <span>Mission Briefs</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                  </a>
                  <a
                    href="https://docs.google.com/document/d/1OzJbeiPYjNQsBEgboyfetXMZvvLKf0129mVT46pkHik/edit?usp=sharing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-semibold transition-colors flex items-center justify-between group"
                  >
                    <span>Space Capabilities (GLP)</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                  </a>
                  <a
                    href="https://docs.google.com/document/d/1SxnYaSQyK0QGXGeWB4Futi-68cqTQVcq5lmMMQPRyXM/edit?usp=sharing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-semibold transition-colors flex items-center justify-between group"
                  >
                    <span>Tool Usage Guide</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                  </a>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Panel - Event Log */}
          <main className="flex-1 bg-[#04060c] flex flex-col">
            <div className="border-b border-slate-800 bg-[#0a0f1e] px-6 py-4">
              <h2 className="text-lg font-bold text-slate-100">Mission Event Log</h2>
              <p className="text-xs text-slate-500 mt-1">Real-time tracking of team activities and mission events</p>
            </div>

            {/* Event Feed */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {eventLog.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-4xl">📡</span>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">No Events</h3>
                    <p className="text-slate-400">Awaiting mission activity</p>
                  </div>
                </div>
              ) : (
                eventLog.map(event => (
                  <div
                    key={event.id}
                    className={`bg-[#050812] border rounded-lg p-3 shadow ${
                      event.type === 'team-join' 
                        ? 'border-emerald-900/50' 
                        : event.type === 'error'
                        ? 'border-red-900/50'
                        : 'border-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${
                          event.type === 'team-join' 
                            ? 'bg-emerald-500' 
                            : event.type === 'error'
                            ? 'bg-red-500'
                            : 'bg-blue-500'
                        }`}></span>
                        <span className="text-sm text-slate-200">{event.message}</span>
                      </div>
                      <span className="text-xs text-slate-500 font-mono">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Info Footer */}
            <div className="border-t border-slate-800 bg-[#0a0f1e] p-4">
              <div className="max-w-5xl mx-auto text-center">
                <p className="text-xs text-slate-500">
                  Team Lead View • Monitor team status and access mission resources above
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
