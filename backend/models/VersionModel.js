import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;

const versionSchema = new Schema({
    documentId: {
        type: Schema.Types.ObjectId,
        ref: 'Document',
        required: true
    },
    content: {
        type: Schema.Types.Mixed, 
        required: true
    },
    editedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    saveId: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    }
}, {timestamps: true});

const Version = models.Version || model('Version', versionSchema);
export default Version;
