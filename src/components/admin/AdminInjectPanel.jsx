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

function InjectCard({ inject, teamId, onSend, disabled, status }) {
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

  const isActiveOrResolved = status === 'active' || status === 'resolved';
  const buttonLabel = isActiveOrResolved ? 'Reset Inject' : 'Send Inject';
  const buttonStateClasses = isActiveOrResolved ? 'bg-slate-600 hover:bg-slate-500' : buttonClasses[teamColor];
  
  const statusBadge = status === 'resolved' ? (
    <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-300 border border-green-500/50">
      ✓ Resolved
    </span>
  ) : status === 'active' ? (
    <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50">
      ⚡ Active
    </span>
  ) : null;

  return (
    <div className={`border rounded-lg p-4 transition-colors ${colorClasses[teamColor]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{inject.icon}</span>
            <h4 className="font-semibold text-white">{inject.title}</h4>
            {statusBadge}
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

function TeamSection({ teamId, isExpanded, onToggle, onSendInject, disabled, statusMap }) {
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
              inject={inject}
              teamId={teamId}
              onSend={onSendInject}
              disabled={disabled}
              status={statusMap?.[inject.id] || 'idle'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminInjectPanel({ sessionId, socket }) {
  const [expandedSections, setExpandedSections] = useState({
    sda: false,
    cyber: false,
    intel: false,
    ew: false
  });
  const [injectStatuses, setInjectStatuses] = useState({});

  // Subscribe to inject statuses from Firestore
  React.useEffect(() => {
    if (!sessionId) return;

    const setupSubscription = async () => {
      const { collection, onSnapshot } = await import('firebase/firestore');
      const { db } = await import('../../services/firebase');
      
      const injectsRef = collection(db, 'sessions', sessionId, 'injects');
      const unsubscribe = onSnapshot(injectsRef, (snapshot) => {
        const statuses = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          // For satellite-dropout, check both sda and ew statuses (if either is resolved, show resolved)
          if (data.type === 'satellite-dropout') {
            const currentStatus = statuses[data.type];
            if (!currentStatus || data.status === 'resolved' || (currentStatus !== 'resolved' && data.status === 'active')) {
              statuses[data.type] = data.status;
            }
          } else {
            statuses[data.type] = data.status;
          }
        });
        setInjectStatuses(statuses);
      });

      return unsubscribe;
    };

    let unsubscribe;
    setupSubscription().then(unsub => { unsubscribe = unsub; });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [sessionId]);

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

    const currentStatus = injectStatuses[inject.id] || 'idle';
    const nextStatus = (currentStatus === 'active' || currentStatus === 'resolved') ? 'idle' : 'active';

    // Generate inject-specific payload
    let payload = {};
    if (nextStatus === 'active' && inject.id === 'satellite-dropout') {
      // Get random satellite from session
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../../services/firebase');
      const sessionRef = doc(db, 'sessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);
      
      if (sessionSnap.exists()) {
        // Use satellite IDs from fictionalSatellites.json
        const satelliteIds = ['aehf-6', 'gps-iii-5', 'sbirs-geo-6', 'sentinel-7'];
        const randomSat = satelliteIds[Math.floor(Math.random() * satelliteIds.length)];
        
        // Generate bad frequency at least 2 MHz away from existing signals
        const existingFreqs = [100.8e6, 98.5e6, 105.2e6, 92.1e6, 110.3e6, 88.7e6, 115.6e6]; // From audioTransmissions.json
        let badFreq;
        let attempts = 0;
        do {
          badFreq = 80e6 + Math.random() * 50e6; // 80-130 MHz
          const tooClose = existingFreqs.some(f => Math.abs(f - badFreq) < 2e6);
          if (!tooClose) break;
          attempts++;
        } while (attempts < 50);
        
        payload = {
          targetSatellite: randomSat,
          badFrequency: badFreq
        };
        
        console.log('[AdminInjectPanel] 🛰️ SATELLITE DROPOUT INJECT 🛰️');
        console.log('  Target Satellite:', randomSat);
        console.log('  Bad Frequency:', (badFreq / 1_000_000).toFixed(3), 'MHz');
        console.log('  📡 EW TUNING INSTRUCTIONS:');
        console.log('    Center Frequency:', (badFreq / 1_000_000).toFixed(3), 'MHz');
        console.log('    Bandwidth: ~250 kHz');
        console.log('    Audio: Jamming sound (you should hear static/noise)');
        console.log('    Deploy jammer at this frequency to resolve!');
        console.log('[AdminInjectPanel] Satellite dropout payload:', payload);
      }
    }

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
      
      const injectData = {
        team: teamId,
        type: inject.id,
        title: inject.title,
        description: inject.description,
        status: nextStatus,
        payload,
        updatedAt: new Date().toISOString()
      };
      
      const injectRef = doc(db, 'sessions', sessionId, 'injects', `${teamId}-${inject.id}`);
      await setDoc(injectRef, injectData);

      // For satellite-dropout, also send to EW team so they can see the bad signal
      if (inject.id === 'satellite-dropout' && teamId === 'sda') {
        const ewInjectRef = doc(db, 'sessions', sessionId, 'injects', `ew-${inject.id}`);
        const ewDescription = nextStatus === 'active' && payload.badFrequency 
          ? `${inject.description} | TUNE TO: ${(payload.badFrequency / 1_000_000).toFixed(3)} MHz, BW: ~250 kHz`
          : inject.description;
        await setDoc(ewInjectRef, {
          ...injectData,
          team: 'ew',
          description: ewDescription
        });
        socket.sendInject('ew', inject.id, inject.title, ewDescription, payload, nextStatus);
      }

      // Also emit via Socket.IO for instant updates
      socket.sendInject(teamId, inject.id, inject.title, inject.description, payload, nextStatus);
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
            statusMap={injectStatuses}
          />
        ))}
      </div>
    </div>
  );
}
