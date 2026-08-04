const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const app = express();
require('dotenv').config();

const PORT = process.env.PORT || 3000;

const projectsRoute = require('./routes/projects');
const categoriesRoute = require('./routes/categories');
const authRoute = require('./routes/auth');
const uploadRoute = require('./routes/upload');
const usersRoute = require('./routes/users');

// CORS — izinkan Cloudflare Pages
app.use(cors({
    origin: [
        'https://7e978130.mineatlas.pages.dev',
        'https://mineatlas.pages.dev'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(cookieParser());

app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Auto-init database saat server start
const { getDatabase, saveDatabase } = require('./config/database');
(async function() {
    const db = await getDatabase();
    db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, email TEXT UNIQUE, password TEXT, avatar TEXT, role TEXT DEFAULT \'user\', created_at TEXT DEFAULT (datetime(\'now\')))');
    db.run('CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, slug TEXT UNIQUE)');
    db.run('CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, slug TEXT UNIQUE, description TEXT, category TEXT, edition TEXT, version TEXT, author TEXT, thumbnail TEXT, download_url TEXT, downloads INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime(\'now\')))');
    db.run('CREATE TABLE IF NOT EXISTS ratings (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, user_id INTEGER, rating INTEGER, created_at TEXT DEFAULT (datetime(\'now\')), UNIQUE(project_id, user_id))');
    db.run('CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, user_id INTEGER, comment TEXT, created_at TEXT DEFAULT (datetime(\'now\')), updated_at TEXT DEFAULT (datetime(\'now\')))');
    db.run('CREATE TABLE IF NOT EXISTS favorites (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, project_id INTEGER, created_at TEXT DEFAULT (datetime(\'now\')), UNIQUE(user_id, project_id))');
    saveDatabase(db);
    db.close();
    console.log('Database siap');
})();

app.get('/api', function(req, res) {
    res.json({ status: 'ok', message: 'MineAtlas API Running' });
});

app.use('/api/projects', projectsRoute);
app.use('/api/categories', categoriesRoute);
app.use('/api/auth', authRoute);
app.use('/api/upload', uploadRoute);
app.use('/api/users', usersRoute);

app.listen(PORT, '0.0.0.0', function() {
    console.log('=================================');
    console.log('🚀 MineAtlas Server Berjalan');
    console.log('=================================');
    console.log('Local   : http://localhost:' + PORT);
    console.log('Network : http://0.0.0.0:' + PORT);
});