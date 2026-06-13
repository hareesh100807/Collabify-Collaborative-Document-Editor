import cookie from "cookie";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Document from "../models/DocumentModel.js";
import User from "../models/UserModel.js";
import { createVersionIfChanged } from "../utils/versionHistory.js";

const roomUsers = new Map();

const canAccessDocument = (document, userId) => {
  if (!document || !userId) return false;

  const currentUserId = userId.toString();
  const isOwner = document.owner?.toString() === currentUserId;
  const isCollaborator = document.collaborators?.some((collaboratorId) => collaboratorId.toString() === currentUserId);

  return isOwner || isCollaborator;
};

const getActiveUsers = (documentId) => {
  const users = roomUsers.get(documentId);
  if (!users) return [];

  const uniqueUsers = new Map();
  users.forEach((user) => {
    if (user?.id) uniqueUsers.set(user.id, user);
  });

  return Array.from(uniqueUsers.values());
};

const addActiveUser = (documentId, socket) => {
  if (!roomUsers.has(documentId)) {
    roomUsers.set(documentId, new Map());
  }

  roomUsers.get(documentId).set(socket.id, {
    id: socket.user._id.toString(),
    username: socket.user.username,
    email: socket.user.email,
  });
};

const removeActiveUser = (documentId, socket) => {
  const users = roomUsers.get(documentId);
  if (!users) return;

  users.delete(socket.id);
  if (users.size === 0) {
    roomUsers.delete(documentId);
  }
};

const leaveDocumentRoom = (io, socket) => {
  const documentId = socket.data.documentId;
  if (!documentId) return;

  removeActiveUser(documentId, socket);
  socket.leave(documentId);
  socket.to(documentId).emit("active-users", getActiveUsers(documentId));
  socket.data.documentId = null;
};

const authenticateSocket = async (socket) => {
  const cookies = cookie.parse(socket.handshake.headers.cookie || "");
  const token = cookies.token;

  if (!token) return null;

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return User.findById(decoded.userId).select("-password");
};

const documentSocket = (io) => {
  io.on("connection", async (socket) => {
    try {
      const user = await authenticateSocket(socket);

      if (!user) {
        socket.emit("not-authorized");
        socket.disconnect(true);
        return;
      }

      socket.user = user;

      socket.on("join-document", async (documentId) => {
        try {
          if (!mongoose.Types.ObjectId.isValid(documentId)) {
            socket.emit("document-not-found");
            return;
          }

          const document = await Document.findById(documentId);
          if (!document) {
            socket.emit("document-not-found");
            return;
          }

          if (!canAccessDocument(document, socket.user._id)) {
            socket.emit("not-authorized");
            return;
          }

          leaveDocumentRoom(io, socket);
          socket.join(documentId);
          socket.data.documentId = documentId;
          addActiveUser(documentId, socket);

          socket.emit("load-document", document);
          io.to(documentId).emit("active-users", getActiveUsers(documentId));
        } catch (error) {
          console.error("join-document error:", error);
          socket.emit("document-error", "Unable to join document");
        }
      });

      socket.on("send-changes", (delta, documentId) => {
        const targetDocumentId = documentId || socket.data.documentId;
        if (!targetDocumentId) return;
        socket.to(targetDocumentId).emit("receive-changes", delta);
      });

      socket.on("typing", ({ documentId, username }) => {
        const targetDocumentId = documentId || socket.data.documentId;
        if (!targetDocumentId) return;
        socket.to(targetDocumentId).emit("user-typing", {
          username: username || socket.user.username,
        });
      });

      socket.on("stop-typing", ({ documentId, username }) => {
        const targetDocumentId = documentId || socket.data.documentId;
        if (!targetDocumentId) return;
        socket.to(targetDocumentId).emit("user-stop-typing", {
          username: username || socket.user.username,
        });
      });

      socket.on("save-document", async ({ documentId, content }) => {
        try {
          if (!mongoose.Types.ObjectId.isValid(documentId)) return;

          const document = await Document.findById(documentId);
          if (!document || !canAccessDocument(document, socket.user._id)) return;

          document.content = content;
          await document.save();

          await createVersionIfChanged({
            documentId,
            content,
            editedBy: socket.user._id,
          });
        } catch (error) {
          console.error("save-document error:", error);
        }
      });

      socket.on("disconnect", () => {
        leaveDocumentRoom(io, socket);
      });
    } catch (error) {
      console.error("socket authentication error:", error);
      socket.emit("not-authorized");
      socket.disconnect(true);
    }
  });
};

export default documentSocket;
