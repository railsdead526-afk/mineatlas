// ============================================
// MINEATLAS — ROUTE AUTH (REGISTER & LOGIN)
// ============================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase, saveDatabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
require('dotenv').config();

// POST /api/auth/register — Daftar akun baru
router.post('/register', async function(req, res) {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Semua field harus diisi' });
    }

    if (password.length < 8) {
        return res.status(400).json({ error: 'Password minimal 8 karakter' });
    }

    const db = await getDatabase();

    const existing = db.exec("SELECT id FROM users WHERE email = '" + email + "'");
    if (existing.length > 0 && existing[0].values.length > 0) {
        db.close();
        return res.status(400).json({ error: 'Email sudah terdaftar' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    db.run(
        "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'user')",
        [username, email, hashedPassword]
    );

    saveDatabase(db);
    db.close();

    res.status(201).json({ message: 'Pendaftaran berhasil!' });
});

// POST /api/auth/login — Masuk ke akun
router.post('/login', async function(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email dan password harus diisi' });
    }

    const db = await getDatabase();

    const result = db.exec("SELECT * FROM users WHERE email = '" + email + "'");

    if (result.length === 0 || result[0].values.length === 0) {
        db.close();
        return res.status(401).json({ error: 'Email atau password salah' });
    }

    const columns = result[0].columns;
    const row = result[0].values[0];
    let user = {};
    columns.forEach((col, i) => user[col] = row[i]);

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
        db.close();
        return res.status(401).json({ error: 'Email atau password salah' });
    }

    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

    db.close();

    res.cookie('token', token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
        message: 'Login berhasil!',
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        }
    });
});

// POST /api/auth/logout — Keluar
router.post('/logout', function(req, res) {
    res.clearCookie('token');
    res.json({ message: 'Logout berhasil!' });
});

// GET /api/auth/me — Cek status login
router.get('/me', authenticateToken, function(req, res) {
    res.json({
        id: req.user.id,
        username: req.user.username,
        role: req.user.role
    });
});

module.exports = router;