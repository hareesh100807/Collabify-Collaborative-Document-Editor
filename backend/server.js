import dotenv from 'dotenv';
import connectDB from './config/db.js';
import app from './app.js';

import { createServer } from 'http';
import { Server } from 'socket.io';
import documentSocket from './sockets/documentSocket.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

// Connect to database
connectDB();

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }
});
app.set('io', io);

documentSocket(io);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

