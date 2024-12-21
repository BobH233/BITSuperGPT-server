# BIT超级共享GPT-后端项目

一个能够在本地共享Plus账号，避免OpenAI标记降智前提下，使用原生网页版ChatGPT Plus的项目

## 客户端源码

请前往这里查看：[BITSuperGPT-client](https://github.com/BobH233/BITSuperGPT-client)

请先阅读以上项目的注意事项，然后继续阅读这个项目的README

# 构建和开发


```
BITSUPERGPT-SERVER/
├── config/                 # 配置文件目录
│   ├── accounts.json       # ChatGPT账户配置文件
│   └── config.json         # sing-box的配置文件
├── database/               # 数据库相关逻辑
│   └── initialize.js       # 数据库初始化脚本
├── middleware/             # 中间件模块
│   └── auth.js             # 用户身份验证中间件
├── routes/                 # 路由模块
│   ├── account.js          # 账户相关路由
│   ├── auth.js             # 身份验证相关路由
│   ├── config.js           # 配置信息相关路由
│   └── usage.js            # 用量统计相关路由
├── utils/                  # 工具函数
│   └── logger.js           # 日志工具，暂时没用到
├── .gitignore              # Git 忽略配置文件
├── package.json            # npm 项目描述文件，包含依赖和脚本
├── README.md               # 项目说明文档（即本文件）
├── redisClient.js          # Redis 客户端工具，负责缓存管理
└── server.js               # 服务器入口文件
```

## 安装项目依赖

需要nodejs，我的开发环境nodejs版本是v23.4.0

我安装了cnpm来加速安装依赖，用以下指令安装依赖

```bash
cnpm install
```

你也可以使用其他包管理器，比如 npm 或者 yarn

## 配置项目

在项目根目录新建 `.env` 文件，并根据以下模板来填写信息

```
REDIS_URL=redis://your-redis-server:6379(你的本地配置redis服务器链接)

PORT=3001(服务器后端运行的端口地址)

JWT_SECRET=your_jwt_secret_key（使用openssl rand -base64 64生成一个jwt密匙，注意不要泄露！也不要放到客户端，客户端没位置给你放这个的）

ENCRYPTION_KEY=<后端配置的加密密匙，注意必须是32位长度字符串，客户端要和这个配置一致>

```

然后编辑 `config/accounts.json` 里面的 账号密码，这个要和你注册的ChatGPT的账号密码一致

然后编辑 `config/config.json`，这个和客户端的 `sing-box/config.json` 里面的理论上是一样的。在`outbounds`一栏，根据你自己搭建的拥有绿色IP的服务器上sing-box的配置情况而定，至于怎么配置sing-box，请参考google上官方文档，在这里不可以赘述过多。

**为什么要在服务端有一个`config.json`，客户端还要有一个？** 因为客户端有一个功能，可以从服务端随时拉取最新的代理服务器配置下来，所以这个地方放的这个就是方便随时拉取客户端拉取配置文件，方便服务端随时变动代理配置的。

## 初始化数据库

完成了以上配置后，你首先需要初始化一个数据库，运行以下代码初始化数据库：

```bash
npm run init-db
```

输入如下信息：

```
npm run init-db

> chatgpt-share-backend@1.0.0 init-db
> node database/initialize.js

已连接到 SQLite 数据库。
确保 users 表存在。
确保 login_logs 表存在。
确保 chatgpt_usage 表存在。
未找到管理员用户，正在创建默认管理员用户...
已创建默认管理员用户，用户名: admin, 密码: admin123, 昵称: Administrator
已关闭数据库连接。
```

此时会创建 `database.sqlite` 作为初始数据库，请留意上面的初始用户名和密码，稍后可以用于登录。

## 运行项目

完成了以上配置后，你就已经可以开始运行后端了，输入以下指令开始运行：

```bash
npm start
```

后端启动后，即可去前端配置然后尝试连接后端了。

# 特别感谢

特别感谢ChatGPT给我写出了能够共享使用ChatGPT的代码