import dotenv from 'dotenv';
import { z } from 'zod';

// 加载环境变量
dotenv.config();

// 环境变量验证 Schema
const envSchema = z.object({
    // 服务器
    PORT: z.string().default('8080'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),

    // JWT
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('7d'),

    // Gemini API - 必须配置
    GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),

    // 速率限制
    RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
    RATE_LIMIT_MAX_REQUESTS: z.string().default('30'),

    // AI 配置
    AI_TIMEOUT_MS: z.string().default('60000'),
    AI_MAX_TOKENS: z.string().default('8192'),

    // 内容安全
    CONTENT_SAFETY_LEVEL: z.enum(['low', 'medium', 'high']).default('medium'),

    // 计费
    CREDITS_PER_1K_INPUT_TOKENS: z.string().default('1'),
    CREDITS_PER_1K_OUTPUT_TOKENS: z.string().default('2'),
    FREE_CREDITS_PER_MONTH: z.string().default('100'),

    // Apple Sign In
    APPLE_BUNDLE_ID: z.string().default('com.futurecraft.app'),

    // App Store Server API
    APP_STORE_KEY_ID: z.string().default(''),
    APP_STORE_ISSUER_ID: z.string().default(''),

    // Google Cloud TTS (可选)
    GOOGLE_CLOUD_TTS_API_KEY: z.string().default(''),

    // 数据库
    DB_PATH: z.string().default(''),

    // 日志
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

// 解析并验证环境变量
const parseEnv = () => {
    try {
        return envSchema.parse(process.env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const missing = error.issues.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
            console.error('❌ 环境变量配置错误:\n' + missing);
            console.error('\n请参考 env.example.txt 配置 .env 文件');
            process.exit(1);
        }
        throw error;
    }
};

export const env = parseEnv();

// 导出类型化配置
export const config = {
    port: parseInt(env.PORT, 10),
    nodeEnv: env.NODE_ENV,
    isDev: env.NODE_ENV === 'development',
    isProd: env.NODE_ENV === 'production',

    jwt: {
        secret: env.JWT_SECRET,
        expiresIn: env.JWT_EXPIRES_IN,
    },

    gemini: {
        apiKey: env.GEMINI_API_KEY,
        timeout: parseInt(env.AI_TIMEOUT_MS, 10),
        maxTokens: parseInt(env.AI_MAX_TOKENS, 10),
    },

    rateLimit: {
        windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
        maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10),
    },

    safety: {
        level: env.CONTENT_SAFETY_LEVEL,
    },

    billing: {
        creditsPerKInputTokens: parseInt(env.CREDITS_PER_1K_INPUT_TOKENS, 10),
        creditsPerKOutputTokens: parseInt(env.CREDITS_PER_1K_OUTPUT_TOKENS, 10),
        freeCreditsPerMonth: parseInt(env.FREE_CREDITS_PER_MONTH, 10),
    },

    logLevel: env.LOG_LEVEL,
};

