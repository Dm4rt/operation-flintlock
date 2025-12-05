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
    
    // New inject control system
    socket.on('inject:send', (data) => {
      const { sessionId, team, type, title, description, payload, status = 'active' } = data;
      
      if (!sessionId) {
        console.error('[Socket] ❌ Inject send failed: No sessionId provided');
        return;
      }
      
      console.log(`[Socket] 📡 Inject sent to ${team}: ${type} - ${title}`);
      console.log(`[Socket]    Session: ${sessionId}`);

      const injectData = {
        team,
        type,
        title,
        description,
        payload: payload || {},
        status,
        timestamp: Date.now(),
        sentBy: socket.id
      };

      // Debug: Check what rooms exist
      const teamRoom = `session:${sessionId}:team:${team}`;
      const adminRoom = `session:${sessionId}:team:admin`;
      const sessionRoom = `session:${sessionId}`;
      
      console.log(`[Socket]    Target rooms:`, { teamRoom, adminRoom, sessionRoom });

      // Broadcast to specific team (they will handle the inject logic on frontend)
      io.to(teamRoom).emit('inject:received', injectData);
      console.log(`[Socket]   ✓ Emitted inject:received to ${teamRoom}`);
      
      // Also broadcast to admin for logging
      io.to(adminRoom).emit('inject:log', injectData);
      console.log(`[Socket]   ✓ Emitted inject:log to ${adminRoom}`);
      
      // Broadcast to inject feed (all teams can see inject was sent)
      io.to(sessionRoom).emit('inject:new', injectData);
      console.log(`[Socket]   ✓ Emitted inject:new to ${sessionRoom}`);
    });

    // Legacy inject system (keep for compatibility)
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
    // CYBER REPAIR EW SYSTEMS (Cyber → Resolve Inject)
    // ========================================
    socket.on('cyber:repair-ew', async (data) => {
      const { component } = data;
      const sessionId = socket.sessionId;
      
      if (!sessionId) {
        console.error('[Socket] ❌ Repair failed: No sessionId');
        return;
      }
      
      console.log(`[Socket] 🔧 Cyber attempting repair: ${component}`);

      try {
        const db = admin.firestore();
        const injectsRef = db.collection('sessions').doc(sessionId).collection('injects');
        
        // Find active spectrum-outage inject for EW team
        const snapshot = await injectsRef
          .where('team', '==', 'ew')
          .where('type', '==', 'spectrum-outage')
          .where('status', '==', 'active')
          .get();

        if (snapshot.empty) {
          console.log('[Socket] ⚠️ No active spectrum-outage inject found');
          socket.emit('repair:error', { message: 'No active outage to repair' });
          return;
        }

        const doc = snapshot.docs[0];
        const injectData = doc.data();
        const correctComponent = injectData.payload?.component;

        console.log(`[Socket] 🔍 Found inject:`, {
          docId: doc.id,
          currentStatus: injectData.status,
          correctComponent,
          attemptedComponent: component
        });

        if (component === correctComponent) {
          // Correct component - resolve the inject
          await doc.ref.update({
            status: 'resolved',
            resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            resolvedBy: 'cyber'
          });

          console.log(`[Socket] ✅ Spectrum outage resolved - ${component} repaired correctly`);
          console.log(`[Socket] 📝 Updated document: ${doc.id}`);
          
          // Notify all teams
          io.to(`session:${sessionId}`).emit('inject:resolved', {
            team: 'ew',
            type: 'spectrum-outage',
            resolvedBy: 'cyber',
            component
          });

          socket.emit('repair:success', { 
            message: `${component} repaired successfully!`,
            component 
          });
        } else {
          // Wrong component - send error
          console.log(`[Socket] ❌ Wrong component - tried ${component}, need ${correctComponent}`);
          socket.emit('repair:error', { 
            message: `Repair failed - ${component} is not the problem`,
            attempted: component
          });
        }
      } catch (error) {
        console.error('[Socket] ❌ Repair error:', error);
        socket.emit('repair:error', { message: 'System error during repair' });
      }
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
