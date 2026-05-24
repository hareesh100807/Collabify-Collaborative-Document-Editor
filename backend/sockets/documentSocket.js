import Document from "../models/DocumentModel.js";
import mongoose from "mongoose";
import Version from "../models/VersionModel.js";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import User from "../models/UserModel.js";

const documentSocket = (io) => {
  io.on("connection", async (socket) => {
    try {
      // parse cookies
      const cookies = cookie.parse(socket.handshake.headers.cookie || "");
      const token = cookies.token;
      if (!token) {
        socket.disconnect();
        return;
      }
      // verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
      const user = await User.findById(userId);
      if (!user) {
        socket.disconnect();
        return;
      }
      // Attach user to socket
      socket.user = user;
      console.log("User connected:", socket.id, user.username);

      // Join document room
      socket.on("join-document", async (documentId) => {
        try {
          if (!mongoose.Types.ObjectId.isValid(documentId)) {
            return;
          }
          socket.join(documentId);
          console.log(`Socket ${socket.id} joined document ${documentId}`);

          const document = await Document.findById(documentId);
          if (!document) {
            socket.emit("document-not-found");
            return;
          }
          // Send existing content
          socket.emit("load-document", document);
        } catch (error) {
          console.error("join-document error:", error);
        }
      });

      // Receive changes and broadcast to others in the room
      socket.on("send-changes", (delta, documentId) => {
        socket.to(documentId).emit("receive-changes", delta);
      });

      // Save document (content + title)
      socket.on("save-document", async ({ documentId, content, title }) => {
        try {
          const updateData = { content };
          if (title !== undefined) {
            updateData.title = title;
          }
          await Document.findByIdAndUpdate(documentId, updateData);
        } catch (error) {
          console.error("save-document error:", error);
        }
      });

      // Rename document
      socket.on("rename-document", async ({ documentId, title }) => {
        try {
          await Document.findByIdAndUpdate(documentId, { title });
          // Broadcast new title to all other users in the room
          socket.to(documentId).emit("title-updated", title);
        } catch (error) {
          console.error("rename-document error:", error);
        }
      });

      // Typing indicators
      socket.on("typing", ({ documentId, username }) => {
        socket.to(documentId).emit("user-typing", username);
      });

      socket.on("stop-typing", ({ documentId }) => {
        socket.to(documentId).emit("user-stop-typing");
      });

      // Handle disconnect
      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
      });

    } catch (err) {
      console.error("Socket auth error:", err.message);
      socket.disconnect();
    }
  });
};

export default documentSocket;
