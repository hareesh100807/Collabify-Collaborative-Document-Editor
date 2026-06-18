import crypto from 'crypto';
import Document from "../models/DocumentModel.js";
import User from "../models/UserModel.js";
import ShareRequest from "../models/ShareRequestModel.js";
import { sendShareNotification, sendInviteToUnregistered, sendRejectionNotification } from "../utils/emailService.js";
import { getFrontendBaseUrl } from "../utils/frontendUrl.js";

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const hasCollaborator = (document, userId) => (
    Boolean(document?.collaborators?.some((collaboratorId) => collaboratorId.toString() === userId.toString()))
);

const sendEmailWithoutBlockingInvite = async (sendEmail) => {
    try {
        await sendEmail();
    } catch (error) {
        console.error("Invitation email failed:", error.message);
    }
};

const syncPendingRequestsForUser = async (user) => {
    const email = normalizeEmail(user?.email);
    if (!email || !user?._id) return;

    await ShareRequest.updateMany(
        {
            toUser: null,
            toEmail: email,
            status: 'pending'
        },
        { $set: { toUser: user._id } }
    );

    const legacyPendingDocuments = await Document.find({ pendingCollaborators: email }).select('_id owner');

    await Promise.all(
        legacyPendingDocuments.map(async (document) => {
            const existingRequest = await ShareRequest.findOne({
                document: document._id,
                status: 'pending',
                $or: [
                    { toUser: user._id },
                    { toEmail: email }
                ]
            });

            if (!existingRequest) {
                await ShareRequest.create({
                    document: document._id,
                    fromUser: document.owner,
                    toUser: user._id,
                    toEmail: email,
                    status: 'pending'
                });
            }
        })
    );
};

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
            if (document.owner._id.toString() === collaborator._id.toString()) {
                return res.status(400).json({ message: "You cannot invite yourself" });
            }

            // Already a collaborator
            if (hasCollaborator(document, collaborator._id)) {
                return res.status(400).json({ message: "User is already a collaborator" });
            }
            
            // Check for existing pending request
            const existingRequest = await ShareRequest.findOne({
                document: documentId,
                status: 'pending',
                $or: [
                    { toUser: collaborator._id },
                    { toEmail: email }
                ]
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
            await sendEmailWithoutBlockingInvite(() => sendShareNotification(email, document.owner.username, document.title));
            
            return res.status(200).json({ message: "Invitation sent! They will see it in their dashboard." });
        } else {
            // Unregistered user
            const existingRequest = await ShareRequest.findOne({
                document: documentId,
                toEmail: email,
                status: 'pending'
            });

            if (existingRequest || document.pendingCollaborators.includes(email)) {
                return res.status(400).json({ message: "Invitation already sent" });
            }

            document.pendingCollaborators.push(email);
            await document.save();

            await ShareRequest.create({
                document: documentId,
                fromUser: req.user._id,
                toEmail: email,
                status: 'pending'
            });

            // Send email
            const registerLink = `${getFrontendBaseUrl()}/register?next=/dashboard`;
            await sendEmailWithoutBlockingInvite(() => sendInviteToUnregistered(email, document.owner.username, document.title, registerLink));

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
        }

        document.pendingCollaborators = document.pendingCollaborators.filter(
            (pendingEmail) => normalizeEmail(pendingEmail) !== email
        );

        await ShareRequest.deleteMany({
            document: documentId,
            $or: [
                { toEmail: email },
                ...(collaborator ? [{ toUser: collaborator._id }] : [])
            ]
        });

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
        const email = normalizeEmail(req.user.email);
        await syncPendingRequestsForUser(req.user);

        const requests = await ShareRequest.find({
            status: 'pending',
            $or: [
                { toUser: req.user._id },
                { toEmail: email }
            ]
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
        const email = normalizeEmail(req.user.email);
        const request = await ShareRequest.findById(requestId);
        
        const isTargetUser = request?.toUser?.toString() === req.user._id.toString();
        const isTargetEmail = normalizeEmail(request?.toEmail) === email;

        if (!request || request.status !== 'pending' || (!isTargetUser && !isTargetEmail)) {
            return res.status(404).json({ message: "Request not found or unauthorized" });
        }
        
        const document = await Document.findById(request.document);
        if (document && !hasCollaborator(document, req.user._id)) {
            document.collaborators.push(req.user._id);
            document.pendingCollaborators = document.pendingCollaborators.filter(
                (pendingEmail) => normalizeEmail(pendingEmail) !== email
            );
            await document.save();
        }
        
        request.toUser = req.user._id;
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
        const email = normalizeEmail(req.user.email);
        const request = await ShareRequest.findById(requestId).populate('fromUser').populate('document');
        
        const isTargetUser = request?.toUser?.toString() === req.user._id.toString();
        const isTargetEmail = normalizeEmail(request?.toEmail) === email;

        if (!request || request.status !== 'pending' || (!isTargetUser && !isTargetEmail)) {
            return res.status(404).json({ message: "Request not found or unauthorized" });
        }
        
        if (request.document?._id) {
            await Document.findByIdAndUpdate(request.document._id, {
                $pull: { pendingCollaborators: email }
            });
        }

        request.toUser = req.user._id;
        request.status = 'rejected';
        await request.save();
        
        // Notify owner
        if (request.fromUser && request.document) {
            await sendEmailWithoutBlockingInvite(() => sendRejectionNotification(request.fromUser.email, req.user.username, request.document.title));
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
        
        const link = `${getFrontendBaseUrl()}/invite/${shareToken}`;
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
