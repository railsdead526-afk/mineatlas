// ============================================
// MINEATLAS — DATABASE CONFIG
// ============================================

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'database', 'mineatlas.db');

async function getDatabase() {
    const SQL = await initSqlJs();
    if (fs.existsSync(dbPath)) {
        return new SQL.Database(fs.readFileSync(dbPath));
    }
    return new SQL.Database();
}

function saveDatabase(db) {
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

function queryRows(db, sql, params = []) {
    const stmt = db.prepare(sql);
    try {
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        return rows;
    } finally {
        stmt.free();
    }
}

function queryOne(db, sql, params = []) {
    const rows = queryRows(db, sql, params);
    return rows.length ? rows[0] : null;
}

function run(db, sql, params = []) {
    db.run(sql, params);
}

module.exports = { getDatabase, saveDatabase, queryRows, queryOne, run };