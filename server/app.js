const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const clientPath = path.join(__dirname, '..', 'client');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET wajib diisi dan minimal 32 karakter.');
    process.exit(1);
}

const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:3000,http://localhost:5173,https://mineatlas.pages.dev')
    .split(',').map(v => v.trim()).filter(Boolean);

const projectsRoute = require('./routes/projects');
const categoriesRoute = require('./routes/categories');
const authRoute = require('./routes/auth');
const uploadRoute = require('./routes/upload');
const usersRoute = require('./routes/users');
const { getDatabase, saveDatabase } = require('./config/database');

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Origin tidak diizinkan oleh CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

// Lightweight request rate limiter for the single-node deployment.
const rateBuckets = new Map();
const RATE_WINDOW = 60 * 1000;
const RATE_LIMIT = 120;
app.use((req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'unknown';
    const bucket = rateBuckets.get(key);
    if (!bucket || now - bucket.startedAt >= RATE_WINDOW) {
        rateBuckets.set(key, { startedAt: now, count: 1 });
        return next();
    }
    bucket.count += 1;
    if (bucket.count > RATE_LIMIT) return res.status(429).json({ error: 'Terlalu banyak request. Coba lagi nanti.' });
    next();
});
setInterval(() => {
    const cutoff = Date.now() - RATE_WINDOW * 2;
    for (const [key, bucket] of rateBuckets) if (bucket.startedAt < cutoff) rateBuckets.delete(key);
}, RATE_WINDOW).unref();

app.use(express.static(clientPath));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    dotfiles: 'deny',
    index: false,
    maxAge: '1h'
}));

app.get('/', (req, res) => res.sendFile(path.join(clientPath, 'index.html')));

(async () => {
    const db = await getDatabase();
    try {
        db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, avatar TEXT, role TEXT DEFAULT 'user', created_at TEXT DEFAULT (datetime('now')))");
        db.run("CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE)");
        db.run("CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT, category TEXT NOT NULL, edition TEXT NOT NULL, version TEXT, author TEXT, thumbnail TEXT, download_url TEXT, downloads INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))");
        db.run("CREATE TABLE IF NOT EXISTS ratings (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, user_id INTEGER NOT NULL, rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5), created_at TEXT DEFAULT (datetime('now')), UNIQUE(project_id, user_id))");
        db.run("CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, user_id INTEGER NOT NULL, comment TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))");
        db.run("CREATE TABLE IF NOT EXISTS favorites (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, project_id INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')), UNIQUE(user_id, project_id))");
        saveDatabase(db);
        console.log('✅ Database siap');
    } finally {
        db.close();
    }
})().catch(err => {
    console.error('❌ Database initialization failed:', err);
    process.exit(1);
});

app.get('/api', (req, res) => res.json({ status: 'ok', message: 'MineAtlas API Running' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/projects', projectsRoute);
app.use('/api/categories', categoriesRoute);
app.use('/api/auth', authRoute);
app.use('/api/upload', uploadRoute);
app.use('/api/users', usersRoute);

app.use((err, req, res, next) => {
    console.error(err);
    if (err.message && err.message.includes('CORS')) return res.status(403).json({ error: 'Origin tidak diizinkan' });
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Ukuran file terlalu besar' });
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

app.use((req, res) => res.status(404).json({ status: 'error', message: 'Route not found' }));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 MineAtlas API berjalan di port ${PORT}`);
});