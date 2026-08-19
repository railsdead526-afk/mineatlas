const express = require('express');
const router = express.Router();
const { getDatabase, queryRows } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.get('/me/favorites', authenticateToken, async (req, res) => {
    const db = await getDatabase();
    try {
        const projects = queryRows(db,
            'SELECT p.* FROM projects p JOIN favorites f ON p.id = f.project_id WHERE f.user_id = ? ORDER BY f.created_at DESC',
            [req.user.id]
        );
        res.json(projects);
    } finally { db.close(); }
});

router.get('/me/projects', authenticateToken, async (req, res) => {
    const db = await getDatabase();
    try {
        const projects = queryRows(db,
            'SELECT p.*, (SELECT COUNT(*) FROM ratings WHERE project_id = p.id) AS rating_count, (SELECT AVG(rating) FROM ratings WHERE project_id = p.id) AS avg_rating, (SELECT COUNT(*) FROM comments WHERE project_id = p.id) AS comment_count, (SELECT COUNT(*) FROM favorites WHERE project_id = p.id) AS favorite_count FROM projects p WHERE p.author = (SELECT username FROM users WHERE id = ?) ORDER BY p.created_at DESC',
            [req.user.id]
        );
        res.json(projects);
    } finally { db.close(); }
});

module.exports = router;