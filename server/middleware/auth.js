// ============================================
// MINEATLAS — MIDDLEWARE AUTHENTIKASI
// ============================================

const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware: cek apakah user sudah login
function authenticateToken(req, res, next) {
    // Ambil token dari cookie
    const token = req.cookies && req.cookies.token;

    if (!token) {
        return res.status(401).json({ error: 'Silakan login terlebih dahulu' });
    }

    // Verifikasi token
    jwt.verify(token, process.env.JWT_SECRET, function(err, user) {
        if (err) {
            return res.status(403).json({ error: 'Token tidak valid' });
        }

        // Simpan data user ke request
        req.user = user;
        next();
    });
}

module.exports = { authenticateToken };
