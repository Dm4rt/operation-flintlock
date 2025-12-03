/**
 * Operation Flintlock - Main Server
 * Express + Socket.IO backend for real-time team coordination
 */
import dotenv from "dotenv";
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { initializeSockets } from './server/socket.js';


const app = express();
const httpServer = createServer(app);

/**
 * Build allowed origins list from env
 * - CORS_ORIGIN can be a comma-separated list:
 *   e.g. "http://localhost:5173,https://your-app.vercel.app"
 * - Falls back to CLIENT_URL, then localhost for dev
 */
const rawOrigins =
  process.env.CORS_ORIGIN ||
  process.env.CLIENT_URL ||
  'http://localhost:5173';

const allowedOrigins = rawOrigins.split(',').map(o => o.trim());

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser tools (no Origin header) and allowed origins
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);

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
    version: '1.0.0',
  });
});

// Initialize Socket.IO
// (we'll update initializeSockets later so it can also use allowedOrigins)
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
