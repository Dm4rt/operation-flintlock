import * as satellite from 'satellite.js';

/**
 * Propagate satellite position from TLE at a given time
 * @param {Object} tle - TLE object with line1 and line2
 * @param {Date} date - Date to propagate to
 * @returns {Object} Position data with lat, lon, alt, velocity
 */
export function propagateSatellite(tle, date = new Date()) {
  const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
  const positionAndVelocity = satellite.propagate(satrec, date);
  
  if (positionAndVelocity.position === false) {
    return null;
  }

  const positionEci = positionAndVelocity.position;
  const gmst = satellite.gstime(date);
  const positionGd = satellite.eciToGeodetic(positionEci, gmst);

  return {
    lat: satellite.degreesLat(positionGd.latitude),
    lon: satellite.degreesLong(positionGd.longitude),
    alt: positionGd.height, // km
    velocity: positionAndVelocity.velocity,
    eci: positionEci
  };
}

/**
 * Generate orbit track by propagating satellite through one full orbital period
 * This ensures the orbit path matches exactly where the satellite actually travels
 */
export function generateOrbitTrack(tle, pointCount = 150) {
  const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
  
  if (!satrec) return [];
  
  // Calculate orbital period in minutes
  const meanMotion = satrec.no; // revolutions per day
  const periodMinutes = (2 * Math.PI) / meanMotion; // period in minutes
  
  const now = new Date();
  const points = [];
  
  // Propagate satellite through one complete orbit
  for (let i = 0; i <= pointCount; i++) {
    const fraction = i / pointCount;
    const timeOffset = fraction * periodMinutes * 60 * 1000; // convert to milliseconds
    const propagateTime = new Date(now.getTime() + timeOffset);
    
    const position = propagateSatellite(tle, propagateTime);
    
    if (position) {
      points.push({
        lat: position.lat,
        lon: position.lon,
        alt: position.alt
      });
    }
  }
  
  return points;
}

/**
 * Calculate next pass time over a ground location (simplified)
 * @param {Object} tle - TLE object
 * @param {number} lat - Ground station latitude
 * @param {number} lon - Ground station longitude
 * @returns {Object} Next pass info
 */
export function calculateNextPass(tle, lat = 39.0, lon = -95.0) {
  const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
  const period = (2 * Math.PI) / satrec.no; // minutes
  
  // For LEO satellites, calculate actual passes
  if (period < 200) {
    const now = new Date();
    
    // Check next 24 hours in 5-minute increments
    for (let i = 0; i < 288; i++) {
      const checkTime = new Date(now.getTime() + i * 5 * 60 * 1000);
      const pos = propagateSatellite(tle, checkTime);
      
      if (pos) {
        // Simple elevation check (within ~2000km and same hemisphere)
        const distance = Math.sqrt(
          Math.pow(pos.lat - lat, 2) + Math.pow(pos.lon - lon, 2)
        );
        
        if (distance < 20 && pos.alt < 2000) {
          return {
            time: checkTime,
            duration: Math.floor(period * 0.15), // roughly 15% of orbit
            elevation: Math.max(10, 90 - distance * 4)
          };
        }
      }
    }
    
    return { time: null, duration: 0, elevation: 0 };
  }
  
  // For GEO satellites, always in coverage
  return { time: new Date(), duration: 1440, elevation: 45 };
}

/**
 * Convert ECI coordinates to Cesium Cartesian3
 * @param {Object} eciPos - ECI position from satellite.js
 * @returns {Object} Cartesian3-compatible object
 */
export function eciToCesiumCartesian(eciPos) {
  if (!eciPos) return null;
  
  return {
    x: eciPos.x * 1000, // convert km to meters
    y: eciPos.y * 1000,
    z: eciPos.z * 1000
  };
}

/**
 * Get satellite period in minutes
 * @param {Object} tle - TLE object
 * @returns {number} Period in minutes
 */
export function getSatellitePeriod(tle) {
  const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
  return (2 * Math.PI) / satrec.no;
}

/**
 * Determine orbit class from TLE
 * @param {Object} tle - TLE object
 * @returns {string} LEO, MEO, or GEO
 */
export function getOrbitClass(tle) {
  const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
  const period = (2 * Math.PI) / satrec.no;
  
  if (period > 1400) return 'GEO';
  if (period > 200) return 'MEO';
  return 'LEO';
}
