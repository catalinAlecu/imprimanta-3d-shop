const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const app = express();

// Reads port from env file or it takes port 3000
const PORT = process.env.PORT || 3000;


// Database connection
mongoose.connect(process.env.mongo_uri)
    .then (() => console.log("Database connected successfully!"))
    .catch((err) => console.error("Error connecting to MongoDB: ", err));

app.get('/', (req, res) => {
    res.send("Server is working!")
})

app.listen(PORT, () => {
    console.log(`Serverul ruleaza pe portul ${PORT}.`)
})