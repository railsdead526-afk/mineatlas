const express = require('express');
const path = require('path');
const fs = require('fs');
const { queryRows, queryOne, run } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const uploadRoot = path.join(__dirname, '..', 'uploads');

function projectId(value) {
    const id = Number.parseInt(value, 10);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}
function pagination(value, fallback, max) {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback;
}
function safeName(value) { return value && path.basename(value) === value ? value : null; }
function deleteUpload(folder, name) {
    const safe = safeName(name);
    if (!safe) return;
    const filePath = path.join(uploadRoot, folder, safe);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

const projectSelect = `
    SELECT p.*, u.username AS author,
           c.name AS category_name, c.slug AS category_slug,
           COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS rating,
           COUNT(DISTINCT r.id)::int AS rating_count,
           COUNT(DISTINCT f.id)::int AS favorite_count
    FROM projects p
    LEFT JOIN users u ON u.id = p.author_id
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN ratings r ON r.project_id = p.id
    LEFT JOIN favorites f ON f.project_id = p.id
`;

router.get('/', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim().slice(0, 120);
        const category = String(req.query.category || '').trim();
        const version = String(req.query.version || '').trim();
        const author = String(req.query.author || '').trim();
        const page = pagination(req.query.page, 1, 1000000);
        const limit = pagination(req.query.limit, 20, 100);
        const offset = (page - 1) * limit;
        const where = [];
        const params = [];
        if (q) { params.push(`%${q}%`); where.push(`(p.title ILIKE $${params.length} OR p.description ILIKE $${params.length})`); }
        if (category) { params.push(category); where.push(`c.slug = $${params.length}`); }
        if (version) { params.push(version); where.push(`p.version = $${params.length}`); }
        if (author) { params.push(author); where.push(`u.username = $${params.length}`); }
        const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
        const sorts = {
            oldest: 'p.created_at ASC', downloads: 'p.downloads DESC',
            rating: 'COALESCE(AVG(r.rating), 0) DESC', newest: 'p.created_at DESC'
        };
        const orderBy = sorts[String(req.query.sort || 'newest')] || sorts.newest;
        const countRow = await queryOne(`SELECT COUNT(*)::int AS total FROM projects p LEFT JOIN users u ON u.id=p.author_id LEFT JOIN categories c ON c.id=p.category_id${whereSql}`, params);
        const total = Number(countRow?.total || 0);
        const dataParams = [...params, limit, offset];
        const items = await queryRows(`${projectSelect}${whereSql} GROUP BY p.id, u.username, c.name, c.slug ORDER BY ${orderBy} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`, dataParams);
        const totalPages = Math.ceil(total / limit);
        res.json({ items, total, page, totalPages, hasNext: page < totalPages, hasPrev: page > 1 });
    } catch (err) {
        console.error('Project list error:', err);
        res.status(500).json({ error: 'Gagal mengambil project' });
    }
});

router.get('/:id', async (req, res) => {
    const id = projectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    try {
        const project = await queryOne(`${projectSelect} WHERE p.id = $1 GROUP BY p.id, u.username, c.name, c.slug`, [id]);
        if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' });
        res.json(project);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Gagal mengambil project' }); }
});

router.get('/:id/download', async (req, res) => {
    const id = projectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    try {
        const project = await queryOne('SELECT download_url FROM projects WHERE id = $1', [id]);
        const filename = safeName(project?.download_url);
        if (!filename) return res.status(404).json({ error: 'File tidak tersedia' });
        const filePath = path.join(uploadRoot, 'files', filename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File tidak ditemukan di server' });
        await run('UPDATE projects SET downloads = downloads + 1, updated_at = NOW() WHERE id = $1', [id]);
        return res.download(filePath, filename);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Download gagal' }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
    const id = projectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    try {
        const project = await queryOne('SELECT * FROM projects WHERE id = $1', [id]);
        if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' });
        if (project.author_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Anda bukan pemilik project ini' });
        const allowed = ['title', 'description', 'version', 'edition'];
        const fields = [], values = [];
        for (const field of allowed) {
            if (req.body[field] !== undefined) {
                const value = String(req.body[field]).trim();
                if (field === 'title' && (value.length < 2 || value.length > 160)) return res.status(400).json({ error: 'Judul harus 2-160 karakter' });
                if (field === 'description' && value.length > 10000) return res.status(400).json({ error: 'Deskripsi terlalu panjang' });
                fields.push(`${field} = $${values.length + 1}`); values.push(value);
            }
        }
        if (!fields.length) return res.status(400).json({ error: 'Tidak ada data yang diubah' });
        values.push(id);
        await run(`UPDATE projects SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`, values);
        res.json({ message: 'Project berhasil diupdate!' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Update project gagal' }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    const id = projectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    try {
        const project = await queryOne('SELECT * FROM projects WHERE id = $1', [id]);
        if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' });
        if (project.author_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Anda bukan pemilik project ini' });
        await run('DELETE FROM projects WHERE id = $1', [id]);
        deleteUpload('files', project.download_url);
        deleteUpload('images', project.thumbnail);
        res.json({ message: 'Project berhasil dihapus!' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Delete project gagal' }); }
});

router.post('/:id/rating', authenticateToken, async (req, res) => {
    const id = projectId(req.params.id), rating = Number(req.body.rating);
    if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating harus 1 sampai 5' });
    try {
        await run(`INSERT INTO ratings (project_id, user_id, rating) VALUES ($1, $2, $3) ON CONFLICT (project_id, user_id) DO UPDATE SET rating = EXCLUDED.rating`, [id, req.user.id, rating]);
        res.json({ message: 'Rating berhasil disimpan!' });
    } catch (err) { if (err.code === '23503') return res.status(404).json({ error: 'Project tidak ditemukan' }); console.error(err); res.status(500).json({ error: 'Rating gagal disimpan' }); }
});

router.get('/:id/rating', async (req, res) => {
    const id = projectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    try {
        const summary = await queryOne('SELECT AVG(rating) AS average, COUNT(*)::int AS count FROM ratings WHERE project_id = $1', [id]);
        const rows = await queryRows('SELECT rating, COUNT(*)::int AS count FROM ratings WHERE project_id = $1 GROUP BY rating', [id]);
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; rows.forEach(r => distribution[r.rating] = r.count);
        res.json({ average: Math.round(Number(summary?.average || 0) * 10) / 10, count: Number(summary?.count || 0), distribution });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Gagal mengambil rating' }); }
});

router.post('/:id/comments', authenticateToken, async (req, res) => {
    const id = projectId(req.params.id), comment = String(req.body.comment || '').trim();
    if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    if (comment.length < 1 || comment.length > 2000) return res.status(400).json({ error: 'Komentar harus 1-2000 karakter' });
    try { await run('INSERT INTO comments (project_id, user_id, comment) VALUES ($1, $2, $3)', [id, req.user.id, comment]); res.status(201).json({ message: 'Komentar berhasil ditambahkan!' }); }
    catch (err) { if (err.code === '23503') return res.status(404).json({ error: 'Project tidak ditemukan' }); console.error(err); res.status(500).json({ error: 'Komentar gagal ditambahkan' }); }
});

router.get('/:id/comments', async (req, res) => {
    const id = projectId(req.params.id); if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    try { res.json(await queryRows('SELECT c.id, c.comment, c.created_at, u.username FROM comments c JOIN users u ON u.id=c.user_id WHERE c.project_id=$1 ORDER BY c.created_at DESC', [id])); }
    catch (err) { console.error(err); res.status(500).json({ error: 'Gagal mengambil komentar' }); }
});

router.post('/:id/favorite', authenticateToken, async (req, res) => {
    const id = projectId(req.params.id); if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    try {
        const project = await queryOne('SELECT id FROM projects WHERE id=$1', [id]);
        if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' });
        const existing = await queryOne('SELECT id FROM favorites WHERE project_id=$1 AND user_id=$2', [id, req.user.id]);
        if (existing) { await run('DELETE FROM favorites WHERE id=$1', [existing.id]); return res.json({ favorited: false }); }
        await run('INSERT INTO favorites (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, id]);
        res.json({ favorited: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Favorite gagal diubah' }); }
});

router.get('/:id/favorite', async (req, res) => {
    const id = projectId(req.params.id); if (!id) return res.status(400).json({ error: 'ID project tidak valid' });
    try { const row = await queryOne('SELECT COUNT(*)::int AS count FROM favorites WHERE project_id=$1', [id]); res.json({ count: Number(row?.count || 0) }); }
    catch (err) { console.error(err); res.status(500).json({ error: 'Gagal mengambil favorite' }); }
});

module.exports = router;