import React, { useState, useEffect } from 'react';
import StarBackground from '../StarBackground';
import SatImageryPanel from './SatImageryPanel';
import OSINTChallenge from './OSINTChallenge';
import { useFlintlockSocket } from '../../hooks/useFlintlockSocket';
import { Terminal, Inbox } from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import asatImage from './images/flint-asat.png';
import crypticImage from './images/flint-cryptic.png';

const ANALYSIS_TOOLS = [
  { id: 'intel-inbox', name: 'Intel Inbox', icon: '📥', description: 'Incoming intelligence reports and imagery' },
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
  const [intelItems, setIntelItems] = useState([
    {
      id: 'welcome-1',
      type: 'message',
      title: '📧 Secure Communication Link',
      description: 'Access secure email portal for mission communications',
      link: 'https://dm4rt.github.io/flintmail/',
      linkText: 'Open Flintmail',
      timestamp: new Date()
    },
    {
      id: 'welcome-2',
      type: 'message',
      title: '🔒 Nuclear Command System',
      description: 'Classified nuclear command and control interface',
      link: 'https://dm4rt.github.io/flintNuke/',
      linkText: 'Access Nuclear System',
      timestamp: new Date()
    }
  ]);
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

  // Subscribe to intel injects via Firestore
  useEffect(() => {
    if (!operationId || !db) return;

    const unsubscribe = onSnapshot(
      query(collection(db, 'sessions', operationId, 'injects'), where('team', '==', 'intel')),
      (snapshot) => {
        const items = [];
        
        snapshot.forEach((docSnap) => {
          const inject = docSnap.data();
          
          if (inject.status === 'active') {
            if (inject.type === 'asat-imagery') {
              items.push({
                id: docSnap.id,
                type: 'image',
                title: '🛰️ ASAT Prep Imagery',
                description: 'New satellite images show crews prepping suspected ASAT payload',
                image: asatImage,
                timestamp: new Date(inject.activatedAt || Date.now())
              });
            } else if (inject.type === 'cryptic-tweet') {
              items.push({
                id: docSnap.id,
                type: 'tweet',
                title: '🐦 Cryptic Tweet Intercepted',
                description: 'Social media monitoring detected suspicious encoded message',
                image: crypticImage,
                timestamp: new Date(inject.activatedAt || Date.now())
              });
            } else if (inject.type === 'encrypted-msg-1') {
              items.push({
                id: docSnap.id,
                type: 'encrypted',
                title: '🔐 Encrypted Message Intercepted',
                description: 'ROT-13 + Symbol Shift encryption detected',
                encryptedText: 'FynGrDhengl$25@',
                hint: 'The quarry turns letters halfway around the alphabet. Numbers move forward three steps. Tools shift right on the workbench.',
                cipher: 'ROT-13 + Symbol Shift',
                solution: 'SlateQuarry#92!',
                timestamp: new Date(inject.activatedAt || Date.now())
              });
            } else if (inject.type === 'encrypted-msg-2') {
              items.push({
                id: docSnap.id,
                type: 'encrypted',
                title: '🔐 Encrypted Message Intercepted',
                description: 'Vigenère cipher with key "FOSSIL" detected',
                encryptedText: 'Yzwacqmt@85$',
                hint: 'Ancient fossils hide the pattern. Stones swap places, numbers mirror themselves.',
                cipher: 'Vigenère (Key: FOSSIL)',
                solution: 'Trilobite$58@',
                timestamp: new Date(inject.activatedAt || Date.now())
              });
            } else if (inject.type === 'encrypted-msg-3') {
              items.push({
                id: docSnap.id,
                type: 'encrypted',
                title: '🔐 Encrypted Message Intercepted',
                description: 'Custom XOR cipher (Key: 0x3A) detected',
                encryptedText: '0A 5F 58 58 56 56 1C 4C 48 48 59 5E 65 6D 6D 15',
                hint: 'The forge masks each symbol using the same glowing rune. The result is unreadable without the correct spark.',
                cipher: 'XOR Cipher (Key: 0x3A)',
                solution: 'PebbleForge%77?',
                timestamp: new Date(inject.activatedAt || Date.now())
              });
            }
          }
        });
        
        setIntelItems(items.sort((a, b) => b.timestamp - a.timestamp));
      }
    );

    return unsubscribe;
  }, [operationId]);

  // Listen for admin injects via Socket.IO (legacy)
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
                    {/* Intel Inbox */}
                    {selectedTool.id === 'intel-inbox' && (
                      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                          <Inbox className="w-6 h-6 text-purple-400" />
                          <h2 className="text-xl font-bold text-white">Intelligence Inbox</h2>
                          <span className="ml-auto px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-sm font-semibold">
                            {intelItems.length} items
                          </span>
                        </div>

                        {intelItems.length === 0 ? (
                          <div className="text-center py-12">
                            <Inbox className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-400">No intelligence items received yet</p>
                            <p className="text-sm text-slate-500 mt-2">New imagery and reports will appear here</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {intelItems.map((item) => (
                              <div
                                key={item.id}
                                className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-purple-500/50 transition-colors"
                              >
                                {/* Message Type (Links) */}
                                {item.type === 'message' && (
                                  <div>
                                    <div className="flex items-start justify-between mb-2">
                                      <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                                      <span className="text-xs text-slate-500">
                                        {item.timestamp.toLocaleTimeString()}
                                      </span>
                                    </div>
                                    <p className="text-sm text-slate-300 mb-3">{item.description}</p>
                                    <div className="flex gap-2">
                                      <a
                                        href={item.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded transition-colors"
                                      >
                                        {item.linkText}
                                      </a>
                                      <span className="px-3 py-1.5 rounded text-sm bg-green-500/20 text-green-300">
                                        System Link
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {/* Image/Tweet Type */}
                                {(item.type === 'image' || item.type === 'tweet') && (
                                  <div className="flex gap-4">
                                    <div className="flex-shrink-0">
                                      <img
                                        src={item.image}
                                        alt={item.title}
                                        className="w-32 h-32 object-cover rounded border border-slate-600"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-start justify-between mb-2">
                                        <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                                        <span className="text-xs text-slate-500">
                                          {item.timestamp.toLocaleTimeString()}
                                        </span>
                                      </div>
                                      <p className="text-sm text-slate-300 mb-3">{item.description}</p>
                                      <div className="flex gap-2">
                                        <a
                                          href={item.image}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded transition-colors"
                                        >
                                          View Full Image
                                        </a>
                                        <span className={`px-3 py-1.5 rounded text-sm ${
                                          item.type === 'image' 
                                            ? 'bg-blue-500/20 text-blue-300' 
                                            : 'bg-cyan-500/20 text-cyan-300'
                                        }`}>
                                          {item.type === 'image' ? 'Imagery' : 'OSINT'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Encrypted Message Type */}
                                {item.type === 'encrypted' && (
                                  <div>
                                    <div className="flex items-start justify-between mb-2">
                                      <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                                      <span className="text-xs text-slate-500">
                                        {item.timestamp.toLocaleTimeString()}
                                      </span>
                                    </div>
                                    <p className="text-sm text-slate-300 mb-3">{item.description}</p>
                                    
                                    <div className="bg-slate-900/80 border border-red-500/30 rounded p-3 mb-3">
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-red-400 font-mono text-xs">ENCRYPTED</span>
                                        <span className="text-slate-500 text-xs">•</span>
                                        <span className="text-slate-400 text-xs">{item.cipher}</span>
                                      </div>
                                      <code className="text-amber-300 font-mono text-sm break-all">
                                        {item.encryptedText}
                                      </code>
                                    </div>

                                    <div className="bg-blue-900/20 border border-blue-500/30 rounded p-3 mb-3">
                                      <div className="text-xs text-blue-300 font-semibold mb-1">HINT:</div>
                                      <p className="text-xs text-blue-200/80 italic">{item.hint}</p>
                                    </div>

                                    <div className="flex gap-2">
                                      <span className="px-3 py-1.5 rounded text-sm bg-red-500/20 text-red-300">
                                        Encrypted
                                      </span>
                                      <span className="px-3 py-1.5 rounded text-sm bg-yellow-500/20 text-yellow-300">
                                        Requires Decryption
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

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
