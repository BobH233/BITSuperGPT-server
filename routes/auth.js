// routes/auth.js

const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid'); // 用于生成唯一的 jti
const redisClient = require('../redisClient'); // 引入 Redis 客户端

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

// 登录接口
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const db = new sqlite3.Database('./database.sqlite');
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) {
            db.close();
            return res.status(500).json({ message: 'Database error' });
        }
        if (!user) {
            db.close();
            return res.status(400).json({ message: 'Invalid username or password' });
        }
        bcrypt.compare(password, user.password, async (err, result) => {
            if (err) {
                db.close();
                return res.status(500).json({ message: 'Error comparing passwords' });
            }
            if (!result) {
                db.close();
                return res.status(400).json({ message: 'Invalid username or password' });
            }
            // 生成唯一的 jti
            const jti = uuidv4();

            // 生成 JWT，包含 nickname
            const token = jwt.sign(
                { id: user.id, username: user.username, nickname: user.nickname, is_admin: user.is_admin, jti },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            const userJtiKey = `user:${user.id}:tokens`;
            try {
                await redisClient.set(`token:${jti}`, 'valid', { EX: 7 * 24 * 60 * 60 });
                await redisClient.sAdd(userJtiKey, jti);
            } catch (redisErr) {
                console.error('Redis error:', redisErr);
            }
            // 记录登录行为
            const loginTime = new Date().toISOString();
            db.run(
                `INSERT INTO login_logs (user_id, username, login_time) VALUES (?, ?, ?)`,
                [user.id, user.username, loginTime],
                (err) => {
                    if (err) {
                        console.error('记录登录行为时出错:', err);
                    }
                    db.close();
                    res.json({ token });
                }
            );
        });
    });
});

// 获取登录状态接口
router.get('/status', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const db = new sqlite3.Database('./database.sqlite');

    db.get(`SELECT * FROM users WHERE id = ?`, [userId], async (err, user) => {
        if (err) {
            db.close();
            return res.status(500).json({ message: 'database error' });
        }

        if (!user) {
            db.close();
            return res.status(404).json({ message: 'user not found' });
        }
        req.user.nickname = user.nickname;
        req.user.is_admin = user.is_admin;
        res.json({ loggedIn: true, user: req.user });
    });
});

router.post('/revoke-all-tokens', authenticateToken, authorizeAdmin, async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ message: 'userId is required' });
    }

    const userTokensKey = `user:${userId}:tokens`;

    try {
        const jtIs = await redisClient.sMembers(userTokensKey);
        if (jtIs.length === 0) {
            return res.status(400).json({ message: 'User has no active tokens' });
        }

        // 删除每个 token:jti
        const pipeline = redisClient.multi();
        jtIs.forEach(jti => {
            pipeline.del(`token:${jti}`);
        });
        // 删除用户的 token 集合
        pipeline.del(userTokensKey);
        await pipeline.exec();

        res.json({ message: `All tokens for user ${userId} have been revoked` });
    } catch (err) {
        console.error('Redis error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/logout', authenticateToken, async (req, res) => {
    const jti = req.user.jti;
    if (!jti) {
        return res.status(400).json({ message: 'Invalid token structure' });
    }

    try {
        await redisClient.del(`token:${jti}`);
        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        console.error('Redis error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 添加用户接口（仅管理员）
router.post('/add-user', authenticateToken, authorizeAdmin, (req, res) => {
    const { username, password, nickname, is_admin } = req.body;
    if (!username || !password || !nickname) {
        return res.status(400).json({ message: 'Username, password, and nickname are required' });
    }
    const db = new sqlite3.Database('./database.sqlite');
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            db.close();
            return res.status(500).json({ message: 'Error hashing password' });
        }
        db.run(
            `INSERT INTO users (username, password, nickname, is_admin) VALUES (?, ?, ?, ?)`,
            [username, hash, nickname, is_admin ? 1 : 0],
            function (err) {
                if (err) {
                    db.close();
                    if (err.code === 'SQLITE_CONSTRAINT') {
                        return res.status(400).json({ message: 'Username already exists' });
                    }
                    return res.status(500).json({ message: 'Error adding user' });
                }
                db.close();
                res.json({ message: 'User added successfully', user_id: this.lastID });
            }
        );
    });
});

router.post('/change-password', authenticateToken, async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    // 验证输入
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: 'parameter not enough' });
    }

    const userId = req.user.id;
    const db = new sqlite3.Database('./database.sqlite');

    db.get(`SELECT password FROM users WHERE id = ?`, [userId], async (err, row) => {
        if (err) {
            db.close();
            return res.status(500).json({ message: 'database error' });
        }

        if (!row) {
            db.close();
            return res.status(404).json({ message: 'user not found' });
        }

        const hashedPassword = row.password;

        // 比较旧密码
        bcrypt.compare(oldPassword, hashedPassword, async (err, isMatch) => {
            if (err) {
                db.close();
                return res.status(500).json({ message: 'oldPassword wrong!' });
            }

            if (!isMatch) {
                db.close();
                return res.status(400).json({ message: 'oldPassword wrong!' });
            }

            // 哈希新密码
            try {
                const saltRounds = 10;
                const newHashedPassword = await bcrypt.hash(newPassword, saltRounds);

                // 更新数据库中的密码
                db.run(`UPDATE users SET password = ? WHERE id = ?`, [newHashedPassword, userId], async function (err) {
                    if (err) {
                        db.close();
                        return res.status(500).json({ message: 'Update error.' });
                    }

                    db.close();

                    // 吊销所有现有的令牌
                    const userTokensKey = `user:${userId}:tokens`;
                    try {
                        const jtis = await redisClient.sMembers(userTokensKey);
                        if (jtis.length > 0) {
                            const pipeline = redisClient.multi();
                            jtis.forEach(jti => {
                                pipeline.del(`token:${jti}`);
                            });
                            pipeline.del(userTokensKey);
                            await pipeline.exec();
                        }
                    } catch (redisErr) {
                        console.error('吊销令牌时出错:', redisErr);
                    }

                    res.json({ message: 'password changed!' });
                });
            } catch (hashErr) {
                db.close();
                return res.status(500).json({ message: 'password hash error.' });
            }
        });
    });
});

module.exports = router;