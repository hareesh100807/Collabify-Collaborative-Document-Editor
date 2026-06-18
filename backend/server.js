import dotenv from 'dotenv';
import connectDB from './config/db.js';
import app from './app.js';
import http from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/mongo-adapter';
import documentSocket from './sockets/documentSocket.js';

dotenv.config();

const PORT = process.env.PORT || 4000;
const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const dbConnection = await connectDB();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  maxHttpBufferSize: 14 * 1024 * 1024,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: false,
  },
});

const shouldUseMongoAdapter =
  process.env.SOCKET_IO_MONGO_ADAPTER === 'true' ||
  process.env.RENDER === 'true' ||
  Number(process.env.WEB_CONCURRENCY || 1) > 1;

if (shouldUseMongoAdapter) {
  const adapterCollection = dbConnection.getClient().db().collection('socket.io-adapter-events');
  await adapterCollection.createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 3600, background: true }
  );
  io.adapter(createAdapter(adapterCollection, { addCreatedAtField: true }));
  console.log('Socket.IO MongoDB adapter enabled');
}

documentSocket(io);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
