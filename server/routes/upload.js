// ============================================
// MINEATLAS — ROUTE UPLOAD
// ============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { getDatabase, saveDatabase, run, queryOne } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const projectExtensions = new Set(['.zip', '.jar', '.mcpack', '.mcaddon', '.mcworld', '.mrpack']);
const uploadRoot = path.join(__dirname, '..', 'uploads');
const imageDir = path.join(uploadRoot, 'images');
const fileDir = path.join(uploadRoot, 'files');
fs.mkdirSync(imageDir, { recursive: true });
fs.mkdirSync(fileDir, { recursive: true });

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, file.fieldname === 'thumbnail' || file.fieldname === 'screenshots' ? imageDir : fileDir);
    },
    filename(req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024, files: 7, fields: 10 },
    fileFilter(req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (file.fieldname === 'file') {
            if (!projectExtensions.has(ext)) return cb(new Error('Format file project tidak didukung'));
        } else if (!imageTypes.has(file.mimetype) || !['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            return cb(new Error('Format gambar tidak didukung'));
        }
        cb(null, true);
    }
});

function slugify(value) {
    return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'project';
}

function uniqueSlug(db, base) {
    let slug = base;
    let n = 2;
    while (queryOne(db, 'SELECT id FROM projects WHERE slug = ?', [slug])) slug = `${base}-${n++}`;
    return slug;
}

router.post('/', authenticateToken, (req, res, next) => {
    upload.fields([
        { name: 'file', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 },
        { name: 'screenshots', maxCount: 5 }
    ])(req, res, err => {
        if (err) return res.status(400).json({ error: err.message || 'Upload tidak valid' });
        next();
    });
}, async (req, res) => {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const category = String(req.body.category || '').trim();
    const version = String(req.body.version || '').trim();
    const file = req.files?.file?.[0];
    const thumbnail = req.files?.thumbnail?.[0];

    if (title.length < 2 || title.length > 120 || description.length < 10 || description.length > 10000 || !category || version.length > 40 || !file) {
        return res.status(400).json({ error: 'Data project tidak valid atau file project belum diupload' });
    }

    const db = await getDatabase();
    try {
        const slug = uniqueSlug(db, slugify(title));
        run(db, 'INSERT INTO projects (title, slug, description, category, edition, version, author, thumbnail, download_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [title, slug, description, category, 'Java Edition', version, req.user.username, thumbnail?.filename || null, file.filename]);
        saveDatabase(db);
        res.status(201).json({ message: 'Project berhasil diupload!', slug });
    } catch (err) {
        console.error('Upload error:', err);
        // Remove files if database insertion fails.
        for (const item of [file, thumbnail, ...(req.files?.screenshots || [])]) {
            if (item?.path && fs.existsSync(item.path)) fs.unlinkSync(item.path);
        }
        res.status(500).json({ error: 'Upload gagal' });
    } finally {
        db.close();
    }
});

module.exports = router;