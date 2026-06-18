import Version from '../models/VersionModel.js';
import Document from '../models/DocumentModel.js';
import { createVersionIfChanged, filterDuplicateVersions } from '../utils/versionHistory.js';

const canAccessDocument = (document, userId) => {
    if (!document || !userId) return false;
    const currentUserId = userId.toString();
    const isOwner = document.owner?.toString() === currentUserId;
    const isCollaborator = document.collaborators?.some((collaboratorId) => collaboratorId.toString() === currentUserId);
    return isOwner || isCollaborator;
};

export const isDocumentOwner = (document, userId) => {
    if (!document?.owner || !userId) return false;
    return document.owner.toString() === userId.toString();
};

// Get version history for a document
export const getVersions= async (req, res) => {
    try{
        // Validate document ID
        const { documentId } = req.params;
        // Check if document exists
        const document = await Document.findById(documentId);
        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }
        if (!canAccessDocument(document, req.user._id)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        // Fetch versions, populate editor info, sort by creation date
        const versions = await Version.find({ documentId }).populate('editedBy', 'username email').sort({ createdAt: -1 });
        // Return versions
        res.json({ versions: filterDuplicateVersions(versions) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const restoreVersion = async (req, res) => {
    try {
        const  versionId  = req.params.versionId;
        // Find version
        const version = await Version.findById(versionId);
        if (!version) {
            return res.status(404).json({ message: 'Version not found' });
        }  
        const document = await Document.findById(version.documentId);
        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }
        if (!isDocumentOwner(document, req.user._id)) {
            return res.status(403).json({ message: 'Only the document owner can restore versions' });
        }
        // Update document content
        document.content = version.content;
        await document.save();
        await createVersionIfChanged({
            documentId: document._id,
            content: version.content,
            editedBy: req.user._id
        });
        res.json({ message: 'Document restored to previous version', document });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
