// server.js

const express = require('express');
const app = express();
const dotenv = require('dotenv');
dotenv.config();

const authRoutes = require('./routes/auth');
const usageRoutes = require('./routes/usage');
const configRoutes = require('./routes/config');
const accountRoutes = require('./routes/account');

// 中间件
app.use(express.json());

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api', configRoutes);
app.use('/api', accountRoutes);

// 根路由
app.get('/', (req, res) => {
    res.send('Node.js Backend Server is running');
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
