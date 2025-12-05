import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { applyManeuverOffsets } from '../../utils/maneuverLogic';

export default function SatelliteObject({ 
  satellite, 
  position, 
  isSelected, 
  onSelect = () => {},
  onHover = () => {},
  offsets,
  variant = 'normal',
  interactive = true,
  labelOverride
}) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const isGhost = variant === 'ghost';

  // Get color based on satellite type
  const getSatelliteColor = () => {
    if (isGhost) return '#38bdf8';
    if (variant === 'unknown') return '#ff6b35'; // orange-red for unknown
    if (variant === 'threat') return '#dc2626'; // bright red for threats
    if (isSelected) return '#fb923c'; // orange
    if (hovered) return '#ffffff'; // white
    
    switch (satellite.type) {
      case 'comms': return '#22d3ee'; // cyan
      case 'navigation': return '#4ade80'; // green
      case 'missile_warning': return '#f87171'; // red
      case 'isr': return '#facc15'; // yellow
      default: return '#ffffff'; // white
    }
  };

  const color = getSatelliteColor();
  const size = isGhost ? 0.18 : isSelected ? 0.35 : hovered ? 0.28 : 0.22;

  // Pulse animation for selected satellite
  useFrame((state) => {
    if (meshRef.current && isSelected && !isGhost) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
      meshRef.current.scale.setScalar(scale);
    }
  });

  // Use ECI position if available, otherwise convert lat/lon/alt
  const cartesianPosition = useMemo(() => {
    if (!position) return [0, 0, 0];
    
    let x, y, z;
    
    // If we have ECI coordinates, use them directly
    if (position.eci) {
      x = position.eci.x / 1000; // Convert to thousands of km
      y = position.eci.z / 1000; // Swap Y and Z for Three.js
      z = position.eci.y / 1000;
    } else {
      // Fallback to lat/lon/alt conversion
      const lat = position.lat * (Math.PI / 180);
      const lon = position.lon * (Math.PI / 180);
      const radius = 6.371 + position.alt / 1000;
      
      x = radius * Math.cos(lat) * Math.cos(lon);
      y = radius * Math.sin(lat);
      z = radius * Math.cos(lat) * Math.sin(lon);
    }
    
    // Apply maneuver offsets to satellite position
    if (offsets && (offsets.altitudeOffset !== 0 || offsets.phaseOffset !== 0 || offsets.inclinationOffset !== 0)) {
      // Altitude changes - scale distance from center
      if (offsets.altitudeOffset !== 0) {
        const distance = Math.sqrt(x*x + y*y + z*z);
        const scale = 1 + (offsets.altitudeOffset / 6371);
        x *= scale;
        y *= scale;
        z *= scale;
      }
      
      // Phase offset - rotate around Y axis
      if (offsets.phaseOffset !== 0) {
        const angle = offsets.phaseOffset * Math.PI;
        const newX = x * Math.cos(angle) - z * Math.sin(angle);
        const newZ = x * Math.sin(angle) + z * Math.cos(angle);
        x = newX;
        z = newZ;
      }
      
      // Inclination - tilt around X axis
      if (offsets.inclinationOffset !== 0) {
        const tilt = (offsets.inclinationOffset * Math.PI) / 180;
        const newY = y * Math.cos(tilt) - z * Math.sin(tilt);
        const newZ = y * Math.sin(tilt) + z * Math.cos(tilt);
        y = newY;
        z = newZ;
      }
    }
    
    return [x, y, z];
  }, [position, offsets]);

  const telemetryPosition = useMemo(() => {
    if (!position) return null;
    return applyManeuverOffsets(position, offsets);
  }, [position, offsets]);

  const shouldShowLabel = (isSelected || hovered || isGhost) && telemetryPosition;
  const primaryLabel = labelOverride || satellite.name;
  const secondaryLabel = labelOverride ? satellite.name : satellite.mission;

  return (
    <group position={cartesianPosition}>
      <mesh
        ref={meshRef}
        onClick={interactive ? (e => {
          e.stopPropagation();
          onSelect(satellite);
        }) : undefined}
        onPointerOver={interactive ? (e => {
          e.stopPropagation();
          setHovered(true);
          onHover(satellite);
        }) : undefined}
        onPointerOut={interactive ? (e => {
          e.stopPropagation();
          setHovered(false);
          onHover(null);
        }) : undefined}
      >
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial 
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
        />
      </mesh>
      
      {/* Glow effect */}
      <mesh scale={[1.5, 1.5, 1.5]}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial 
          color={color}
          transparent
          opacity={isGhost ? 0.2 : 0.3}
        />
      </mesh>

      {/* Label for selected or hovered satellite */}
      {shouldShowLabel && (
        <Html
          position={[0, size * 3, 0]}
          center
          distanceFactor={15}
          style={{
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        >
          <div className={`px-3 py-2 rounded-lg border-2 backdrop-blur-md ${
            variant === 'unknown'
              ? 'bg-orange-600/90 border-orange-400'
              : variant === 'threat'
                ? 'bg-red-600/90 border-red-400'
                : isSelected 
                  ? 'bg-orange-500/90 border-orange-400' 
                  : isGhost
                    ? 'bg-cyan-500/80 border-cyan-300'
                    : 'bg-slate-900/90 border-slate-700'
          }`}>
            <p className="text-white font-bold text-xs whitespace-nowrap">
              {variant === 'unknown' ? '??? ' : variant === 'threat' ? '⚠️ ' : ''}{primaryLabel}
            </p>
            {secondaryLabel && (
              <p className="text-slate-300 text-[10px] whitespace-nowrap">{secondaryLabel}</p>
            )}
            {(variant === 'unknown' || variant === 'threat') && (
              <p className="text-slate-200 text-[10px] whitespace-nowrap mt-1">UNKNOWN</p>
            )}
            <div className="text-slate-400 text-[9px] font-mono mt-1 space-y-0.5">
              <p>Lat: {telemetryPosition.lat.toFixed(2)}°</p>
              <p>Lon: {telemetryPosition.lon.toFixed(2)}°</p>
              <p>Alt: {(telemetryPosition.alt).toFixed(0)} km</p>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
