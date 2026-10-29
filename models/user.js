import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    username: {type: String, required: true, unique: true},
    email: {type: String, required: true, unique: true},
    password: {type: String, required: true},

    role: {
        type: String,
        enum: ['user', 'gestionar', 'admin'],
        default: 'user'
    },

    phone: {type: String, required: true},
    address: {
        street: {type: String, required: true},
        city: {type: String, required: true},
        county: {type: String, required: true},
        zipCode: {type: String, required: true}
    },

    cart: { 
        type: mongoose.Schema.Types.Mixed, 
        default: [] 
    }
    
}, {
    timestamps: true
});

export default mongoose.model('User', UserSchema);