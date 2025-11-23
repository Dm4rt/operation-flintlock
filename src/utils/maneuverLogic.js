/**
 * Maneuver logic for satellite operations
 * Does NOT recalculate TLEs - uses parameter offsets instead
 */

export const MANEUVER_TYPES = {
  RAISE_ORBIT: 'raise_orbit',
  LOWER_ORBIT: 'lower_orbit',
  PHASE_FORWARD: 'phase_forward',
  PHASE_BACKWARD: 'phase_backward',
  INCLINATION_CHANGE: 'inclination_change'
};

export const MANEUVER_COSTS = {
  [MANEUVER_TYPES.RAISE_ORBIT]: 10,
  [MANEUVER_TYPES.LOWER_ORBIT]: 10,
  [MANEUVER_TYPES.PHASE_FORWARD]: 5,
  [MANEUVER_TYPES.PHASE_BACKWARD]: 5,
  [MANEUVER_TYPES.INCLINATION_CHANGE]: 15
};

export const MANEUVER_DESCRIPTIONS = {
  [MANEUVER_TYPES.RAISE_ORBIT]: 'Increase altitude - widens ground track',
  [MANEUVER_TYPES.LOWER_ORBIT]: 'Decrease altitude - tightens ground track',
  [MANEUVER_TYPES.PHASE_FORWARD]: 'Shift satellite ahead in orbit',
  [MANEUVER_TYPES.PHASE_BACKWARD]: 'Shift satellite behind in orbit',
  [MANEUVER_TYPES.INCLINATION_CHANGE]: 'Change orbit tilt by ±5°'
};

/**
 * Apply maneuver to satellite and return updated state
 * @param {Object} satellite - Current satellite state
 * @param {string} maneuverType - Type of maneuver
 * @returns {Object} Updated satellite with new offsets and fuel
 */
export function applyManeuver(satellite, maneuverType) {
  const cost = MANEUVER_COSTS[maneuverType];
  
  if (satellite.fuelPoints < cost) {
    throw new Error('Insufficient fuel points');
  }

  const newSatellite = { ...satellite };
  const offsets = newSatellite.maneuverOffsets || {
    altitudeOffset: 0,
    phaseOffset: 0,
    inclinationOffset: 0
  };

  switch (maneuverType) {
    case MANEUVER_TYPES.RAISE_ORBIT:
      offsets.altitudeOffset += 250; // +250 km
      break;
    case MANEUVER_TYPES.LOWER_ORBIT:
      offsets.altitudeOffset -= 250; // -250 km
      break;
    case MANEUVER_TYPES.PHASE_FORWARD:
      offsets.phaseOffset += 0.1; // advance phase
      break;
    case MANEUVER_TYPES.PHASE_BACKWARD:
      offsets.phaseOffset -= 0.1; // retard phase
      break;
    case MANEUVER_TYPES.INCLINATION_CHANGE:
      offsets.inclinationOffset += 5; // +5 degrees
      break;
    default:
      throw new Error('Unknown maneuver type');
  }

  newSatellite.maneuverOffsets = offsets;
  newSatellite.fuelPoints -= cost;
  newSatellite.lastManeuver = {
    type: maneuverType,
    timestamp: new Date(),
    cost
  };

  return newSatellite;
}

/**
 * Apply maneuver offsets to propagated position
 * @param {Object} position - Base position from propagation
 * @param {Object} offsets - Maneuver offsets
 * @returns {Object} Modified position
 */
export function applyManeuverOffsets(position, offsets) {
  if (!position || !offsets) return position;

  return {
    ...position,
    alt: position.alt + offsets.altitudeOffset,
    lat: position.lat + (offsets.inclinationOffset * 0.1), // simplified
    lon: position.lon + (offsets.phaseOffset * 10) // simplified phase shift
  };
}

/**
 * Calculate ASAT risk based on orbit class and satellite status
 * @param {Object} satellite - Satellite object
 * @returns {string} low, medium, high, critical
 */
export function calculateAsatRisk(satellite) {
  const { orbitClass, status, fuelPoints } = satellite;
  
  // Base risk by orbit
  let riskLevel = 1;
  
  if (orbitClass === 'LEO') riskLevel = 3; // LEO most vulnerable
  if (orbitClass === 'MEO') riskLevel = 2;
  if (orbitClass === 'GEO') riskLevel = 1;
  
  // Low fuel increases risk
  if (fuelPoints < 30) riskLevel += 1;
  
  // Status modifiers
  if (status.jammed) riskLevel += 1;
  
  if (riskLevel >= 4) return 'critical';
  if (riskLevel === 3) return 'high';
  if (riskLevel === 2) return 'medium';
  return 'low';
}

/**
 * Check if satellite can perform maneuver
 * @param {Object} satellite - Satellite object
 * @param {string} maneuverType - Type of maneuver
 * @returns {Object} { canManeuver: boolean, reason: string }
 */
export function canPerformManeuver(satellite, maneuverType) {
  const cost = MANEUVER_COSTS[maneuverType];
  
  if (satellite.fuelPoints < cost) {
    return { canManeuver: false, reason: 'Insufficient fuel' };
  }
  
  if (satellite.status.health !== 'nominal') {
    return { canManeuver: false, reason: 'Satellite health not nominal' };
  }
  
  return { canManeuver: true, reason: null };
}

/**
 * Generate maneuver recommendation based on satellite state
 * @param {Object} satellite - Satellite object
 * @returns {Object} Recommendation with type and reasoning
 */
export function getManeuverRecommendation(satellite) {
  const { status, fuelPoints, orbitClass } = satellite;
  
  // High ASAT risk on LEO - recommend raising orbit
  if (orbitClass === 'LEO' && status.asatRisk === 'high') {
    return {
      type: MANEUVER_TYPES.RAISE_ORBIT,
      reason: 'High ASAT risk detected - raise orbit to evade',
      priority: 'critical'
    };
  }
  
  // Jamming - recommend phase shift
  if (status.jammed) {
    return {
      type: MANEUVER_TYPES.PHASE_FORWARD,
      reason: 'Jamming detected - shift phase to escape interference',
      priority: 'high'
    };
  }
  
  // Low fuel warning
  if (fuelPoints < 20) {
    return {
      type: null,
      reason: 'Low fuel - conserve for emergency maneuvers only',
      priority: 'warning'
    };
  }
  
  return {
    type: null,
    reason: 'All systems nominal',
    priority: 'normal'
  };
}
