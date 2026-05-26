import express from "express";
import {
    addCollaborator, 
    removeCollaborator, 
    getShareRequests, 
    acceptShareRequest, 
    rejectShareRequest, 
    generateShareLink, 
    handleShareLink
} from "../controllers/shareController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const shareRouter = express.Router();

// Email sharing and management
shareRouter.post("/:documentId/collaborators", authMiddleware, addCollaborator);
shareRouter.post("/:documentId/collaborators/remove", authMiddleware, removeCollaborator);

// Accept / Reject flow
shareRouter.get("/requests", authMiddleware, getShareRequests);
shareRouter.post("/requests/:requestId/accept", authMiddleware, acceptShareRequest);
shareRouter.post("/requests/:requestId/reject", authMiddleware, rejectShareRequest);

// Shareable links
shareRouter.post("/:documentId/link", authMiddleware, generateShareLink);
shareRouter.get("/invite/:token", authMiddleware, handleShareLink);

export default shareRouter;