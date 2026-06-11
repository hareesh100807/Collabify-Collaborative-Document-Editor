import crypto from 'crypto';
import Document from "../models/DocumentModel.js";
import User from "../models/UserModel.js";
import ShareRequest from "../models/ShareRequestModel.js";
import { sendShareNotification, sendInviteToUnregistered, sendRejectionNotification } from "../utils/emailService.js";

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const hasCollaborator = (document, userId) => (
    Boolean(document?.collaborators?.some((collaboratorId) => collaboratorId.toString() === userId.toString()))
);

// Add collaborator via email
export const addCollaborator = async (req, res) => {
    try {
        const { documentId } = req.params;
        const email = normalizeEmail(req.body.email);
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }
        
        const document = await Document.findById(documentId).populate('owner');
        if (!document) {
            return res.status(404).json({ message: "Document not found" });
        }
        
        if (document.owner._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const collaborator = await User.findOne({ email });

        if (collaborator) {
            // Already a collaborator
            if (hasCollaborator(document, collaborator._id)) {
                return res.status(400).json({ message: "User is already a collaborator" });
            }
            
            // Check for existing pending request
            const existingRequest = await ShareRequest.findOne({
                document: documentId,
                toUser: collaborator._id,
                status: 'pending'
            });
            
            if (existingRequest) {
                return res.status(400).json({ message: "Invitation already sent" });
            }

            // Create share request
            await ShareRequest.create({
                document: documentId,
                fromUser: req.user._id,
                toUser: collaborator._id,
                toEmail: email,
                status: 'pending'
            });

            // Send email
            await sendShareNotification(email, document.owner.username, document.title);
            
            return res.status(200).json({ message: "Invitation sent! They will see it in their dashboard." });
        } else {
            // Unregistered user
            if (document.pendingCollaborators.includes(email)) {
                return res.status(400).json({ message: "Invitation already sent" });
            }

            document.pendingCollaborators.push(email);
            await document.save();

            // Send email
            const registerLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?next=/documents/${documentId}`;
            await sendInviteToUnregistered(email, document.owner.username, document.title, registerLink);

            return res.status(200).json({ message: "Invitation sent! They'll get access when they register." });
        }
    } catch (error) {
        console.error("Add collaborator error:", error);
        res.status(500).json({ message: error.message || "Server error" });
    }
};

export const removeCollaborator = async (req, res) => {
    try {
        const { documentId } = req.params;
        const email = normalizeEmail(req.body.email);
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }
        
        const document = await Document.findById(documentId);
        if (!document) {
            return res.status(404).json({ message: "Document not found" });
        }
        
        if (document.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized" });
        }
        
        const collaborator = await User.findOne({ email });
        
        if (collaborator) {
            document.collaborators = document.collaborators.filter(
                (id) => id.toString() !== collaborator._id.toString()
            );
        } else {
            // Also check pending collaborators
            document.pendingCollaborators = document.pendingCollaborators.filter(
                (pendingEmail) => pendingEmail !== email
            );
        }
        
        await document.save();
        res.status(200).json({ message: "Collaborator removed successfully" });
    } catch (error) {
        console.error("Remove collaborator error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get pending share requests for the logged-in user
export const getShareRequests = async (req, res) => {
    try {
        const requests = await ShareRequest.find({
            toUser: req.user._id,
            status: 'pending'
        }).populate('document', 'title').populate('fromUser', 'username email');
        
        res.status(200).json({ requests });
    } catch (error) {
        console.error("Get share requests error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Accept share request
export const acceptShareRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const request = await ShareRequest.findById(requestId);
        
        if (!request || request.status !== 'pending' || request.toUser.toString() !== req.user._id.toString()) {
            return res.status(404).json({ message: "Request not found or unauthorized" });
        }
        
        const document = await Document.findById(request.document);
        if (document && !hasCollaborator(document, req.user._id)) {
            document.collaborators.push(req.user._id);
            await document.save();
        }
        
        request.status = 'accepted';
        await request.save();
        
        res.status(200).json({ message: "Invitation accepted" });
    } catch (error) {
        console.error("Accept share request error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Reject share request
export const rejectShareRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const request = await ShareRequest.findById(requestId).populate('fromUser').populate('document');
        
        if (!request || request.status !== 'pending' || request.toUser.toString() !== req.user._id.toString()) {
            return res.status(404).json({ message: "Request not found or unauthorized" });
        }
        
        request.status = 'rejected';
        await request.save();
        
        // Notify owner
        if (request.fromUser && request.document) {
            await sendRejectionNotification(request.fromUser.email, req.user.username, request.document.title);
        }
        
        res.status(200).json({ message: "Invitation rejected" });
    } catch (error) {
        console.error("Reject share request error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Generate share link
export const generateShareLink = async (req, res) => {
    try {
        const { documentId } = req.params;
        
        const document = await Document.findById(documentId);
        if (!document) return res.status(404).json({ message: "Document not found" });
        
        if (document.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized" });
        }
        
        const shareToken = crypto.randomBytes(16).toString('hex');
        
        await ShareRequest.create({
            document: documentId,
            fromUser: req.user._id,
            toEmail: 'link_share',
            status: 'pending',
            shareToken
        });
        
        const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/${shareToken}`;
        res.status(200).json({ link });
    } catch (error) {
        console.error("Generate share link error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Handle share link
export const handleShareLink = async (req, res) => {
    try {
        const { token } = req.params;
        const request = await ShareRequest.findOne({ shareToken: token, status: 'pending' }).populate('document', 'title');
        
        if (!request) {
            return res.status(404).json({ message: "Invalid or expired link" });
        }
        
        // If owner opened link, just redirect to doc
        if (request.fromUser.toString() === req.user._id.toString()) {
            return res.status(200).json({ documentId: request.document._id });
        }
        
        // If already collaborator
        const document = await Document.findById(request.document._id);
        if (!document) {
            return res.status(404).json({ message: "Document not found" });
        }
        if (hasCollaborator(document, req.user._id)) {
            return res.status(200).json({ documentId: request.document._id });
        }

        // Link opened by someone else -> Add them as collaborator immediately or create pending request for them
        // Let's create a specific pending request for them to accept/reject, or auto-accept since they clicked the link.
        // It's a link share, so they want access. Let's add them directly.
        document.collaborators.push(req.user._id);
        await document.save();
        
        res.status(200).json({ message: "Added as collaborator", documentId: document._id });
    } catch (error) {
        console.error("Handle share link error:", error);
        res.status(500).json({ message: "Server error" });
    }
};
