# Sentry 错误追踪集成指南

## 1. 安装

```bash
npm install @sentry/react @sentry/node @sentry/browser
```

## 2. 前端初始化

```typescript
// src/main.ts
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
});
```

## 3. 后端初始化

```typescript
// backend/server.ts
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

## 4. 环境变量

```env
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
VITE_SENTRY_DSN=$SENTRY_DSN
```

## 5. Sentry 免费额度

- 5000 errors/month
- 10000 transactions/month
- 14 天数据保留
- 足够 MVP 阶段使用
