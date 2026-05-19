import Version from '../models/versionModel.js';
import Document from '../models/documentModel.js';

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
        // Fetch versions, populate editor info, sort by creation date
        const versions = await Version.find({ documentId }).populate('editedBy', 'username').sort({ createdAt: -1 });
        // Return versions
        res.json(versions);
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
        // Update document content
        await Document.findByIdAndUpdate(version.documentId, { content: version.content });
        res.json({ message: 'Document restored to previous version' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};