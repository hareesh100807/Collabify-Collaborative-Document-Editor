import express from "express";
import {addCollaborator,removeCollaborator} from "../controllers/shareController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const shareRouter = express.Router();

shareRouter.post("/:documentId/collaborators", authMiddleware, addCollaborator);
shareRouter.post("/:documentId/collaborators/remove", authMiddleware, removeCollaborator);

export default shareRouter;