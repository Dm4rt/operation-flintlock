import React, { useMemo } from 'react';
import * as THREE from 'three';
import * as satellite from 'satellite.js';

export default function OrbitPath({ tle, satelliteType, isSelected }) {
  // Generate orbit points using direct ECI to Cartesian conversion
  const orbitPoints = useMemo(() => {
    const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
    if (!satrec) return [];
    
    // Calculate orbital period in minutes
    const meanMotion = satrec.no; // revolutions per day in radians
    const periodMinutes = (2 * Math.PI) / meanMotion; // period in minutes
    
    const now = new Date();
    const points = [];
    const pointCount = 200; // More points for smoother orbits
    
    // Propagate through one complete orbit
    for (let i = 0; i <= pointCount; i++) {
      const fraction = i / pointCount;
      const minutesOffset = fraction * periodMinutes;
      const propagateTime = new Date(now.getTime() + minutesOffset * 60 * 1000);
      
      const positionAndVelocity = satellite.propagate(satrec, propagateTime);
      
      if (positionAndVelocity && positionAndVelocity.position) {
        const positionEci = positionAndVelocity.position;
        
        // Convert ECI position (in km) to Three.js units (keeping km scale)
        const x = positionEci.x / 1000; // Convert to thousands of km for Three.js scale
        const y = positionEci.z / 1000; // Swap Y and Z for Three.js coordinate system
        const z = positionEci.y / 1000;
        
        points.push(new THREE.Vector3(x, y, z));
      }
    }
    
    return points;
  }, [tle]);

  // Get orbit color based on satellite type
  const getOrbitColor = () => {
    switch (satelliteType) {
      case 'comms': return '#22d3ee'; // cyan
      case 'navigation': return '#4ade80'; // green
      case 'missile_warning': return '#f87171'; // red
      case 'isr': return '#facc15'; // yellow
      default: return '#ffffff'; // white
    }
  };

  const color = getOrbitColor();
  const lineWidth = isSelected ? 3 : 2;

  if (orbitPoints.length === 0) return null;

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={orbitPoints.length}
          array={new Float32Array(orbitPoints.flatMap(p => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial 
        color={color}
        transparent
        opacity={0.6}
        linewidth={lineWidth}
      />
    </line>
  );
}
