// ============================================
// MINEATLAS — AUTHENTICATION MIDDLEWARE
// ============================================

const jwt = require('jsonwebtoken');
require('dotenv').config();

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be configured and at least 32 characters long');
    return secret;
}

function authenticateToken(req, res, next) {
    const token = req.cookies && req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Silakan login terlebih dahulu' });

    try {
        const user = jwt.verify(token, getJwtSecret(), { issuer: 'mineatlas' });
        req.user = user;
        next();
    } catch {
        res.status(401).json({ error: 'Sesi tidak valid atau sudah kedaluwarsa' });
    }
}

module.exports = { authenticateToken };