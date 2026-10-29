import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    username: {type: String, required: true, unique: true},
    email :{type: String, required: true, unique: true},
    password: {type: String, required: true},

    // Authorization
    role: {
        type: String,
        enum: ['User', 'Gestionar', 'Admin'],
        default: 'user'
    },

    // Order relevant info
    phone: {type: String, required: true},
    address: {
        street: {type: String, required: true},
        city: {type: String, required: true},
        county: {type: String, requried: true},
        zipCode: {type: String, required: true}
    },

    // Cart for logged in users
    cart: [{
        product: {type: mongoose.Schema.Types.ObjectId, ref: 'Imprimanta'},
        quantity: {type: Number, default: 1}
    }]
},{
        timestamp: true
    }
);

export default mongoose.model('User', UserSchema);