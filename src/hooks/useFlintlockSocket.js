/**
 * useFlintlockSocket Hook
 * Centralized Socket.IO connection management for Operation Flintlock
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export function useFlintlockSocket(sessionId, teamId, teamName) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const listenersRef = useRef(new Map());

  // Initialize socket connection
  useEffect(() => {
    if (!sessionId || !teamId) {
      console.warn('[Socket] Missing sessionId or teamId');
      return;
    }

    console.log(`[Socket] Connecting to ${SOCKET_URL} as ${teamId}`);

    // Create socket instance
    const socket = io(SOCKET_URL, {
      auth: {
      },
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log(`[Socket] Connected: ${socket.id}`);
      setIsConnected(true);
      setError(null);

      // Join session and team rooms
      socket.emit('join', { sessionId, teamId, teamName });
    });

    socket.on('joined', (data) => {
      console.log(`[Socket] Joined successfully:`, data);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      setError(err.message);
      setIsConnected(false);
    });

    socket.on('error', (err) => {
      console.error('[Socket] Error:', err);
      setError(err.message || 'Socket error occurred');
    });

    // Cleanup on unmount
    return () => {
      console.log('[Socket] Cleaning up connection');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, teamId, teamName]);

  // Generic emit function
  const emit = useCallback((event, data) => {
    if (!socketRef.current?.connected) {
      console.warn(`[Socket] Cannot emit ${event}, not connected`);
      return false;
    }

    socketRef.current.emit(event, { sessionId, ...data });
    return true;
  }, [sessionId]);

  // Subscribe to socket events
  const on = useCallback((event, handler) => {
    if (!socketRef.current) {
      console.warn(`[Socket] Cannot subscribe to ${event}, socket not initialized`);
      return () => {};
    }

    socketRef.current.on(event, handler);
    
    // Track listener for cleanup
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, []);
    }
    listenersRef.current.get(event).push(handler);

    // Return unsubscribe function
    return () => {
      socketRef.current?.off(event, handler);
      const listeners = listenersRef.current.get(event);
      if (listeners) {
        const index = listeners.indexOf(handler);
        if (index > -1) listeners.splice(index, 1);
      }
    };
  }, []);

  // Unsubscribe from event
  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  // ========================================
  // SPECIALIZED EMIT FUNCTIONS
  // ========================================

  // Satellite telemetry update (SDA)
  const emitSatelliteUpdate = useCallback((satellites) => {
    return emit('sat:update', { satellites });
  }, [emit]);

  // Request satellite imagery (Intel)
  const requestImagery = useCallback((satId) => {
    console.log(`[Socket] Requesting imagery for ${satId}`);
    return emit('intel:requestImagery', { satId });
  }, [emit]);

  // Send imagery coordinates (SDA)
  const sendImageryCoords = useCallback((satId, lat, lon, altKm, requestedBy) => {
    return emit('sda:imageryCoords', { satId, lat, lon, altKm, requestedBy });
  }, [emit]);

  // SDR spectrum update (EW)
  const emitSdrUpdate = useCallback((spectrumData, waterfallData) => {
    return emit('sdr:update', { spectrumData, waterfallData });
  }, [emit]);

  // Jamming control (EW)
  const emitJammingUpdate = useCallback((isJamming, targetFreq, power) => {
    return emit('jamming:update', { isJamming, targetFreq, power });
  }, [emit]);

  // Mission countdown tick (Admin)
  const emitMissionTick = useCallback((payload) => {
    return emit('mission:tick', payload);
  }, [emit]);

  // Push inject (Admin)
  const pushInject = useCallback((inject) => {
    return emit('inject:push', { inject });
  }, [emit]);

  // Flint file visibility (Admin)
  const updateFlintVisibility = useCallback((filename, visible) => {
    return emit('flint:visibility', { filename, visible });
  }, [emit]);

  // Generic team action
  const emitTeamAction = useCallback((action, payload) => {
    return emit('team:action', { action, payload });
  }, [emit]);

  // Participant status update
  const updateParticipantStatus = useCallback((status) => {
    return emit('participant:update', { teamId, status });
  }, [emit, teamId]);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    
    // Generic functions
    emit,
    on,
    off,
    
    // Specialized functions
    emitSatelliteUpdate,
    requestImagery,
    sendImageryCoords,
    emitSdrUpdate,
    emitJammingUpdate,
    emitMissionTick,
    pushInject,
    updateFlintVisibility,
    emitTeamAction,
    updateParticipantStatus
  };
}
