import React from 'react';
import { Satellite, Radio, Shield, AlertTriangle, Fuel, Activity } from 'lucide-react';
import { calculateNextPass } from '../../utils/orbitUtils';
import { calculateAsatRisk } from '../../utils/maneuverLogic';

export default function SdaSatellitePanel({ satellite }) {
  if (!satellite) return null;

  const nextPass = calculateNextPass(satellite.tle);
  const asatRisk = calculateAsatRisk(satellite);

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      default: return 'text-green-500';
    }
  };

  const getFuelColor = (fuel) => {
    if (fuel > 60) return 'bg-green-500';
    if (fuel > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-lg border-2 border-slate-700 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-900/30 to-orange-800/20 border-b border-orange-700/50 px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500 flex items-center justify-center">
            <Satellite className="w-4 h-4 text-orange-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-white">{satellite.name}</h3>
            <p className="text-xs text-slate-400">{satellite.mission}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">

      {/* Orbit Information */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400 uppercase">Orbit Class</span>
          <span className="text-sm font-bold text-white">{satellite.orbitClass}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400 uppercase">Priority</span>
          <span className={`text-sm font-bold ${
            satellite.priority === 'critical' ? 'text-red-400' : 'text-yellow-400'
          }`}>
            {satellite.priority.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="space-y-2 pt-2 border-t border-slate-700">
        {/* Health */}
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 flex-1">Health</span>
          <span className={`text-sm font-bold ${
            satellite.status.health === 'nominal' ? 'text-green-400' : 'text-red-400'
          }`}>
            {satellite.status.health.toUpperCase()}
          </span>
        </div>

        {/* ASAT Risk */}
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 flex-1">ASAT Risk</span>
          <span className={`text-sm font-bold ${getRiskColor(asatRisk)}`}>
            {asatRisk.toUpperCase()}
          </span>
        </div>

        {/* Coverage */}
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 flex-1">Coverage</span>
          <span className={`text-sm font-bold ${
            satellite.status.coverage ? 'text-green-400' : 'text-red-400'
          }`}>
            {satellite.status.coverage ? 'AVAILABLE' : 'NO COVERAGE'}
          </span>
        </div>

        {/* Jamming Status */}
        {satellite.status.jammed && (
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-400 flex-1">JAMMING DETECTED</span>
          </div>
        )}
      </div>

      {/* Fuel Points */}
      <div className="pt-3 border-t border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <Fuel className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 flex-1">Fuel Points</span>
          <span className="text-sm font-bold text-white">{satellite.fuelPoints} FP</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all ${getFuelColor(satellite.fuelPoints)}`}
            style={{ width: `${satellite.fuelPoints}%` }}
          ></div>
        </div>
      </div>

      {/* Next Pass Info (for LEO satellites) */}
      {satellite.orbitClass === 'LEO' && nextPass.time && (
        <div className="pt-3 border-t border-slate-700">
          <p className="text-xs text-slate-400 uppercase mb-2">Next Pass</p>
          <div className="space-y-1">
            <p className="text-xs text-white">
              {nextPass.time.toLocaleTimeString('en-US', { hour12: false })}
            </p>
            <p className="text-xs text-slate-500">
              Duration: {nextPass.duration} min | Elevation: {Math.round(nextPass.elevation)}°
            </p>
          </div>
        </div>
      )}

      {/* Last Maneuver */}
      {satellite.lastManeuver && (
        <div className="pt-3 border-t border-slate-700">
          <p className="text-xs text-slate-400 uppercase mb-1">Last Maneuver</p>
          <p className="text-xs text-white">
            {satellite.lastManeuver.type.replace('_', ' ').toUpperCase()}
          </p>
          <p className="text-xs text-slate-500">
            {new Date(satellite.lastManeuver.timestamp).toLocaleTimeString('en-US', { hour12: false })} 
            {' '}({satellite.lastManeuver.cost} FP)
          </p>
        </div>
      )}
      </div>
    </div>
  );
}
