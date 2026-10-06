import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']); 
import 'dotenv/config';
import express from 'express';
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as adminJsMongoose from '@adminjs/mongoose';
import path from 'path';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import Imprimanta from './models/imprimanta.js';

AdminJS.registerAdapter(adminJsMongoose);

const app = express();
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.mongo_uri || process.env.MONGO_URI)
    .then(() => console.log("Database connected successfully!"))
    .catch((err) => console.error("Error connecting to MongoDB: ", err));

const admin = new AdminJS({
    databases: [mongoose], 
    rootPath: '/admin',
});


const MONGO_URI = process.env.mongo_uri || process.env.MONGO_URI;

const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
        authenticate: async (email, password) => {
            if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return null;
            if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
                return { email };
            }
            return null;
        },
        cookieName: 'adminjs',
        cookiePassword: process.env.COOKIE_SECRET,
    },
    null,
    {
        store: MongoStore.create({ mongoUrl: MONGO_URI, collectionName: 'sessions' }),
        resave: false,
        saveUninitialized: false,
        secret: process.env.COOKIE_SECRET,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 1000 * 60 * 60 * 8,
        },
    }
);
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