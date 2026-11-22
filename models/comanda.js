import mongoose from 'mongoose';

const ComandaSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    produse: {
        type: mongoose.Schema.Types.Mixed,
        default: []
    },
    total: {
        type: Number,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    address: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        county: { type: String, required: true },
        zipCode: { type: String, required: true }
    },
    status: {
        type: String,
        enum: ['In asteptare', 'In curs de livrare', 'Livrata'],
        default: 'In asteptare'
    },

    confirmedByClient: {
        type: Boolean,
        default: false
    }
    
}, {
    timestamps: true
});

export default mongoose.model('Comanda', ComandaSchema);