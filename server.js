import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']); 
import 'dotenv/config';
import session from 'express-session';
import express from 'express';
import AdminJS, { ComponentLoader } from 'adminjs';
import bcrypt from 'bcryptjs';
import AdminJSExpress from '@adminjs/express';
import * as adminJsMongoose from '@adminjs/mongoose';
import path from 'path';
import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import { fileURLToPath } from 'url';
import uploadFeature, { BaseProvider } from '@adminjs/upload';
import { v2 as cloudinary } from 'cloudinary';
import { sendFirstEmail } from './utils/email.js';

// Models from database
import Imprimanta from './models/imprimanta.js';
import User from './models/user.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
AdminJS.registerAdapter(adminJsMongoose);

const app = express();
app.set('trust proxy', 1);

app.use(express.json());

const MONGO_URI = process.env.mongo_uri || process.env.MONGO_URI;

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI, collectionName: 'user_sessions' })
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

app.get('/models', async (req, res) => {
    try {
        const imprimante = await Imprimanta.find({ disponibil: true });

        res.render('models', { 
            imprimante,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME 
        }); 
    } catch (error) {
        console.error('Eroare la extragerea imprimantelor:', error);
        res.status(500).send('Eroare la încărcarea paginii.');
    }
});

app.get('/imprimanta/:id', async (req, res) => {
    try {
        const imprimantaGasita = await Imprimanta.findById(req.params.id);

        if (!imprimantaGasita) {
            return res.status(404).send('Produsul nu a fost gasit.');
        }

        res.render('imprimanta', { 
            imprimanta: imprimantaGasita,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME
        });

    } catch (error) {
        console.error('Eroare la deschiderea paginii produsului:', error);
        res.status(500).send('Link invalid sau eroare pe server.');
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, turnstileToken } = req.body;

        if (!turnstileToken) {
            return res.status(400).json({ message: 'Te rugam sa bifezi verificarea de securitate!' });
        }

        const verifyFormData = new URLSearchParams();
        verifyFormData.append('secret', process.env.TURNSTILE_SECRET_KEY);
        verifyFormData.append('response', turnstileToken);

        const cfResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: verifyFormData,
        });
        const outcome = await cfResponse.json();

        if (!outcome.success) {
            return res.status(400).json({ message: 'Verificarea anti-bot a eșuat. Reîncearcă!' });
        }

        // 3. Verificăm dacă utilizatorul există deja
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
        await sendFirstEmail(email, username);
        res.status(201).json({ message: 'Cont creat cu succes!' });

    } catch (error) {
        console.error('Eroare la inregistrare:', error);
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
            return res.status(404).json({ message: 'Nu exista niciun cont cu acest email!' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Parolă incorectă!' });
        }

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

mongoose.connect(MONGO_URI)
    .then(() => console.log("Database connected successfully!"))
    .catch((err) => console.error("Error connecting to MongoDB: ", err));

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

class CloudinaryProvider extends BaseProvider {
    constructor() { 
        super('cloudinary'); 
    }

    async upload(file, key) {
        try {
            console.log("Se incearca upload-ul catre Cloudinary pentru:", key);
            const rezultat = await cloudinary.uploader.upload(file.path, { public_id: key });
            console.log("Upload reusit! URL Cloudinary:", rezultat.secure_url);
        } catch (error) {
            console.error("Eroare FATALA la upload Cloudinary:", error);
        }
    }

    async delete(key, bucket) {
        await cloudinary.uploader.destroy(key);
    }

    async path(key, bucket) {
        return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${key}`;
    }
}

const componentLoader = new ComponentLoader();

const admin = new AdminJS({
    databases: [mongoose], 
    componentLoader, 
    resources: [
        {
            resource: Imprimanta,
            options: {
                properties: {
                    detaliiSuplimentare: {
                        type: 'textarea', 
                    }
                }
            },
            features: [
                uploadFeature({
                    componentLoader, 
                    provider: new CloudinaryProvider(),
                    properties: {
                        key: 'imagine', 
                        file: 'Incarca imagine',
                    },
                    uploadPath: (record, filename) => {
                        const numeFaraExtensie = filename.split('.').slice(0, -1).join('.');
                        return `imprimante3d/${record.id()}_${numeFaraExtensie.replace(/\s+/g, '_')}`;
                    }
                })
            ]
        }
    ],
    rootPath: '/admin',
});

app.get('/admin/frontend/assets/components.bundle.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
        window.AdminJS = window.AdminJS || {};
        window.AdminJS.UserComponents = window.AdminJS.UserComponents || {};

        // 1. Componenta pentru formularul de Upload (New / Edit)
        window.AdminJS.UserComponents.UploadEditComponent = function(props) {
            const { property, onChange, record } = props;
            const imagineExistenta = record && record.params && record.params.imagine;

            return React.createElement(
                'div',
                { style: { marginBottom: '20px' } },
                React.createElement(
                    'label',
                    { style: { display: 'block', marginBottom: '8px', fontSize: '12px', color: '#898A9A' } },
                    property.label || 'Încarcă imagine'
                ),
                imagineExistenta ? React.createElement(
                    'div',
                    { style: { marginBottom: '8px', fontSize: '12px', color: '#28a745' } },
                    'Imagine actuală: ' + imagineExistenta
                ) : null,
                React.createElement('input', {
                    type: 'file',
                    accept: 'image/*',
                    onChange: function(e) {
                        if (e.target.files && e.target.files[0]) {
                            onChange(property.name, e.target.files[0]);
                        }
                    },
                    style: {
                        padding: '8px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        width: '100%'
                    }
                })
            );
        };

        // 2. Componenta pentru afișarea în tabel (List)
        window.AdminJS.UserComponents.UploadListComponent = function(props) {
            const { record } = props;
            const filePath = record && record.params && record.params.filePath;
            const imagine = record && record.params && record.params.imagine;

            if (filePath) {
                return React.createElement('img', {
                    src: filePath,
                    alt: 'Produs',
                    style: { height: '40px', width: '40px', objectFit: 'contain', borderRadius: '4px', background: '#fff' }
                });
            }
            return React.createElement('span', null, imagine ? 'Imagine încărcată' : 'Fără imagine');
        };

        // 3. Componenta pentru pagina de detalii produs în AdminJS (Show)
        window.AdminJS.UserComponents.UploadShowComponent = function(props) {
            const { property, record } = props;
            const filePath = record && record.params && record.params.filePath;
            const imagine = record && record.params && record.params.imagine;

            return React.createElement(
                'div',
                { style: { marginBottom: '20px' } },
                React.createElement(
                    'label',
                    { style: { display: 'block', marginBottom: '8px', fontSize: '12px', color: '#898A9A' } },
                    property.label || 'Imagine'
                ),
                filePath ? React.createElement('img', {
                    src: filePath,
                    alt: 'Produs',
                    style: { maxHeight: '150px', objectFit: 'contain', borderRadius: '8px', background: '#fff', padding: '8px', border: '1px solid #eee' }
                }) : React.createElement('span', null, imagine || 'Fără imagine')
            );
        };
    `);
});

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