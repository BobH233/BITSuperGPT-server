// database/initialize.js 

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

// 确保数据库文件路径正确
const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('无法连接到数据库', err);
        process.exit(1);
    }
    console.log('已连接到 SQLite 数据库。');
});

db.serialize(() => {
    // 创建 users 表，添加 nickname 字段
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            nickname TEXT,  -- 新增 nickname 字段
            is_admin INTEGER DEFAULT 0
        )
    `, (err) => {
        if (err) {
            console.error('创建 users 表时出错:', err);
            db.close();
            process.exit(1);
        } else {
            console.log('确保 users 表存在。');
        }
    });

    // 创建 login_logs 表
    db.run(`
        CREATE TABLE IF NOT EXISTS login_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            username TEXT,
            login_time TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `, (err) => {
        if (err) {
            console.error('创建 login_logs 表时出错:', err);
            db.close();
            process.exit(1);
        } else {
            console.log('确保 login_logs 表存在。');
        }
    });

    // 创建 chatgpt_usage 表
    db.run(`
        CREATE TABLE IF NOT EXISTS chatgpt_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            model TEXT,
            conversation_id TEXT,
            is_new_conversation INTEGER,
            usage_time TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `, (err) => {
        if (err) {
            console.error('创建 chatgpt_usage 表时出错:', err);
            db.close();
            process.exit(1);
        } else {
            console.log('确保 chatgpt_usage 表存在。');
        }
    });

    // 添加 userGroup 列
    function addUserGroupColumn() {
        db.run(`ALTER TABLE users ADD COLUMN userGroup INTEGER DEFAULT 0`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log('userGroup 列已存在，跳过添加。');
                } else {
                    console.error('添加 userGroup 列时出错:', err);
                    db.close();
                    process.exit(1);
                }
            } else {
                console.log('已成功添加 userGroup 列到 users 表。');
            }
        });
    }

    // 检查 userGroup 列是否存在
    db.all(`PRAGMA table_info(users)`, (err, columns) => {
        if (err) {
            console.error('获取 users 表信息时出错:', err);
            db.close();
            process.exit(1);
        }
        const columnNames = columns.map(col => col.name);
        if (!columnNames.includes('userGroup')) {
            addUserGroupColumn();
        } else {
            console.log('userGroup 列已存在，跳过添加。');
        }

        // 确保有管理员用户
        db.get(`SELECT * FROM users WHERE is_admin = 1 LIMIT 1`, (err, row) => {
            if (err) {
                console.error('查询 users 表时出错:', err);
                db.close();
                process.exit(1);
            }
            if (!row) {
                const defaultAdmin = {
                    username: 'admin',
                    password: 'admin123', // 默认密码，请在生产环境中更改
                    nickname: 'Administrator', // 默认昵称
                    is_admin: 1,
                    userGroup: 1 // 默认用户组
                };
                console.log('未找到管理员用户，正在创建默认管理员用户...');
                bcrypt.hash(defaultAdmin.password, 10, (err, hash) => {
                    if (err) {
                        console.error('哈希密码时出错:', err);
                        db.close();
                        process.exit(1);
                    }
                    db.run(
                        `INSERT INTO users (username, password, nickname, is_admin, userGroup) VALUES (?, ?, ?, ?, ?)`,
                        [defaultAdmin.username, hash, defaultAdmin.nickname, defaultAdmin.is_admin, defaultAdmin.userGroup],
                        function(err) {
                            if (err) {
                                console.error('插入默认管理员用户时出错:', err);
                                db.close();
                                process.exit(1);
                            } else {
                                console.log(`已创建默认管理员用户，用户名: ${defaultAdmin.username}, 密码: ${defaultAdmin.password}, 昵称: ${defaultAdmin.nickname}, 用户组: ${defaultAdmin.userGroup}`);
                                // 关闭数据库连接
                                db.close((err) => {
                                    if (err) {
                                        console.error('关闭数据库时出错:', err);
                                        process.exit(1);
                                    } else {
                                        console.log('已关闭数据库连接。');
                                    }
                                });
                            }
                        }
                    );
                });
            } else {
                console.log('管理员用户已存在。');
                // 关闭数据库连接
                db.close((err) => {
                    if (err) {
                        console.error('关闭数据库时出错:', err);
                        process.exit(1);
                    } else {
                        console.log('已关闭数据库连接。');
                    }
                });
            }
        });
    });
}); 
