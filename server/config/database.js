// ============================================
// MINEATLAS — DATABASE CONFIG (sql.js)
// ============================================

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'mineatlas.db');

// Fungsi untuk mendapatkan database
async function getDatabase() {
    const SQL = await initSqlJs();
    
    let db;
    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }
    
    console.log('Database terhubung');
    return db;
}

// Fungsi untuk menyimpan database ke file
function saveDatabase(db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
}

module.exports = { getDatabase, saveDatabase };
