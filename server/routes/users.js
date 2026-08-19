const express = require('express');
const { queryRows } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/me/favorites', authenticateToken, async (req, res) => {
    try {
        const projects = await queryRows(`SELECT p.* FROM projects p JOIN favorites f ON f.project_id = p.id WHERE f.user_id = $1 ORDER BY f.created_at DESC`, [req.user.id]);
        res.json(projects);
    } catch (err) {
        console.error('Favorites error:', err);
        res.status(500).json({ error: 'Gagal mengambil favorit' });
    }
});

router.get('/me/projects', authenticateToken, async (req, res) => {
    try {
        const projects = await queryRows(`
            SELECT p.*, COUNT(DISTINCT r.id)::int AS rating_count,
                   COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS avg_rating,
                   COUNT(DISTINCT c.id)::int AS comment_count,
                   COUNT(DISTINCT f.id)::int AS favorite_count
            FROM projects p
            LEFT JOIN ratings r ON r.project_id = p.id
            LEFT JOIN comments c ON c.project_id = p.id
            LEFT JOIN favorites f ON f.project_id = p.id
            WHERE p.author_id = $1
            GROUP BY p.id
            ORDER BY p.created_at DESC`, [req.user.id]);
        res.json(projects);
    } catch (err) {
        console.error('User projects error:', err);
        res.status(500).json({ error: 'Gagal mengambil project' });
    }
});

module.exports = router;