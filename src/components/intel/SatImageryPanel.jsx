/**
 * Satellite Imagery Panel
 * Displays Google Maps satellite view at coordinates from SDA
 */

import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

export default function SatImageryPanel({ satData, onClose }) {
  const mapRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!satData) return;

    const initMap = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        
        if (!apiKey) {
          throw new Error('Google Maps API key not configured');
        }

        const loader = new Loader({
          apiKey,
          version: 'weekly',
          libraries: ['maps']
        });

        await loader.load();

        if (!mapRef.current) return;

        const { lat, lon } = satData;
        const position = { lat, lng: lon };

        // Create map instance
        const map = new google.maps.Map(mapRef.current, {
          center: position,
          zoom: 14,
          mapTypeId: 'satellite',
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_CENTER,
          },
          zoomControl: true,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_CENTER
          },
          scaleControl: true,
          streetViewControl: false,
          fullscreenControl: true
        });

        // Add marker at target position
        new google.maps.Marker({
          position,
          map,
          title: `${satData.satId} Target Location`,
          label: {
            text: '🛰',
            fontSize: '24px'
          }
        });

        // Add info window
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="color: #1e293b; font-family: monospace;">
              <strong>${satData.satId}</strong><br/>
              Lat: ${lat.toFixed(6)}°<br/>
              Lon: ${lon.toFixed(6)}°<br/>
              Alt: ${satData.altKm} km
            </div>
          `
        });

        infoWindow.open(map, new google.maps.Marker({ position, map }));

        mapInstanceRef.current = map;
        setIsLoading(false);

      } catch (err) {
        console.error('Failed to load Google Maps:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    initMap();

    return () => {
      mapInstanceRef.current = null;
    };
  }, [satData]);

  if (!satData) {
    return (
      <div className="flex items-center justify-center h-96 bg-slate-900 rounded-lg border border-slate-700">
        <div className="text-center text-slate-400">
          <p className="text-sm">No satellite data available</p>
          <p className="text-xs mt-2">Request imagery from SDA</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{satData.satId.toUpperCase()}</h3>
            <p className="text-xs text-slate-400 mt-1">
              {satData.timestamp?.toLocaleString?.() || 'Live'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-sm text-slate-300"
          >
            Close
          </button>
        </div>

        {/* Coordinates Display */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-slate-800 p-3 rounded">
            <p className="text-xs text-slate-400 uppercase">Latitude</p>
            <p className="text-sm font-mono text-green-400 mt-1">{satData.lat.toFixed(6)}°</p>
          </div>
          <div className="bg-slate-800 p-3 rounded">
            <p className="text-xs text-slate-400 uppercase">Longitude</p>
            <p className="text-sm font-mono text-green-400 mt-1">{satData.lon.toFixed(6)}°</p>
          </div>
          <div className="bg-slate-800 p-3 rounded">
            <p className="text-xs text-slate-400 uppercase">Altitude</p>
            <p className="text-sm font-mono text-green-400 mt-1">{satData.altKm} km</p>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-10">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
              <p className="text-sm text-slate-400 mt-3">Loading satellite imagery...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
            <div className="text-center text-red-400 p-6">
              <p className="font-semibold">Failed to load maps</p>
              <p className="text-sm text-slate-400 mt-2">{error}</p>
              <p className="text-xs text-slate-500 mt-4">
                Check VITE_GOOGLE_MAPS_API_KEY in .env
              </p>
            </div>
          </div>
        )}

        <div ref={mapRef} className="w-full h-[500px]" />
      </div>

      {/* Legend */}
      <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
        <p className="text-xs text-slate-400">
          <span className="font-semibold text-slate-300">Note:</span> Satellite imagery shows ground location 
          directly beneath the ISR satellite at the time of snapshot.
        </p>
      </div>
    </div>
  );
}
