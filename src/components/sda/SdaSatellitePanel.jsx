import React from 'react';
import { Satellite, Radio, Shield, AlertTriangle, Fuel, Activity } from 'lucide-react';
import { calculateNextPass } from '../../utils/orbitUtils';
import { calculateAsatRisk } from '../../utils/maneuverLogic';

export default function SdaSatellitePanel({ satellite }) {
  if (!satellite) return null;

  const asatRisk = calculateAsatRisk(satellite);

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      default: return 'text-green-400';
    }
  };

  const getFuelColor = (fuel) => {
    if (fuel > 60) return 'bg-green-400';
    if (fuel > 30) return 'bg-yellow-400';
    return 'bg-red-400';
  };

  return (
    <div className="bg-slate-800/80 rounded-lg border-2 border-slate-700">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <h3 className="text-base font-bold text-white text-center">
          Satellite Details
        </h3>
      </div>

      <div className="p-4 space-y-3">

      {/* Status Grid */}
      <div className="space-y-2">
        {/* Health */}
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">Health</span>
          <span className={`text-sm font-bold ${
            satellite.status.health === 'nominal' ? 'text-green-400' : 'text-red-400'
          }`}>
            {satellite.status.health.toUpperCase()}
          </span>
        </div>

        {/* ASAT Risk */}
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">ASAT Risk</span>
          <span className={`text-sm font-bold ${getRiskColor(asatRisk)}`}>
            {asatRisk.toUpperCase()}
          </span>
        </div>

        {/* Coverage */}
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">Coverage</span>
          <span className={`text-sm font-bold ${
            satellite.status.coverage ? 'text-green-400' : 'text-red-400'
          }`}>
            {satellite.status.coverage ? 'YES' : 'NO'}
          </span>
        </div>

        {/* Fuel */}
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">Fuel</span>
          <span className="text-sm font-bold text-white">{satellite.fuelPoints}%</span>
        </div>
      </div>
      </div>
    </div>
  );
}
