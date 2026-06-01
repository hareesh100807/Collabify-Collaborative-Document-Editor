import dotenv from 'dotenv';
import connectDB from './config/db.js';
import app from './app.js';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import Document from './models/DocumentModel.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

// Connect to database
connectDB();

// create http server and attach socket.io
const server = http.createServer(app);
const io = new IOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

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

  // Persist document content when client requests save via socket
  socket.on('save-document', async ({ documentId, content }) => {
    try {
      if (!documentId) return;
      await Document.findByIdAndUpdate(documentId, { $set: { content } });
      // notify other clients that document was saved
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

server.listen(PORT, () => {
  console.log(`Server (with socket.io) is running on port ${PORT}`);
});

