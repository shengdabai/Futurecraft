import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

// 用户 Payload 类型
export interface JwtPayload {
    userId: string;
    isGuest: boolean;
    region: string;
    type?: 'access' | 'refresh';
    iat?: number;
    exp?: number;
}

function verifyToken(token: string): JwtPayload {
    const decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || typeof decoded.userId !== 'string' || !decoded.userId
        || typeof decoded.isGuest !== 'boolean' || typeof decoded.region !== 'string'
        || typeof decoded.exp !== 'number'
        || (decoded.type !== 'access' && decoded.type !== 'refresh')) {
        throw new Error('Invalid token claims');
    }
    return decoded as JwtPayload;
}

// 扩展 Express Request 类型
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

/**
 * JWT 认证中间件
 * 验证请求头中的 Bearer Token
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: '请先登录',
        });
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    try {
        const decoded = verifyToken(token);

        // 普通路由不接受 refresh token（除 /auth/refresh 端点外由路由自行检查）
        if (decoded.type === 'refresh' && !(req.method === 'POST' && req.path === '/refresh')) {
            return res.status(401).json({
                error: 'InvalidTokenType',
                message: '不能使用 refresh token 访问此接口',
            });
        }

        req.user = decoded;
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({
                error: 'TokenExpired',
                message: '登录已过期，请重新登录',
            });
        }
        return res.status(401).json({
            error: 'InvalidToken',
            message: '无效的认证令牌',
        });
    }
};

/**
 * 可选认证中间件
 * Token 有效则附加用户信息，无 Token 也允许继续
 */
export const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = verifyToken(token);
            if (decoded.type === 'access') req.user = decoded;
        } catch {
            // Token 无效，忽略
        }
    }

    next();
};

/**
 * 生成 Access Token（短过期 15 分钟）
 */
export const generateAccessToken = (
    payload: Omit<JwtPayload, 'iat' | 'exp' | 'type'>,
): string => {
    return jwt.sign({ ...payload, type: 'access' }, config.jwt.secret, {
        expiresIn: '15m',
    });
};

/**
 * 生成 Refresh Token（长过期 30 天）
 */
export const generateRefreshToken = (
    payload: Omit<JwtPayload, 'iat' | 'exp' | 'type'>,
): string => {
    return jwt.sign({ ...payload, type: 'refresh' }, config.jwt.secret, {
        expiresIn: '30d',
    });
};

/**
 * @deprecated 使用 generateAccessToken / generateRefreshToken
 */
export const generateToken = generateAccessToken;

