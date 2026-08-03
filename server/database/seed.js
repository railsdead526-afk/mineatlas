const { getDatabase, saveDatabase } = require('../config/database');

async function seed() {
    const db = await getDatabase();
    console.log('Mengisi data contoh...');

    // Kategori
    const categories = [
        ['Mods', 'mods'],
        ['Modpacks', 'modpacks'],
        ['Plugins', 'plugins'],
        ['Shaders', 'shaders'],
        ['Maps', 'maps']
    ];
    categories.forEach(c => {
        db.run('INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)', c);
    });

    // Users
    db.run('INSERT OR IGNORE INTO users (id, username, email, password, role) VALUES (1, "JellySquid", "jelly@mineatlas.com", "pass123", "creator")');
    db.run('INSERT OR IGNORE INTO users (id, username, email, password, role) VALUES (2, "UserKamu", "user@mineatlas.com", "pass123", "user")');

    // Projects
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
    projects.forEach(p => {
        db.run('INSERT OR IGNORE INTO projects (title, slug, description, category, edition, version, author) VALUES (?, ?, ?, ?, ?, ?, ?)', p);
    });

    saveDatabase(db);
    console.log('Data contoh berhasil diisi.');
    db.close();
}

seed().catch(err => console.error(err));
