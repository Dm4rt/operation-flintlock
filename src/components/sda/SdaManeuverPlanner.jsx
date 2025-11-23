import React from 'react';
import { ArrowUp, ArrowDown, ChevronRight, ChevronLeft, RotateCcw, AlertCircle } from 'lucide-react';
import { 
  MANEUVER_TYPES, 
  MANEUVER_COSTS, 
  MANEUVER_DESCRIPTIONS,
  canPerformManeuver,
  getManeuverRecommendation 
} from '../../utils/maneuverLogic';

export default function SdaManeuverPlanner({ satellite, onManeuver }) {
  if (!satellite) return null;

  const recommendation = getManeuverRecommendation(satellite);

  const maneuvers = [
    { 
      type: MANEUVER_TYPES.RAISE_ORBIT, 
      label: 'Raise Orbit', 
      icon: ArrowUp,
      color: 'blue'
    },
    { 
      type: MANEUVER_TYPES.LOWER_ORBIT, 
      label: 'Lower Orbit', 
      icon: ArrowDown,
      color: 'blue'
    },
    { 
      type: MANEUVER_TYPES.PHASE_FORWARD, 
      label: 'Phase Forward', 
      icon: ChevronRight,
      color: 'purple'
    },
    { 
      type: MANEUVER_TYPES.PHASE_BACKWARD, 
      label: 'Phase Backward', 
      icon: ChevronLeft,
      color: 'purple'
    },
    { 
      type: MANEUVER_TYPES.INCLINATION_CHANGE, 
      label: 'Inclination Change', 
      icon: RotateCcw,
      color: 'orange'
    }
  ];

  const handleManeuverClick = (maneuverType) => {
    const check = canPerformManeuver(satellite, maneuverType);
    
    if (!check.canManeuver) {
      alert(check.reason);
      return;
    }
    
    onManeuver(maneuverType);
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
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-lg border-2 border-slate-700 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/30 to-blue-800/20 border-b border-blue-700/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="text-blue-400">⚡</span> Maneuver Control
          </h3>
          <div className="bg-slate-900/60 px-3 py-1 rounded-full border border-slate-700">
            <p className="text-xs text-slate-300 font-mono">
              <span className="text-green-400 font-bold">{satellite.fuelPoints}</span> FP
            </p>
          </div>
        </div>
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

      {/* Maneuver Buttons */}
      <div className="space-y-2">
        {maneuvers.map(maneuver => {
          const check = canPerformManeuver(satellite, maneuver.type);
          const cost = MANEUVER_COSTS[maneuver.type];
          const description = MANEUVER_DESCRIPTIONS[maneuver.type];
          
          return (
            <button
              key={maneuver.type}
              onClick={() => handleManeuverClick(maneuver.type)}
              disabled={!check.canManeuver}
              className={`w-full rounded-lg transition-all border-2 shadow-lg ${
                !check.canManeuver 
                  ? 'bg-slate-800/50 border-slate-700 text-slate-600 cursor-not-allowed'
                  : maneuver.color === 'green'
                  ? 'bg-gradient-to-br from-green-600 to-green-700 border-green-500 text-white hover:from-green-500 hover:to-green-600 hover:border-green-400 hover:shadow-green-500/50 active:scale-95'
                  : maneuver.color === 'yellow'
                  ? 'bg-gradient-to-br from-yellow-600 to-yellow-700 border-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-600 hover:border-yellow-400 hover:shadow-yellow-500/50 active:scale-95'
                  : 'bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500 text-white hover:from-blue-500 hover:to-blue-600 hover:border-blue-400 hover:shadow-blue-500/50 active:scale-95'
              }`}
            >
              <div className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <maneuver.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-base font-bold">{maneuver.label}</p>
                  </div>
                  <div className="bg-black/30 px-3 py-1 rounded-full text-sm font-bold backdrop-blur-sm">
                    -{cost} FP
                  </div>
                </div>
                <p className="text-xs opacity-90 text-left">{description}</p>
              </div>
            </button>
          );
        })}
      </div>

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
