import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import * as satellite from 'satellite.js';

export default function OrbitPath({ tle, satelliteType, isSelected, offsets }) {
  const lineRef = useRef();
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
        let x = positionEci.x / 1000; // Convert to thousands of km for Three.js scale
        let y = positionEci.z / 1000; // Swap Y and Z for Three.js coordinate system
        let z = positionEci.y / 1000;
        
        // Apply offsets for planned maneuvers (make them VERY visible)
        if (offsets && (offsets.altitudeOffset !== 0 || offsets.phaseOffset !== 0 || offsets.inclinationOffset !== 0)) {
          // Altitude changes - scale the orbit radius
          if (offsets.altitudeOffset !== 0) {
            const distance = Math.sqrt(x*x + y*y + z*z);
            const altitudeScale = 1 + (offsets.altitudeOffset / 6371); // Earth radius ~6371 km
            x *= altitudeScale;
            y *= altitudeScale;
            z *= altitudeScale;
          }
          
          // Phase offset rotates around Y axis (vertical)
          if (offsets.phaseOffset !== 0) {
            const angle = offsets.phaseOffset * Math.PI; // Much more dramatic
            const newX = x * Math.cos(angle) - z * Math.sin(angle);
            const newZ = x * Math.sin(angle) + z * Math.cos(angle);
            x = newX;
            z = newZ;
          }
          
          // Inclination changes tilt the orbit around X axis
          if (offsets.inclinationOffset !== 0) {
            const tiltAngle = (offsets.inclinationOffset * Math.PI) / 180;
            const newY = y * Math.cos(tiltAngle) - z * Math.sin(tiltAngle);
            const newZ = y * Math.sin(tiltAngle) + z * Math.cos(tiltAngle);
            y = newY;
            z = newZ;
          }
        }
        
        points.push(new THREE.Vector3(x, y, z));
      }
    }
    
    return points;
  }, [tle, offsets]);

  // Get orbit color based on satellite type
  const getOrbitColor = () => {
    switch (satelliteType) {
      case 'planned': return '#3b82f6'; // blue for planned maneuvers
      case 'comms': return '#22d3ee'; // cyan
      case 'navigation': return '#4ade80'; // green
      case 'missile_warning': return '#f87171'; // red
      case 'isr': return '#facc15'; // yellow
      default: return '#ffffff'; // white
    }
  };

  const color = getOrbitColor();
  const lineWidth = satelliteType === 'planned' ? 3 : isSelected ? 3 : 2;
  const opacity = satelliteType === 'planned' ? 0.8 : 0.6;

  if (orbitPoints.length === 0) return null;

  const isPlanned = satelliteType === 'planned';

  // Compute dashes for planned orbits
  useEffect(() => {
    if (lineRef.current && isPlanned) {
      lineRef.current.computeLineDistances();
    }
  }, [isPlanned, orbitPoints]);

  return (
    <line ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={orbitPoints.length}
          array={new Float32Array(orbitPoints.flatMap(p => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      {isPlanned ? (
        <lineDashedMaterial 
          color={color}
          transparent
          opacity={opacity}
          linewidth={lineWidth}
          dashSize={2}
          gapSize={1}
        />
      ) : (
        <lineBasicMaterial 
          color={color}
          transparent
          opacity={opacity}
          linewidth={lineWidth}
        />
      )}
    </line>
  );
}
