import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;

const versionSchema = new Schema({
    documentId: {
        type: Schema.Types.ObjectId,
        ref: 'Document',
        required: true
    },
    content: {
        type: String, 
        required: true
    },
    editedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {timestamps: true});

const Version = models.Version || model('Version', versionSchema);
export default Version;