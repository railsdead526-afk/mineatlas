const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queryOne, run } = require('../config/database');

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be configured and at least 32 characters long');
    return secret;
}

const cookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.COOKIE_SAMESITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
});

const emailOf = value => String(value || '').trim().toLowerCase();
const usernameOf = value => String(value || '').trim();

router.post('/register', async (req, res) => {
    const username = usernameOf(req.body.username);
    const email = emailOf(req.body.email);
    const password = String(req.body.password || '');
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) return res.status(400).json({ error: 'Username tidak valid' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Format email tidak valid' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password harus 8-128 karakter' });
    try {
        const existing = await queryOne('SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1', [email, username]);
        if (existing) return res.status(409).json({ error: 'Email atau username sudah terdaftar' });
        const passwordHash = await bcrypt.hash(password, 12);
        const user = await queryOne('INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, role', [username, email, passwordHash]);
        res.status(201).json({ message: 'Pendaftaran berhasil!', user });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Email atau username sudah terdaftar' });
        console.error('Register error:', err);
        res.status(500).json({ error: 'Pendaftaran gagal' });
    }
});

router.post('/login', async (req, res) => {
    const email = emailOf(req.body.email);
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email dan password harus diisi' });
    try {
        const user = await queryOne('SELECT id, username, email, password_hash, role FROM users WHERE email = $1 LIMIT 1', [email]);
        if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Email atau password salah' });
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, getJwtSecret(), { expiresIn: '7d', issuer: 'mineatlas' });
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
        const decoded = jwt.verify(token, getJwtSecret(), { issuer: 'mineatlas' });
        res.json({ id: decoded.id, username: decoded.username, role: decoded.role });
    } catch {
        res.status(401).json({ error: 'Sesi tidak valid atau sudah kedaluwarsa' });
    }
});

module.exports = router;