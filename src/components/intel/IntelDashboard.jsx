import React, { useState } from 'react';
import StarBackground from '../StarBackground';
import SatImageryPanel from './SatImageryPanel';
import { fetchSatImagery, requestSdaSnapshot } from '../../services/intel/fetchSatImagery';

const ANALYSIS_TOOLS = [
  { id: 'sat-imagery', name: 'Satellite Imagery', icon: '🛰️', description: 'Live satellite view from SDA ISR asset' },
  { id: 'reverse-image', name: 'Reverse Image Search', icon: '🔍', description: 'Search image databases for matches' },
  { id: 'geolocation', name: 'Geolocation Tool', icon: '🌍', description: 'Analyze location data and terrain' }
];

export default function IntelDashboard({ operationId }) {
  const [selectedTool, setSelectedTool] = useState(null);
  const [satData, setSatData] = useState(null);
  const [isLoadingSat, setIsLoadingSat] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const handleToolClick = async (tool) => {
    setSelectedTool(tool);
    setAnalysisResult(null);
    setSatData(null);

    // If satellite imagery tool selected, request snapshot from SDA
    if (tool.id === 'sat-imagery') {
      await loadSatImagery();
    }
  };

  const loadSatImagery = async () => {
    setIsLoadingSat(true);
    try {
      // Request SDA to send snapshot
      requestSdaSnapshot(operationId);
      
      // Wait a moment for SDA to process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fetch the snapshot from Firestore
      const data = await fetchSatImagery(operationId);
      
      if (data) {
        setSatData(data);
      } else {
        setAnalysisResult('No satellite data available. Ensure SDA has an ISR satellite selected.');
      }
    } catch (error) {
      console.error('Failed to load sat imagery:', error);
      setAnalysisResult('Error loading satellite imagery. Please try again.');
    } finally {
      setIsLoadingSat(false);
    }
  };

  const runAnalysis = () => {
    if (!selectedTool) return;

    let result = '';
    switch (selectedTool.id) {
      case 'reverse-image':
        result = `Reverse image search results:\n\n✓ 3 potential matches found\n✓ Location: Central Asia region\n✓ Similar structures identified in database\n✓ Confidence: 78%`;
        break;
      case 'geolocation':
        result = `Geolocation Analysis:\n\nCoordinates: 34.5°N, 69.2°E\nCountry: Afghanistan\nNearest city: Kabul (45km)\nTerrain: Mountainous\nElevation: 2,100m`;
        break;
    }
    setAnalysisResult(result);
  };

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
            {selectedTool ? (
              <div className="p-6">
                {/* Satellite Imagery Tool */}
                {selectedTool.id === 'sat-imagery' && (
                  <div>
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

                {/* Other Analysis Tools */}
                {selectedTool.id !== 'sat-imagery' && (
                  <div className="bg-[#050812] border border-slate-900 rounded-xl shadow-2xl p-6">
                    <div className="border-b border-slate-800 pb-4 mb-6">
                      <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <span className="text-3xl">{selectedTool.icon}</span>
                        <span>{selectedTool.name}</span>
                      </h2>
                      <p className="text-sm text-slate-400 mt-2">{selectedTool.description}</p>
                    </div>

                    <div className="mb-6">
                      <button
                        onClick={runAnalysis}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors"
                      >
                        Run Analysis
                      </button>
                    </div>

                    {analysisResult && (
                      <div className="bg-slate-900/50 rounded-lg p-6 border border-blue-500/30">
                        <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                          {analysisResult}
                        </pre>
                      </div>
                    )}

                    {!analysisResult && (
                      <div className="bg-slate-900/30 rounded-lg p-8 text-center">
                        <p className="text-slate-500">No analysis results yet. Click "Run Analysis" to begin.</p>
                      </div>
                    )}
                  </div>
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
          </main>
        </div>
      </div>
    </div>
  );
}
