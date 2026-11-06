# FutureCraft — AI-Powered Career Exploration & RPG Skill Development

> **发现你的职业超能力。** RPG 式职业探索平台，用 AI 帮你找到真正适合的人生路线。

[![Website](https://img.shields.io/badge/website-futurecraft.vercel.app-blue)]()
[![React](https://img.shields.io/badge/React-19-61DAFB)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

---

## The Problem

Gen Z faces a **career identity crisis**: too many choices, too little guidance. Traditional career tests are boring. Advice from adults feels outdated. You need something interactive, personalized, and fun.

## The Solution

FutureCraft turns career exploration into an **RPG adventure**:

1. **Soul Scan** — Take a personality & aptitude quiz, discover your RPG archetype
2. **Explore** — Browse career paths matched to your archetype with real data
3. **Simulate** — Experience job scenarios before committing to a path
4. **Level Up** — Get personalized learning resources and skill trees

## 6 Core Features

### Soul Scan — 灵魂扫描
AI 分析你的性格和能力，生成 RPG 角色原型（如 "赛博神秘师"、"数据雇佣兵"），包含智力、创造力、魅力、耐力、技术力 5 大属性。

### Multiverse Explorer — 多元宇宙探索
根据你的原型匹配职业道路，包含详细的职位描述、所需技能、薪酬信息和匹配度评分。

### Job Simulation — 职业模拟
互动场景模拟工作决策，实时查看后果，获得适应性评分和个性化反馈。

### Skill Tree — 技能树
基于目标职业的个性化学习资源：图书、视频、GitHub 仓库和任务，XP 游戏化系统。

### AI Tutor — AI 导师
与 AI 职业导师对话，Boss 战模式应对挑战场景，根据你的职业目标提供情境化指导。

### Life Simulator — 人生模拟器
在事情发生前体验人生场景，为您的未来做出明智决策。

## 定价方案

| 功能 | Free | Pro (¥99/年) | Premium (¥299/年) |
|------|------|-------------|------------------|
| Soul Scan | ✓ | ✓ | ✓ |
| 职业探索 (5 个) | ✓ | 无限 | 无限 |
| 职业模拟 | 基础 | 完整 | 完整 + 深度反馈 |
| 技能树 | 基础 | 完整 + XP | 完整 + 导师推荐 |
| AI 导师 | 每日 3 次 | 无限 | 无限 + Boss 战 |
| 人生模拟器 | - | ✓ | ✓ |
| 1:1 职业咨询 | - | - | ✓ |

## 快速开始

```bash
git clone https://github.com/shengdabai/futurecraft.git
cd futurecraft
npm install
npm run dev
```

打开 http://localhost:5173

### 后端 API

```bash
cd backend
npm install
npm run dev  # http://localhost:3000/api
```

创建 `.env.local`：
```
VITE_API_BASE_URL=http://localhost:3000/api
GEMINI_API_KEY=your-key-here
```

## 技术架构

```
[Frontend React App] → [Backend API Server] → [Gemini API]
                          ↓
            [JWT Auth + Rate Limiting + Content Safety]
```

- **前端**: React 19 + TypeScript + Tailwind CSS 4 + Vite 6
- **后端**: Express.js + Google Gemini API
- **部署**: Vercel (前端 + API routes)
- **安全**: API 密钥后端代理、JWT 认证、IP 限流、内容过滤

## 品牌定位

- **名称**: FutureCraft — 铸造你的未来
- **Slogan**: "Discover your career superpower"
- **目标用户**: 16-25 岁 Gen Z（高中生、大学生、职场新人）
- **竞品差异**: 不是传统职业测评，是 RPG 式沉浸式体验
- **视觉风格**: 青紫渐变暗色主题，赛博朋克风

## 获客渠道（Roadmap）

- TikTok/B站 职业探索短视频
- 小红书 "我的 FutureCraft 角色原型" 分享
- 高中/大学职业教育试点合作
- GitHub 开源获客

## 项目结构

```
futurecraft/
├── src/
│   ├── components/     # React 组件 (13 个功能模块)
│   ├── services/       # API 服务层
│   ├── types.ts        # TypeScript 接口
│   ├── App.tsx         # 主应用
│   └── index.tsx       # 入口
├── api/                # Vercel API routes
├── backend/            # Express 后端
├── public/             # 静态资源
└── vercel.json         # 部署配置
```

---

**MIT License**
