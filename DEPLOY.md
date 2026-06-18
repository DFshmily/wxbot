# 微信群AI机器人 — Windows 部署说明

## 1. 环境要求

| 项目 | 要求 |
|------|------|
| 操作系统 | Windows 10/11 64位 |
| Node.js | v18+ (推荐 v20 LTS) |
| 微信 | 3.9.12.17 （强制，其他版本不可用） |
| 网络 | 能访问 DeepSeek/MiMo API |

## 2. 安装微信

1. 下载微信 3.9.12.17：https://github.com/tom-snow/wechat-windows-versions/releases/tag/v3.9.12.17
2. 卸载当前微信（如果有），安装 3.9.12.17
3. 在设置中**关闭微信自动更新**（否则升级后无法使用）
4. 登录机器人微信号

> ⚠️ 微信必须保持登录状态，不要退出

## 3. 部署代码

```bash
# 在 Windows 上
git clone <你的仓库地址> wxbot
cd wxbot
npm install
```

## 4. 配置

```bash
cp .env.example .env
```

编辑 `.env`，至少修改这几项：

```ini
# LLM 配置（二选一）
LLM_PROVIDER=mimo                    # 或 deepseek
LLM_API_KEY=your-api-key-here

# 安全配置（务必修改）
JWT_SECRET=your-random-secret-key
ADMIN_PASSWORD=your-secure-password

# 风控参数（可选）
BOT_NAME=风笙
MAX_MSG_PER_HOUR=20              # 每群每小时最多AI回复数
RANDOM_SKIP_RATE=0.1             # 随机不回复概率(0~1)
WORK_START_HOUR=0                # 工作时间开始（0=24小时）
WORK_END_HOUR=0                  # 工作时间结束
```

## 5. 运行

```bash
# 前台运行（调试用）
npm start

# 或
node src/index.js
```

首次启动时，WeChatFerry 会自动注入 DLL 到微信进程，能看到日志：
```
=== 🤖 微信群AI机器人 ===
Bot: 风笙
Provider: mimo | Model: mimo-v2.5-pro
Web port: 3080

[WCF] Connected to WeChat
[WCF] Loaded N groups, M contacts
[Web] Management interface running at http://localhost:3080
[Watchdog] Started — monitoring service health
✅ 系统就绪
```

## 6. 后台运行（推荐）

使用 PM2 将 Bot 注册为服务，支持自动重启：

```bash
# 安装依赖
npm install

# 全局安装 PM2
npm install -g pm2

# 用 PM2 启动
pm2 start src/index.js --name wxbot

# 保存进程列表
pm2 save
```

### Windows 开机自启

**方法一：pm2-windows-startup（推荐）**

```bash
# 安装
npm install -g pm2-windows-startup

# 注册开机自启
pm2-startup install

# 保存当前进程列表
pm2 save
```

**方法二：任务计划程序**

1. 打开「任务计划程序」
2. 创建基本任务 → 触发器选「登录时」
3. 操作选「启动程序」，填入：
   - 程序：`C:\Users\Administrator\AppData\Roaming\npm\pm2.cmd`
   - 参数：`start src/index.js --name wxbot`
   - 起始目录：`C:\Users\wxbot`（你的项目路径）

**方法三：启动文件夹**

按 `Win+R`，输入 `shell:startup`，创建 `wxbot.bat`：
```bat
cd /d C:\Users\wxbot
pm2 start src/index.js --name wxbot
```

### PM2 常用命令

```bash
pm2 status          # 查看所有进程状态
pm2 logs wxbot      # 查看实时日志
pm2 restart wxbot   # 重启服务
pm2 stop wxbot      # 停止服务
pm2 delete wxbot    # 删除进程
pm2 monit           # 监控面板（CPU、内存）
```

### PM2 配置文件（推荐）

项目已包含 `ecosystem.config.js`，用它启动可以避免重启时微信注入冲突：

```bash
pm2 start ecosystem.config.js
pm2 save
```

配置说明：
- `restart_delay: 5000` — 重启延迟 5 秒，等待旧进程完全退出
- `max_restarts: 10` — 最大重启次数
- `min_uptime: '10s'` — 10 秒内崩溃不算正常启动
- `exp_backoff_restart_delay` — 指数退避重启延迟

> ⚠️ **重要：** 如果重启后出现「CreateRemoteThread 失败」或「注入失败」，说明有残留的 WeChat 进程。需要手动结束所有 WeChat 进程后重新登录。

## 7. Web 管理后台

启动后访问 http://localhost:3080 进入管理界面。

### 功能

| 功能 | 说明 |
|------|------|
| 服务状态 | 查看运行时间、内存、连接状态 |
| 微信连接 | 查看群组数量、联系人数量、重连 |
| 队列监控 | 查看消息队列、看门狗状态 |
| 配置管理 | 在线修改风控、机器人、LLM 配置 |
| 模板编辑 | 在线编辑帮助菜单等模板内容 |
| 运行日志 | 实时查看服务日志（带时间戳） |
| 服务控制 | 重启服务、重置看门狗 |

### API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 登录获取 JWT |
| GET | /api/status | 服务状态 |
| GET | /api/status/health | 健康检查 |
| GET | /api/status/groups | 群组列表 |
| GET | /api/status/logs | 运行日志 |
| GET | /api/config | 获取配置 |
| PUT | /api/config | 更新配置 |
| GET | /api/templates | 获取所有模板 |
| GET | /api/templates/:key | 获取指定模板 |
| PUT | /api/templates/:key | 更新模板 |
| DELETE | /api/templates/:key | 删除模板（恢复默认） |
| POST | /api/control/restart | 重启服务 |
| POST | /api/control/reconnect | 重连微信 |
| POST | /api/control/watchdog/reset | 重置看门狗 |

### 认证

- 默认账号：`admin` / `admin123`
- 本地访问（127.0.0.1）可配置免认证
- Token 有效期 24 小时

## 8. 看门狗自重启

看门狗服务监控三个维度：

| 监控项 | 检查间隔 | 触发条件 |
|--------|----------|----------|
| 事件循环 | 10秒 | 超时30秒无响应 |
| 微信连接 | 30秒 | 连接断开 |
| 消息队列 | 30秒 | 积压超过100条 |

连续 3 次检测失败后：
1. 尝试重连微信
2. 重连失败则触发服务重启（配合 PM2 自动恢复）

### 配置

```ini
WATCHDOG_ENABLED=true            # 启用看门狗
WATCHDOG_CHECK_INTERVAL=30       # 检查间隔(秒)
WATCHDOG_MAX_FAILURES=3          # 最大连续失败次数
```

## 9. 群内使用

### AI 对话
在群里 `@风笙` + 你的问题，AI 会回答任何合法问题：
- 知识问答、翻译、写作、编程等都可以
- 回复限制 200 字以内
- AI 自带安全策略，不会回答违法/有害内容
- 受风控限制（每小时每群最多 20 次）

### 今日总结
发送 `今日总结` 手动触发
定时每天 23:50 自动生成

### 游戏
```
猜数字             开始猜数字游戏（1-100）
猜数字 50         猜数字
成语接龙           开始成语接龙
```

### 帮助
发送 `帮助` 查看可用命令

## 10. 常见问题

**Q: 启动时报 DLL 加载错误**
- 确认是 Windows 64位系统
- 确认微信版本是 3.9.12.17
- 确认微信已登录
- 尝试以管理员身份运行

**Q: 收不到消息**
- 确认微信是登录状态
- 检查 bot 是否在群内
- 查看风控参数是否过严（MAX_MSG_PER_HOUR）
- 访问 Web 后台检查连接状态

**Q: 微信提示版本过低/强制升级**
- 关闭微信自动更新
- 重新安装 3.9.12.17

**Q: 发消息太频繁被限制**
- 调低 `MAX_MSG_PER_HOUR`
- 增大 `MIN_MSG_INTERVAL`
- 增大 `RANDOM_SKIP_RATE`

**Q: Web 后台无法访问**
- 检查端口是否被占用（默认 3080）
- 检查防火墙设置
- 查看日志中的 `[Web]` 输出

**Q: 服务频繁重启**
- 查看日志中的 `[Watchdog]` 输出
- 检查微信连接是否稳定
- 尝试增大 `WATCHDOG_MAX_FAILURES`

## 11. 文件结构

```
wxbot/
├── .env                      # 配置文件
├── .env.example              # 配置模板
├── data/
│   └── wxbot.db              # SQLite 数据库（自动生成）
├── src/
│   ├── index.js              # 入口
│   ├── config.js             # 配置加载
│   ├── database/             # 数据库
│   ├── handlers/             # 消息处理
│   ├── services/             # 核心服务
│   │   ├── wechatferry.js    # 微信接入
│   │   ├── deepseek.js       # LLM API
│   │   ├── watchdog.js       # 看门狗
│   │   └── message-queue.js  # 消息队列
│   ├── web/                  # Web 管理
│   │   ├── server.js         # HTTP 服务
│   │   ├── auth.js           # 认证
│   │   ├── routes/           # API 路由
│   │   └── public/           # 前端界面
│   └── games/                # 游戏
└── package.json
```

日志直接输出到终端/stdout，Web 后台也可查看实时日志。
