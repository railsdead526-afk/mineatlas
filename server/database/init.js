require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, closeDatabase } = require('../config/database');

async function init() {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await query(schema);
    console.log('PostgreSQL schema MineAtlas siap.');
    await closeDatabase();
}

init().catch(async err => {
    console.error('Database initialization failed:', err);
    try { await closeDatabase(); } catch {}
    process.exit(1);
});