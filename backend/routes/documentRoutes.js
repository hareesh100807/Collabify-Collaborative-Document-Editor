import express from 'express';
import { createDocument, getDocuments, getDocumentById, updateDocument, deleteDocument,shareDocument } from '../controllers/documentController.js';
import  authMiddleware  from '../middlewares/authMiddleware.js';

const docRouter = express.Router();
//route to create a new document
docRouter.post('/', authMiddleware, createDocument);
//route to get all documents of the authenticated user
docRouter.get('/', authMiddleware, getDocuments);
//route to get a document by id
docRouter.get('/:id', authMiddleware, getDocumentById);
//route to update a document by id
docRouter.put('/:id', authMiddleware, updateDocument);
//route to delete a document by id
docRouter.delete('/:id', authMiddleware, deleteDocument);
//route to share a document with another user
docRouter.post('/share', authMiddleware, shareDocument);
export default docRouter;
