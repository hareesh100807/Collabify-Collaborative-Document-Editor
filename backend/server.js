import dotenv from 'dotenv';
import connectDB from './config/db.js';
import app from './app.js';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import Document from './models/DocumentModel.js';

dotenv.config();

const START_PORT = Number(process.env.PORT) || 5000;
const MAX_ATTEMPTS = 5;

// Connect to database
connectDB();

// configure allowed origins for socket.io (keep in sync with app.js FRONTEND_URLS / FRONTEND_URL)
const _frontendUrls = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:5174';
const allowedOrigins = _frontendUrls.split(',').map(s => s.trim()).filter(Boolean);

// socket handlers registration helper
const registerSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    
    socket.on('join-document', async (documentId) => {
      socket.join(`document:${documentId}`);
      try {
        const doc = await Document.findById(documentId).lean();
        if (doc) {
          socket.emit('load-document', { title: doc.title || 'Untitled Document', content: doc.content || { ops: [] } });
        } else {
          socket.emit('load-document', { title: 'Untitled Document', content: { ops: [] } });
        }
      } catch (err) {
        console.error('Error loading document for socket join:', err);
        socket.emit('load-document', { title: 'Untitled Document', content: { ops: [] } });
      }
    });

    socket.on('send-changes', (delta, documentId) => {
      socket.to(`document:${documentId}`).emit('receive-changes', delta);
    });

    socket.on('save-document', async ({ documentId, content }) => {
      try {
        if (!documentId) return;
        await Document.findByIdAndUpdate(documentId, { $set: { content } });
        socket.to(`document:${documentId}`).emit('document-saved', { documentId });
      } catch (err) {
        console.error('Error saving document via socket:', err);
      }
    });

    socket.on('typing', (payload) => {
      socket.to(`document:${payload.documentId}`).emit('user-typing', payload);
    });

    socket.on('stop-typing', (payload) => {
      socket.to(`document:${payload.documentId}`).emit('user-stopped-typing', payload);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });
};

// Try starting a fresh server on the given port. If the port is in use, try the next port.
const tryStart = async (port, attemptsLeft) => {
  const server = http.createServer(app);
  const io = new IOServer(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    }
  });

  // Register handlers on this io instance
  registerSocketHandlers(io);

  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      // Clean up io listeners to avoid leaks
      try { io.removeAllListeners(); } catch (e) {}
      try { server.close(); } catch (e) {}

      if (err.code === 'EADDRINUSE') {
        if (attemptsLeft > 0) {
          const nextPort = Number(port) + 1;
          console.warn(`Port ${port} is in use, retrying on port ${nextPort} (attempts left: ${attemptsLeft - 1})`);
          // resolve with null to indicate caller should retry
          resolve({ retry: true, nextPort });
          return;
        }
      }

      // For other errors or no attempts left, reject
      reject(err);
    });

    server.listen(port, () => {
      console.log(`Server (with socket.io) is running on port ${port}`);
      resolve({ retry: false, port, server, io });
    });
  });
};

// Sequentially attempt to start server up to MAX_ATTEMPTS
const startServer = async () => {
  let port = START_PORT;
  let attemptsLeft = MAX_ATTEMPTS;

  while (attemptsLeft > 0) {
    try {
      const result = await tryStart(port, attemptsLeft);
      if (result && result.retry) {
        port = result.nextPort;
        attemptsLeft -= 1;
        continue;
      }
      // started successfully
      return result;
    } catch (err) {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
  }

  console.error(`All ${MAX_ATTEMPTS} attempts failed. Could not start server.`);
  process.exit(1);
};

startServer();

