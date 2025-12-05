import React, { useEffect, useMemo, useState } from 'react';
import { Terminal, AlertTriangle, Zap, Activity } from 'lucide-react';
import { INJECT_CATALOG } from '../../data/injectCatalog';

export default function SdaInjectFeed({ injects, socket, sessionId }) {
  const catalog = useMemo(() => INJECT_CATALOG.sda || [], []);
  const [adminInjects, setAdminInjects] = useState(() =>
    catalog.map((item) => ({
      ...item,
      status: 'idle',
      lastTriggered: null
    }))
  );

  // Subscribe to Firestore inject state (like Flint files)
  useEffect(() => {
    if (!sessionId) return;

    const setupSubscription = async () => {
      const { collection, onSnapshot, query, where } = await import('firebase/firestore');
      const { db } = await import('../../services/firebase');
      
      const injectsRef = collection(db, 'sessions', sessionId, 'injects');
      const q = query(injectsRef, where('team', '==', 'sda'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log('[SdaInjectFeed] Firestore snapshot:', snapshot.size, 'injects');
        
        setAdminInjects((prev) => {
          const updated = [...prev];
          snapshot.forEach((doc) => {
            const data = doc.data();
            const index = updated.findIndex(i => i.id === data.type);
            if (index >= 0) {
              updated[index] = {
                ...updated[index],
                status: data.status || 'idle',
                lastTriggered: data.updatedAt ? new Date(data.updatedAt) : null
              };
            }
          });
          return updated;
        });
      });

      return unsubscribe;
    };

    let unsubscribe;
    setupSubscription().then(unsub => { unsubscribe = unsub; });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [sessionId]);
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
        <div className="h-full overflow-y-auto space-y-4 pr-2">
          <section>
            <p className="text-[11px] uppercase text-slate-500 tracking-wide mb-2">Admin Inject Status</p>
            <div className="space-y-2">
              {adminInjects.map((inject) => (
                <div key={inject.id} className="p-2 rounded-lg border border-slate-800 bg-slate-900/40">
                  <div className="flex items-start gap-3">
                    <span className="text-xl" role="img" aria-label="inject-icon">{inject.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-white font-semibold">{inject.title}</p>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                          inject.status === 'active'
                            ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                            : 'border-slate-500/40 text-slate-300 bg-slate-500/10'
                        }`}>
                          {inject.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{inject.description}</p>
                      {inject.lastTriggered && (
                        <p className="text-[11px] text-slate-500 mt-1">
                          Last update: {inject.lastTriggered.toLocaleTimeString('en-US', { hour12: false })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="text-[11px] uppercase text-slate-500 tracking-wide mb-2">System Events</p>
            {[...injects].length === 0 ? (
              <p className="text-xs text-slate-500 italic">No events yet...</p>
            ) : (
              injects.map((inject) => (
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
          </section>
        </div>
      </div>
    </div>
  );
}
