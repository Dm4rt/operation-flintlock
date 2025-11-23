import React, { useState, useEffect } from 'react';
import SdaOrbitViewer from './SdaOrbitViewer';
import SdaSatellitePanel from './SdaSatellitePanel';
import SdaManeuverPlanner from './SdaManeuverPlanner';
import SdaInjectFeed from './SdaInjectFeed';
import satellitesData from '../../data/fictionalSatellites.json';
import { propagateSatellite } from '../../utils/orbitUtils';
import { applyManeuver } from '../../utils/maneuverLogic';
import aehfImage from './assets/AEHF_1.jpg';
import gpsImage from './assets/GPS_III.jpg';
import sbirsImage from './assets/SBIRS.jpg';
import isrImage from './assets/ISR.jpg';

export default function SdaDashboard({ sessionCode, timeLeft }) {
  const [satellites, setSatellites] = useState(satellitesData);
  const [selectedSatellite, setSelectedSatellite] = useState(satellites[0]);
  const [showOrbits, setShowOrbits] = useState(false);
  const [injects, setInjects] = useState([
    {
      id: 1,
      timestamp: new Date(),
      type: 'system',
      message: 'SDA System Online - 4 satellites tracked'
    }
  ]);

  // Update satellite positions every second
  useEffect(() => {
    const interval = setInterval(() => {
      setSatellites(prev => prev.map(sat => {
        const position = propagateSatellite(sat.tle);
        return {
          ...sat,
          currentPosition: position,
          lastUpdated: Date.now()
        };
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Handle maneuver execution
  const handleManeuver = (maneuverType) => {
    try {
      const updatedSat = applyManeuver(selectedSatellite, maneuverType);
      
      setSatellites(prev => prev.map(sat => 
        sat.id === selectedSatellite.id ? updatedSat : sat
      ));
      
      setSelectedSatellite(updatedSat);
      
      // Add inject for maneuver
      addInject({
        type: 'maneuver',
        message: `${selectedSatellite.name} executing ${maneuverType.replace('_', ' ')} maneuver`
      });
    } catch (error) {
      addInject({
        type: 'error',
        message: `Maneuver failed: ${error.message}`
      });
    }
  };

  const addInject = (inject) => {
    setInjects(prev => [{
      id: Date.now(),
      timestamp: new Date(),
      ...inject
    }, ...prev]);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <span className="text-orange-400">◉</span> SPACE DOMAIN AWARENESS
          </h1>
          <p className="text-xs text-slate-400 uppercase">Orbital Operations Center</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 uppercase">Mission Timer</p>
          <div className="text-2xl font-mono font-bold text-white">
            {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:
            {String(timeLeft % 60).padStart(2, '0')}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 flex gap-0 min-h-0 overflow-hidden">
        {/* Left Panel - Tracked Assets */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-4 bg-slate-900/40 border-r border-slate-800 p-4 z-10">
          {/* Header */}
          <div className="bg-slate-800/80 rounded-lg border-2 border-slate-700 px-4 py-3">
            <h3 className="text-base font-bold text-white text-center">
              Tracked Assets
            </h3>
          </div>

          {/* Satellite List */}
          <div className="flex-1 overflow-y-auto space-y-3">
            {satellites.map(sat => {
              // Get image based on satellite
              const getImage = (id) => {
                switch(id) {
                  case 'aehf-6': return aehfImage;
                  case 'gps-iii-5': return gpsImage;
                  case 'sbirs-geo-6': return sbirsImage;
                  case 'sentinel-7': return isrImage;
                  default: return null;
                }
              };
              
              // Get color dot based on type
              const getTypeColor = (type) => {
                switch(type) {
                  case 'comms': return 'bg-cyan-400';
                  case 'navigation': return 'bg-green-400';
                  case 'missile_warning': return 'bg-red-400';
                  case 'isr': return 'bg-yellow-400';
                  default: return 'bg-white';
                }
              };
              
              return (
                <button
                  key={sat.id}
                  onClick={() => setSelectedSatellite(sat)}
                  className={`w-full rounded-lg text-left transition-all border-2 ${
                    selectedSatellite.id === sat.id
                      ? 'border-orange-500 bg-slate-800 shadow-lg shadow-orange-500/30'
                      : 'border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="p-3 flex items-center gap-3">
                    {/* Satellite Image */}
                    <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-slate-950 border-2 border-slate-700">
                      <img 
                        src={getImage(sat.id)} 
                        alt={sat.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    {/* Satellite Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${getTypeColor(sat.type)}`}></div>
                        <p className="font-bold text-sm text-white truncate">{sat.name}</p>
                      </div>
                      <p className="text-xs text-slate-400">{sat.orbitClass}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Satellite Details Panel */}
          <div className="border-t border-slate-700 pt-4">
            <SdaSatellitePanel satellite={selectedSatellite} />
          </div>

          {/* Orbit Trajectory Toggle */}
          <div className="mt-auto pt-3 border-t border-slate-800">
            <button
              onClick={() => setShowOrbits(!showOrbits)}
              className={`w-full p-3 rounded-lg transition-all flex items-center justify-between ${
                showOrbits
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span className="text-xs font-semibold tracking-wide uppercase">Orbital Paths</span>
              <div className={`w-10 h-5 rounded-full transition-colors ${
                showOrbits ? 'bg-blue-400' : 'bg-slate-600'
              } relative flex-shrink-0`}>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  showOrbits ? 'translate-x-5' : 'translate-x-0'
                }`}></div>
              </div>
            </button>
          </div>
        </div>

        {/* Center - 3D Orbit Viewer */}
        <div className="flex-1 bg-slate-950 relative z-0">
          <SdaOrbitViewer 
            satellites={satellites} 
            selectedSatellite={selectedSatellite}
            onSelectSatellite={setSelectedSatellite}
            showOrbits={showOrbits}
          />
        </div>

        {/* Right Panel - Maneuver Planner & Event Feed */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto bg-slate-900/40 border-l border-slate-800 p-4 z-10">
          {/* Maneuver Planner */}
          <div>
            <SdaManeuverPlanner 
              satellite={selectedSatellite}
              onManeuver={handleManeuver}
            />
          </div>

          {/* Event Feed */}
          <div className="flex-1 min-h-[200px]">
            <SdaInjectFeed injects={injects} />
          </div>
        </div>
      </div>
    </div>
  );
}
