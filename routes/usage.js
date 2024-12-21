// routes/usage.js

const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// 记录 ChatGPT API 调用
router.post('/record', authenticateToken, (req, res) => {
    const { model, conversation_id, is_new_conversation } = req.body;
    const user_id = req.user.id;
    const usage_time = new Date().toISOString();

    if (!model || !conversation_id || typeof is_new_conversation !== 'boolean') {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const db = new sqlite3.Database('./database.sqlite');
    db.run(
        `INSERT INTO chatgpt_usage (user_id, model, conversation_id, is_new_conversation, usage_time) VALUES (?, ?, ?, ?, ?)`,
        [user_id, model, conversation_id, is_new_conversation ? 1 : 0, usage_time],
        function (err) {
            if (err) {
                db.close();
                return res.status(500).json({ message: 'Error recording usage' });
            }
            db.close();
            res.json({ message: 'Usage recorded successfully' });
        }
    );
});

// 接口1: 筛选用户的新建会话 conversation_id
router.post('/filter-conversations', authenticateToken, (req, res) => {
    const { user_id, conversation_ids } = req.body;

    if (!user_id || !Array.isArray(conversation_ids)) {
        return res.status(400).json({ message: 'Invalid parameters' });
    }

    const db = new sqlite3.Database('./database.sqlite');
    const placeholders = conversation_ids.map(() => '?').join(',');
    const query = `
        SELECT conversation_id 
        FROM chatgpt_usage 
        WHERE user_id = ? 
          AND conversation_id IN (${placeholders}) 
          AND is_new_conversation = 1
    `;
    db.all(query, [user_id, ...conversation_ids], (err, rows) => {
        if (err) {
            db.close();
            return res.status(500).json({ message: 'Database error' });
        }
        const filtered_conversation_ids = rows.map(row => row.conversation_id);
        db.close();
        res.json({ conversation_ids: filtered_conversation_ids });
    });
});

// 接口2: 查询用户在某个时间段内对各个模型的用量情况
router.get('/user-usage', authenticateToken, (req, res) => {
    const { user_id, start_time, end_time } = req.query;

    if (!user_id || !start_time || !end_time) {
        return res.status(400).json({ message: 'Missing query parameters' });
    }

    const db = new sqlite3.Database('./database.sqlite');
    const query = `
        SELECT model, COUNT(*) as usage_count 
        FROM chatgpt_usage 
        WHERE user_id = ? 
          AND usage_time BETWEEN ? AND ? 
        GROUP BY model
    `;
    db.all(query, [user_id, start_time, end_time], (err, rows) => {
        if (err) {
            db.close();
            return res.status(500).json({ message: 'Database error' });
        }
        db.close();
        res.json({ usage: rows });
    });
});

// 接口3: 查询所有用户在某个时间段内对各个模型的用量情况，并返回用户信息
router.get('/all-users-usage', authenticateToken, (req, res) => {
    const { start_time, end_time } = req.query;

    if (!start_time || !end_time) {
        return res.status(400).json({ message: 'Missing query parameters' });
    }

    const db = new sqlite3.Database('./database.sqlite');
    const query = `
        SELECT 
            u.id AS user_id,
            u.username,
            u.nickname,
            u.is_admin,
            cu.model,
            COUNT(*) AS usage_count
        FROM 
            chatgpt_usage cu
        JOIN 
            users u ON cu.user_id = u.id
        WHERE 
            cu.usage_time BETWEEN ? AND ?
        GROUP BY 
            u.id, cu.model
    `;
    db.all(query, [start_time, end_time], (err, rows) => {
        if (err) {
            console.error('查询所有用户用量时出错:', err);
            db.close();
            return res.status(500).json({ message: 'Database error' });
        }

        // 关闭数据库连接
        db.close();

        // 格式化结果
        const usage = rows.map(row => ({
            user_id: row.user_id,
            username: row.username,
            nickname: row.nickname,
            is_admin: Boolean(row.is_admin),
            model: row.model,
            usage_count: row.usage_count
        }));

        res.json({ usage });
    });
});

router.get('/user-usage-details', authenticateToken, authorizeAdmin, (req, res) => {
    const { user_id, start_time, end_time } = req.query;

    if (!user_id || !start_time || !end_time) {
        return res.status(400).json({ message: 'Missing query parameters' });
    }

    const db = new sqlite3.Database('./database.sqlite');
    const query = `
        SELECT id, model, conversation_id, is_new_conversation, usage_time 
        FROM chatgpt_usage 
        WHERE user_id = ? 
          AND usage_time BETWEEN ? AND ?
        ORDER BY usage_time DESC
    `;
    db.all(query, [user_id, start_time, end_time], (err, rows) => {
        if (err) {
            db.close();
            return res.status(500).json({ message: 'Database error' });
        }
        db.close();
        res.json({ usage: rows });
    });
});

router.get('/all-users-usage-details', authenticateToken, authorizeAdmin, (req, res) => {
    const { start_time, end_time } = req.query;

    if (!start_time || !end_time) {
        return res.status(400).json({ message: 'Missing query parameters' });
    }

    const db = new sqlite3.Database('./database.sqlite');
    const query = `
        SELECT 
            u.id AS user_id,
            u.username,
            u.nickname,
            u.is_admin,
            cu.id AS usage_id,
            cu.model,
            cu.conversation_id,
            cu.is_new_conversation,
            cu.usage_time 
        FROM 
            chatgpt_usage cu
        JOIN 
            users u ON cu.user_id = u.id
        WHERE 
            cu.usage_time BETWEEN ? AND ?
        ORDER BY 
            u.id, cu.usage_time DESC
    `;
    db.all(query, [start_time, end_time], (err, rows) => {
        if (err) {
            console.error('查询所有用户详细用量时出错:', err);
            db.close();
            return res.status(500).json({ message: 'Database error' });
        }

        // 关闭数据库连接
        db.close();

        // 格式化结果
        const usageDetails = rows.map(row => ({
            user_id: row.user_id,
            username: row.username,
            nickname: row.nickname,
            is_admin: Boolean(row.is_admin),
            usage_id: row.usage_id,
            model: row.model,
            conversation_id: row.conversation_id,
            is_new_conversation: Boolean(row.is_new_conversation),
            usage_time: row.usage_time
        }));

        res.json({ usage: usageDetails });
    });
});


module.exports = router;
