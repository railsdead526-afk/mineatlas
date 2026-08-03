const { getDatabase, saveDatabase } = require('../config/database');

async function init() {
    const db = await getDatabase();
    
    console.log('Membuat tabel...');
    
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, avatar TEXT, role TEXT DEFAULT 'user', created_at TEXT DEFAULT (datetime('now')))`);
    
    db.run(`CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE)`);
    
    db.run(`CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT, category TEXT NOT NULL, edition TEXT NOT NULL, version TEXT, author TEXT, thumbnail TEXT, download_url TEXT, downloads INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`);
    
    saveDatabase(db);
    console.log('Tabel berhasil dibuat.');
    db.close();
}

init().catch(err => console.error(err));
