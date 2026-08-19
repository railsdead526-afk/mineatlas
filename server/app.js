require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { query } = require('./config/database');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const clientPath = path.join(__dirname, '..', 'client');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET wajib diisi dan minimal 32 karakter');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL wajib diisi');

const origins = (process.env.CLIENT_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(',').map(v => v.trim()).filter(Boolean);
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (origin, cb) => (!origin || origins.includes(origin)) ? cb(null, true) : cb(new Error('CORS origin tidak diizinkan')), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

const buckets = new Map();
app.use((req, res, next) => {
    const now = Date.now(), key = req.ip || 'unknown', bucket = buckets.get(key);
    if (!bucket || now - bucket.startedAt >= 60000) buckets.set(key, { startedAt: now, count: 1 });
    else { bucket.count++; if (bucket.count > 120) return res.status(429).json({ error: 'Terlalu banyak request. Coba lagi nanti.' }); }
    next();
});
setInterval(() => { const cutoff = Date.now() - 120000; for (const [key, b] of buckets) if (b.startedAt < cutoff) buckets.delete(key); }, 60000).unref();

app.use(express.static(clientPath));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { dotfiles: 'deny', index: false, maxAge: '1h' }));
app.get('/', (req, res) => res.sendFile(path.join(clientPath, 'index.html')));

app.get('/api', (req, res) => res.json({ status: 'ok', message: 'MineAtlas API Running' }));
app.get('/api/health', async (req, res) => {
    try { await query('SELECT 1'); res.json({ status: 'ok', database: 'ok', timestamp: new Date().toISOString() }); }
    catch { res.status(503).json({ status: 'error', database: 'unavailable' }); }
});

app.use('/api/projects', require('./routes/projects'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/users', require('./routes/users'));

app.use((err, req, res, next) => {
    console.error(err);
    if (err.message?.includes('CORS')) return res.status(403).json({ error: 'Origin tidak diizinkan' });
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});
app.use((req, res) => res.status(404).json({ status: 'error', message: 'Route not found' }));

app.listen(PORT, '0.0.0.0', () => console.log(`MineAtlas API berjalan di port ${PORT}`));