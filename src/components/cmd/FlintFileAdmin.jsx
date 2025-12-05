import React, { useState, useEffect, useRef } from 'react';
import { useFlintlockSocket } from '../../hooks/useFlintlockSocket';
import { revealFlintFile, hideFlintFile } from '../../terminal/initFlintFiles';

export default function FlintFileAdmin({ sessionId }) {
  const socket = useFlintlockSocket(sessionId, 'admin', 'Admin');
  const [visibilityMap, setVisibilityMap] = useState({});
  const [flintFiles, setFlintFiles] = useState([]);
  const toggleInProgressRef = useRef({});
  const lastSocketUpdateRef = useRef({});

  // Load initial flint files from Firestore and subscribe to Socket.IO updates
  useEffect(() => {
    if (!sessionId) return;

    // Load initial state from Firestore
    const loadInitialFiles = async () => {
      const { subscribeToFlintVisibility } = await import('../../terminal/flintVisibility');
      const unsubFirestore = subscribeToFlintVisibility(sessionId, (newMap) => {
        setVisibilityMap(newMap);
        setFlintFiles(Object.keys(newMap).sort());
      });
      return unsubFirestore;
    };

    let unsubFirestore;
    loadInitialFiles().then(unsub => { unsubFirestore = unsub; });

    return () => {
      if (unsubFirestore) unsubFirestore();
    };
  }, [sessionId]);

  // Listen for visibility updates via Socket.IO
  useEffect(() => {
    if (!socket.isConnected) return;

    const unsubscribe = socket.on('flint:visibility', ({ filename, visible }) => {
      // Prevent processing updates we just sent
      if (lastSocketUpdateRef.current[filename] === visible) {
        console.log('[FlintFileAdmin] Ignoring echo update:', filename, visible);
        return;
      }
      lastSocketUpdateRef.current[filename] = visible;
      
      console.log('[FlintFileAdmin] Visibility update:', filename, visible);
      setVisibilityMap(prev => ({
        ...prev,
        [filename]: visible
      }));
    });

    return unsubscribe;
  }, [socket]);

  const handleToggle = async (filename) => {
    // Prevent rapid-fire toggles
    if (toggleInProgressRef.current[filename]) {
      console.log('[FlintFileAdmin] Toggle already in progress for', filename);
      return;
    }
    toggleInProgressRef.current[filename] = true;
    
    const isCurrentlyVisible = visibilityMap[filename];
    const newVisibility = !isCurrentlyVisible;
    
    try {
      // Update Firestore for persistence
      if (newVisibility) {
        await revealFlintFile(sessionId, filename);
      } else {
        await hideFlintFile(sessionId, filename);
      }
      
      // Track this update to prevent echo processing
      lastSocketUpdateRef.current[filename] = newVisibility;
      
      // Broadcast via Socket.IO for real-time updates
      socket.updateFlintVisibility(filename, newVisibility);
      
      // Update local state immediately for UI responsiveness
      setVisibilityMap(prev => ({
        ...prev,
        [filename]: newVisibility
      }));
    } catch (error) {
      console.error('Failed to toggle visibility:', error);
    } finally {
      // Release lock after short delay
      setTimeout(() => {
        toggleInProgressRef.current[filename] = false;
      }, 500);
    }
  };

  if (!sessionId) {
    return (
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-700">
        <h2 className="text-xl font-bold text-white mb-2">Flint File Control</h2>
        <p className="text-slate-400 text-sm">No session active</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 p-6 rounded-xl border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-4">Flint File Control</h2>
      <p className="text-slate-400 text-sm mb-4">
        Toggle visibility of hidden files in the Cyber terminal
      </p>

      {flintFiles.length === 0 ? (
        <p className="text-slate-500 text-sm italic">
          No flint files initialized yet. Start the operation to initialize them.
        </p>
      ) : (
        <div className="space-y-2">
          {flintFiles.map((filename) => {
            const isVisible = visibilityMap[filename];
            return (
              <div
                key={filename}
                className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700"
              >
                <div className="flex items-center gap-3">
                  <code className="text-sm text-green-400 font-mono">{filename}</code>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      isVisible
                        ? 'bg-green-900/30 text-green-400 border border-green-700'
                        : 'bg-red-900/30 text-red-400 border border-red-700'
                    }`}
                  >
                    {isVisible ? 'VISIBLE' : 'HIDDEN'}
                  </span>
                </div>

                <button
                  onClick={() => handleToggle(filename)}
                  className={`px-4 py-2 rounded font-semibold text-sm transition-colors ${
                    isVisible
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {isVisible ? 'Hide' : 'Reveal'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 p-3 bg-slate-800 rounded-lg border border-slate-700">
        <p className="text-xs text-slate-400">
          <strong className="text-slate-300">Note:</strong> Changes take effect immediately in the Cyber terminal.
          Hidden files cannot be accessed with <code className="text-green-400">cat</code> or <code className="text-green-400">ls</code>.
        </p>
      </div>
    </div>
  );
}
