import React, { useState, useEffect, useRef } from 'react';
import SdaOrbitViewer from './SdaOrbitViewer';
import SdaSatellitePanel from './SdaSatellitePanel';
import SdaManeuverPlanner from './SdaManeuverPlanner';
import SdaInjectFeed from './SdaInjectFeed';
import satellitesData from '../../data/fictionalSatellites.json';
import { propagateSatellite } from '../../utils/orbitUtils';
import { applyManeuver, applyManeuverOffsets, DEFAULT_MANEUVER_OFFSETS, ensureOffsets, getTrackAdjustedDate } from '../../utils/maneuverLogic';
import aehfImage from './assets/AEHF_1.jpg';
import gpsImage from './assets/GPS_III.jpg';
import sbirsImage from './assets/SBIRS.jpg';
import isrImage from './assets/ISR.jpg';
import { db } from '../../services/firebase';
import { collection, doc, setDoc, updateDoc, getDocs } from 'firebase/firestore';
import useCountdown from '../../hooks/useCountdown';
import useSession from '../../hooks/useSession';
import { useFlintlockSocket } from '../../hooks/useFlintlockSocket';

export default function SdaDashboard({ sessionCode }) {
  const { join } = useSession(sessionCode);
  const socket = useFlintlockSocket(sessionCode, 'sda', 'Space Ops - SDA');
  const { timeLeft } = useCountdown(socket);
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

  // Use refs to access latest values in Socket.IO listeners without causing re-renders
  const selectedSatelliteRef = useRef(selectedSatellite);
  const operationIdRef = useRef(sessionCode);
  const lastBroadcastHash = useRef(null);
  const lastSocketUpdateHash = useRef(null);
  
  useEffect(() => {
    selectedSatelliteRef.current = selectedSatellite;
  }, [selectedSatellite]);

  useEffect(() => {
    operationIdRef.current = sessionCode;
  }, [sessionCode]);

  // Helper function to add inject messages
  const addInject = React.useCallback((inject) => {
    setInjects(prev => [{
      id: Date.now(),
      timestamp: new Date(),
      ...inject
    }, ...prev]);
  }, []);

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

  // Initialize satellites if needed then load them into local state
  useEffect(() => {
    if (!sessionCode) return;
    let isMounted = true;

    const ensureSatellites = async () => {
      try {
        const satellitesRef = collection(db, 'sessions', sessionCode, 'satellites');
        let snapshot = await getDocs(satellitesRef);

        // Seed Firestore with baseline satellites if none exist yet
        if (snapshot.empty) {
          console.log('[SDA] Initializing satellites in Firestore for', sessionCode);
          for (const sat of satellitesData) {
            const satDoc = doc(db, 'sessions', sessionCode, 'satellites', sat.id);
            const data = {
              ...sat,
              maneuverOffsets: { ...DEFAULT_MANEUVER_OFFSETS },
              fuelPoints: sat.fuelPoints || 100,
              status: sat.status || {
                health: 'nominal',
                coverage: true,
                jammed: false,
                asatRisk: 'low'
              },
              lastUpdated: new Date().toISOString()
            };
            await setDoc(satDoc, {
              ...data,
              currentPosition: propagateSatellite(
                sat.tle,
                getTrackAdjustedDate(new Date(), data.maneuverOffsets)
              )
            });
          }

          // Re-fetch now that initialization completed
          snapshot = await getDocs(satellitesRef);
        }

        const sats = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const maneuverOffsets = ensureOffsets(data.maneuverOffsets);
          sats.push({
            ...data,
            maneuverOffsets,
            id: docSnap.id,
            currentPosition: propagateSatellite(
              data.tle,
              getTrackAdjustedDate(new Date(), maneuverOffsets)
            )
          });
        });

        if (isMounted) {
          setSatellites(sats);
          setSelectedSatellite((prev) => prev || sats[0] || null);
        }
      } catch (error) {
        console.error('Failed to initialize satellites:', error);
        addInject({
          type: 'error',
          message: `Failed to initialize satellites: ${error.message}`
        });
      }
    };

    ensureSatellites();

    return () => {
      isMounted = false;
    };
  }, [sessionCode, addInject]);

  // Subscribe to satellite updates via Socket.IO
  useEffect(() => {
    if (!socket.isConnected) return;

    const unsubscribe = socket.on('sat:update', ({ satellites: remoteSats }) => {
      // Prevent processing duplicate updates
      const updateHash = JSON.stringify(remoteSats.map(s => ({ id: s.id, fuel: s.fuelPoints, offsets: s.maneuverOffsets })));
      if (lastSocketUpdateHash.current === updateHash) {
        console.log('[SDA] Ignoring duplicate socket update');
        return;
      }
      lastSocketUpdateHash.current = updateHash;
      
      console.log('Socket.IO satellite update received:', remoteSats.length, 'satellites');
      setSatellites(remoteSats);
      
      // Update selected satellite if it exists in the new list
      if (selectedSatellite) {
        const updated = remoteSats.find(s => s.id === selectedSatellite.id);
        if (updated) {
          setSelectedSatellite(updated);
        }
      }
    });

    return unsubscribe;
  }, [socket, selectedSatellite]);

  // Update satellite positions every second and broadcast via Socket.IO
  useEffect(() => {
    if (!socket.isConnected) return;

    const interval = setInterval(() => {
      setSatellites(prev => {
        const updated = prev.map(sat => {
          const position = propagateSatellite(
            sat.tle,
            getTrackAdjustedDate(new Date(), sat.maneuverOffsets)
          );
          return {
            ...sat,
            currentPosition: position
          };
        });
        
        // Only broadcast if meaningful data changed (not just position updates)
        const broadcastHash = JSON.stringify(updated.map(s => ({ id: s.id, fuel: s.fuelPoints, offsets: s.maneuverOffsets, status: s.status })));
        if (lastBroadcastHash.current !== broadcastHash) {
          lastBroadcastHash.current = broadcastHash;
          socket.emitSatelliteUpdate(updated);
        }
        
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [socket]);

  // Listen for Intel imagery requests via Socket.IO
  useEffect(() => {
    if (!socket.isConnected) return;
    
    console.log('[SDA] Setting up Socket.IO Intel imagery request listener');
    
    const unsubscribe = socket.on('intel:requestImagery', ({ satId, requestedBy }) => {
      console.log('[SDA] *** Intel imagery request received via Socket.IO ***', { satId, requestedBy });
      
      const currentSatellite = selectedSatelliteRef.current;
      const currentOperationId = operationIdRef.current;
      
      if (!currentSatellite) {
        console.warn('[SDA] No satellite selected for snapshot');
        addInject({
          type: 'warning',
          message: 'Intel requested imagery but no ISR satellite selected'
        });
        // Send error response to Intel
        socket.emit('sda:imageryError', {
          sessionId: currentOperationId,
          requestedBy,
          error: 'No ISR satellite selected. Please select sentinel-7 in SDA dashboard.'
        });
        return;
      }

      // Only send snapshot for ISR satellites (sentinel-7)
      if (!currentSatellite.id.includes('sentinel')) {
        console.warn('[SDA] Selected satellite is not ISR type:', currentSatellite.id);
        addInject({
          type: 'warning',
          message: `Intel requested imagery but ${currentSatellite.id} is not an ISR satellite`
        });
        // Send error response to Intel
        socket.emit('sda:imageryError', {
          sessionId: currentOperationId,
          requestedBy,
          error: `Wrong satellite selected. SDA has ${currentSatellite.id} selected, but Intel needs sentinel-7 (ISR satellite).`
        });
        return;
      }

      try {
        // Get current position from TLE propagation
        const position = currentSatellite.currentPosition;
        
        console.log('[SDA] Current position:', position);
        
        if (!position) {
          console.error('[SDA] No position available for satellite');
          addInject({
            type: 'error',
            message: 'No position data available for satellite'
          });
          return;
        }

        // Position already has lat, lon, alt from propagateSatellite utility
        const { lat, lon, alt } = position;
        
        console.log('[SDA] Extracted coordinates:', { lat, lon, alt });
        
        // Send coordinates back to Intel via Socket.IO
        socket.sendImageryCoords(
          currentSatellite.id,
          lat,
          lon,
          alt,
          requestedBy
        );
        
        console.log('[SDA] ✅ Imagery coordinates sent via Socket.IO');
        
        addInject({
          type: 'success',
          message: `Intel snapshot sent: ${currentSatellite.id} at (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`
        });
      } catch (error) {
        console.error('[SDA] ❌ Failed to send snapshot:', error);
        addInject({
          type: 'error',
          message: `Snapshot failed: ${error.message}`
        });
      }
    });
    
    console.log('[SDA] Socket.IO listener attached for Intel requests');
    
    return unsubscribe;
  }, [socket.isConnected]);

  // Handle maneuver planning (allows stacking multiple maneuvers)
  const handlePlanManeuver = (maneuverType) => {
    try {
      if (!selectedSatellite) return;

      const snapshotOffsets = (sat) => ensureOffsets(sat?.maneuverOffsets);

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
  const commitInProgressRef = useRef(false);
  const handleCommitManeuver = async () => {
    if (!plannedManeuver || commitInProgressRef.current) return;
    commitInProgressRef.current = true;
    
    const updateData = {
      maneuverOffsets: plannedManeuver.previewSatellite.maneuverOffsets,
      fuelPoints: plannedManeuver.previewSatellite.fuelPoints,
      lastManeuver: plannedManeuver.previewSatellite.lastManeuver,
      lastUpdated: new Date().toISOString()
    };

    const applyLocalUpdate = () => {
      const updatedSatellite = {
        ...plannedManeuver.previewSatellite,
        id: plannedManeuver.satelliteId,
        ...updateData,
        currentPosition: propagateSatellite(
          plannedManeuver.previewSatellite.tle || selectedSatellite?.tle,
          getTrackAdjustedDate(new Date(), updateData.maneuverOffsets)
        )
      };

      setSatellites((prev) => {
        const next = prev.map((sat) => (sat.id === plannedManeuver.satelliteId ? { ...sat, ...updatedSatellite } : sat));
        if (socket.isConnected) {
          socket.emitSatelliteUpdate(next);
        }
        return next;
      });

      setSelectedSatellite((current) => (current?.id === plannedManeuver.satelliteId ? { ...current, ...updatedSatellite } : current));
      selectedSatelliteRef.current = updatedSatellite;
    };

    let commitSucceeded = false;

    try {
      console.log('Committing maneuver to Firebase:', plannedManeuver.satelliteId, {
        offsets: JSON.stringify(updateData.maneuverOffsets),
        fuel: updateData.fuelPoints
      });

      const satDoc = doc(db, 'sessions', sessionCode, 'satellites', plannedManeuver.satelliteId);
      await updateDoc(satDoc, updateData);

      console.log('Maneuver committed successfully');
      commitSucceeded = true;
    } catch (error) {
      console.error('Commit maneuver error:', error);
      addInject({
        type: 'error',
        message: `Failed to commit maneuver: ${error.message}`
      });
    } finally {
      applyLocalUpdate();

      addInject({
        type: commitSucceeded ? 'maneuver' : 'warning',
        message: `${selectedSatellite?.name || 'Satellite'} executing ${plannedManeuver.type.replace('_', ' ')} maneuver`
      });

      setPlannedManeuver(null);
      commitInProgressRef.current = false;
    }
  };

  // Cancel the planned maneuver
  const handleCancelManeuver = () => {
    setPlannedManeuver(null);
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
      <header className="bg-[#0a0f1e] border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="px-3 py-1.5 rounded border border-orange-500 bg-orange-500/10">
              <span className="text-sm font-bold text-orange-200">SDA</span>
            </div>
            <h1 className="text-xl font-bold text-slate-100">Space Domain Awareness</h1>
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Orbital Operations Center</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Operation ID</p>
              <p className="text-lg font-mono font-bold text-blue-400">{sessionCode}</p>
            </div>
          </div>
        </div>
      </header>

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
