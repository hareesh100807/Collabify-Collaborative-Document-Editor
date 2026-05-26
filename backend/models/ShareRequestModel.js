import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;

const ShareRequestSchema = new Schema({
    document: {
        type: Schema.Types.ObjectId,
        ref: 'Document',
        required: true,
    },
    fromUser: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    toUser: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null, // Null if the user hasn't registered yet
    },
    toEmail: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending',
    },
    shareToken: {
        type: String,
        unique: true,
        sparse: true, // Allow nulls without breaking uniqueness
    }
}, { timestamps: true });

const ShareRequest = models.ShareRequest || model('ShareRequest', ShareRequestSchema);

export default ShareRequest;
