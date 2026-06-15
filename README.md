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

---

## 免责声明

使用本项目则表示您同意并认可以下声明：

1. **使用目的**：本项目仅供学习交流使用，**请勿用于非法用途**，否则后果自负。任何违反法律法规、侵犯他人合法权益的行为，均与本项目及其开发者无关，后果由用户自行承担。

2. **使用期限**：请在下载保存、编译使用本项目的 24 小时内，删除本项目的源代码和（编译出的）程序；超出此期限的任何使用行为，一概与本项目及其开发者无关。

3. **操作规范**：本项目仅允许在授权情况下对数据库进行备份与查看，严禁用于非法目的。严禁用于窃取他人隐私。严禁进行二次开发。否则自行承担所有相关责任。

4. **免责声明接受**：下载、保存、浏览源代码或者下载安装、编译使用本程序，表示您同意本警告，并承诺遵守它。

5. **禁止非法测试**：禁止利用本项目相关技术从事非法测试或渗透，禁止利用本项目相关代码或技术从事任何非法工作。因此产生的一切不良后果与本项目及其开发者无关。

6. **免责声明修改**：本免责声明可能根据项目运行情况进行修改和调整。使用本项目时应遵守最新版本的免责声明。

7. **其他**：用户在使用本项目过程中应遵守相关的法律法规和道德规范。对于因用户违反相关规定而引发的任何纠纷或损失，本项目及其开发者不承担任何责任。

## 致谢

本项目灵感来源于以下项目：

- [WeChatFerry](https://github.com/lich0821/WeChatFerry)
- [wechatferry](https://github.com/wechatferry/wechatferry)

## License

基于 [MIT](LICENSE) 协议。为 💖 发电。
