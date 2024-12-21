// middleware/auth.js

const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const redisClient = require('../redisClient');

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

// 认证中间件，验证 JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ message: 'No token provided' });

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        const jti = user.jti;
        if(!jti) {
            return res.status(403).json({ message: 'Invalid token structure' });
        }
        try {
            const tokenStatus = await redisClient.get(`token:${jti}`);
            if (tokenStatus !== 'valid') {
                return res.status(403).json({ message: 'Token has been revoked' });
            }
        } catch (redisErr) {
            console.error('Redis error:', redisErr);
            return res.status(500).json({ message: 'Internal server error' });
        }
        req.user = user;
        next();
    });
}

// 授权中间件，检查是否为管理员
function authorizeAdmin(req, res, next) {
    if (!req.user.is_admin) {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
}

module.exports = {
    authenticateToken,
    authorizeAdmin
};
