import React, { useState } from 'react';
import StarBackground from '../StarBackground';

const INTEL_FILES = [
  {
    id: 'sat-imagery-001',
    name: 'SAT-IMAGERY-001.jpg',
    type: 'image',
    classification: 'TOP SECRET',
    date: '2025-11-28',
    description: 'Satellite surveillance imagery of suspected hostile installation',
    imageUrl: '/assets/intel-sample.jpg',
    metadata: {
      location: '34.5°N, 69.2°E',
      timestamp: '2025-11-28 14:32:17 UTC',
      resolution: '0.5m GSD',
      sensor: 'WorldView-3'
    }
  },
  {
    id: 'comms-intercept-047',
    name: 'COMMS-INTERCEPT-047.txt',
    type: 'text',
    classification: 'SECRET',
    date: '2025-11-29',
    description: 'Intercepted communications from unidentified source',
    content: `BEGIN TRANSMISSION
FROM: UNKNOWN
TO: UNKNOWN
TIME: 2025-11-29 03:15:42 UTC

[ENCRYPTED SEGMENT]
...ASSET DEPLOYED...COORDINATES CONFIRMED...
...WINDOW CLOSES 0600 LOCAL...
...AWAIT FURTHER INSTRUCTIONS...
[END ENCRYPTED SEGMENT]

SIGNAL STRENGTH: -67 dBm
FREQUENCY: 2.4 GHz
ENCRYPTION: AES-256
END TRANSMISSION`
  },
  {
    id: 'threat-assessment-12',
    name: 'THREAT-ASSESSMENT-12.pdf',
    type: 'document',
    classification: 'CONFIDENTIAL',
    date: '2025-11-27',
    description: 'Regional threat assessment and force disposition analysis',
    content: `REGIONAL THREAT ASSESSMENT
Classification: CONFIDENTIAL
Date: 2025-11-27

EXECUTIVE SUMMARY:
Recent intelligence indicates heightened activity in the region.
Multiple signals intelligence (SIGINT) intercepts suggest 
coordination between previously unaffiliated groups.

KEY FINDINGS:
- Increased radio traffic on known adversary frequencies
- Movement of personnel and equipment detected via IMINT
- Pattern analysis indicates potential operation in planning stages

RECOMMENDED ACTIONS:
- Enhanced surveillance of key locations
- Continued SIGINT collection and analysis
- Preparation of contingency response plans

CONFIDENCE LEVEL: MODERATE TO HIGH`
  }
];

const ANALYSIS_TOOLS = [
  { id: 'reverse-image', name: 'Reverse Image Search', icon: '🔍' },
  { id: 'metadata', name: 'EXIF Metadata Analyzer', icon: '📊' },
  { id: 'pattern', name: 'Pattern Recognition', icon: '🎯' },
  { id: 'geolocation', name: 'Geolocation Tool', icon: '🌍' }
];

export default function IntelDashboard({ operationId }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedTool, setSelectedTool] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);

  const handleToolClick = (tool) => {
    setSelectedTool(tool);
    setAnalysisResult(null);
  };

  const runAnalysis = () => {
    if (!selectedTool) return;

    // Simulate analysis
    let result = '';
    switch (selectedTool.id) {
      case 'reverse-image':
        result = `Reverse image search results:\n\n✓ 3 potential matches found\n✓ Location: Central Asia region\n✓ Similar structures identified in database\n✓ Confidence: 78%`;
        break;
      case 'metadata':
        result = `EXIF Metadata Analysis:\n\nCamera: Military-grade optical sensor\nGPS: 34.5123°N, 69.2456°E\nTimestamp: 2025-11-28 14:32:17 UTC\nAltitude: 580km\nOrientation: 127° bearing`;
        break;
      case 'pattern':
        result = `Pattern Recognition Analysis:\n\n✓ Vehicle count: 12 detected\n✓ Building structures: 8 identified\n✓ Personnel detected: 23-27 individuals\n✓ Activity level: MODERATE`;
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
              <h1 className="text-xl font-bold text-slate-100">Space Ops Console</h1>
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
          {/* Sidebar - File List */}
          <aside className="w-80 bg-[#0c111f] border-r border-slate-900 overflow-y-auto">
            <div className="p-4">
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-2">
                <h3 className="text-[11px] uppercase text-slate-500 font-semibold mb-3">Intelligence Files</h3>
                {INTEL_FILES.filter(file => 
                  !searchQuery || file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  file.description.toLowerCase().includes(searchQuery.toLowerCase())
                ).map(file => (
                  <button
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedFile?.id === file.id
                        ? 'bg-amber-500/10 border-amber-500/50'
                        : 'bg-[#090d17] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-semibold text-white truncate">{file.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        file.classification === 'TOP SECRET' 
                          ? 'bg-red-500/20 text-red-300'
                          : file.classification === 'SECRET'
                          ? 'bg-orange-500/20 text-orange-300'
                          : 'bg-yellow-500/20 text-yellow-300'
                      }`}>
                        {file.classification}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{file.description}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{file.date}</p>
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-2">
                <h3 className="text-[11px] uppercase text-slate-500 font-semibold mb-3">Analysis Tools</h3>
                {ANALYSIS_TOOLS.map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => handleToolClick(tool)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedTool?.id === tool.id
                        ? 'bg-blue-500/10 border-blue-500/50'
                        : 'bg-[#090d17] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{tool.icon}</span>
                      <span className="text-sm text-white">{tool.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Main Panel - File Viewer */}
          <main className="flex-1 bg-[#04060c] overflow-y-auto">
            {selectedFile ? (
              <div className="p-6">
                <div className="bg-[#050812] border border-slate-900 rounded-xl shadow-2xl p-6">
                  {/* File Header */}
                  <div className="border-b border-slate-800 pb-4 mb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-white mb-2">{selectedFile.name}</h2>
                        <p className="text-sm text-slate-400">{selectedFile.description}</p>
                      </div>
                      <span className={`px-3 py-1 rounded font-bold text-sm ${
                        selectedFile.classification === 'TOP SECRET' 
                          ? 'bg-red-500/20 text-red-300 border border-red-500/50'
                          : selectedFile.classification === 'SECRET'
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/50'
                          : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50'
                      }`}>
                        {selectedFile.classification}
                      </span>
                    </div>
                    {selectedFile.metadata && (
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        {Object.entries(selectedFile.metadata).map(([key, value]) => (
                          <div key={key}>
                            <p className="text-[10px] uppercase text-slate-500">{key}</p>
                            <p className="text-sm text-slate-300 font-mono">{value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* File Content */}
                  <div className="min-h-[400px]">
                    {selectedFile.type === 'image' ? (
                      <div className="bg-slate-900/50 rounded-lg p-8 flex items-center justify-center min-h-[400px]">
                        <div className="text-center">
                          <div className="w-64 h-64 bg-slate-800 rounded-lg flex items-center justify-center mb-4">
                            <span className="text-6xl">🛰️</span>
                          </div>
                          <p className="text-slate-400 text-sm">Satellite Imagery Placeholder</p>
                          <p className="text-slate-500 text-xs mt-1">{selectedFile.imageUrl}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-900/50 rounded-lg p-6">
                        <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap">
                          {selectedFile.content}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Analysis Section */}
                  {selectedTool && (
                    <div className="mt-6 border-t border-slate-800 pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                          <span>{selectedTool.icon}</span>
                          <span>{selectedTool.name}</span>
                        </h3>
                        <button
                          onClick={runAnalysis}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-sm transition-colors"
                        >
                          Run Analysis
                        </button>
                      </div>
                      {analysisResult && (
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-blue-500/30">
                          <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap">
                            {analysisResult}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-5xl">📁</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">No File Selected</h3>
                  <p className="text-slate-400">Select an intelligence file from the sidebar to begin analysis</p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
