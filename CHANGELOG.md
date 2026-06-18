# 更新日志

## v1.2.3 (2026-06-18)

### 🚀 新功能
- **图片发送支持** — 消息队列支持 text/image 两种类型，图片消息跳过随机延迟直接发送
- **看门狗自重启** — 三层健康监控（事件循环、微信连接、消息队列），连续 3 次失败自动重连或重启
- **Web 管理后台** — Express HTTP 服务器，JWT 认证，支持远程管理配置、查看状态、重启服务
- **帮助菜单可编辑** — 支持在 Web 端编辑帮助菜单内容，使用 `{botname}` 占位符

### 🔧 优化
- **连接重试机制** — WeChatFerry 连接失败自动重试 5 次，每次间隔 8 秒
- **日志加时间** — 所有日志输出添加时间戳，格式 `[2026/6/18 14:30:00]`
- **API 429 限流重试** — DeepSeek/MiMo API 限流时自动重试 3 次，等待 5/10/15 秒
- **PM2 配置优化** — 重启延迟 10 秒，指数退避，避免微信注入冲突

### 📁 新增文件
- `src/services/watchdog.js` — 看门狗服务
- `src/web/server.js` — Express HTTP 服务器
- `src/web/auth.js` — JWT 认证中间件
- `src/web/routes/status.js` — 状态查询 API
- `src/web/routes/config.js` — 配置管理 API
- `src/web/routes/control.js` — 服务控制 API
- `src/web/routes/templates.js` — 模板管理 API
- `src/web/public/index.html` — Web 管理界面
- `ecosystem.config.cjs` — PM2 配置文件

### 🔐 安全
- Web 管理后台需要 JWT 认证
- 本地访问可配置免认证
- API Key 脱敏显示

---

## v1.1.0 (2026-06-18)

### 🚀 新功能
- **Web 管理后台** — 远程管理配置、查看状态、重启服务
- **看门狗自重启** — 服务卡死自动重启

### 🔧 优化
- 消息队列支持多消息类型
- WeChatFerry 添加 isHealthy 健康检查

---

## v1.0.0 (2026-06-18)

### 🎉 首发版本
- WeChatFerry 微信接入
- AI 对话（DeepSeek/MiMo）
- 消息存储与查询
- 每日群聊总结
- 风控系统
- 群统计功能
- 猜数字、成语接龙游戏
