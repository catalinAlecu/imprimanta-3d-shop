import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']); 
import 'dotenv/config';
import express from 'express';
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as adminJsMongoose from '@adminjs/mongoose';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import Imprimanta from './models/imprimanta.js';

AdminJS.registerAdapter(adminJsMongoose);

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.mongo_uri || process.env.MONGO_URI)
    .then(() => console.log("Database connected successfully!"))
    .catch((err) => console.error("Error connecting to MongoDB: ", err));

const admin = new AdminJS({
    databases: [mongoose], 
    rootPath: '/admin',
});

const adminRouter = AdminJSExpress.buildRouter(admin);
app.use(admin.options.rootPath, adminRouter);

app.get('/', (req, res) => {
    res.send("Server is working!");
});

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

export default app;

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Serverul ruleaza local pe portul ${PORT}.`);
    });
}