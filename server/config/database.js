const { Pool } = require('pg');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL wajib diisi.');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Math.max(1, Number(process.env.DB_POOL_MAX || 10)),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', err => console.error('PostgreSQL pool error:', err));

async function query(text, params = []) { return pool.query(text, params); }
async function queryRows(text, params = []) { return (await pool.query(text, params)).rows; }
async function queryOne(text, params = []) { return (await pool.query(text, params)).rows[0] || null; }
async function run(text, params = []) { return pool.query(text, params); }

async function transaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function closeDatabase() { await pool.end(); }
module.exports = { pool, query, queryRows, queryOne, run, transaction, closeDatabase };