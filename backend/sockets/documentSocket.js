import Document from "../models/DocumentModel.js";
import mongoose from "mongoose";
import Version from "../models/VersionModel.js";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import User from "../models/UserModel.js";

const documentSocket = (io) => {
  io.on("connection",async (socket) => {
    try{
      // parse cookies
      const cookies = cookie.parse(socket.handshake.headers.cookie || "");
      //get token
      const token = cookies.token;
      if(!token){
        socket.disconnect();
        return;
      }
      //verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      //find userId in token
      const userId = decoded.userId;
      const user = await User.findById(userId);
      if(!user){
        socket.disconnect();
        return;
      }
      //Attach user to socket
      socket.user = user;
    } catch (err) {
      console.error('Socket auth error:', err);
      socket.disconnect();
      return;
    }

    console.log("User connected:", socket.id);
    // Join document room
    socket.on("join-document",async (documentId) => {
      try {
        // Validate Mongo ID
        if (!mongoose.Types.ObjectId.isValid(documentId)) {
          return;
        }
        //join room
        socket.join(documentId);
        console.log(`Socket ${socket.id} joined document ${documentId}`);
        // Find document
        const document = await Document.findById(documentId);
        if (!document) {
          socket.emit("document-not-found");
          return;
        }

        // Send existing content
        socket.emit("load-document",document);
      } catch (error) {
        console.error(error);
      }
    });
    // Receive changes
    socket.on("send-changes",(delta, documentId) => {
      // Send to everyone EXCEPT sender
      socket.to(documentId).emit("receive-changes",delta);
    });
    // Save document
    socket.on("save-document",async ({ documentId, content,userId }) => {
      try {
        await Document.findByIdAndUpdate(documentId,{ content });
        // Save version
        const version = new Version({documentId, content, editedBy: userId});
        await version.save();
        console.log("Document saved");
      } catch (error) {
        console.error(error);
      }
    });
    // Handle disconnect
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};
export default documentSocket;
