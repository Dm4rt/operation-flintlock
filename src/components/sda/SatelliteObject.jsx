import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

export default function SatelliteObject({ 
  satellite, 
  position, 
  isSelected, 
  onSelect,
  onHover,
  offsets 
}) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  // Get color based on satellite type
  const getSatelliteColor = () => {
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
  const size = isSelected ? 0.35 : hovered ? 0.28 : 0.22;

  // Pulse animation for selected satellite
  useFrame((state) => {
    if (meshRef.current && isSelected) {
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

  return (
    <group position={cartesianPosition}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(satellite);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHover(satellite);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          onHover(null);
        }}
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
          opacity={0.3}
        />
      </mesh>

      {/* Label for selected or hovered satellite */}
      {(isSelected || hovered) && position && (
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
            isSelected 
              ? 'bg-orange-500/90 border-orange-400' 
              : 'bg-slate-900/90 border-slate-700'
          }`}>
            <p className="text-white font-bold text-xs whitespace-nowrap">{satellite.name}</p>
            <p className="text-slate-300 text-[10px] whitespace-nowrap">{satellite.mission}</p>
            <div className="text-slate-400 text-[9px] font-mono mt-1 space-y-0.5">
              <p>Lat: {position.lat.toFixed(2)}°</p>
              <p>Lon: {position.lon.toFixed(2)}°</p>
              <p>Alt: {(position.alt).toFixed(0)} km</p>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
