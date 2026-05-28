import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import app from './app.js';
import documentSocket from './sockets/documentSocket.js';

dotenv.config();

const PORT = process.env.PORT || 4000;

// Connect to database
connectDB();

// Create HTTP server and attach Socket.IO
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  },
  maxHttpBufferSize: 1e8, // 100 MB to allow embedding large images
});

// Initialize socket handlers
documentSocket(io);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
