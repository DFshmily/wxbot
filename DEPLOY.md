# 微信群AI机器人 — Windows 部署说明

## 1. 环境要求

| 项目 | 要求 |
|------|------|
| 操作系统 | Windows 10/11 64位 |
| Node.js | v18+ (推荐 v20 LTS) |
| 微信 | 3.9.12.17 （强制，其他版本不可用） |
| 网络 | 能访问 DeepSeek API |

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
# 必填
DEEPSEEK_API_KEY=sk-your-real-key-here

# 可选 - 按需调整
BOT_NAME=小助手
MAX_MSG_PER_HOUR=20              # 每群每小时最多AI回复数
RANDOM_SKIP_RATE=0.3             # 随机不回复概率(0~1)
WORK_START_HOUR=8                # 工作时间开始
WORK_END_HOUR=23                 # 工作时间结束
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
[WCF] Connected to WeChat
[WCF] Loaded N groups from M contacts
```

## 6. 后台运行（推荐）

使用 `node-windows` 或 PM2 将 Bot 注册为 Windows 服务：

### 方案 A：PM2

```bash
npm install -g pm2
pm2 start src/index.js --name wxbot
pm2 save
pm2 startup        # 开机自启
```

### 方案 B：作为 Windows 服务

```bash
npm install -g node-windows
```

创建 `service.js`：

```js
const Service = require('node-windows').Service;
const svc = new Service({
  name: 'WeChatBot',
  description: '微信群AI机器人',
  script: require('path').join(__dirname, 'src/index.js')
});
svc.on('install', () => svc.start());
svc.install();
```

```bash
node service.js
```

## 7. 群内使用

### 基础聊天
在群里 `@小助手` + 你的问题

### 今日总结
发送 `#今日总结` 手动触发
定时每天 23:50 自动生成

### 游戏
```
$猜数字             开始猜数字游戏（1-100）
$猜数字 50         猜数字
$成语接龙           开始成语接龙
```

### 帮助
发送 `#帮助` 查看可用命令

## 8. 常见问题

**Q: 启动时报 DLL 加载错误**
- 确认是 Windows 64位系统
- 确认微信版本是 3.9.12.17
- 确认微信已登录
- 尝试以管理员身份运行

**Q: 收不到消息**
- 确认微信是登录状态
- 检查 bot 是否在群内
- 查看风控参数是否过严（MAX_MSG_PER_HOUR）

**Q: 微信提示版本过低/强制升级**
- 关闭微信自动更新
- 重新安装 3.9.12.17

**Q: 发消息太频繁被限制**
- 调低 `MAX_MSG_PER_HOUR`
- 增大 `MIN_MSG_INTERVAL`
- 增大 `RANDOM_SKIP_RATE`

## 9. 文件结构

```
wxbot/
├── .env                      # 配置文件
├── data/
│   └── wxbot.db              # SQLite 数据库（自动生成）
└── src/                      # 源码
```

日志直接输出到终端/stdout，如需落文件请用 PM2 等工具重定向。
