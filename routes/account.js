// routes/game.js

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 字节密钥
const IV_LENGTH = 16; // AES block size

// 加密函数
function encrypt(text) {
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// 假设游戏账号密码存储在一个文件中（可根据实际情况调整）
const gameAccountsPath = path.join(__dirname, '../config/accounts.json');

// 获取游戏账号密码接口
router.get('/gpt-credentials', authenticateToken, (req, res) => {
    fs.readFile(gameAccountsPath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Error reading game accounts file' });
        }
        try {
            const accounts = JSON.parse(data);
            const encryptedAccounts = accounts.map(acc => ({
                account: encrypt(acc.account),
                password: encrypt(acc.password)
            }));
            res.json({ accounts: encryptedAccounts });
        } catch (parseErr) {
            res.status(500).json({ message: 'Error parsing gpt accounts file', parseErr });
        }
    });
});

module.exports = router;
