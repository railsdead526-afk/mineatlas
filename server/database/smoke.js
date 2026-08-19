require('dotenv').config();
const app = require('../app');
const { queryOne, closeDatabase } = require('../config/database');

async function main() {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const port = server.address().port;

    try {
        const health = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (!health.ok) throw new Error(`Health check failed: ${health.status}`);
        const body = await health.json();
        if (body.database !== 'ok') throw new Error('Database health is not ok');

        await queryOne(`INSERT INTO categories (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING RETURNING id`, ['Smoke Test', 'smoke-test']);
        const category = await queryOne('SELECT id FROM categories WHERE slug=$1', ['smoke-test']);
        if (!category) throw new Error('Smoke test category was not created');

        console.log('MineAtlas backend smoke test passed.');
    } finally {
        server.close();
        await closeDatabase();
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
