const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');

// GET /api/categories
router.get('/', async function(req, res) {
    const db = await getDatabase();
    const cats = db.exec('SELECT * FROM categories');
    
    let result = [];
    if (cats.length > 0) {
        const columns = cats[0].columns;
        result = cats[0].values.map(row => {
            let obj = {};
            columns.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });
    }
    
    res.json(result);
    db.close();
});

module.exports = router;
