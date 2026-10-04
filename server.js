require('dotenv').config();

const express = require('express');
const app = express();

// Citire port din fisierul .env sau valoarea 3000
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send("Server is working!")
})

app.listen(PORT, () => {
    console.log(`Serverul ruleaza pe portul ${PORT}.`)
})