// redisClient.js
const redis = require('redis');
const dotenv = require('dotenv');
dotenv.config();

const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error', err);
});

(async () => {
    await redisClient.connect();
    console.log('Connected to Redis');
})();

module.exports = redisClient;