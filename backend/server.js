import http from 'http';
import { Server as IOServer } from 'socket.io';
import documentSocket from './sockets/documentSocket.js';

import dotenv from 'dotenv';
import connectDB from './config/db.js';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 4000;

// Connect to database
connectDB();

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = new IOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Initialize document socket handlers
documentSocket(io);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

