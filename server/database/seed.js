const { getDatabase, saveDatabase } = require('../config/database');

async function seed() {
    const db = await getDatabase();

    console.log('Mengisi data contoh MineAtlas...');

    const categories = [
        ['Mods', 'mods'],
        ['Modpacks', 'modpacks'],
        ['Plugins', 'plugins'],
        ['Shaders', 'shaders'],
        ['Maps', 'maps'],
        ['Add-ons', 'add-ons'],
        ['Worlds', 'worlds'],
        ['Resource Packs', 'resource-packs']
    ];

    for (const category of categories) {
        db.run('INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)', category);
    }

    // Never seed real-looking accounts or plaintext passwords.
    // Demo users should be created through the normal registration flow.
    const projects = [
        ['Sodium Performance Mod', 'sodium', 'Mod optimasi rendering untuk Minecraft.', 'Mods', 'Java Edition', '0.5.6', 'JellySquid'],
        ['BSL Shaders', 'bsl-shaders', 'Shader pack realistis.', 'Shaders', 'Java Edition', '8.2', 'CaptTatsu'],
        ['Create Mod', 'create-mod', 'Mod mekanik dan otomatisasi.', 'Mods', 'Java Edition', '1.20.1', 'simibubi'],
        ['EssentialsX Plugin', 'essentialsx', 'Plugin server esensial.', 'Plugins', 'Java Edition', '2.21', 'EssentialsTeam'],
        ['Skyblock One Block', 'skyblock', 'Map Skyblock survival.', 'Maps', 'Java Edition', '1.0', 'MapMaker'],
        ['Dynamic Lighting Add-on', 'dynamic-lighting', 'Add-on pencahayaan dinamis.', 'Add-ons', 'Bedrock Edition', '2.1', 'BedrockDev'],
        ['City Life World', 'city-life', 'World kota modern.', 'Worlds', 'Bedrock Edition', '1.0', 'WorldBuilder'],
        ['Faithful Resource Pack', 'faithful', 'Resource pack setia vanilla.', 'Resource Packs', 'Java Edition', '1.21', 'FaithfulTeam'],
        ['Furniture Add-on', 'furniture-addon', 'Add-on furnitur modern.', 'Add-ons', 'Bedrock Edition', '2.5', 'CraftyBee'],
        ['Parkour Paradise Map', 'parkour-paradise', 'Map parkour menantang.', 'Maps', 'Java Edition', '1.2', 'JumpKing']
    ];

    for (const project of projects) {
        db.run(
            'INSERT OR IGNORE INTO projects (title, slug, description, category, edition, version, author) VALUES (?, ?, ?, ?, ?, ?, ?)',
            project
        );
    }

    saveDatabase(db);
    db.close();
    console.log('Data contoh berhasil diisi.');
}

seed().catch((error) => {
    console.error('Seed gagal:', error);
    process.exitCode = 1;
});
