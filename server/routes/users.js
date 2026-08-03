const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/users/me/favorites — Favorit user login
router.get('/me/favorites', authenticateToken, async function(req, res) {
    const userId = req.user.id;
    const db = await getDatabase();

    const result = db.exec(
        'SELECT p.* FROM projects p ' +
        'JOIN favorites f ON p.id = f.project_id ' +
        'WHERE f.user_id = ' + userId
    );

    let projects = [];
    if (result.length > 0) {
        const cols = result[0].columns;
        result[0].values.forEach(row => {
            let obj = {};
            cols.forEach((col, i) => obj[col] = row[i]);
            projects.push(obj);
        });
    }

    db.close();
    res.json(projects);
});

// GET /api/users/me/projects — Project user login
router.get('/me/projects', authenticateToken, async function(req, res) {
    const userId = req.user.id;
    const db = await getDatabase();

    const result = db.exec(
        'SELECT p.*, ' +
        '(SELECT COUNT(*) FROM ratings WHERE project_id = p.id) as rating_count, ' +
        '(SELECT AVG(rating) FROM ratings WHERE project_id = p.id) as avg_rating, ' +
        '(SELECT COUNT(*) FROM comments WHERE project_id = p.id) as comment_count, ' +
        '(SELECT COUNT(*) FROM favorites WHERE project_id = p.id) as favorite_count ' +
        'FROM projects p WHERE p.author = (SELECT username FROM users WHERE id = ' + userId + ')'
    );

    let projects = [];
    if (result.length > 0) {
        const cols = result[0].columns;
        result[0].values.forEach(row => {
            let obj = {};
            cols.forEach((col, i) => obj[col] = row[i]);
            projects.push(obj);
        });
    }

    db.close();
    res.json(projects);
});

module.exports = router;