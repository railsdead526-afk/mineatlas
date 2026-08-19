const express = require('express');
const { queryRows } = require('../config/database');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        res.json(await queryRows('SELECT id, name, slug FROM categories ORDER BY name ASC'));
    } catch (err) {
        console.error('Categories error:', err);
        res.status(500).json({ error: 'Gagal mengambil kategori' });
    }
});

module.exports = router;