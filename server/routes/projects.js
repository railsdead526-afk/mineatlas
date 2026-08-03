const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getDatabase, saveDatabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/projects — Search + Filter + Sort + Pagination
router.get('/', async function(req, res) {
    const db = await getDatabase();
    const { q, category, version, author, sort, page, limit } = req.query;
    const currentPage = parseInt(page) || 1;
    const perPage = parseInt(limit) || 20;
    const offset = (currentPage - 1) * perPage;

    let where = [];
    if (q) where.push("(title LIKE '%" + q + "%' OR description LIKE '%" + q + "%' OR author LIKE '%" + q + "%')");
    if (category) where.push("category = '" + category + "'");
    if (version) where.push("version = '" + version + "'");
    if (author) where.push("author = '" + author + "'");

    let whereClause = where.length > 0 ? ' WHERE ' + where.join(' AND ') : '';

    let orderBy = ' ORDER BY created_at DESC';
    if (sort === 'oldest') orderBy = ' ORDER BY created_at ASC';
    else if (sort === 'downloads') orderBy = ' ORDER BY downloads DESC';
    else if (sort === 'rating') orderBy = ' ORDER BY (SELECT AVG(rating) FROM ratings WHERE project_id = projects.id) DESC';

    const countResult = db.exec('SELECT COUNT(*) as total FROM projects' + whereClause);
    let total = 0;
    if (countResult.length > 0 && countResult[0].values.length > 0) total = countResult[0].values[0][0];
    const totalPages = Math.ceil(total / perPage);

    const projects = db.exec('SELECT * FROM projects' + whereClause + orderBy + ' LIMIT ' + perPage + ' OFFSET ' + offset);
    let items = [];
    if (projects.length > 0) {
        const columns = projects[0].columns;
        items = projects[0].values.map(row => {
            let obj = {};
            columns.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });
    }

    db.close();
    res.json({ items, total, page: currentPage, totalPages, hasNext: currentPage < totalPages, hasPrev: currentPage > 1 });
});

// GET /api/projects/:id - Satu project
router.get('/:id', async function(req, res) {
    const db = await getDatabase();
    const projects = db.exec('SELECT * FROM projects WHERE id = ' + parseInt(req.params.id));
    if (projects.length > 0 && projects[0].values.length > 0) {
        const columns = projects[0].columns;
        const row = projects[0].values[0];
        let obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        res.json(obj);
    } else {
        res.status(404).json({ error: 'Project tidak ditemukan' });
    }
    db.close();
});

// GET /api/projects/:id/download
router.get('/:id/download', async function(req, res) {
    const db = await getDatabase();
    const projects = db.exec('SELECT * FROM projects WHERE id = ' + parseInt(req.params.id));
    if (projects.length === 0 || projects[0].values.length === 0) { db.close(); return res.status(404).json({ error: 'Project tidak ditemukan' }); }
    const columns = projects[0].columns;
    const row = projects[0].values[0];
    let project = {};
    columns.forEach((col, i) => project[col] = row[i]);
    if (!project.download_url) { db.close(); return res.status(404).json({ error: 'File tidak tersedia' }); }
    const filePath = path.join(__dirname, '..', 'uploads', 'files', project.download_url);
    if (!fs.existsSync(filePath)) { db.close(); return res.status(404).json({ error: 'File tidak ditemukan di server' }); }
    db.run('UPDATE projects SET downloads = downloads + 1 WHERE id = ' + project.id);
    saveDatabase(db); db.close();
    res.download(filePath, project.download_url);
});

// PUT /api/projects/:id
router.put('/:id', authenticateToken, async function(req, res) {
    const projectId = parseInt(req.params.id);
    const db = await getDatabase();
    const projects = db.exec('SELECT * FROM projects WHERE id = ' + projectId);
    if (projects.length === 0 || projects[0].values.length === 0) { db.close(); return res.status(404).json({ error: 'Project tidak ditemukan' }); }
    const cols = projects[0].columns;
    const row = projects[0].values[0];
    let project = {};
    cols.forEach((col, i) => project[col] = row[i]);
    if (project.author !== req.user.username) { db.close(); return res.status(403).json({ error: 'Anda bukan pemilik project ini' }); }
    const { title, description, category, version } = req.body;
    if (title) db.run('UPDATE projects SET title = ? WHERE id = ' + projectId, [title]);
    if (description) db.run('UPDATE projects SET description = ? WHERE id = ' + projectId, [description]);
    if (category) db.run('UPDATE projects SET category = ? WHERE id = ' + projectId, [category]);
    if (version) db.run('UPDATE projects SET version = ? WHERE id = ' + projectId, [version]);
    saveDatabase(db); db.close();
    res.json({ message: 'Project berhasil diupdate!' });
});

// DELETE /api/projects/:id
router.delete('/:id', authenticateToken, async function(req, res) {
    const projectId = parseInt(req.params.id);
    const db = await getDatabase();
    const projects = db.exec('SELECT * FROM projects WHERE id = ' + projectId);
    if (projects.length === 0 || projects[0].values.length === 0) { db.close(); return res.status(404).json({ error: 'Project tidak ditemukan' }); }
    const cols = projects[0].columns;
    const row = projects[0].values[0];
    let project = {};
    cols.forEach((col, i) => project[col] = row[i]);
    if (project.author !== req.user.username) { db.close(); return res.status(403).json({ error: 'Anda bukan pemilik project ini' }); }
    if (project.download_url) { const fp = path.join(__dirname, '..', 'uploads', 'files', project.download_url); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
    if (project.thumbnail) { const tp = path.join(__dirname, '..', 'uploads', 'images', project.thumbnail); if (fs.existsSync(tp)) fs.unlinkSync(tp); }
    db.run('DELETE FROM ratings WHERE project_id = ' + projectId);
    db.run('DELETE FROM comments WHERE project_id = ' + projectId);
    db.run('DELETE FROM favorites WHERE project_id = ' + projectId);
    db.run('DELETE FROM projects WHERE id = ' + projectId);
    saveDatabase(db); db.close();
    res.json({ message: 'Project berhasil dihapus!' });
});

// POST /api/projects/:id/rating
router.post('/:id/rating', authenticateToken, async function(req, res) {
    const projectId = parseInt(req.params.id);
    const userId = req.user.id;
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating harus 1 sampai 5' });
    const db = await getDatabase();
    const existing = db.exec('SELECT id FROM ratings WHERE project_id = ' + projectId + ' AND user_id = ' + userId);
    if (existing.length > 0 && existing[0].values.length > 0) {
        db.run('UPDATE ratings SET rating = ' + rating + ' WHERE project_id = ' + projectId + ' AND user_id = ' + userId);
    } else {
        db.run('INSERT INTO ratings (project_id, user_id, rating) VALUES (' + projectId + ', ' + userId + ', ' + rating + ')');
    }
    saveDatabase(db); db.close();
    res.json({ message: 'Rating berhasil disimpan!' });
});

// GET /api/projects/:id/rating
router.get('/:id/rating', async function(req, res) {
    const projectId = parseInt(req.params.id);
    const db = await getDatabase();
    const avgResult = db.exec('SELECT AVG(rating) as avg, COUNT(*) as count FROM ratings WHERE project_id = ' + projectId);
    let avg = 0, count = 0;
    if (avgResult.length > 0 && avgResult[0].values.length > 0) { const c = avgResult[0].columns; const r = avgResult[0].values[0]; avg = r[c.indexOf('avg')] || 0; count = r[c.indexOf('count')] || 0; }
    const dist = db.exec('SELECT rating, COUNT(*) as count FROM ratings WHERE project_id = ' + projectId + ' GROUP BY rating');
    let distribution = {1:0, 2:0, 3:0, 4:0, 5:0};
    if (dist.length > 0) { const dC = dist[0].columns; dist[0].values.forEach(row => { let o = {}; dC.forEach((col, i) => o[col] = row[i]); distribution[o.rating] = o.count; }); }
    db.close();
    res.json({ average: Math.round(avg * 10) / 10, count, distribution });
});

// POST /api/projects/:id/comments
router.post('/:id/comments', authenticateToken, async function(req, res) {
    const projectId = parseInt(req.params.id);
    const userId = req.user.id;
    const { comment } = req.body;
    if (!comment || comment.trim() === '') return res.status(400).json({ error: 'Komentar tidak boleh kosong' });
    const db = await getDatabase();
    db.run('INSERT INTO comments (project_id, user_id, comment) VALUES (?, ?, ?)', [projectId, userId, comment]);
    saveDatabase(db); db.close();
    res.status(201).json({ message: 'Komentar berhasil ditambahkan!' });
});

// GET /api/projects/:id/comments
router.get('/:id/comments', async function(req, res) {
    const projectId = parseInt(req.params.id);
    const db = await getDatabase();
    const result = db.exec('SELECT c.id, c.comment, c.created_at, u.username FROM comments c JOIN users u ON c.user_id = u.id WHERE c.project_id = ' + projectId + ' ORDER BY c.created_at DESC');
    let comments = [];
    if (result.length > 0) { const cols = result[0].columns; result[0].values.forEach(row => { let obj = {}; cols.forEach((col, i) => obj[col] = row[i]); comments.push(obj); }); }
    db.close();
    res.json(comments);
});

// POST /api/projects/:id/favorite
router.post('/:id/favorite', authenticateToken, async function(req, res) {
    const projectId = parseInt(req.params.id);
    const userId = req.user.id;
    const db = await getDatabase();
    const existing = db.exec('SELECT id FROM favorites WHERE project_id = ' + projectId + ' AND user_id = ' + userId);
    if (existing.length > 0 && existing[0].values.length > 0) {
        db.run('DELETE FROM favorites WHERE project_id = ' + projectId + ' AND user_id = ' + userId);
        saveDatabase(db); db.close();
        return res.json({ favorited: false });
    } else {
        db.run('INSERT INTO favorites (user_id, project_id) VALUES (' + userId + ', ' + projectId + ')');
        saveDatabase(db); db.close();
        return res.json({ favorited: true });
    }
});

// GET /api/projects/:id/favorite
router.get('/:id/favorite', async function(req, res) {
    const projectId = parseInt(req.params.id);
    const db = await getDatabase();
    const countResult = db.exec('SELECT COUNT(*) as count FROM favorites WHERE project_id = ' + projectId);
    let count = 0;
    if (countResult.length > 0 && countResult[0].values.length > 0) count = countResult[0].values[0][0];
    db.close();
    res.json({ count });
});

module.exports = router;