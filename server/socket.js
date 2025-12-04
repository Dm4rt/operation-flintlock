/**
 * Operation Flintlock - Socket.IO Server
 * Handles all real-time communication between teams
 */

import { Server } from 'socket.io';
import { admin } from './firebase-admin.js';

// === NEW BLOCK ===
// Build allowed origins list
const rawOrigins =
  process.env.CORS_ORIGIN ||
  process.env.CLIENT_URL ||
  'http://localhost:5173';

const allowedOrigins = rawOrigins.split(',').map(o => o.trim());
// ==================

export function initializeSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,   // <--- updated
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Middleware: Verify Firebase auth token (optional)
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (token) {
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        socket.userId = decodedToken.uid;
        socket.userEmail = decodedToken.email;
      } catch (error) {
        console.warn('Token verification failed:', error.message);
      }
    }
    
    next();
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join session and team rooms
    socket.on('join', ({ sessionId, teamId, teamName }) => {
      if (!sessionId) {
        socket.emit('error', { message: 'Session ID required' });
        return;
      }

      socket.sessionId = sessionId;
      socket.teamId = teamId;
      socket.teamName = teamName;

      // Join rooms
      socket.join(`session:${sessionId}`);
      socket.join(`session:${sessionId}:team:${teamId}`);

      console.log(`[Socket] ${socket.id} joined session:${sessionId} as ${teamId}`);

      // Notify others in the session
      socket.to(`session:${sessionId}`).emit('team:joined', {
        teamId,
        teamName,
        socketId: socket.id
      });

      socket.emit('joined', { sessionId, teamId });
    });

    // ========================================
    // SATELLITE TELEMETRY (SDA → All)
    // ========================================
    socket.on('sat:update', (data) => {
      const { sessionId, satellites } = data;
      
      if (!sessionId) return;

      // Broadcast to all clients in the session
      io.to(`session:${sessionId}`).emit('sat:update', { satellites });
      
      console.log(`[Socket] Satellite update broadcasted for session:${sessionId}`);
    });

    // ========================================
    // INTEL IMAGERY REQUEST (Intel → SDA)
    // ========================================
    socket.on('intel:requestImagery', async (data) => {
      const { sessionId, satId } = data;
      
      console.log(`[Socket] Intel requesting imagery for ${satId} in session:${sessionId}`);

      // Forward request to SDA team only
      socket.to(`session:${sessionId}:team:sda`).emit('intel:requestImagery', {
        satId,
        requestedBy: socket.id
      });
    });

    // SDA responds with coordinates
    socket.on('sda:imageryCoords', async (data) => {
      const { sessionId, satId, lat, lon, altKm, requestedBy } = data;
      
      console.log(`[Socket] SDA providing coords: (${lat}, ${lon})`);

      // Send coordinates back to the requester (Intel)
      io.to(requestedBy).emit('intel:imageryCoords', {
        satId,
        lat,
        lon,
        altKm,
        timestamp: new Date().toISOString()
      });
    });

    // SDA responds with error (wrong satellite selected, etc.)
    socket.on('sda:imageryError', async (data) => {
      const { sessionId, requestedBy, error } = data;
      
      console.log(`[Socket] SDA imagery error: ${error}`);

      // Send error back to the requester (Intel)
      io.to(requestedBy).emit('intel:imageryError', {
        error,
        timestamp: new Date().toISOString()
      });
    });

    // ========================================
    // SDR SPECTRUM UPDATES (EW → All)
    // ========================================
    socket.on('sdr:update', (data) => {
      const { sessionId, spectrumData, waterfallData } = data;
      
      if (!sessionId) return;

      // Broadcast to all in session
      io.to(`session:${sessionId}`).emit('sdr:update', {
        spectrumData,
        waterfallData,
        timestamp: Date.now()
      });
    });

    // ========================================
    // JAMMING CONTROL (EW → All)
    // ========================================
    socket.on('jamming:update', (data) => {
      const { sessionId, isJamming, targetFreq, power } = data;
      
      console.log(`[Socket] Jamming update: ${isJamming} on ${targetFreq}MHz`);

      io.to(`session:${sessionId}`).emit('jamming:update', {
        isJamming,
        targetFreq,
        power,
        timestamp: Date.now()
      });
    });

    // ========================================
    // MISSION COUNTDOWN (Admin → All)
    // ========================================
    socket.on('mission:tick', (data) => {
      const { sessionId, timeLeft, isRunning, currentRound, totalRounds, roundDurationMinutes } = data;
      
      io.to(`session:${sessionId}`).emit('mission:tick', {
        timeLeft,
        isRunning,
        currentRound,
        totalRounds,
        roundDurationMinutes,
        timestamp: Date.now()
      });
    });

    // ========================================
    // ADMIN INJECTS (Admin → All)
    // ========================================
    socket.on('inject:push', (data) => {
      const { sessionId, inject } = data;
      
      console.log(`[Socket] New inject pushed: ${inject.message}`);

      io.to(`session:${sessionId}`).emit('inject:new', {
        inject,
        timestamp: Date.now()
      });
    });

    // ========================================
    // FLINT FILE VISIBILITY (Admin → Cyber)
    // ========================================
    socket.on('flint:visibility', (data) => {
      const { sessionId, filename, visible } = data;
      
      console.log(`[Socket] Flint file visibility: ${filename} = ${visible}`);

      io.to(`session:${sessionId}:team:cyber`).emit('flint:visibility', {
        filename,
        visible,
        timestamp: Date.now()
      });
    });

    // ========================================
    // TEAM ACTIONS (Any → Session)
    // ========================================
    socket.on('team:action', (data) => {
      const { sessionId, action, payload } = data;
      
      console.log(`[Socket] Team action: ${action} from ${socket.teamId}`);

      io.to(`session:${sessionId}`).emit('team:action', {
        teamId: socket.teamId,
        action,
        payload,
        timestamp: Date.now()
      });
    });

    // ========================================
    // PARTICIPANT STATUS (Any → Session)
    // ========================================
    socket.on('participant:update', (data) => {
      const { sessionId, teamId, status } = data;
      
      io.to(`session:${sessionId}`).emit('participant:update', {
        teamId,
        status,
        socketId: socket.id,
        timestamp: Date.now()
      });
    });

    // ========================================
    // DISCONNECT HANDLER
    // ========================================
    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
      
      if (socket.sessionId && socket.teamId) {
        socket.to(`session:${socket.sessionId}`).emit('team:left', {
          teamId: socket.teamId,
          socketId: socket.id
        });
      }
    });

    // ========================================
    // ERROR HANDLER
    // ========================================
    socket.on('error', (error) => {
      console.error(`[Socket] Error on ${socket.id}:`, error);
    });
  });

  console.log('[Socket.IO] Server initialized');
  
  return io;
}
