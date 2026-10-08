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
import Imprimanta from './models/imprimanta.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

AdminJS.registerAdapter(adminJsMongoose);

const app = express();
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); 

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'))
});

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


export default app;

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Serverul ruleaza local pe portul ${PORT}.`);
    });
}