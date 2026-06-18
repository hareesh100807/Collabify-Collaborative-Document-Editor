import cookie from "cookie";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Document from "../models/DocumentModel.js";
import User from "../models/UserModel.js";
import { isDocumentContentTooLarge } from "../utils/documentContent.js";
import { createVersionIfChanged } from "../utils/versionHistory.js";

const canAccessDocument = (document, userId) => {
  if (!document || !userId) return false;

  const currentUserId = userId.toString();
  const isOwner = document.owner?.toString() === currentUserId;
  const isCollaborator = document.collaborators?.some((collaboratorId) => collaboratorId.toString() === currentUserId);

  return isOwner || isCollaborator;
};

const getActiveUsers = async (io, documentId) => {
  const sockets = await io.in(documentId).fetchSockets();
  const uniqueUsers = new Map();

  sockets.forEach((roomSocket) => {
    const user = roomSocket.data.user;
    if (user?.id) uniqueUsers.set(user.id, user);
  });

  return Array.from(uniqueUsers.values());
};

const broadcastActiveUsers = async (io, documentId) => {
  if (!documentId) return;
  io.to(documentId).emit("active-users", await getActiveUsers(io, documentId));
};

const leaveDocumentRoom = async (io, socket) => {
  const documentId = socket.data.documentId;
  if (!documentId) return;

  socket.leave(documentId);
  socket.data.documentId = null;
  await broadcastActiveUsers(io, documentId);
};

const getJoinedDocumentId = (socket, requestedDocumentId) => {
  const joinedDocumentId = socket.data.documentId;
  if (!joinedDocumentId) return null;
  if (requestedDocumentId && requestedDocumentId !== joinedDocumentId) return null;
  if (!socket.rooms.has(joinedDocumentId)) return null;
  return joinedDocumentId;
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
      socket.data.user = {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
      };

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

          await leaveDocumentRoom(io, socket);
          socket.join(documentId);
          socket.data.documentId = documentId;

          socket.emit("load-document", document);
          await broadcastActiveUsers(io, documentId);
        } catch (error) {
          console.error("join-document error:", error);
          socket.emit("document-error", "Unable to join document");
        }
      });

      socket.on("send-changes", (delta, documentId) => {
        const targetDocumentId = getJoinedDocumentId(socket, documentId);
        if (!targetDocumentId) return;
        socket.to(targetDocumentId).emit("receive-changes", delta);
      });

      socket.on("typing", ({ documentId, username } = {}) => {
        const targetDocumentId = getJoinedDocumentId(socket, documentId);
        if (!targetDocumentId) return;
        socket.to(targetDocumentId).emit("user-typing", {
          username: username || socket.user.username,
        });
      });

      socket.on("stop-typing", ({ documentId, username } = {}) => {
        const targetDocumentId = getJoinedDocumentId(socket, documentId);
        if (!targetDocumentId) return;
        socket.to(targetDocumentId).emit("user-stop-typing", {
          username: username || socket.user.username,
        });
      });

      socket.on("save-document", async ({ documentId, content, saveId } = {}) => {
        try {
          const targetDocumentId = getJoinedDocumentId(socket, documentId);
          if (!targetDocumentId || !mongoose.Types.ObjectId.isValid(targetDocumentId)) return;
          if (isDocumentContentTooLarge(content)) {
            socket.emit("save-error", "Document content is too large");
            return;
          }

          const document = await Document.findById(targetDocumentId);
          if (!document || !canAccessDocument(document, socket.user._id)) return;

          document.content = content;
          await document.save();

          await createVersionIfChanged({
            documentId: targetDocumentId,
            content,
            editedBy: socket.user._id,
            saveId: typeof saveId === "string" && saveId.length <= 128 ? saveId : undefined,
          });
        } catch (error) {
          console.error("save-document error:", error);
        }
      });

      socket.on("disconnect", async () => {
        const documentId = socket.data.documentId;
        socket.data.documentId = null;
        await broadcastActiveUsers(io, documentId);
      });
    } catch (error) {
      console.error("socket authentication error:", error);
      socket.emit("not-authorized");
      socket.disconnect(true);
    }
  });
};

export default documentSocket;
