import Document from "../models/DocumentModel.js";
import User from "../models/UserModel.js";

export const addCollaborator = async (req, res) => {
    try {
        const { documentId } = req.params;
        const{email} = req.body;
        //find document
        const document = await Document.findById(documentId);
        if (!document) {
            return res.status(404).json({ message: "Document not found" });
        }
        //check if user is owner
        if (document.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized" });
        }
        //find collaborator by email
        const collaborator = await User.findOne({ email });
        if (!collaborator) {
            return res.status(404).json({ message: "User not found" });
        }
        //avoid duplicates
        const alreadyExists = document.collaborators?.some((id) => id.toString() === collaborator._id.toString());
        if (alreadyExists) {
            return res.status(400).json({ message: "User is already a collaborator" });
        }
        document.collaborators.push(collaborator._id);
        await document.save();
        res.status(200).json({ message: "Collaborator added successfully", collaborator: {id: collaborator._id, username: collaborator.username, email: collaborator.email} });
    } catch (error) {
        console.error("Add collaborator error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const removeCollaborator = async (req, res) => {
    try {
        const { documentId } = req.params;
        const{email} = req.body;
        //find document
        const document = await Document.findById(documentId);
        if (!document) {
            return res.status(404).json({ message: "Document not found" });
        }
        //check if user is owner
        if (document.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized" });
        }
        //find collaborator by email
        const collaborator = await User.findOne({ email });
        if (!collaborator) {
            return res.status(404).json({ message: "User not found" });
        }
        //remove collaborator
        document.collaborators = document.collaborators.filter((id) => id.toString() !== collaborator._id.toString());
        await document.save();
        res.status(200).json({ message: "Collaborator removed successfully" });
    } catch (error) {
        console.error("Remove collaborator error:", error);
        res.status(500).json({ message: "Server error" });
    }
};