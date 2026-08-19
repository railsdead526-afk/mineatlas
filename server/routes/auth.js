// ============================================
// MINEATLAS — ROUTE AUTH
// ============================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase, saveDatabase, queryOne, run } = require('../config/database');
require('dotenv').config();

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be configured and at least 32 characters long');
    return secret;
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeUsername(value) {
    return String(value || '').trim();
}

router.post('/register', async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!username || !email || !password) return res.status(400).json({ error: 'Semua field harus diisi' });
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) return res.status(400).json({ error: 'Username 3-24 karakter, hanya huruf, angka, dan underscore' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Format email tidak valid' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password harus 8-128 karakter' });

    const db = await getDatabase();
    try {
        const existing = queryOne(db, 'SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
        if (existing) return res.status(409).json({ error: 'Email atau username sudah terdaftar' });

        const hashedPassword = await bcrypt.hash(password, 12);
        run(db, 'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)', [username, email, hashedPassword, 'user']);
        saveDatabase(db);
        return res.status(201).json({ message: 'Pendaftaran berhasil!' });
    } catch (err) {
        console.error('Register error:', err);
        return res.status(500).json({ error: 'Pendaftaran gagal' });
    } finally {
        db.close();
    }
});

router.post('/login', async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email dan password harus diisi' });

    const db = await getDatabase();
    try {
        const user = queryOne(db, 'SELECT id, username, email, password, role FROM users WHERE email = ?', [email]);
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Email atau password salah' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            getJwtSecret(),
            { expiresIn: '7d', issuer: 'mineatlas' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.COOKIE_SAMESITE || 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/'
        });

        return res.json({
            message: 'Login berhasil!',
            user: { id: user.id, username: user.username, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Login gagal' });
    } finally {
        db.close();
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.COOKIE_SAMESITE || 'lax',
        path: '/'
    });
    res.json({ message: 'Logout berhasil!' });
});

router.get('/me', (req, res) => {
    const token = req.cookies && req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Silakan login terlebih dahulu' });
    try {
        const decoded = jwt.verify(token, getJwtSecret(), { issuer: 'mineatlas' });
        res.json({ id: decoded.id, username: decoded.username, role: decoded.role });
    } catch {
        res.status(401).json({ error: 'Sesi tidak valid atau sudah kedaluwarsa' });
    }
});

module.exports = router;