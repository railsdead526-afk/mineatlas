require('dotenv').config();
const { query, closeDatabase } = require('../config/database');

const categories = [
    ['Mods', 'mods'], ['Modpacks', 'modpacks'], ['Plugins', 'plugins'], ['Shaders', 'shaders'],
    ['Maps', 'maps'], ['Add-ons', 'add-ons'], ['Worlds', 'worlds'], ['Resource Packs', 'resource-packs']
];

async function seed() {
    for (const [name, slug] of categories) await query('INSERT INTO categories (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING', [name, slug]);
    console.log('Kategori MineAtlas berhasil di-seed.');
    await closeDatabase();
}

seed().catch(async err => {
    console.error('Seed gagal:', err);
    try { await closeDatabase(); } catch {}
    process.exit(1);
});