import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Satellite, Shield, Eye, Radio } from 'lucide-react';
import { INJECT_CATALOG } from '../../data/injectCatalog';

const TEAM_CONFIG = {
  sda: {
    name: 'Space Domain Awareness',
    icon: Satellite,
    color: 'blue'
  },
  cyber: {
    name: 'Cyber Operations',
    icon: Shield,
    color: 'green'
  },
  intel: {
    name: 'Intelligence',
    icon: Eye,
    color: 'purple'
  },
  ew: {
    name: 'Electronic Warfare',
    icon: Radio,
    color: 'red'
  }
};

function InjectCard({ inject, teamId, onSend, disabled }) {
  const teamColor = TEAM_CONFIG[teamId].color;
  
  const colorClasses = {
    blue: 'bg-blue-950/30 border-blue-500/50 hover:bg-blue-950/50',
    green: 'bg-green-950/30 border-green-500/50 hover:bg-green-950/50',
    purple: 'bg-purple-950/30 border-purple-500/50 hover:bg-purple-950/50',
    red: 'bg-red-950/30 border-red-500/50 hover:bg-red-950/50'
  };
  
  const buttonClasses = {
    blue: 'bg-blue-600 hover:bg-blue-500',
    green: 'bg-green-600 hover:bg-green-500',
    purple: 'bg-purple-600 hover:bg-purple-500',
    red: 'bg-red-600 hover:bg-red-500'
  };

  const buttonLabel = inject.isActive ? 'Reset Inject' : 'Send Inject';
  const buttonStateClasses = inject.isActive ? 'bg-slate-600 hover:bg-slate-500' : buttonClasses[teamColor];

  return (
    <div className={`border rounded-lg p-4 transition-colors ${colorClasses[teamColor]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{inject.icon}</span>
            <h4 className="font-semibold text-white">{inject.title}</h4>
          </div>
          <p className="text-sm text-slate-400">{inject.description}</p>
        </div>
        <button
          onClick={() => onSend(inject, teamId)}
          disabled={disabled}
          className={`px-4 py-2 rounded text-white text-sm font-semibold transition-colors whitespace-nowrap ${
            disabled ? 'bg-slate-700 cursor-not-allowed opacity-50' : buttonStateClasses
          }`}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function TeamSection({ teamId, isExpanded, onToggle, onSendInject, disabled, activeMap }) {
  const config = TEAM_CONFIG[teamId];
  const Icon = config.icon;
  const injects = INJECT_CATALOG[teamId];

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 text-${config.color}-400`} />
          <h3 className="text-lg font-bold text-white">{config.name}</h3>
          <span className="text-xs text-slate-500 font-mono">
            {injects.length} inject{injects.length !== 1 ? 's' : ''}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-6 py-4 space-y-3 bg-slate-950/50">
          {injects.map((inject) => (
            <InjectCard
              key={inject.id}
              inject={{ ...inject, isActive: activeMap?.[inject.id] }}
              teamId={teamId}
              onSend={onSendInject}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminInjectPanel({ sessionId, socket }) {
  const [expandedSections, setExpandedSections] = useState({
    sda: true,
    cyber: false,
    intel: false,
    ew: false
  });
  const [activeInjects, setActiveInjects] = useState({});

  const toggleSection = (teamId) => {
    setExpandedSections(prev => ({
      ...prev,
      [teamId]: !prev[teamId]
    }));
  };

  const handleSendInject = async (inject, teamId) => {
    if (!sessionId || !socket?.isConnected) {
      console.warn('[AdminInjectPanel] Cannot send inject - no session or socket');
      return;
    }

    const isActive = activeInjects[inject.id] === true;
    const nextStatus = isActive ? 'idle' : 'active';

    console.log('[AdminInjectPanel] Sending inject:', {
      sessionId,
      team: teamId,
      type: inject.id,
      title: inject.title,
      status: nextStatus
    });

    try {
      // Write to Firestore for persistence (like Flint files)
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../../services/firebase');
      const injectRef = doc(db, 'sessions', sessionId, 'injects', `${teamId}-${inject.id}`);
      await setDoc(injectRef, {
        team: teamId,
        type: inject.id,
        title: inject.title,
        description: inject.description,
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });

      // Also emit via Socket.IO for instant updates
      socket.sendInject(teamId, inject.id, inject.title, inject.description, {}, nextStatus);

      setActiveInjects((prev) => ({
        ...prev,
        [inject.id]: !isActive
      }));
    } catch (error) {
      console.error('[AdminInjectPanel] Failed to send inject:', error);
    }
  };

  const isDisabled = !sessionId || !socket?.isConnected;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Inject Control Dashboard</h2>
        <p className="text-sm text-slate-400">
          Deploy mission injects to each team. All injects are sent via WebSocket for real-time delivery.
        </p>
        {isDisabled && (
          <div className="mt-3 px-4 py-2 bg-amber-950/30 border border-amber-500/50 rounded-lg">
            <p className="text-sm text-amber-300">
              ⚠️ Session not active or socket disconnected. Start operation to enable injects.
            </p>
          </div>
        )}
      </div>

      {/* Team Sections */}
      <div className="space-y-4">
        {['sda', 'cyber', 'intel', 'ew'].map((teamId) => (
          <TeamSection
            key={teamId}
            teamId={teamId}
            isExpanded={expandedSections[teamId]}
            onToggle={() => toggleSection(teamId)}
            onSendInject={handleSendInject}
            disabled={isDisabled}
            activeMap={activeInjects}
          />
        ))}
      </div>
    </div>
  );
}
