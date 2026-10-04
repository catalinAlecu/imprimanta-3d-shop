const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // ESERVFAIL error fix
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const app = express();
app.use(express.json());
app.use(express.static('public'));

// Reads port from env file or it takes port 3000
const PORT = process.env.PORT || 3000;


// Database connection
mongoose.connect(process.env.mongo_uri)
    .then (() => console.log("Database connected successfully!"))
    .catch((err) => console.error("Error connecting to MongoDB: ", err));

// Database models
const Imprimanta = require('./models/imprimanta');

app.get('/', (req, res) => {
    res.send("Server is working!")
})


// API
app.post('/api/imprimante', async (req, res) => {
  try {
    const imprimantaNoua = new Imprimanta(req.body); 
    const imprimantaSalvata = await imprimantaNoua.save(); 
    res.status(201).json(imprimantaSalvata); 
  } catch (eroare) {
    res.status(400).json({ mesaj: 'Eroare la salvare', detalii: eroare.message });
  }
});

app.get('/api/imprimante', async (req, res) => {
    try {
        const toateImprimantele = await Imprimanta.find();
        res.status(200).json(toateImprimantele);
    } catch (error) {
        res.status(500).json({message: "Could not retreive data", details: error.message});
    }
});



app.listen(PORT, () => {
    console.log(`Serverul ruleaza pe portul ${PORT}.`)
})