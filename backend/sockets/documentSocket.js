import Document from "../models/DocumentModel.js";
import mongoose from "mongoose";
import Version from "../models/VersionModel.js";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import User from "../models/UserModel.js";
import * as Y from 'yjs';
import {getYDoc} from './yjsServer.js';

const activeUsers={};
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
      console.log(`User connected: ${socket.user.username}`);


      // Join document room
      socket.on("join-document",async (documentId) => {
        try {
          // Validate Mongo ID
          if (!mongoose.Types.ObjectId.isValid(documentId)) {
            return;
          }
          
          
          // Find document
          const document = await Document.findById(documentId);
          if (!document) {
            socket.emit("document-not-found");
            return;
          }
          //authorize user
          const isOwner = document.owner.toString() === socket.user._id.toString();
          const isCollaborator = document.collaborators?.some((collaborator) => collaborator.toString() === socket.user._id.toString());
          if (!isOwner && !isCollaborator) {
            socket.emit("not-authorized");
            return;
          }
          //join socket room
          socket.join(documentId);
          //get yjs document state from database
          const ydoc = getYDoc(documentId);
          //restore saved yjs state
          if(document.yjsState){
            Y.applyUpdate(ydoc, new Uint8Array(document.yjsState));
          }
          //active users init
          if (!activeUsers[documentId]) {
              activeUsers[documentId] = [];
          }
          // Check duplicate
          const existingUser = activeUsers[documentId].find((u) => u.userId.toString() === socket.user._id.toString());
          // Add user
          if (!existingUser) {
            activeUsers[documentId].push({
              userId: socket.user._id,
              username: socket.user.username,
              socketId: socket.id,
            });
          }
          
          console.log(`Socket ${socket.id} joined document ${documentId}`);
          //broadcast active users to room
          io.to(documentId).emit("active-users", activeUsers[documentId]);
          // Send existing content
          socket.emit("load-document",document);
          } catch (error) {
            console.error("Join document error:", error);
          }
      }
      );


      // Receive changes
      socket.on("send-changes",(delta, documentId) => {
          // Send to everyone EXCEPT sender
          socket.to(documentId).emit("receive-changes",delta);
        }
      );


  // Save document
      socket.on("save-document",async ({ documentId, content }) => {
          try {
            if (!mongoose.Types.ObjectId.isValid(documentId)) {
              return;
            }
            //find document
            const document = await Document.findById(documentId);
            if (!document) {
              socket.emit("document-not-found");
              return;
            }
            //authorize user
            const isOwner = document.owner.toString() === socket.user._id.toString();
            const isCollaborator = document.collaborators?.some((collaborator) => collaborator.toString() === socket.user._id.toString());
            if (!isOwner && !isCollaborator) {
              socket.emit("not-authorized");
              return;
            }
            //save document content
            if(document.content!== content){
              document.content = content;
              await document.save();
              // Save version
              const version = new Version({documentId, content, editedBy: socket.user._id});
              await version.save();
              console.log("Document saved");
            }
          } catch (error) {
            console.error("Save document error:", error);
          }
        }
      );


  // Handle disconnect
      socket.on("disconnect", () => {
        for (const documentId in activeUsers) {
          activeUsers[documentId] =
            activeUsers[documentId].filter(
              (user) =>
                user.socketId !== socket.id
            );
            //remove empty rooms
            if (activeUsers[documentId].length === 0) {
              delete activeUsers[documentId];
            }
      
      
        io.to(documentId).emit("active-users", activeUsers[documentId]||[]);
        }
      });


  // Typing indicator
      socket.on("typing",({ documentId }) => {
        socket
          .to(documentId)
          .emit("user-typing", socket.user.username);
      });


  // Stop typing indicator
      socket.on("stop-typing",({ documentId }) => {
        socket
          .to(documentId)
          .emit("user-stop-typing", socket.user.username);
      });
  //yjs update handling
      socket.on("yjs-update",({documentId,update}) => {
        try{
          const ydoc = getYDoc(documentId);
          //apply update to ydoc
          Y.applyUpdate(ydoc, new Uint8Array(update));
          //save crdt state to database
          const state = Y.encodeStateAsUpdate(ydoc);
          await Document.findByIdAndUpdate(documentId, {yjsState: Buffer.from(state)});
          //broadcast update to other clients
          socket.to(documentId).emit("yjs-update", {documentId, update});
        }catch(error){
          console.error("Yjs update error:", error);
        }
      });
    }catch(error){
      console.error("Socket authentication error:", error);
      socket.disconnect();
    }    
  });
};
export default documentSocket;