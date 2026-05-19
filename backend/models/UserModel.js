import mongoose from 'mongoose';
const { Schema, model, models } = mongoose;

const UserSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    email: {
        type: String,   
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
        trim: true,
        select: false, // Exclude password from query results by default
    },
    profilePic: {
        type: String,
        default: '',   
    },
    providers: [
        {
            name: {
                type: String,
                enum: ['local','google'], // Supported providers
            },
            providerId: {
                type: String,
            }
        }
    ]
}, { timestamps: true });
const User = models.User || model('User', UserSchema);

export default User;