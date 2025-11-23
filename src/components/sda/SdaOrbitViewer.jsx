import React, { useEffect, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import Earth from './Earth';
import SatelliteObject from './SatelliteObject';
import OrbitPath from './OrbitPath';
import { propagateSatellite } from '../../utils/orbitUtils';

export default function SdaOrbitViewer({ satellites, selectedSatellite, onSelectSatellite, showOrbits }) {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [satellitePositions, setSatellitePositions] = useState({});
    const [hoveredSatellite, setHoveredSatellite] = useState(null);

    // Update time every second
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Update satellite positions every second
    useEffect(() => {
        const positions = {};
        satellites.forEach(sat => {
            const position = propagateSatellite(sat.tle, currentTime);
            if (position) {
                positions[sat.id] = position;
            }
        });
        setSatellitePositions(positions);
    }, [satellites, currentTime]);

    return (
        <div className="w-full h-full relative bg-[#0a1125]">
            <Canvas
                camera={{ position: [0, 0, 30], fov: 50 }}
                style={{ background: '#0a1125' }}
            >
                <Suspense fallback={null}>
                    {/* Lighting */}
                    <ambientLight intensity={0.3} />
                    <directionalLight 
                        position={[10, 10, 5]} 
                        intensity={1.5}
                        castShadow
                    />
                    <pointLight position={[-10, -10, -5]} intensity={0.5} color="#4488ff" />

                    {/* Stars background */}
                    <Stars 
                        radius={300} 
                        depth={50} 
                        count={5000} 
                        factor={4} 
                        saturation={0.5}
                        fade
                    />

                    {/* Earth */}
                    <Earth />

                    {/* Orbit Paths */}
                    {showOrbits && satellites.map(sat => (
                        <OrbitPath
                            key={`orbit-${sat.id}`}
                            tle={sat.tle}
                            satelliteType={sat.type}
                            isSelected={selectedSatellite?.id === sat.id}
                        />
                    ))}

                    {/* Satellites */}
                    {satellites.map(sat => {
                        const position = satellitePositions[sat.id];
                        if (!position) return null;

                        return (
                            <SatelliteObject
                                key={sat.id}
                                satellite={sat}
                                position={position}
                                isSelected={selectedSatellite?.id === sat.id}
                                onSelect={onSelectSatellite}
                                onHover={setHoveredSatellite}
                            />
                        );
                    })}

                    {/* Camera Controls */}
                    <OrbitControls
                        enablePan={false}
                        enableZoom={true}
                        enableRotate={true}
                        minDistance={10}
                        maxDistance={80}
                        autoRotate={false}
                        autoRotateSpeed={0.5}
                    />
                </Suspense>
            </Canvas>

            {/* UTC Time Overlay */}
            <div className="absolute top-3 left-3 bg-slate-900/95 rounded-lg px-3 py-2 border border-slate-700 pointer-events-none">
                <p className="text-xs text-slate-400 uppercase">UTC</p>
                <p className="text-sm font-mono text-white">
                    {currentTime.toISOString().replace('T', ' ').substring(0, 19)}
                </p>
            </div>

            {/* Tracking Indicator */}
            {selectedSatellite && (
                <div className="absolute top-3 right-3 bg-slate-900/95 rounded-lg px-3 py-2 border border-orange-500 pointer-events-none">
                    <p className="text-xs text-slate-400 uppercase">Tracking</p>
                    <p className="text-sm font-bold text-orange-400">{selectedSatellite.name}</p>
                    <p className="text-xs text-slate-300">{selectedSatellite.orbitClass}</p>
                </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-3 left-3 bg-slate-900/95 rounded-lg px-3 py-2 border border-slate-700 pointer-events-none">
                <p className="text-xs text-slate-400 uppercase mb-1.5">Satellite Types</p>
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400"></div>
                        <p className="text-xs text-white">Comms</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                        <p className="text-xs text-white">Nav</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                        <p className="text-xs text-white">Missile Warning</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                        <p className="text-xs text-white">ISR</p>
                    </div>
                </div>
            </div>

            {/* Controls Hint */}
            <div className="absolute bottom-3 right-3 bg-slate-900/95 rounded-lg px-3 py-2 border border-slate-700 pointer-events-none">
                <p className="text-xs text-slate-400 uppercase mb-1">Controls</p>
                <p className="text-xs text-white">Click: Select Satellite</p>
                <p className="text-xs text-white">Drag: Rotate View</p>
                <p className="text-xs text-white">Scroll: Zoom</p>
            </div>

            {/* Loading indicator */}
            {Object.keys(satellitePositions).length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mb-4"></div>
                        <p className="text-white text-sm">Initializing orbital visualization...</p>
                    </div>
                </div>
            )}
        </div>
    );
}
