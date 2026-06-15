# WXBot - 微信群 AI 机器人

基于 [WeChatFerry](https://github.com/lich0821/WeChatFerry) + DeepSeek API + Node.js + SQLite 的微信群聊 AI 机器人。

## 功能

### 🤖 AI 对话
在群里 `@机器人` + 问题，触发单轮 AI 回答（无历史上下文，节省 Token）。

### 🛠 工具
| 命令 | 说明 |
|------|------|
| `天气 <城市>` | 查天气（含逐时预报）|
| `翻译 <文本>` | 中英互译 |
| `新闻` | 热点新闻速览 |
| `历史上的今天` | 今天发生的历史事件 |

### 🎮 娱乐
| 命令 | 说明 |
|------|------|
| `讲个笑话` | AI 讲个冷笑话 |
| `今天运势` | 每日运势 |
| `土味情话` | 随机情话 |
| `抽签` / `抽奖` | 群内随机抽人 |

### 📊 群聊
| 命令 | 说明 |
|------|------|
| `群统计` | 今日发言排行榜、时段分布 |
| `高频词` | 今日高频词汇 TOP15 |
| `今日总结` | 今日群聊 AI 总结 |
| `昨天说了什么` | 昨日群聊回顾 |
| `搜索 <关键词>` | 搜索群聊历史消息 |
| `刚才谁提到 <关键词>` | 快速查找最近提到 |

### 💰 账户
| 命令 | 说明 |
|------|------|
| `余额` | 查 DeepSeek 账户余额 |
| `用量` | 查 Token 消耗统计 |

### 🎲 游戏
| 命令 | 说明 |
|------|------|
| `猜数字` | 猜 1-100 的数字 |
| `成语接龙` | 成语接龙游戏 |

### ⏰ 定时总结
每天 23:50 自动生成当日群聊总结。

## 快速开始

### 环境要求
- **操作系统**: Windows 10/11 64位（WeChatFerry 依赖）
- **Node.js**: v18+（推荐 v20 LTS）
- **微信**: 3.9.12.17（[下载](https://github.com/tom-snow/wechat-windows-versions/releases/tag/v3.9.12.17)）

### 部署

```bash
# 克隆
git clone <repo-url> wxbot
cd wxbot

# 安装依赖
npm install

# 配置
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY

# 运行
npm start
```

详细部署说明请参考 [DEPLOY.md](DEPLOY.md)。

## 技术栈

- **WeChatFerry** — 微信协议接入（DLL 注入）
- **DeepSeek API** — AI 对话、总结、翻译等
- **SQLite (better-sqlite3)** — 本地消息存储
- **Node.js** — 运行环境

## 风控系统

每小时每群最多 20 次 AI 回复，10% 随机跳过，1-3 秒随机延迟，均为降低被微信风控的概率。详见 `.env.example` 中的风控参数。

## 项目结构

```
wxbot/
├── .env.example          # 环境变量模板
├── DEPLOY.md             # 部署说明
├── README.md             # 本文件
├── package.json
└── src/
    ├── index.js          # 入口
    ├── config.js         # 配置加载
    ├── database/
    │   ├── init.js       # SQLite 初始化
    │   └── queries.js    # 数据库查询
    ├── handlers/
    │   ├── message-router.js  # 消息路由
    │   ├── ai-chat.js         # AI 对话
    │   ├── history.js         # 历史查询
    │   └── summary.js         # 每日总结
    ├── services/
    │   ├── wechatferry.js     # WeChatFerry 客户端
    │   ├── deepseek.js        # DeepSeek API
    │   ├── tools.js           # 实用工具
    │   ├── statistics.js      # 群统计
    │   ├── risk-control.js    # 风控
    │   ├── compressor.js      # 消息压缩
    │   ├── merger.js          # 消息合并
    │   └── message-queue.js   # 发送队列
    └── games/
        ├── guess-number.js    # 猜数字
        └── idiom-chain.js     # 成语接龙
```
