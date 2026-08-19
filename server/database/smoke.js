require('dotenv').config();
const app = require('../app');
const { queryOne, closeDatabase } = require('../config/database');

async function main() {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const port = server.address().port;

    try {
        const base = `http://127.0.0.1:${port}`;
        const health = await fetch(`${base}/api/health`);
        if (!health.ok) throw new Error(`Health check failed: ${health.status}`);
        const body = await health.json();
        if (body.database !== 'ok') throw new Error('Database health is not ok');

        const csrf = await fetch(`${base}/api/auth/csrf`);
        if (!csrf.ok) throw new Error(`CSRF bootstrap failed: ${csrf.status}`);
        const csrfBody = await csrf.json();
        if (!csrfBody.csrfToken || csrfBody.csrfToken.length < 32) throw new Error('CSRF token was not generated');

        const protectedMutation = await fetch(`${base}/api/auth/logout`, { method: 'POST' });
        if (protectedMutation.status !== 403) throw new Error(`Expected CSRF rejection, got ${protectedMutation.status}`);

        await queryOne('INSERT INTO categories (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING RETURNING id', ['Smoke Test', 'smoke-test']);
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
