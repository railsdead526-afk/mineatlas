const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getDatabase, saveDatabase, queryRows, queryOne, run } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

function projectId(value) {
    const id = Number.parseInt(value, 10);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function pagination(value, fallback, max) {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback;
}

router.get('/', async (req, res) => {
    const db = await getDatabase();
    try {
        const q = String(req.query.q || '').trim();
        const category = String(req.query.category || '').trim();
        const version = String(req.query.version || '').trim();
        const author = String(req.query.author || '').trim();
        const currentPage = pagination(req.query.page, 1, 1000000);
        const perPage = pagination(req.query.limit, 20, 100);
        const offset = (currentPage - 1) * perPage;

        const where = [];
        const params = [];
        if (q) {
            where.push('(title LIKE ? ESCAPE \'\\\' OR description LIKE ? ESCAPE \'\\\' OR author LIKE ? ESCAPE \'\\\')');
            const search = `%${q.replace(/[\\%_]/g, m => `\\${m}`)}%`;
            params.push(search, search, search);
        }
        if (category) { where.push('category = ?'); params.push(category); }
        if (version) { where.push('version = ?'); params.push(version); }
        if (author) { where.push('author = ?'); params.push(author); }

        const whereClause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
        const allowedSorts = {
            oldest: 'created_at ASC',
            downloads: 'downloads DESC',
            rating: '(SELECT AVG(rating) FROM ratings WHERE project_id = projects.id) DESC',
            newest: 'created_at DESC'
        };
        const orderBy = allowedSorts[String(req.query.sort || 'newest')] || allowedSorts.newest;

        const totalRow = queryOne(db, `SELECT COUNT(*) AS total FROM projects${whereClause}`, params);
        const total = Number(totalRow?.total || 0);
        const items = queryRows(db, `SELECT * FROM projects${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...params, perPage, offset]);

        res.json({ items, total, page: currentPage, totalPages: Math.ceil(total / perPage), hasNext: currentPage < Math.ceil(total / perPage), hasPrev: currentPage > 1 });
    } catch (err) {
        console.error('Project list error:', err);
        res.status(500).json({ error: 'Gagal mengambil project' });
    } finally {
        db.close();
    }
});

router.get('/:id', async (req, res) => {
    const id = projectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    const db = await getDatabase();
    try {
        const project = queryOne(db, 'SELECT * FROM projects WHERE id = ?', [id]);
        if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' });
        res.json(project);
    } finally { db.close(); }
});

router.get('/:id/download', async (req, res) => {
    const id = projectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    const db = await getDatabase();
    try {
        const project = queryOne(db, 'SELECT id, download_url FROM projects WHERE id = ?', [id]);
        if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' });
        if (!project.download_url || path.basename(project.download_url) !== project.download_url) return res.status(404).json({ error: 'File tidak tersedia' });
        const filePath = path.join(__dirname, '..', 'uploads', 'files', project.download_url);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File tidak ditemukan di server' });
        run(db, 'UPDATE projects SET downloads = downloads + 1 WHERE id = ?', [id]);
        saveDatabase(db);
        return res.download(filePath, project.download_url);
    } finally { db.close(); }
});

router.put('/:id', authenticateToken, async (req, res) => {
    const id = projectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    const db = await getDatabase();
    try {
        const project = queryOne(db, 'SELECT * FROM projects WHERE id = ?', [id]);
        if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' });
        if (project.author !== req.user.username && req.user.role !== 'admin') return res.status(403).json({ error: 'Anda bukan pemilik project ini' });

        const fields = [];
        const values = [];
        for (const field of ['title', 'description', 'category', 'version']) {
            if (req.body[field] !== undefined) {
                const value = String(req.body[field]).trim();
                if (field === 'title' && (value.length < 2 || value.length > 120)) return res.status(400).json({ error: 'Judul harus 2-120 karakter' });
                fields.push(`${field} = ?`);
                values.push(value);
            }
        }
        if (!fields.length) return res.status(400).json({ error: 'Tidak ada data yang diubah' });
        values.push(id);
        run(db, `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, values);
        saveDatabase(db);
        res.json({ message: 'Project berhasil diupdate!' });
    } finally { db.close(); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    const id = projectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    const db = await getDatabase();
    try {
        const project = queryOne(db, 'SELECT * FROM projects WHERE id = ?', [id]);
        if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' });
        if (project.author !== req.user.username && req.user.role !== 'admin') return res.status(403).json({ error: 'Anda bukan pemilik project ini' });

        const safeDelete = (folder, name) => {
            if (!name || path.basename(name) !== name) return;
            const filePath = path.join(__dirname, '..', 'uploads', folder, name);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        };
        safeDelete('files', project.download_url);
        safeDelete('images', project.thumbnail);
        run(db, 'DELETE FROM ratings WHERE project_id = ?', [id]);
        run(db, 'DELETE FROM comments WHERE project_id = ?', [id]);
        run(db, 'DELETE FROM favorites WHERE project_id = ?', [id]);
        run(db, 'DELETE FROM projects WHERE id = ?', [id]);
        saveDatabase(db);
        res.json({ message: 'Project berhasil dihapus!' });
    } finally { db.close(); }
});

router.post('/:id/rating', authenticateToken, async (req, res) => {
    const id = projectId(req.params.id);
    const rating = Number(req.body.rating);
    if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating harus 1 sampai 5' });
    const db = await getDatabase();
    try {
        if (!queryOne(db, 'SELECT id FROM projects WHERE id = ?', [id])) return res.status(404).json({ error: 'Project tidak ditemukan' });
        const existing = queryOne(db, 'SELECT id FROM ratings WHERE project_id = ? AND user_id = ?', [id, req.user.id]);
        if (existing) run(db, 'UPDATE ratings SET rating = ? WHERE id = ?', [rating, existing.id]);
        else run(db, 'INSERT INTO ratings (project_id, user_id, rating) VALUES (?, ?, ?)', [id, req.user.id, rating]);
        saveDatabase(db);
        res.json({ message: 'Rating berhasil disimpan!' });
    } finally { db.close(); }
});

router.get('/:id/rating', async (req, res) => {
    const id = projectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    const db = await getDatabase();
    try {
        const summary = queryOne(db, 'SELECT AVG(rating) AS average, COUNT(*) AS count FROM ratings WHERE project_id = ?', [id]);
        const rows = queryRows(db, 'SELECT rating, COUNT(*) AS count FROM ratings WHERE project_id = ? GROUP BY rating', [id]);
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        rows.forEach(row => distribution[row.rating] = row.count);
        res.json({ average: Math.round(Number(summary?.average || 0) * 10) / 10, count: Number(summary?.count || 0), distribution });
    } finally { db.close(); }
});

router.post('/:id/comments', authenticateToken, async (req, res) => {
    const id = projectId(req.params.id);
    const comment = String(req.body.comment || '').trim();
    if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    if (!comment || comment.length > 2000) return res.status(400).json({ error: 'Komentar harus 1-2000 karakter' });
    const db = await getDatabase();
    try {
        if (!queryOne(db, 'SELECT id FROM projects WHERE id = ?', [id])) return res.status(404).json({ error: 'Project tidak ditemukan' });
        run(db, 'INSERT INTO comments (project_id, user_id, comment) VALUES (?, ?, ?)', [id, req.user.id, comment]);
        saveDatabase(db);
        res.status(201).json({ message: 'Komentar berhasil ditambahkan!' });
    } finally { db.close(); }
});

router.get('/:id/comments', async (req, res) => {
    const id = projectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    const db = await getDatabase();
    try {
        res.json(queryRows(db, 'SELECT c.id, c.comment, c.created_at, u.username FROM comments c JOIN users u ON c.user_id = u.id WHERE c.project_id = ? ORDER BY c.created_at DESC', [id]));
    } finally { db.close(); }
});

router.post('/:id/favorite', authenticateToken, async (req, res) => {
    const id = projectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    const db = await getDatabase();
    try {
        if (!queryOne(db, 'SELECT id FROM projects WHERE id = ?', [id])) return res.status(404).json({ error: 'Project tidak ditemukan' });
        const existing = queryOne(db, 'SELECT id FROM favorites WHERE project_id = ? AND user_id = ?', [id, req.user.id]);
        if (existing) {
            run(db, 'DELETE FROM favorites WHERE id = ?', [existing.id]);
            saveDatabase(db);
            return res.json({ favorited: false });
        }
        run(db, 'INSERT INTO favorites (user_id, project_id) VALUES (?, ?)', [req.user.id, id]);
        saveDatabase(db);
        res.json({ favorited: true });
    } finally { db.close(); }
});

router.get('/:id/favorite', async (req, res) => {
    const id = projectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    const db = await getDatabase();
    try {
        const row = queryOne(db, 'SELECT COUNT(*) AS count FROM favorites WHERE project_id = ?', [id]);
        res.json({ count: Number(row?.count || 0) });
    } finally { db.close(); }
});

module.exports = router;