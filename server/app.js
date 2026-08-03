const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const app = express();
require('dotenv').config();

const PORT = process.env.PORT || 3000;

const projectsRoute = require('./routes/projects');
const categoriesRoute = require('./routes/categories');
const authRoute = require('./routes/auth');
const uploadRoute = require('./routes/upload');
const usersRoute = require('./routes/users');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api', function(req, res) {
    res.json({ status: 'ok', message: 'MineAtlas API Running' });
});

app.use('/api/projects', projectsRoute);
app.use('/api/categories', categoriesRoute);
app.use('/api/auth', authRoute);
app.use('/api/upload', uploadRoute);
app.use('/api/users', usersRoute);

app.listen(PORT, '0.0.0.0', function() {
    console.log('=================================');
    console.log('🚀 MineAtlas Server Berjalan');
    console.log('=================================');
    console.log('Local   : http://localhost:' + PORT);
    console.log('Network : http://0.0.0.0:' + PORT);
});