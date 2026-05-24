import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import app from './app.js';
import documentSocket from './sockets/documentSocket.js';

const PORT = process.env.PORT || 4000;

// Create HTTP server wrapping the Express app
const httpServer = createServer(app);

// Attach Socket.io to the HTTP server
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  },
});

// Wire up socket event handlers
documentSocket(io);

// Connect to database, then start server
connectDB();

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});