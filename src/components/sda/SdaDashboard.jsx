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
      <div className="flex-1 flex gap-0 min-h-0">
        {/* Left Panel - Tracked Assets & Details */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-4 overflow-y-auto bg-slate-900/40 border-r border-slate-800 p-4">
          {/* Satellite Selector */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wide flex items-center gap-2">
              <span className="text-orange-400">▣</span> Tracked Assets
            </h3>
            <div className="space-y-3">
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
                
                return (
                  <button
                    key={sat.id}
                    onClick={() => setSelectedSatellite(sat)}
                    className={`w-full rounded-lg text-left transition-all overflow-hidden border-2 ${
                      selectedSatellite.id === sat.id
                        ? 'border-orange-500 bg-gradient-to-br from-slate-800 to-slate-900 shadow-lg shadow-orange-500/30'
                        : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="p-3">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-slate-950 border-2 border-slate-700">
                          <img 
                            src={getImage(sat.id)} 
                            alt={sat.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-white mb-1">{sat.name}</p>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${
                                sat.status.health === 'nominal' ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                              }`}></div>
                              <span className="text-xs text-slate-400">
                                {sat.status.health === 'nominal' ? 'Nominal' : 'Degraded'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">{sat.orbitClass}</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Mission</span>
                          <span className="text-xs text-slate-300">{sat.mission.split(' ').slice(0, 2).join(' ')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Fuel</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all ${
                                  sat.fuelPoints > 50 ? 'bg-green-400' : sat.fuelPoints > 25 ? 'bg-yellow-400' : 'bg-red-400'
                                }`}
                                style={{ width: `${sat.fuelPoints}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-slate-300 font-mono">{sat.fuelPoints}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Satellite Detail Panel (bottom of left column) */}
          <div className="mt-4">
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
        <div className="flex-1 bg-slate-950 relative">
          <SdaOrbitViewer 
            satellites={satellites} 
            selectedSatellite={selectedSatellite}
            onSelectSatellite={setSelectedSatellite}
            showOrbits={showOrbits}
          />
        </div>

        {/* Right Panel - Maneuver Planner & Event Feed */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto bg-slate-900/40 border-l border-slate-800 p-4">
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
