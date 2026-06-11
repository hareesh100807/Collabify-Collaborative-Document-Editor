import cookie from "cookie";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Document from "../models/DocumentModel.js";
import User from "../models/UserModel.js";
import Version from "../models/VersionModel.js";

const userCanAccessDocument = (document, userId) => {
  if (!document || !userId) return false;

  const normalizedUserId = userId.toString();
  const isOwner = document.owner?.toString() === normalizedUserId;
  const isCollaborator = document.collaborators.some(
    (collaboratorId) => collaboratorId.toString() === normalizedUserId
  );

  return isOwner || isCollaborator;
};

const documentSocket = (io) => {
  const emitActiveUsers = (documentId, excludeSocketId = null) => {
    const room = io.sockets.adapter.rooms.get(documentId);
    const uniqueUsers = new Map();

    if (room) {
      room.forEach((socketId) => {
        if (socketId === excludeSocketId) return;

        const roomSocket = io.sockets.sockets.get(socketId);
        const roomUser = roomSocket?.user;

        if (roomUser?._id) {
          uniqueUsers.set(roomUser._id.toString(), {
            id: roomUser._id,
            username: roomUser.username,
            email: roomUser.email,
          });
        }
      });
    }

    io.to(documentId).emit("active-users", Array.from(uniqueUsers.values()));
  };

  const leaveJoinedDocuments = (socket) => {
    socket.joinedDocuments.forEach((joinedDocumentId) => {
      socket.leave(joinedDocumentId);
      emitActiveUsers(joinedDocumentId, socket.id);
    });
    socket.joinedDocuments.clear();
  };

  io.on("connection", async (socket) => {
    try {
      const cookies = cookie.parse(socket.handshake.headers.cookie || "");
      const token = cookies.token;

      if (!token) {
        socket.disconnect(true);
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select("-password");

      if (!user) {
        socket.disconnect(true);
        return;
      }

      socket.user = user;
      socket.joinedDocuments = new Set();
      console.log("User connected:", socket.id);

      socket.on("join-document", async (documentId) => {
        try {
          leaveJoinedDocuments(socket);

          if (!mongoose.Types.ObjectId.isValid(documentId)) {
            socket.emit("document-not-found");
            return;
          }

          const document = await Document.findById(documentId);
          if (!document) {
            socket.emit("document-not-found");
            return;
          }

          if (!userCanAccessDocument(document, user._id)) {
            socket.emit("not-authorized");
            return;
          }

          socket.join(documentId);
          socket.joinedDocuments.add(documentId);
          socket.emit("load-document", {
            title: document.title || "Untitled Document",
            content: document.content || { ops: [] },
          });
          emitActiveUsers(documentId);
        } catch (error) {
          console.error("Socket join-document error:", error);
          socket.emit("document-not-found");
        }
      });

      socket.on("send-changes", (delta, documentId) => {
        if (!mongoose.Types.ObjectId.isValid(documentId)) return;
        if (!socket.rooms.has(documentId)) return;
        socket.to(documentId).emit("receive-changes", delta);
      });

      socket.on("typing", ({ documentId }) => {
        if (!mongoose.Types.ObjectId.isValid(documentId)) return;
        if (!socket.rooms.has(documentId)) return;
        socket.to(documentId).emit("user-typing", {
          documentId,
          username: user.username,
        });
      });

      socket.on("stop-typing", ({ documentId }) => {
        if (!mongoose.Types.ObjectId.isValid(documentId)) return;
        if (!socket.rooms.has(documentId)) return;
        socket.to(documentId).emit("user-stopped-typing", {
          documentId,
          username: user.username,
        });
      });

      socket.on("save-document", async ({ documentId, content }) => {
        try {
          if (!mongoose.Types.ObjectId.isValid(documentId)) return;
          if (!socket.rooms.has(documentId)) return;

          const document = await Document.findById(documentId);
          if (!userCanAccessDocument(document, user._id)) return;

          document.content = content;
          await document.save();
          await Version.create({
            documentId,
            content,
            editedBy: user._id,
          });

          socket.to(documentId).emit("document-saved", { documentId });
        } catch (error) {
          console.error("Socket save-document error:", error);
        }
      });

      socket.on("disconnecting", () => {
        leaveJoinedDocuments(socket);
      });

      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
      });
    } catch (error) {
      console.error("Socket authentication error:", error);
      socket.disconnect(true);
    }
  });
};

export default documentSocket;
