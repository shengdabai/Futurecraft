# PostHog 产品分析集成指南

## 1. 安装

```bash
npm install posthog-js
```

## 2. 初始化

```typescript
// src/main.ts
import posthog from "posthog-js";

posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_POSTHOG_HOST || "https://app.posthog.com",
  capture_pageview: true,
});
```

## 3. 关键事件追踪

```typescript
// 用户完成 Soul Scan
posthog.capture("soul_scan_completed", {
  archetype: result.archetype,
  duration_seconds: elapsed,
});

// 用户探索职业
posthog.capture("career_explored", {
  career: result.career,
  match_score: result.matchScore,
});

// 用户完成模拟
posthog.capture("simulation_completed", {
  scenario: result.scenario,
  outcome: result.outcome,
});
```

## 4. 环境变量

```env
VITE_POSTHOG_KEY=phc_xxx
VITE_POSTHOG_HOST=https://app.posthog.com
```

## 5. PostHog 免费额度

- 1M events/month
- 免费 forever
- 功能完整（funnels, cohorts, feature flags）
- 足够 MVP 阶段使用
