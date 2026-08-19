require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { query, closeDatabase } = require('./config/database');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const clientPath = path.join(__dirname, '..', 'client');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET wajib diisi dan minimal 32 karakter');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL wajib diisi');

const origins = (process.env.CLIENT_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(',').map(v => v.trim()).filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
    origin: (origin, cb) => (!origin || origins.includes(origin)) ? cb(null, true) : cb(new Error('CORS origin tidak diizinkan')),
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());
app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    limit: Math.max(1, Number(process.env.API_RATE_LIMIT || 120)),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Terlalu banyak request. Coba lagi nanti.' }
}));

app.use(express.static(clientPath));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { dotfiles: 'deny', index: false, maxAge: '1h' }));
app.get('/', (req, res) => res.sendFile(path.join(clientPath, 'index.html')));
app.get('/api', (req, res) => res.json({ status: 'ok', message: 'MineAtlas API Running' }));
app.get('/api/health', async (req, res) => {
    try {
        await query('SELECT 1');
        res.json({ status: 'ok', database: 'ok', timestamp: new Date().toISOString() });
    } catch {
        res.status(503).json({ status: 'error', database: 'unavailable' });
    }
});

app.use('/api/projects', require('./routes/projects'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/users', require('./routes/users'));

app.use((err, req, res, next) => {
    console.error(err);
    if (err.message?.includes('CORS')) return res.status(403).json({ error: 'Origin tidak diizinkan' });
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Ukuran file terlalu besar' });
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});
app.use((req, res) => res.status(404).json({ status: 'error', message: 'Route not found' }));

let server;
if (require.main === module) {
    server = app.listen(PORT, '0.0.0.0', () => console.log(`MineAtlas API berjalan di port ${PORT}`));
    const shutdown = async signal => {
        console.log(`${signal} diterima, menghentikan MineAtlas...`);
        server.close(async () => {
            try { await closeDatabase(); } finally { process.exit(0); }
        });
    };
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
