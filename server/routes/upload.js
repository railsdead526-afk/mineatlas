// ============================================
// MINEATLAS — ROUTE UPLOAD
// ============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getDatabase, saveDatabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Konfigurasi multer
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        if (file.fieldname === 'thumbnail' || file.fieldname === 'screenshots') {
            cb(null, 'uploads/images');
        } else {
            cb(null, 'uploads/files');
        }
    },
    filename: function(req, file, cb) {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// POST /api/upload — Upload project (butuh login)
router.post('/', authenticateToken, upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
    { name: 'screenshots', maxCount: 5 }
]), async function(req, res) {
    try {
        const { title, description, category, version } = req.body;
        const author = req.user.username;

        if (!title || !description || !category || !version) {
            return res.status(400).json({ error: 'Semua field harus diisi' });
        }

        const file = req.files['file'] ? req.files['file'][0] : null;
        const thumbnail = req.files['thumbnail'] ? req.files['thumbnail'][0] : null;

        if (!file) {
            return res.status(400).json({ error: 'File project wajib diupload' });
        }

        const db = await getDatabase();
        const slug = title.toLowerCase().replace(/\s+/g, '-');

        db.run(
            'INSERT INTO projects (title, slug, description, category, edition, version, author, thumbnail, download_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [title, slug, description, category, 'Java Edition', version, author, thumbnail ? thumbnail.filename : null, file.filename]
        );

        saveDatabase(db);
        db.close();

        res.status(201).json({ message: 'Project berhasil diupload!' });
    } catch (err) {
        res.status(500).json({ error: 'Upload gagal' });
    }
});

module.exports = router;
