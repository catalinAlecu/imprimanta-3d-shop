import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    role: {
        type: String,
        enum: ['user', 'gestionar', 'admin'],
        default: 'user'
    },

    phone: { type: String, default: '' },
    address: {
        street: { type: String, default: '' },
        city: { type: String, default: '' },
        county: { type: String, default: '' },
        zipCode: { type: String, default: '' }
    },

    cart: {
        type: mongoose.Schema.Types.Mixed,
        default: []
    }
}, {
    timestamps: true
});

export default mongoose.model('User', UserSchema);