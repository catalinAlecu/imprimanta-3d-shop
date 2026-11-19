import mongoose from 'mongoose';

const ComandaSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    produse: [
        {
            imprimantaId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Imprimanta'
            },
            marca: String,
            model: String,
            pretUnitar: Number,
            cantitate: Number
        }
    ],
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
    verificata: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['In asteptare', 'Verificata', 'Shipped'],
        default: 'In asteptare'
    }
}, {
    timestamps: true
});

export default mongoose.model('Comanda', ComandaSchema);