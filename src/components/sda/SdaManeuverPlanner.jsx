import React from 'react';
import { ArrowUp, ArrowDown, ChevronRight, ChevronLeft, RotateCcw, AlertCircle } from 'lucide-react';
import { 
  MANEUVER_TYPES, 
  MANEUVER_COSTS, 
  MANEUVER_DESCRIPTIONS,
  canPerformManeuver,
  getManeuverRecommendation 
} from '../../utils/maneuverLogic';

export default function SdaManeuverPlanner({ satellite, onPlanManeuver, onCommitManeuver, onCancelManeuver, plannedManeuver }) {
  if (!satellite) return null;

  const recommendation = getManeuverRecommendation(satellite);
  const hasPlannedManeuver = plannedManeuver && plannedManeuver.satelliteId === satellite.id;
  const defaultOffsets = { altitudeOffset: 0, phaseOffset: 0, inclinationOffset: 0 };
  const plannedOffsets = hasPlannedManeuver
    ? (plannedManeuver.previewSatellite?.maneuverOffsets || defaultOffsets)
    : defaultOffsets;
  const baseOffsets = hasPlannedManeuver
    ? (plannedManeuver.baseOffsets || defaultOffsets)
    : defaultOffsets;
  const offsetDeltas = {
    altitude: plannedOffsets.altitudeOffset - baseOffsets.altitudeOffset,
    phase: plannedOffsets.phaseOffset - baseOffsets.phaseOffset,
    inclination: plannedOffsets.inclinationOffset - baseOffsets.inclinationOffset
  };

  const maneuvers = [
    { 
      type: MANEUVER_TYPES.RAISE_ORBIT, 
      label: 'Prograde', 
      icon: ArrowUp,
      color: 'green',
      symbol: '⊕'
    },
    { 
      type: MANEUVER_TYPES.LOWER_ORBIT, 
      label: 'Retrograde', 
      icon: ArrowDown,
      color: 'green',
      symbol: '⊖'
    },
    { 
      type: MANEUVER_TYPES.INCLINATION_CHANGE, 
      label: 'Normal', 
      icon: ArrowUp,
      color: 'purple',
      symbol: '△'
    },
    { 
      type: MANEUVER_TYPES.PHASE_FORWARD, 
      label: 'Radial Out', 
      icon: ChevronRight,
      color: 'cyan',
      symbol: '⊙'
    },
    { 
      type: MANEUVER_TYPES.PHASE_BACKWARD, 
      label: 'Radial In', 
      icon: ChevronLeft,
      color: 'cyan',
      symbol: '⊗'
    }
  ];

  const handleManeuverClick = (maneuverType) => {
    const check = canPerformManeuver(satellite, maneuverType);
    
    if (!check.canManeuver) {
      alert(check.reason);
      return;
    }
    
    onPlanManeuver(maneuverType);
  };

  const getColorClasses = (color, disabled) => {
    if (disabled) {
      return 'bg-slate-800 text-slate-600 cursor-not-allowed';
    }
    
    const colors = {
      blue: 'bg-blue-600 hover:bg-blue-500 text-white',
      purple: 'bg-purple-600 hover:bg-purple-500 text-white',
      orange: 'bg-orange-600 hover:bg-orange-500 text-white'
    };
    
    return colors[color];
  };

  return (
    <div className="bg-slate-900/60 rounded-lg border-2 border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800/80 border-b border-slate-700 px-4 py-3">
        <h3 className="text-base font-bold text-white text-center">
          Maneuver Planner
        </h3>
      </div>

      <div className="p-4 space-y-3">
        {/* Recommendation Banner */}
        {recommendation.type && (
          <div className={`p-3 rounded-lg border ${
            recommendation.priority === 'critical' 
              ? 'bg-red-900/20 border-red-600' 
              : 'bg-yellow-900/20 border-yellow-600'
          }`}>
            <div className="flex items-start gap-2">
              <AlertCircle className={`w-4 h-4 mt-0.5 ${
                recommendation.priority === 'critical' ? 'text-red-400' : 'text-yellow-400'
              }`} />
              <div>
                <p className={`text-xs font-bold ${
                  recommendation.priority === 'critical' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  RECOMMENDATION
                </p>
                <p className="text-xs text-white mt-1">{recommendation.reason}</p>
              </div>
            </div>
          </div>
        )}

      {recommendation.priority === 'warning' && !recommendation.type && (
        <div className="p-3 rounded-lg border bg-yellow-900/20 border-yellow-600">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 text-yellow-400" />
            <div>
              <p className="text-xs font-bold text-yellow-400">WARNING</p>
              <p className="text-xs text-white mt-1">{recommendation.reason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Planned Maneuver Status */}
      {hasPlannedManeuver && (
        <div className="bg-blue-900/30 border-2 border-blue-600 rounded-lg p-3">
          <p className="text-xs text-blue-400 font-bold uppercase mb-1">Maneuvers Planned</p>
          <div className="space-y-1">
            {offsetDeltas.altitude !== 0 && (
              <p className="text-xs text-white">
                Altitude: {offsetDeltas.altitude > 0 ? '+' : ''}{offsetDeltas.altitude} km
              </p>
            )}
            {offsetDeltas.phase !== 0 && (
              <p className="text-xs text-white">
                Phase: {offsetDeltas.phase > 0 ? '+' : ''}{offsetDeltas.phase.toFixed(2)}
              </p>
            )}
            {offsetDeltas.inclination !== 0 && (
              <p className="text-xs text-white">
                Inclination: {offsetDeltas.inclination > 0 ? '+' : ''}{offsetDeltas.inclination}°
              </p>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">Preview orbit shown in dashed blue line</p>
          <p className="text-xs text-green-400 mt-1">Fuel cost: {satellite.fuelPoints - plannedManeuver.previewSatellite.fuelPoints} FP</p>
        </div>
      )}

      {/* Maneuver Buttons */}
      <div className="space-y-3">
        {maneuvers.map(maneuver => {
          const check = canPerformManeuver(satellite, maneuver.type);
          const cost = MANEUVER_COSTS[maneuver.type];
          
          return (
            <button
              key={maneuver.type}
              onClick={() => handleManeuverClick(maneuver.type)}
              disabled={!check.canManeuver}
              className={`w-full rounded-lg transition-all border-2 shadow-lg ${
                !check.canManeuver
                  ? 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700 hover:border-slate-500 hover:shadow-xl active:scale-95'
              }`}
            >
              <div className="px-6 py-4">
                <p className="text-lg font-bold">{maneuver.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Commit/Cancel Buttons */}
      {hasPlannedManeuver && (
        <div className="space-y-2 pt-3 border-t border-slate-700">
          <button
            onClick={onCommitManeuver}
            className="w-full rounded-lg bg-green-600 hover:bg-green-500 border-2 border-green-500 text-white font-bold py-3 transition-all hover:shadow-xl active:scale-95"
          >
            Commit Maneuver
          </button>
          <button
            onClick={onCancelManeuver}
            className="w-full rounded-lg bg-red-600 hover:bg-red-500 border-2 border-red-500 text-white font-bold py-3 transition-all hover:shadow-xl active:scale-95"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Maneuver Offsets Display */}
      {satellite.maneuverOffsets && (
        <div className="pt-3 border-t border-slate-700">
          <p className="text-xs text-slate-400 uppercase mb-2">Applied Offsets</p>
          <div className="space-y-1 text-xs">
            {satellite.maneuverOffsets.altitudeOffset !== 0 && (
              <p className="text-white">
                Altitude: {satellite.maneuverOffsets.altitudeOffset > 0 ? '+' : ''}
                {satellite.maneuverOffsets.altitudeOffset} km
              </p>
            )}
            {satellite.maneuverOffsets.phaseOffset !== 0 && (
              <p className="text-white">
                Phase: {satellite.maneuverOffsets.phaseOffset > 0 ? '+' : ''}
                {satellite.maneuverOffsets.phaseOffset.toFixed(2)}
              </p>
            )}
            {satellite.maneuverOffsets.inclinationOffset !== 0 && (
              <p className="text-white">
                Inclination: {satellite.maneuverOffsets.inclinationOffset > 0 ? '+' : ''}
                {satellite.maneuverOffsets.inclinationOffset}°
              </p>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
