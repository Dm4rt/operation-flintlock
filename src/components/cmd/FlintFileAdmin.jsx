import React, { useState, useEffect } from 'react';
import { subscribeToFlintVisibility } from '../../terminal/flintVisibility';
import { revealFlintFile, hideFlintFile } from '../../terminal/initFlintFiles';

export default function FlintFileAdmin({ sessionId }) {
  const [visibilityMap, setVisibilityMap] = useState({});
  const [flintFiles, setFlintFiles] = useState([]);

  // Subscribe to Firestore visibility changes
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = subscribeToFlintVisibility(sessionId, (newMap) => {
      setVisibilityMap(newMap);
      // Extract filenames from the map
      setFlintFiles(Object.keys(newMap).sort());
    });

    return unsubscribe;
  }, [sessionId]);

  const handleToggle = async (filename) => {
    const isCurrentlyVisible = visibilityMap[filename];
    
    try {
      if (isCurrentlyVisible) {
        await hideFlintFile(sessionId, filename);
      } else {
        await revealFlintFile(sessionId, filename);
      }
    } catch (error) {
      console.error('Failed to toggle visibility:', error);
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
