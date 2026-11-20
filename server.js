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
import { Category } from './models/categorie.js';
import Comanda from './models/comanda.js';

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
    saveUninitialized: true,
    store: MongoStore.create({ mongoUrl: MONGO_URI, collectionName: 'user_sessions' })
}));

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.cart = req.session.cart || { totalItems: 0, items: {} };
    res.locals.cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/register', (req, res) => {
    res.render('register', { hideButtons: false });
});

app.get('/models', async (req, res) => {
    try {
        const categorieSelectata = (req.query.categorie || '').trim();
        const filtru = { disponibil: true };
        let categorieActiva = null;

        const categorii = await Category.find().sort({ name: 1 }).lean();

        if (categorieSelectata) {
            const mapareRegex = {
                fdm: /fdm/i,
                sla: /sla|r[aă][sș]in[aă]|resin/i,
                industrial: /industrial/i
            };

            const cheie = categorieSelectata.toLowerCase();
            const regexCautare = mapareRegex[cheie]
                || new RegExp(categorieSelectata.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

            categorieActiva = categorii.find(cat => regexCautare.test(cat.name)) || null;
            if (categorieActiva) {
                filtru.categorie = categorieActiva._id;
            } else {
                return res.render('models', {
                    imprimante: [],
                    categorii,
                    categorieActiva: null,
                    categorieSelectata,
                    cloudName: process.env.CLOUDINARY_CLOUD_NAME
                });
            }
        }

        const imprimante = await Imprimanta.find(filtru)
            .populate('categorie', 'name')
            .lean();

        res.render('models', {
            imprimante,
            categorii,
            categorieActiva,
            categorieSelectata,
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
    res.render('login', { hideButtons: false });
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
            username: user.username,
            role: user.role || 'user'
        };

        const redirectUrl = user.role === 'gestionar' ? '/gestionar/comenzi' : '/';

        req.session.save((err) => {
            if (err) {
                console.error('Eroare la salvarea sesiunii la logare:', err);
                return res.status(500).json({ message: 'Eroare la salvarea sesiunii.' });
            }

            res.status(200).json({
                message: 'Logare reușită!',
                role: req.session.user.role,
                redirectUrl
            });
        });

    } catch (error) {
        console.error('Eroare la logare:', error);
        res.status(500).json({ message: 'Eroare internă a serverului.' });
    }
});

app.post('/cart/add/:id', async (req, res) => {
    try {
        const productId = req.params.id;

        const imprimanta = await Imprimanta.findById(productId).lean();

        if (!imprimanta) {
            return res.status(404).send('Imprimanta nu a fost găsită');
        }

        if (!req.session.cart) {
            req.session.cart = { items: {}, totalItems: 0 };
        }

        const cart = req.session.cart;
        if (cart.items[productId]) {
            cart.items[productId].quantity++;
        } else {
            cart.items[productId] = {
                item: imprimanta,
                quantity: 1
            };
        }

        cart.totalItems++;

        req.session.save((err) => {
            if (err) {
                console.error("Eroare la salvarea sesiunii:", err);
            }
            res.redirect('/cart');
        });

    } catch (error) {
        console.error("Eroare la adăugarea în coș:", error);
        res.status(500).send('A apărut o eroare.');
    }
});

app.post('/cart/remove/:id', (req, res) => {
    try {
        const productId = req.params.id;

        if (req.session.cart && req.session.cart.items[productId]) {
            req.session.cart.totalItems -= req.session.cart.items[productId].quantity;
            delete req.session.cart.items[productId];

            req.session.save((err) => {
                if (err) {
                    console.error("Eroare la salvarea sesiunii după ștergere:", err);
                }
                res.redirect('/cart');
            });
        } else {
            res.redirect('/cart');
        }

    } catch (error) {
        console.error("Eroare la ștergerea din coș:", error);
        res.status(500).send('A apărut o eroare la ștergere.');
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
        },
        Category,
        User,
        {
            resource: Comanda,
            options: {
                properties: {
                    produse: {
                        isVisible: { list: false, show: true, edit: true, filter: false }
                    }
                }
            }
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

app.get('/cart', (req, res) => {
    const cart = req.session.cart || { items: {}, totalItems: 0 };

    let totalAmount = 0;
    const cartItems = Object.values(cart.items);

    cartItems.forEach(cartItem => {
        totalAmount += cartItem.item.pret * cartItem.quantity;
    });

    res.render('cart', {
        items: cartItems,
        totalAmount: totalAmount,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME
    });
});

app.post('/cart/update/:id/:action', (req, res) => {
    try {
        const { id: productId, action } = req.params;
        const cart = req.session.cart;

        if (cart && cart.items[productId]) {
            if (action === 'increase') {
                cart.items[productId].quantity++;
                cart.totalItems++;
            } else if (action === 'decrease') {
                cart.items[productId].quantity--;
                cart.totalItems = Math.max(0, cart.totalItems - 1);

                if (cart.items[productId].quantity <= 0) {
                    delete cart.items[productId];
                }
            }

            return req.session.save((err) => {
                if (err) {
                    console.error('Eroare la actualizarea cantitatii în sesiune:', err);
                }
                res.redirect('/cart');
            });
        }

        res.redirect('/cart');
    } catch (error) {
        console.error('Eroare la modificarea cantitatii:', error);
        res.status(500).send('A aparut o eroare la actualizarea cosului.');
    }
});

app.use(admin.options.rootPath, adminRouter);

function esteGestionar(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    if (req.session.user.role !== 'gestionar' && req.session.user.role !== 'admin') {
        return res.status(403).send('Acces interzis. Doar gestionarul poate accesa această pagină.');
    }
    next();
}

app.get('/gestionar/comenzi', esteGestionar, async (req, res) => {
    try {
        const statusActiv = req.query.status || 'toate';
        const termenCautare = (req.query.q || '').trim();

        const toateComenzile = await Comanda.find()
            .populate('user', 'username email phone address')
            .sort({ createdAt: -1 });

        const statistici = {
            total: toateComenzile.length,
            inAsteptare: toateComenzile.filter(c => c.status === 'In asteptare').length,
            verificate: toateComenzile.filter(c => c.status === 'Verificata').length,
            expediate: toateComenzile.filter(c => c.status === 'Livrata').length,
            valoareTotala: toateComenzile.reduce((suma, c) => suma + (c.total || 0), 0)
        };

        let comenziFiltrate = toateComenzile;

        if (statusActiv !== 'toate') {
            comenziFiltrate = comenziFiltrate.filter(c => c.status === statusActiv);
        }

        if (termenCautare) {
            const q = termenCautare.toLowerCase();
            comenziFiltrate = comenziFiltrate.filter(c => {
                const codComanda = c._id.toString().slice(-6).toLowerCase();
                const username = (c.user?.username || '').toLowerCase();
                const email = (c.user?.email || '').toLowerCase();
                const telefon = (c.phone || '').toLowerCase();
                const oras = (c.address?.city || '').toLowerCase();

                return (
                    codComanda.includes(q) ||
                    username.includes(q) ||
                    email.includes(q) ||
                    telefon.includes(q) ||
                    oras.includes(q)
                );
            });
        }

        res.render('gestionar-comenzi', {
            comenzi: comenziFiltrate,
            statistici,
            statusActiv,
            termenCautare
        });
    } catch (error) {
        console.error('Eroare la încărcarea comenzilor:', error);
        res.status(500).send('Eroare la încărcarea panoului de comenzi.');
    }
});

app.post('/gestionar/comenzi/:id/verifica', esteGestionar, async (req, res) => {
    try {
        const comanda = await Comanda.findById(req.params.id);
        if (!comanda) return res.status(404).send('Comanda nu a fost găsită.');

        if (comanda.status !== 'Livrata') {
            comanda.verificata = !comanda.verificata;
            comanda.status = comanda.verificata ? 'Verificata' : 'In asteptare';
            await comanda.save();
        }

        res.redirect('/gestionar/comenzi');
    } catch (error) {
        console.error('Eroare la verificarea comenzii:', error);
        res.status(500).send('Eroare la actualizarea comenzii.');
    }
});

app.post('/gestionar/comenzi/:id/shipped', esteGestionar, async (req, res) => {
    try {
        const comanda = await Comanda.findById(req.params.id);
        if (!comanda) return res.status(404).send('Comanda nu a fost găsită.');

        if (comanda.status !== 'Livrata') {
            comanda.verificata = true;
            comanda.status = 'Livrata';
            await comanda.save();
        }

        res.redirect('/gestionar/comenzi');
    } catch (error) {
        console.error('Eroare la marcarea ca Livrata:', error);
        res.status(500).send('Eroare la actualizarea statusului.');
    }
});

app.get('/checkout', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }

        const cart = req.session.cart || { items: {}, totalItems: 0 };
        const cartItems = Object.values(cart.items);

        if (cartItems.length === 0) {
            return res.redirect('/cart');
        }

        let totalAmount = 0;
        cartItems.forEach(cartItem => {
            totalAmount += cartItem.item.pret * cartItem.quantity;
        });

        const userDb = await User.findById(req.session.user.id).lean();

        const formData = {
            phone: userDb?.phone || '',
            street: userDb?.address?.street || '',
            city: userDb?.address?.city || '',
            county: userDb?.address?.county || '',
            zipCode: userDb?.address?.zipCode || ''
        };

        res.render('checkout', {
            items: cartItems,
            totalAmount,
            formData,
            error: null
        });
    } catch (error) {
        console.error('Eroare la încărcarea paginii de checkout:', error);
        res.status(500).send('A apărut o eroare la încărcarea paginii de finalizare a comenzii.');
    }
});

app.post('/checkout', express.urlencoded({ extended: true }), async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }

        const cart = req.session.cart || { items: {}, totalItems: 0 };
        const cartItems = Object.values(cart.items);

        if (cartItems.length === 0) {
            return res.redirect('/cart');
        }

        const formData = {
            phone: (req.body.phone || '').trim(),
            street: (req.body.street || '').trim(),
            city: (req.body.city || '').trim(),
            county: (req.body.county || '').trim(),
            zipCode: (req.body.zipCode || '').trim()
        };

        if (!formData.phone || !formData.street || !formData.city || !formData.county || !formData.zipCode) {
            let totalAmount = 0;
            cartItems.forEach(ci => {
                totalAmount += ci.item.pret * ci.quantity;
            });

            return res.status(400).render('checkout', {
                items: cartItems,
                totalAmount,
                formData,
                error: 'Te rugăm să completezi toate câmpurile de livrare.'
            });
        }

        const productIds = Object.keys(cart.items);
        const imprimanteDb = await Imprimanta.find({ _id: { $in: productIds } }).lean();

        const produseComanda = [];
        let totalComanda = 0;

        imprimanteDb.forEach(imp => {
            const idStr = imp._id.toString();
            const cantitate = cart.items[idStr]?.quantity || 0;

            if (cantitate > 0) {
                produseComanda.push({
                    imprimantaId: imp._id,
                    marca: imp.marca,
                    model: imp.model,
                    pretUnitar: imp.pret,
                    cantitate
                });
                totalComanda += imp.pret * cantitate;
            }
        });

        if (produseComanda.length === 0) {
            return res.redirect('/cart');
        }

        const comandaNoua = new Comanda({
            user: req.session.user.id,
            produse: produseComanda,
            total: totalComanda,
            phone: formData.phone,
            address: {
                street: formData.street,
                city: formData.city,
                county: formData.county,
                zipCode: formData.zipCode
            }
        });

        await comandaNoua.save();

        await User.findByIdAndUpdate(req.session.user.id, {
            phone: formData.phone,
            address: {
                street: formData.street,
                city: formData.city,
                county: formData.county,
                zipCode: formData.zipCode
            }
        });

        req.session.cart = { items: {}, totalItems: 0 };

        req.session.save((err) => {
            if (err) {
                console.error('Eroare la golirea coșului în sesiune:', err);
            }
            res.redirect(`/comanda-confirmata/${comandaNoua._id}`);
        });
    } catch (error) {
        console.error('Eroare la plasarea comenzii:', error);
        res.status(500).send('A apărut o eroare la salvarea comenzii.');
    }
});

app.get('/comanda-confirmata/:id', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }

        const comanda = await Comanda.findById(req.params.id).lean();
        if (!comanda) {
            return res.status(404).send('Comanda nu a fost găsită.');
        }

        const esteProprietar = comanda.user.toString() === req.session.user.id.toString();
        const estePersonal = req.session.user.role === 'gestionar' || req.session.user.role === 'admin';

        if (!esteProprietar && !estePersonal) {
            return res.status(403).send('Acces interzis.');
        }

        res.render('comanda-confirmata', { comanda });
    } catch (error) {
        console.error('Eroare la afișarea confirmării comenzii:', error);
        res.status(500).send('Nu am putut încărca detaliile comenzii.');
    }
});

export default app;

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Serverul ruleaza local pe portul ${PORT}.`);
    });
}