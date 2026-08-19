const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { queryOne, run } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const imageExt = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const projectExt = new Set(['.zip', '.jar', '.mcpack', '.mcaddon', '.mcworld', '.mrpack']);
const root = path.join(__dirname, '..', 'uploads');
const images = path.join(root, 'images');
const files = path.join(root, 'files');
fs.mkdirSync(images, { recursive: true }); fs.mkdirSync(files, { recursive: true });

const maxMb = Math.max(1, Number(process.env.UPLOAD_MAX_MB || 50));
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, file.fieldname === 'file' ? files : images),
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
    storage,
    limits: { fileSize: maxMb * 1024 * 1024, files: 7, fields: 10 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (file.fieldname === 'file' && !projectExt.has(ext)) return cb(new Error('Format project tidak didukung'));
        if (file.fieldname !== 'file' && (!imageTypes.has(file.mimetype) || !imageExt.has(ext))) return cb(new Error('Format gambar tidak didukung'));
        cb(null, true);
    }
});

function slugify(value) { return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'project'; }
async function uniqueSlug(base) {
    let slug = base, n = 2;
    while (await queryOne('SELECT id FROM projects WHERE slug=$1', [slug])) slug = `${base}-${n++}`;
    return slug;
}
function cleanup(items) { for (const item of items) if (item?.path && fs.existsSync(item.path)) fs.unlinkSync(item.path); }

router.post('/', authenticateToken, (req, res, next) => {
    upload.fields([{ name: 'file', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }, { name: 'screenshots', maxCount: 5 }])(req, res, err => {
        if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.message || 'Upload tidak valid' });
        next();
    });
}, async (req, res) => {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const categorySlug = String(req.body.category || '').trim();
    const version = String(req.body.version || '').trim();
    const edition = String(req.body.edition || 'Java Edition').trim();
    const file = req.files?.file?.[0];
    const thumbnail = req.files?.thumbnail?.[0];
    const screenshots = req.files?.screenshots || [];

    if (title.length < 2 || title.length > 160 || description.length < 10 || description.length > 10000 || version.length > 40 || edition.length > 40 || !categorySlug || !file) {
        cleanup([file, thumbnail, ...screenshots]);
        return res.status(400).json({ error: 'Data project tidak valid atau file belum diupload' });
    }
    try {
        const category = await queryOne('SELECT id FROM categories WHERE slug=$1', [categorySlug]);
        if (!category) { cleanup([file, thumbnail, ...screenshots]); return res.status(400).json({ error: 'Kategori tidak ditemukan' }); }
        const slug = await uniqueSlug(slugify(title));
        const project = await queryOne(`INSERT INTO projects (title, slug, description, category_id, edition, version, author_id, thumbnail, download_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, slug`, [title, slug, description, category.id, edition, version || null, req.user.id, thumbnail?.filename || null, file.filename]);
        // Screenshots are intentionally not stored in the DB yet. Remove them rather than creating orphan files.
        cleanup(screenshots);
        res.status(201).json({ message: 'Project berhasil diupload!', project });
    } catch (err) {
        console.error('Upload error:', err);
        cleanup([file, thumbnail, ...screenshots]);
        res.status(500).json({ error: 'Upload gagal' });
    }
});

module.exports = router;