import React, { useState, useEffect } from 'react';
import SdaOrbitViewer from './SdaOrbitViewer';
import SdaSatellitePanel from './SdaSatellitePanel';
import SdaManeuverPlanner from './SdaManeuverPlanner';
import SdaInjectFeed from './SdaInjectFeed';
import satellitesData from '../../data/fictionalSatellites.json';
import { propagateSatellite } from '../../utils/orbitUtils';
import { applyManeuver, applyManeuverOffsets } from '../../utils/maneuverLogic';
import aehfImage from './assets/AEHF_1.jpg';
import gpsImage from './assets/GPS_III.jpg';
import sbirsImage from './assets/SBIRS.jpg';
import isrImage from './assets/ISR.jpg';
import { db } from '../../services/firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, getDocs } from 'firebase/firestore';
import useCountdown from '../../hooks/useCountdown';
import useSession from '../../hooks/useSession';

export default function SdaDashboard({ sessionCode }) {
  const { timeLeft } = useCountdown(sessionCode);
  const { join } = useSession(sessionCode);
  const [satellites, setSatellites] = useState([]);
  const [selectedSatellite, setSelectedSatellite] = useState(null);
  const [showOrbits, setShowOrbits] = useState(false);
  const [expandedSatellite, setExpandedSatellite] = useState(null);
  const [plannedManeuver, setPlannedManeuver] = useState(null);
  const [injects, setInjects] = useState([
    {
      id: 1,
      timestamp: new Date(),
      type: 'system',
      message: 'SDA System Online - 4 satellites tracked'
    }
  ]);

  // Register team presence
  useEffect(() => {
    if (!sessionCode) return;
    (async () => {
      try {
        await join('sda', { name: 'Space Ops - SDA' });
        console.log('✅ SDA team registered in participants');
      } catch (error) {
        console.error('❌ Failed to register SDA team:', error);
      }
    })();
  }, [sessionCode, join]);

  // Initialize satellites in Firebase on first load
  useEffect(() => {
    if (!sessionCode) return;

    const initSatellites = async () => {
      try {
        console.log('Checking for satellites in session:', sessionCode);
        const satellitesRef = collection(db, 'sessions', sessionCode, 'satellites');
        const snapshot = await getDocs(satellitesRef);
        
        console.log('Satellites found:', snapshot.size);
        
        // If no satellites exist, initialize from JSON
        if (snapshot.empty) {
          console.log('Initializing', satellitesData.length, 'satellites in Firebase...');
          for (const sat of satellitesData) {
            const satDoc = doc(db, 'sessions', sessionCode, 'satellites', sat.id);
            const data = {
              ...sat,
              maneuverOffsets: {
                altitudeOffset: 0,
                phaseOffset: 0,
                inclinationOffset: 0
              },
              fuelPoints: sat.fuelPoints || 100,
              status: sat.status || {
                health: 'nominal',
                coverage: true,
                jammed: false,
                asatRisk: 'low'
              },
              lastUpdated: new Date().toISOString()
            };
            console.log('Creating satellite:', sat.id, data);
            await setDoc(satDoc, data);
          }
          console.log('Satellites initialized successfully');
        }
      } catch (error) {
        console.error('Failed to initialize satellites:', error);
        addInject({
          type: 'error',
          message: `Failed to initialize satellites: ${error.message}`
        });
      }
    };

    initSatellites();
  }, [sessionCode]);

  // Subscribe to satellites from Firebase
  useEffect(() => {
    if (!sessionCode) return;

    const satellitesRef = collection(db, 'sessions', sessionCode, 'satellites');
    const unsubscribe = onSnapshot(satellitesRef, (snapshot) => {
      const sats = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const position = propagateSatellite(data.tle);
        sats.push({
          ...data,
          id: doc.id,
          currentPosition: position
        });
      });
      
      console.log('Firebase update received:', sats.map(s => ({
        id: s.id,
        offsets: s.maneuverOffsets,
        fuel: s.fuelPoints
      })));
      
      setSatellites(sats);
      
      // Update selected satellite if it exists in the new list
      if (selectedSatellite) {
        const updated = sats.find(s => s.id === selectedSatellite.id);
        if (updated) {
          console.log('Updating selected satellite:', updated.id, updated.maneuverOffsets);
          setSelectedSatellite(updated);
        }
      } else if (sats.length > 0) {
        // Set initial selected satellite
        setSelectedSatellite(sats[0]);
      }
    });

    return () => unsubscribe();
  }, [sessionCode]);

  // Update satellite positions every second (just for display, doesn't change Firebase)
  useEffect(() => {
    const interval = setInterval(() => {
      setSatellites(prev => prev.map(sat => {
        const position = propagateSatellite(sat.tle);
        return {
          ...sat,
          currentPosition: position
        };
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Handle maneuver planning (allows stacking multiple maneuvers)
  const handlePlanManeuver = (maneuverType) => {
    try {
      if (!selectedSatellite) return;

      const snapshotOffsets = (sat) => ({
        altitudeOffset: sat?.maneuverOffsets?.altitudeOffset || 0,
        phaseOffset: sat?.maneuverOffsets?.phaseOffset || 0,
        inclinationOffset: sat?.maneuverOffsets?.inclinationOffset || 0
      });

      const isContinuingPlan =
        plannedManeuver && plannedManeuver.satelliteId === selectedSatellite.id;
      
      // If already planning, stack on preview; otherwise start fresh from current state
      const baseSatellite = isContinuingPlan
        ? plannedManeuver.previewSatellite
        : selectedSatellite;

      const baseOffsets = isContinuingPlan
        ? plannedManeuver.baseOffsets
        : snapshotOffsets(selectedSatellite);
      
      const updatedSat = applyManeuver(baseSatellite, maneuverType);
      
      console.log('Planning maneuver:', maneuverType, {
        baseOffsets: JSON.stringify(baseSatellite.maneuverOffsets),
        newOffsets: JSON.stringify(updatedSat.maneuverOffsets),
        fuel: `${baseSatellite.fuelPoints} -> ${updatedSat.fuelPoints}`
      });
      
      setPlannedManeuver({
        type: maneuverType,
        satelliteId: selectedSatellite.id,
        previewSatellite: updatedSat,
        baseOffsets
      });
    } catch (error) {
      console.error('Maneuver planning error:', error);
      addInject({
        type: 'error',
        message: `Maneuver planning failed: ${error.message}`
      });
    }
  };

  // Commit the planned maneuver to Firebase
  const handleCommitManeuver = async () => {
    if (!plannedManeuver) return;
    
    try {
      const updateData = {
        maneuverOffsets: plannedManeuver.previewSatellite.maneuverOffsets,
        fuelPoints: plannedManeuver.previewSatellite.fuelPoints,
        lastManeuver: plannedManeuver.previewSatellite.lastManeuver,
        lastUpdated: new Date().toISOString()
      };
      
      console.log('Committing maneuver to Firebase:', plannedManeuver.satelliteId, {
        offsets: JSON.stringify(updateData.maneuverOffsets),
        fuel: updateData.fuelPoints
      });
      
      const satDoc = doc(db, 'sessions', sessionCode, 'satellites', plannedManeuver.satelliteId);
      await updateDoc(satDoc, updateData);
      
      console.log('Maneuver committed successfully');
      
      addInject({
        type: 'maneuver',
        message: `${selectedSatellite?.name || 'Satellite'} executing ${plannedManeuver.type.replace('_', ' ')} maneuver`
      });
      
      // Clear preview AFTER Firebase update completes
      setPlannedManeuver(null);
    } catch (error) {
      console.error('Commit maneuver error:', error);
      addInject({
        type: 'error',
        message: `Failed to commit maneuver: ${error.message}`
      });
      // Still clear on error
      setPlannedManeuver(null);
    }
  };

  // Cancel the planned maneuver
  const handleCancelManeuver = () => {
    setPlannedManeuver(null);
  };

  const addInject = (inject) => {
    setInjects(prev => [{
      id: Date.now(),
      timestamp: new Date(),
      ...inject
    }, ...prev]);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden relative">
      {/* Mission Timer - Top Center */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-orange-600 rounded-lg px-6 py-2 border-2 border-orange-400 z-50 shadow-lg shadow-orange-500/50">
        <p className="text-xs text-orange-100 uppercase text-center font-bold">Mission Timer</p>
        <div className="text-4xl font-mono font-black text-white text-center">
          {String(Math.floor((timeLeft || 0) / 60)).padStart(2, '0')}:
          {String((timeLeft || 0) % 60).padStart(2, '0')}
        </div>
      </div>

      {/* Header */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <span className="text-orange-400">◉</span> SPACE DOMAIN AWARENESS
          </h1>
          <p className="text-xs text-slate-400 uppercase">Orbital Operations Center</p>
        </div>
        <div className="flex items-center gap-6">
          {/* Team */}
          <div className="text-left">
            <p className="text-xs text-slate-400 uppercase">Team</p>
            <div className="text-lg font-bold text-white">Space Ops - SDA</div>
          </div>
          {/* Room Code */}
          <div className="text-left">
            <p className="text-xs text-slate-400 uppercase">Session</p>
            <div className="text-lg font-mono font-bold text-blue-400">{sessionCode}</div>
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
              
              const isExpanded = expandedSatellite === sat.id;
              const position = sat.currentPosition;
              const displayPosition = position ? applyManeuverOffsets(position, sat.maneuverOffsets) : null;
              
              return (
                <div key={sat.id}>
                  <button
                    onClick={() => {
                      setSelectedSatellite(sat);
                      setExpandedSatellite(isExpanded ? null : sat.id);
                    }}
                    className={`w-full rounded-lg text-left transition-all border-2 ${
                      selectedSatellite?.id === sat.id
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
                  
                  {/* Expanded Position Info */}
                  {isExpanded && displayPosition && (
                    <div className="bg-slate-900/80 border-2 border-slate-700 rounded-lg mt-2 p-3">
                      <div className="space-y-1 text-xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Lat:</span>
                          <span className="text-white">{displayPosition.lat.toFixed(2)}°</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Lon:</span>
                          <span className="text-white">{displayPosition.lon.toFixed(2)}°</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Alt:</span>
                          <span className="text-white">{displayPosition.alt.toFixed(0)} km</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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
            plannedManeuver={plannedManeuver}
          />
        </div>

        {/* Right Panel - Maneuver Planner & Event Feed */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto bg-slate-900/40 border-l border-slate-800 p-4 z-10">
          {/* Maneuver Planner */}
          <div>
            <SdaManeuverPlanner 
              satellite={selectedSatellite}
              onPlanManeuver={handlePlanManeuver}
              onCommitManeuver={handleCommitManeuver}
              onCancelManeuver={handleCancelManeuver}
              plannedManeuver={plannedManeuver}
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
