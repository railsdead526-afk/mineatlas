const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { queryOne } = require('../config/database');

const router = express.Router();

function jwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be configured and at least 32 characters long');
    return secret;
}

function cookieOptions() {
    const production = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: production,
        sameSite: process.env.COOKIE_SAMESITE || (production ? 'none' : 'lax'),
        maxAge: 7 * 86400000,
        path: '/'
    };
}

function csrfCookieOptions() {
    const production = process.env.NODE_ENV === 'production';
    return {
        httpOnly: false,
        secure: production,
        sameSite: process.env.COOKIE_SAMESITE || (production ? 'none' : 'lax'),
        maxAge: 7 * 86400000,
        path: '/'
    };
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[a-zA-Z0-9_]{3,24}$/;

router.get('/csrf', (req, res) => {
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie('csrf_token', token, csrfCookieOptions());
    res.json({ csrfToken: token });
});

router.post('/register', async (req, res) => {
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!username || !email || !password) return res.status(400).json({ error: 'Semua field harus diisi' });
    if (!usernamePattern.test(username)) return res.status(400).json({ error: 'Username 3-24 karakter, hanya huruf, angka, dan underscore' });
    if (!emailPattern.test(email) || email.length > 255) return res.status(400).json({ error: 'Format email tidak valid' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password harus 8-128 karakter' });

    try {
        if (await queryOne('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username])) return res.status(409).json({ error: 'Email atau username sudah terdaftar' });
        const passwordHash = await bcrypt.hash(password, 12);
        const user = await queryOne('INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, role', [username, email, passwordHash]);
        res.status(201).json({ message: 'Pendaftaran berhasil!', user });
    } catch (err) {
        console.error('Register error:', err);
        if (err.code === '23505') return res.status(409).json({ error: 'Email atau username sudah terdaftar' });
        res.status(500).json({ error: 'Pendaftaran gagal' });
    }
});

router.post('/login', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email dan password harus diisi' });
    try {
        const user = await queryOne('SELECT id, username, email, password_hash, role FROM users WHERE email = $1', [email]);
        if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Email atau password salah' });
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, jwtSecret(), { expiresIn: '7d', issuer: 'mineatlas' });
        res.cookie('token', token, cookieOptions());
        res.json({ message: 'Login berhasil!', user: { id: user.id, username: user.username, email: user.email, role: user.role } });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login gagal' });
    }
});

router.post('/logout', (req, res) => {
    const options = cookieOptions();
    delete options.maxAge;
    res.clearCookie('token', options);
    res.json({ message: 'Logout berhasil!' });
});

router.get('/me', (req, res) => {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'Silakan login terlebih dahulu' });
    try {
        const user = jwt.verify(token, jwtSecret(), { issuer: 'mineatlas' });
        res.json({ id: user.id, username: user.username, role: user.role });
    } catch {
        res.status(401).json({ error: 'Sesi tidak valid atau sudah kedaluwarsa' });
    }
});

module.exports = router;
