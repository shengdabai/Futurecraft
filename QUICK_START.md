# ⚡ 快速开始

## 🚀 3分钟部署到手机

### 第一步：配置环境变量

创建 `.env.local` 文件：

```bash
cd /path/to/高考复习

cat > .env.local << EOF
GEMINI_API_KEY=你的Gemini_API_Key
GETNOTES_TOKEN=你的Get笔记Token
JWT_SECRET=随便一串随机字符
EOF
```

### 第二步：部署到 Vercel

```bash
# 安装 Vercel（如果没有）
npm install -g vercel

# 登录并部署
vercel login
vercel --prod
```

部署完成后，你会得到一个地址，例如：`https://gaokao-xxx.vercel.app`

### 第三步：在手机上使用

**方法A（最快）：浏览器访问**

1. 手机打开 Chrome 浏览器
2. 输入你的 Vercel 地址
3. 点击菜单 → "添加到主屏幕"

**方法B：安装 APK**

```bash
# 进入移动端目录
cd 高考复习-mobile

# 安装依赖
npm install

# 修改 API 地址
# 编辑 constants/api.ts，将 your-vercel-app 改为你的实际地址

# 构建 APK
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

构建完成后下载 APK 安装到手机即可。

---

## 📚 已接入的知识库

| 知识库 | ID | 链接 |
|--------|-----|------|
| 高考试题 | K0BlyZmn | https://biji.com/topic/K0BlyZmn |
| 数学学习 | BJ888R8J | https://biji.com/topic/BJ888R8J |

---

## 🎓 核心功能

| 功能 | 说明 |
|------|------|
| 🎓 AI 导师 | 苏格拉底式对话学习 |
| 📊 试题分析 | 基于历年真题分析考点 |
| 🎯 考点预测 | AI 预测今年重点 |
| 📈 学习进度 | 跟踪知识点掌握度 |
| 📷 拍题讲解 | 拍照 AI 解答 |
| 📚 笔记搜索 | 搜索知识库内容 |

---

**详细说明见 `docs/安装使用说明.md`**

