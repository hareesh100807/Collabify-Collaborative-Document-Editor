import dotenv from 'dotenv';
import connectDB from './config/db.js';
import app from './app.js';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import documentSocket from './sockets/documentSocket.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 4000;
const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Connect to database
connectDB();

const server = http.createServer(app);
const io = new IOServer(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

documentSocket(io);

server.listen(PORT, () => {
  console.log(`Server with Socket.io is running on port ${PORT}`);
});
