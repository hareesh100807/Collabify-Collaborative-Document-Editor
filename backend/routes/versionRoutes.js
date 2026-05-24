import express from 'express';
import { getVersions,restoreVersion } from '../controllers/versionController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
const versionRouter = express.Router();

// Get version history for a document
versionRouter.get('/:documentId', authMiddleware, getVersions);

// Restore a specific version
versionRouter.post('/restore/:versionId', authMiddleware, restoreVersion);

export default versionRouter;