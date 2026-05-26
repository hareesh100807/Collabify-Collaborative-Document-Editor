import Document from '../models/DocumentModel.js';
import User from '../models/UserModel.js';

export const createDocument = async (req, res) => {
    try {
        //get title and content from request body
        const { title, content } = req.body;
        //create a new document
        const document = new Document({ title: title || "Untitled Document", content: content || "", owner: req.user._id });
        //save the document
        await document.save();
        //send response
        res.status(201).json({ message: "Document created successfully", document });
    } catch (error) {
        res.status(500).json({ error: error.message });
        return res.status(500).json({ error: error.message });
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
        const isCollaborator = document.collaborators.some(cId => cId.toString() === req.user._id.toString());
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
        //get document id from request params
        const  id  = req.params.id;
        //find document by id
        const document = await Document.findById(id);
        //check if document exists
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        // check if owner or collaborator
        const isOwner = document.owner.toString() === req.user._id.toString();
        const isCollaborator = document.collaborators.some(cId => cId.toString() === req.user._id.toString());
        if (!isOwner && !isCollaborator) {
            return res.status(403).json({ error: 'Access denied' });
        }
        //find document by id and update
        const updatedDoc = await Document.findByIdAndUpdate(
            id,
            { $set: req.body },
            { new: true }
        );
        //send response
        res.status(200).json({ document: updatedDoc });
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

export const shareDocument = async (req, res) => {
    try {
        const{documentId,email}=req.body;
        //find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        //find document
        const document = await Document.findById(documentId);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        //only owner can share
        if (document.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only owner can share the document' });
        }
        //prevent duplicate sharing
        const alreadyCollaborator=document.collaborators.includes(user._id);
        if(alreadyCollaborator){
            return res.status(400).json({ error: 'User is already a collaborator' });
        }
        //add collaborator
        document.collaborators.push(user._id);
        await document.save();
        res.status(200).json({ message: 'Collaborator added' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}