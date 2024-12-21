// utils/logger.js

const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../logs', 'app.log');

// 确保 logs 目录存在
if (!fs.existsSync(path.dirname(logFile))) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
}

function log(message) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

module.exports = {
    log
};
