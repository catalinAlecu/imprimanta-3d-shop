// 1. Am schimbat 'require' cu 'import'
import mongoose from 'mongoose';

const schemaImprimanta = new mongoose.Schema({
  marca: {
    type: String,
    required: [true, 'Marca imprimantei este obligatorie (ex: Creality, Prusa)'],
    trim: true
  },
  model: {
    type: String,
    required: [true, 'Modelul este obligatoriu (ex: Ender 3 V2)'],
    trim: true
  },
  tehnologie: {
    type: String,
    enum: ['FDM', 'SLA', 'SLS', 'Alta'],
    required: true
  },
  pret: {
    type: Number,
    required: [true, 'Prețul este obligatoriu'],
    min: [0, 'Prețul nu poate fi negativ']
  },
  stare: {
    type: String,
    enum: ['Nou', 'Utilizat - Ca Nou', 'Utilizat - Urme normale', 'Defect / Piese'],
    default: 'Nou'
  },
  descriere: {
    type: String,
    required: [true, 'Descrierea este necesară pentru a detalia anunțul']
  },
  disponibil: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true 
});

const Imprimanta = mongoose.model('Imprimanta', schemaImprimanta);
export default Imprimanta;