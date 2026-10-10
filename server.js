import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']); 
import 'dotenv/config';
import session from 'express-session';
import express from 'express';
import AdminJS from 'adminjs';
import bcrypt from 'bcryptjs';
import AdminJSExpress from '@adminjs/express';
import * as adminJsMongoose from '@adminjs/mongoose';
import path from 'path';
import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import { fileURLToPath } from 'url';
// Models from database
import Imprimanta from './models/imprimanta.js';
import User from './models/user.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

AdminJS.registerAdapter(adminJsMongoose);

const app = express();
app.set('trust proxy', 1);

app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); 


app.get('/', (req, res) => {
    res.render('index');
});



app.get('/register', (req, res) => {
    res.render('register', { hideButtons: true });
});

app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({ 
            $or: [{ email: email }, { username: username }] 
        });
        
        if (existingUser) {
            return res.status(400).json({ message: 'Acest email sau nume de utilizator este deja folosit!' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            username,
            email,
            password: hashedPassword
        });
        
        await newUser.save();

        res.status(201).json({ message: 'Cont creat cu succes!' });

    } catch (error) {
        console.error('Eroare la înregistrare:', error);
        res.status(500).json({ message: 'Eroare internă a serverului.' });
    }
});

app.get('/login', (req, res) => {
    res.render('login', { hideButtons: true });
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email: email });
        
        if (!user) {
            return res.status(404).json({ message: 'Nu există niciun cont cu acest email!' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Parolă incorectă!' });
        }

        // User session after login
        req.session.user = {
            id: user._id,
            username: user.username
        };

        res.status(200).json({ message: 'Logare reușită!' });

    } catch (error) {
        console.error('Eroare la logare:', error);
        res.status(500).json({ message: 'Eroare internă a serverului.' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
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