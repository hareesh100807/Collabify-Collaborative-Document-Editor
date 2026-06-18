import Document from '../models/DocumentModel.js';
import ShareRequest from '../models/ShareRequestModel.js';
import { isDocumentContentTooLarge } from '../utils/documentContent.js';
import { createVersionIfChanged } from '../utils/versionHistory.js';

export const createDocument = async (req, res) => {
    try {
        //get title and content from request body
        const { title, content } = req.body;
        if (isDocumentContentTooLarge(content)) {
            return res.status(413).json({ error: 'Document content is too large' });
        }
        //create a new document
        const document = new Document({ title: title || "Untitled Document", content: content || "", owner: req.user._id });
        //save the document
        await document.save();
        //send response
        res.status(201).json({ message: "Document created successfully", document });
    } catch (error) {
        // Send a single error response
        console.error('createDocument error', error);
        res.status(500).json({ error: error.message });
    }
}

export const getDocuments = async (req, res) => {
    try {
        //find documents by owner
        const documents = await Document.find({ $or: [{ owner: req.user._id }, { collaborators: req.user._id }] });
        //send response
        res.status(200).json({ documents });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export const getDocumentById = async (req, res) => {
    try {
        //get document id from request params
        const id  = req.params.id;
        //find document by id
        const document = await Document.findById(id);
        //check if document exists
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        // check if owner or collaborator
        const isOwner = document.owner.toString() === req.user._id.toString();
        const isCollaborator = document.collaborators.some(cId => {
            const collabId = cId && cId._id ? cId._id.toString() : cId.toString();
            return collabId === req.user._id.toString();
        });
        if (!isOwner && !isCollaborator) {
            return res.status(403).json({ error: 'Access denied' });
        }
        //send response
        res.status(200).json({ document });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export const updateDocument = async (req, res) => {
    try {
        const id = req.params.id;
        const { content, saveId } = req.body;
        if (content === undefined) {
            return res.status(400).json({ error: 'Document content is required' });
        }
        if (isDocumentContentTooLarge(content)) {
            return res.status(413).json({ error: 'Document content is too large' });
        }

        const document = await Document.findById(id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const isOwner = document.owner.toString() === req.user._id.toString();
        const isCollaborator = document.collaborators.some(cId => {
            const collabId = cId && cId._id ? cId._id.toString() : cId.toString();
            return collabId === req.user._id.toString();
        });
        if (!isOwner && !isCollaborator) {
            return res.status(403).json({ error: 'Access denied' });
        }

        document.content = content;
        await document.save();
        await createVersionIfChanged({
            documentId: document._id,
            content,
            editedBy: req.user._id,
            saveId: typeof saveId === 'string' && saveId.length <= 128 ? saveId : undefined,
        });

        res.status(200).json({ document });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}


export const deleteDocument = async (req, res) => {
    try {
        //get document id from request params
        const id  = req.params.id;
        const  owner  = req.user._id;
        //find document by id and delete
        const document = await Document.findOneAndDelete({ _id: id, owner });
        //check if document exists
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        //send response
        res.status(200).json({ message: 'Document deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export const renameDocument = async (req, res) => {
    try {
        const documentId = req.params.id;
        const nextTitle = (req.body.title || req.body.newTitle || '').trim();
        if (!nextTitle) {
            return res.status(400).json({ error: 'Title is required' });
        }
        //find document
        const document = await Document.findById(documentId);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        //only owner can rename
        if (document.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only owner can rename the document' });
        }
        //update document title
        document.title = nextTitle;
        await document.save();
        res.status(200).json({ message: 'Document renamed successfully', document });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export const getDocumentCollaborators = async (req, res) => {  
    try {
        const documentId = req.params.id;
        //find document
        const document = await Document.findById(documentId).populate('collaborators', 'username email');
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        //only owner or collaborators can view
        const isOwner = document.owner.toString() === req.user._id.toString();
        const isCollaborator = document.collaborators.some(c => {
            const collabId = c && c._id ? c._id.toString() : c.toString();
            return collabId === req.user._id.toString();
        });
        if (!isOwner && !isCollaborator) {
            return res.status(403).json({ error: 'Access denied' });
        }
        let pendingCollaborators = [];
        if (isOwner) {
            const pendingRequests = await ShareRequest.find({
                document: documentId,
                status: 'pending',
                toEmail: { $ne: 'link_share' }
            }).populate('toUser', 'username email');

            pendingCollaborators = pendingRequests.map((request) => ({
                _id: request._id,
                email: request.toUser?.email || request.toEmail,
                username: request.toUser?.username || '',
                status: request.status,
            }));
        }

        res.status(200).json({
            collaborators: document.collaborators,
            pendingCollaborators,
            isOwner,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
