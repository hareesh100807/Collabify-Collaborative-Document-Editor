import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;

const DocumentSchema = new Schema({
    title: {
        type: String,
        required: true,
        default: 'Untitled Document',
    },
    content: {
        type: Schema.Types.Mixed,
        default: '',
    },
    yjsState: {
        type: Buffer,
        default: null,
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    
    collaborators: [
        {
            type: Schema.Types.ObjectId,
            ref: 'User',
        }
    ],
    pendingCollaborators: [
        {
            type: String,
            lowercase: true,
            trim: true,
        }
    ]
}, { timestamps: true });

const Document = models.Document || model('Document', DocumentSchema);

export default Document;