import React, { useState, useEffect } from 'react';
import StarBackground from '../StarBackground';
import useSession from '../../hooks/useSession';

export default function CommandDashboard({ operationId }) {
  const { session, participants, pushInject } = useSession(operationId);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [messageType, setMessageType] = useState('info');

  // Load injects from session as messages
  useEffect(() => {
    if (session?.injects) {
      setMessages(session.injects.map(inject => ({
        id: inject.id,
        timestamp: inject.timestamp || new Date().toISOString(),
        from: 'ADMIN',
        to: inject.target || 'all',
        type: inject.type || 'info',
        content: inject.text,
        priority: inject.priority || 'normal'
      })));
    }
  }, [session?.injects]);

  const teams = [
    { id: 'all', name: 'All Teams', color: 'text-blue-400' },
    { id: 'sda', name: 'SDA', color: 'text-green-400' },
    { id: 'ew', name: 'Electronic Warfare', color: 'text-blue-400' },
    { id: 'cyber', name: 'Cyber', color: 'text-purple-400' },
    { id: 'intel', name: 'Intelligence', color: 'text-amber-400' }
  ];

  const messageTypes = [
    { id: 'info', label: 'Information', color: 'bg-blue-500/20 text-blue-300 border-blue-500/50' },
    { id: 'warning', label: 'Warning', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' },
    { id: 'critical', label: 'Critical', color: 'bg-red-500/20 text-red-300 border-red-500/50' },
    { id: 'order', label: 'Order', color: 'bg-purple-500/20 text-purple-300 border-purple-500/50' }
  ];

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      from: 'COMMAND',
      to: selectedTeam,
      type: messageType,
      content: newMessage,
      priority: messageType === 'critical' ? 'high' : 'normal'
    };

    // Send to Firebase as inject
    try {
      await pushInject({
        text: newMessage,
        target: selectedTeam === 'all' ? null : selectedTeam,
        type: messageType,
        priority: message.priority
      });
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const formatTimestamp = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getMessageTypeColor = (type) => {
    return messageTypes.find(t => t.id === type)?.color || messageTypes[0].color;
  };

  const getTeamColor = (teamId) => {
    return teams.find(t => t.id === teamId)?.color || 'text-slate-400';
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
                {teams.slice(1).map(team => {
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
                <h3 className="text-[11px] uppercase text-slate-500 font-semibold mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors">
                    Mission Brief
                  </button>
                  <button className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-semibold transition-colors">
                    Status Report
                  </button>
                  <button className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-semibold transition-colors">
                    Event Log
                  </button>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Panel - Messages */}
          <main className="flex-1 bg-[#04060c] flex flex-col">
            {/* Message Feed */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-4xl">📡</span>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">No Messages</h3>
                    <p className="text-slate-400">Awaiting directives from higher command</p>
                  </div>
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className="bg-[#050812] border border-slate-900 rounded-xl p-4 shadow-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getMessageTypeColor(msg.type)}`}>
                          {messageTypes.find(t => t.id === msg.type)?.label || 'INFO'}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          {formatTimestamp(msg.timestamp)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">FROM:</span>
                        <span className="text-xs font-semibold text-blue-400">{msg.from}</span>
                        <span className="text-xs text-slate-600">→</span>
                        <span className={`text-xs font-semibold ${getTeamColor(msg.to)}`}>
                          {teams.find(t => t.id === msg.to)?.name || 'ALL TEAMS'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">{msg.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Message Composer */}
            <div className="border-t border-slate-800 bg-[#0a0f1e] p-4">
              <div className="max-w-5xl mx-auto">
                <div className="flex gap-3 mb-3">
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={messageType}
                    onChange={(e) => setMessageType(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {messageTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type message to teams..."
                    className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg font-semibold transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
