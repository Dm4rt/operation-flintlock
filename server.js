/**
 * Operation Flintlock - Main Server
 * Express + Socket.IO backend for real-time team coordination
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { initializeSockets } from './server/socket.js';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API endpoints (if needed for non-realtime operations)
app.get('/api/status', (req, res) => {
  res.json({ 
    server: 'Operation Flintlock',
    status: 'operational',
    version: '1.0.0'
  });
});

// Initialize Socket.IO
const io = initializeSockets(httpServer);

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   OPERATION FLINTLOCK SERVER          ║
║   Socket.IO + Express                 ║
║   Port: ${PORT}                        ║
║   Environment: ${process.env.NODE_ENV || 'development'}      ║
╚════════════════════════════════════════╝
  `);
});

export { app, httpServer, io };
