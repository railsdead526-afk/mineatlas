const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// Debug
// =========================
const clientPath = path.join(__dirname, '..', 'client');

console.log('==============================');
console.log('__dirname :', __dirname);
console.log('clientPath:', clientPath);
console.log('exists    :', fs.existsSync(clientPath));

if (fs.existsSync(clientPath)) {
    console.log('Client files:', fs.readdirSync(clientPath));
}

console.log('==============================');

// =========================
// Routes
// =========================
const projectsRoute = require('./routes/projects');
const categoriesRoute = require('./routes/categories');
const authRoute = require('./routes/auth');
const uploadRoute = require('./routes/upload');
const usersRoute = require('./routes/users');

// =========================
// Middleware
// =========================
app.use(cors({
    origin: [
        'https://7e978130.mineatlas.pages.dev',
        'https://mineatlas.pages.dev'
    ],
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// =========================
// Static Files
// =========================
app.use(express.static(clientPath));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
});

// =========================
// Database
// =========================
const { getDatabase, saveDatabase } = require('./config/database');

(async () => {
    const db = await getDatabase();

    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, email TEXT UNIQUE, password TEXT, avatar TEXT, role TEXT DEFAULT 'user', created_at TEXT DEFAULT (datetime('now')))");
    db.run("CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, slug TEXT UNIQUE)");
    db.run("CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, slug TEXT UNIQUE, description TEXT, category TEXT, edition TEXT, version TEXT, author TEXT, thumbnail TEXT, download_url TEXT, downloads INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))");
    db.run("CREATE TABLE IF NOT EXISTS ratings (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, user_id INTEGER, rating INTEGER, created_at TEXT DEFAULT (datetime('now')), UNIQUE(project_id, user_id))");
    db.run("CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, user_id INTEGER, comment TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))");
    db.run("CREATE TABLE IF NOT EXISTS favorites (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, project_id INTEGER, created_at TEXT DEFAULT (datetime('now')), UNIQUE(user_id, project_id))");

    saveDatabase(db);
    db.close();

    console.log('✅ Database siap');
})();

// =========================
// API
// =========================
app.get('/api', (req, res) => {
    res.json({
        status: 'ok',
        message: 'MineAtlas API Running'
    });
});

app.use('/api/projects', projectsRoute);
app.use('/api/categories', categoriesRoute);
app.use('/api/auth', authRoute);
app.use('/api/upload', uploadRoute);
app.use('/api/users', usersRoute);

// =========================
// 404
// =========================
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Route not found'
    });
});

// =========================
// Start Server
// =========================
app.listen(PORT, '0.0.0.0', () => {
    console.log('=================================');
    console.log('🚀 MineAtlas Server Berjalan');
    console.log('=================================');
    console.log(`PORT     : ${PORT}`);
    console.log(`CLIENT   : ${clientPath}`);
});