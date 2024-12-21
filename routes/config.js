// routes/config.js

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// 获取配置文件内容
router.get('/config', authenticateToken, (req, res) => {
    const configPath = path.join(__dirname, '../config/config.json');
    fs.readFile(configPath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Error reading config file' });
        }
        try {
            const config = JSON.parse(data);
            res.json({ config });
        } catch (parseErr) {
            res.status(500).json({ message: 'Error parsing config file', parseErr });
        }
    });
});

module.exports = router;
