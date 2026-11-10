import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { config } from '../config/env.js';

/**
 * 通用速率限制器
 * 基于 IP 地址限制请求频率
 */
export const generalLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
        error: 'TooManyRequests',
        message: '请求过于频繁，请稍后再试',
        retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        // 优先使用用户 ID，否则使用 IP
        return req.user?.userId || req.ip || 'unknown';
    },
});

/**
 * AI 请求专用速率限制器
 * 更严格的限制，防止 AI 资源滥用
 */
export const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 分钟
    max: 10, // 每分钟最多 10 次 AI 请求
    message: {
        error: 'AIRateLimitExceeded',
        message: 'AI 请求过于频繁，请稍后再试',
        retryAfter: 60,
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        return req.user?.userId || req.ip || 'unknown';
    },
    skip: (req: Request) => {
        // 可以为付费用户跳过限制
        // return req.user?.subscriptionTier === 'PRO';
        return false;
    },
});

/**
 * 登录请求速率限制器
 * 防止暴力破解
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分钟
    max: 10, // 每 15 分钟最多 10 次登录尝试
    message: {
        error: 'AuthRateLimitExceeded',
        message: '登录尝试过多，请 15 分钟后再试',
        retryAfter: 900,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * 用户级别速率限制
 * 根据用户 ID 进行更细粒度的控制
 */
const userRequestCounts = new Map<string, { count: number; resetTime: number }>();

export const userRateLimitMiddleware = (maxRequests: number, windowMs: number) => {
    return (req: Request, res: Response, next: Function) => {
        const userId = req.user?.userId;
        if (!userId) {
            return next();
        }

        const now = Date.now();
        const userRecord = userRequestCounts.get(userId);

        if (!userRecord || now > userRecord.resetTime) {
            // 重置计数器
            userRequestCounts.set(userId, {
                count: 1,
                resetTime: now + windowMs,
            });
            return next();
        }

        if (userRecord.count >= maxRequests) {
            const retryAfter = Math.ceil((userRecord.resetTime - now) / 1000);
            return res.status(429).json({
                error: 'UserRateLimitExceeded',
                message: '您的请求过于频繁，请稍后再试',
                retryAfter,
            });
        }

        userRecord.count++;
        next();
    };
};

// 定期清理过期记录
setInterval(() => {
    const now = Date.now();
    for (const [userId, record] of userRequestCounts.entries()) {
        if (now > record.resetTime) {
            userRequestCounts.delete(userId);
        }
    }
}, 60 * 1000).unref(); // 每分钟清理一次，不阻止进程正常退出

