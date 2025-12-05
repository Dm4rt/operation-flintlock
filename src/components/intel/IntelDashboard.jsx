import React, { useState, useEffect } from 'react';
import StarBackground from '../StarBackground';
import SatImageryPanel from './SatImageryPanel';
import OSINTChallenge from './OSINTChallenge';
import { useFlintlockSocket } from '../../hooks/useFlintlockSocket';
import { Terminal } from 'lucide-react';

const ANALYSIS_TOOLS = [
  { id: 'sat-imagery', name: 'Satellite Imagery', icon: '🛰️', description: 'Live satellite view from SDA ISR asset' },
  { id: 'osint-challenge', name: 'OSINT Challenge', icon: '🔎', description: 'Oracle Island investigation challenge' }
];

export default function IntelDashboard({ operationId }) {
  const socket = useFlintlockSocket(operationId, 'intel', 'Intel (intel)');
  const [selectedTool, setSelectedTool] = useState(null);
  const [satData, setSatData] = useState(null);
  const [isLoadingSat, setIsLoadingSat] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [imageryTimeoutId, setImageryTimeoutId] = useState(null);
  const [imageryError, setImageryError] = useState(null);
  const [injects, setInjects] = useState([
    {
      id: 1,
      timestamp: new Date(),
      type: 'system',
      message: 'Intel System Online - Analysis tools ready'
    }
  ]);

  const handleToolClick = async (tool) => {
    setSelectedTool(tool);
    setAnalysisResult(null);
    setSatData(null);

    // If satellite imagery tool selected, request snapshot from SDA
    if (tool.id === 'sat-imagery') {
      await loadSatImagery();
    }
  };

  // Listen for admin injects via Socket.IO
  useEffect(() => {
    if (!socket.isConnected) return;

    const unsubscribe = socket.on('inject:new', ({ inject }) => {
      console.log('[Intel] Received new inject:', inject);
      setInjects(prev => [{
        id: Date.now(),
        timestamp: new Date(),
        ...inject
      }, ...prev]);
    });

    return unsubscribe;
  }, [socket]);

  const loadSatImagery = () => {
    // Clear any existing timeout
    if (imageryTimeoutId) clearTimeout(imageryTimeoutId);

    setIsLoadingSat(true);
    setImageryError(null);
    console.log('[Intel] Requesting satellite imagery via Socket.IO');
    
    // Request imagery from SDA via Socket.IO
    socket.requestImagery('sentinel-7');

    // Set timeout if SDA doesn't respond within 10 seconds
    const timeout = setTimeout(() => {
      setIsLoadingSat(false);
      setSatData(null);
      setImageryError('No response from SDA team. The SDA team needs to select an ISR satellite (sentinel-7) before Intel can request imagery.');
      setImageryTimeoutId(null);
    }, 10000);

    setImageryTimeoutId(timeout);
  };

  // Listen for imagery coordinates and errors from SDA via Socket.IO
  useEffect(() => {
    if (!socket.isConnected) return;

    const unsubscribeCoords = socket.on('intel:imageryCoords', (data) => {
      console.log('[Intel] Received imagery coordinates:', data);
      setSatData(data);
      setIsLoadingSat(false);
      
      // Clear timeout if we got a response
      if (imageryTimeoutId) {
        clearTimeout(imageryTimeoutId);
        setImageryTimeoutId(null);
      }
    });

    const unsubscribeError = socket.on('intel:imageryError', (data) => {
      console.warn('[Intel] Received imagery error from SDA:', data.error);
      setIsLoadingSat(false);
      setSatData(null);
      setImageryError(data.error);
      
      // Clear timeout
      if (imageryTimeoutId) {
        clearTimeout(imageryTimeoutId);
        setImageryTimeoutId(null);
      }
    });
    
    return () => {
      unsubscribeCoords();
      unsubscribeError();
    };
  }, [socket, imageryTimeoutId]);

  return (
    <div className="relative min-h-screen bg-slate-950 text-white flex flex-col">
      <StarBackground />

      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <header className="bg-[#0a0f1e] border-b border-slate-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="px-3 py-1.5 rounded border border-amber-500 bg-amber-500/10">
                <span className="text-sm font-bold text-amber-200">INTEL</span>
              </div>
              <h1 className="text-xl font-bold text-slate-100">Intel Console</h1>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Intelligence Analysis Center</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-[11px] uppercase text-slate-500">Operation ID</p>
                <p className="text-lg font-mono text-slate-200">{operationId}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Analysis Tools */}
          <aside className="w-80 bg-[#0c111f] border-r border-slate-900 overflow-y-auto">
            <div className="p-4">
              <div className="space-y-2">
                <h3 className="text-[11px] uppercase text-slate-500 font-semibold mb-3">Analysis Tools</h3>
                {ANALYSIS_TOOLS.map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => handleToolClick(tool)}
                    disabled={tool.id === 'sat-imagery' && isLoadingSat}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedTool?.id === tool.id
                        ? 'bg-blue-500/10 border-blue-500/50'
                        : 'bg-[#090d17] border-slate-800 hover:border-slate-700'
                    } ${tool.id === 'sat-imagery' && isLoadingSat ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{tool.icon}</span>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-white mb-1">{tool.name}</div>
                        <p className="text-xs text-slate-400 leading-tight">{tool.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 p-4 bg-slate-900 rounded-lg border border-slate-800">
                <p className="text-xs text-slate-400 leading-relaxed">
                  <span className="font-semibold text-slate-300">Intel Operations:</span> Select an analysis tool to begin processing intelligence data. Satellite imagery requires active ISR satellite tracking by SDA.
                </p>
              </div>
            </div>
          </aside>

          {/* Main Panel - Analysis Console */}
          <main className="flex-1 bg-[#04060c] overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
              {/* Main Content Area - 2/3 width */}
              <div className="lg:col-span-2">
                {selectedTool ? (
                  <div>
                    {/* Satellite Imagery Tool */}
                    {selectedTool.id === 'sat-imagery' && (
                  <div>
                    {imageryError && (
                      <div className="mb-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
                        <div className="flex items-start gap-3">
                          <span className="text-red-400 text-xl">⚠️</span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-red-300 mb-1">SDA Response Error</p>
                            <p className="text-xs text-red-200/80">{imageryError}</p>
                          </div>
                          <button 
                            onClick={() => setImageryError(null)}
                            className="text-red-400 hover:text-red-300 text-lg"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )}
                    {isLoadingSat ? (
                      <div className="flex items-center justify-center min-h-[500px]">
                        <div className="text-center">
                          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                          <p className="text-slate-400">Requesting satellite snapshot from SDA...</p>
                        </div>
                      </div>
                    ) : satData ? (
                      <SatImageryPanel 
                        satData={satData} 
                        onClose={() => setSelectedTool(null)} 
                      />
                    ) : (
                      <div className="bg-slate-900 p-8 rounded-lg border border-slate-700 text-center">
                        <p className="text-slate-400 mb-4">
                          {analysisResult || 'No satellite data available'}
                        </p>
                        <button
                          onClick={loadSatImagery}
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold"
                        >
                          Request Imagery
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* OSINT Challenge Tool */}
                {selectedTool.id === 'osint-challenge' && (
                  <OSINTChallenge />
                )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-5xl">🔍</span>
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-2">No Tool Selected</h3>
                      <p className="text-slate-400">Select an analysis tool from the sidebar to begin</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Inject Feed Sidebar - 1/3 width */}
              <div className="lg:col-span-1">
                <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 sticky top-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-purple-500" />
                      <h3 className="font-bold text-white">Intel Injects</h3>
                    </div>
                    <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded">
                      {injects.length}
                    </span>
                  </div>

                  <div className="space-y-4 max-h-[calc(100vh-16rem)] overflow-y-auto">
                    {injects.length === 0 ? (
                      <p className="text-slate-500 text-sm italic text-center py-8">
                        No injects received yet
                      </p>
                    ) : (
                      injects.map((inject) => (
                        <div
                          key={inject.id}
                          className={`rounded-lg p-4 border ${
                            inject.type === 'system'
                              ? 'bg-slate-900/50 border-slate-800'
                              : inject.type === 'image'
                              ? 'bg-purple-900/20 border-purple-500/30'
                              : inject.type === 'alert'
                              ? 'bg-red-900/20 border-red-500/30'
                              : 'bg-blue-900/20 border-blue-500/30'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className={`text-xs font-semibold uppercase ${
                              inject.type === 'system'
                                ? 'text-slate-400'
                                : inject.type === 'image'
                                ? 'text-purple-400'
                                : inject.type === 'alert'
                                ? 'text-red-400'
                                : 'text-blue-400'
                            }`}>
                              {inject.type}
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              {inject.timestamp.toLocaleTimeString('en-US', { hour12: false })}
                            </span>
                          </div>
                          <p className="text-white text-sm leading-relaxed">
                            {inject.message}
                          </p>
                          {inject.imageUrl && (
                            <div className="mt-3 border border-slate-700 rounded overflow-hidden">
                              <img 
                                src={inject.imageUrl} 
                                alt="Intel inject" 
                                className="w-full h-auto"
                              />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
