const { Pool } = require('pg');

const required = ['DATABASE_URL'];
for (const key of required) {
    if (!process.env[key]) throw new Error(`${key} wajib diisi.`);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', err => console.error('PostgreSQL pool error:', err));

async function query(text, params = []) {
    return pool.query(text, params);
}

async function queryRows(text, params = []) {
    const result = await pool.query(text, params);
    return result.rows;
}

async function queryOne(text, params = []) {
    const result = await pool.query(text, params);
    return result.rows[0] || null;
}

async function run(text, params = []) {
    return pool.query(text, params);
}

async function closeDatabase() {
    await pool.end();
}

module.exports = { pool, query, queryRows, queryOne, run, closeDatabase };