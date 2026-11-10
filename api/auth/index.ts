/**
 * 用户认证 API（合并版）
 * POST /api/auth?action=login    - 登录
 * POST /api/auth?action=register - 注册
 * GET  /api/auth                 - 获取当前用户信息
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDatabase, generateId } from '../lib/db';
import {
    hashPassword,
    verifyPassword,
    generateToken,
    authenticateRequest,
    isValidUsername,
    isValidPassword
} from '../lib/auth';
import { sendSuccess, sendError, sendPredefinedError } from '../lib/response';

interface LoginBody {
    username: string;
    password: string;
}

interface RegisterBody {
    username: string;
    password: string;
}

// 登录处理
async function handleLogin(req: VercelRequest, res: VercelResponse) {
    const { username, password } = (req.body ?? {}) as LoginBody;

    if (!isValidUsername(username) || !isValidPassword(password)) {
        return sendError(res, 'INVALID_REQUEST', '用户名和密码不能为空', 400);
    }

    const db = getDatabase();
    const user = await db.getUserByUsername(username);

    if (!user) {
        return sendPredefinedError(res, 'INVALID_CREDENTIALS');
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
        return sendPredefinedError(res, 'INVALID_CREDENTIALS');
    }

    const token = generateToken({ userId: user.id, username: user.username });
    return sendSuccess(res, { userId: user.id, username: user.username, token });
}

// 注册处理
async function handleRegister(req: VercelRequest, res: VercelResponse) {
    const { username, password } = (req.body ?? {}) as RegisterBody;

    if (!username || !password) {
        return sendError(res, 'INVALID_REQUEST', '用户名和密码不能为空', 400);
    }

    if (!isValidUsername(username)) {
        return sendError(res, 'INVALID_REQUEST', '用户名必须是 3-20 个字符，只能包含字母、数字和下划线', 400);
    }

    if (!isValidPassword(password)) {
        return sendError(res, 'INVALID_REQUEST', '密码至少需要 6 个字符', 400);
    }

    const db = getDatabase();
    const existingUser = await db.getUserByUsername(username);

    if (existingUser) {
        return sendPredefinedError(res, 'USERNAME_EXISTS');
    }

    const userId = generateId();
    const passwordHash = await hashPassword(password);

    await db.createUser(userId, username, passwordHash);

    const token = generateToken({ userId, username });
    return sendSuccess(res, { userId, username, token }, 201);
}

// 获取当前用户信息
async function handleGetMe(req: VercelRequest, res: VercelResponse) {
    const auth = authenticateRequest(req);
    if (!auth) {
        return sendPredefinedError(res, 'UNAUTHORIZED');
    }

    const db = getDatabase();
    const user = await db.getUserById(auth.userId);

    if (!user) {
        return sendPredefinedError(res, 'NOT_FOUND', '用户不存在');
    }

    const mistakeStats = await db.getMistakesStats(auth.userId);

    return sendSuccess(res, {
        userId: user.id,
        username: user.username,
        createdAt: user.created_at,
        stats: {
            totalMistakes: parseInt(mistakeStats.total) || 0,
            bySubject: {
                math: parseInt(mistakeStats.math) || 0,
                physics: parseInt(mistakeStats.physics) || 0,
                chemistry: parseInt(mistakeStats.chemistry) || 0,
                chinese: parseInt(mistakeStats.chinese) || 0,
                english: parseInt(mistakeStats.english) || 0,
                politics: parseInt(mistakeStats.politics) || 0,
            },
        },
    });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const action = req.query.action as string;

        if (req.method === 'POST') {
            if (action === 'login') {
                return await handleLogin(req, res);
            } else if (action === 'register') {
                return await handleRegister(req, res);
            } else {
                return sendError(res, 'INVALID_REQUEST', '请指定 action 参数：login 或 register', 400);
            }
        } else if (req.method === 'GET') {
            return await handleGetMe(req, res);
        } else {
            return sendPredefinedError(res, 'METHOD_NOT_ALLOWED');
        }
    } catch (error: any) {
        console.error('Auth error:', {
            message: error?.message || 'Unknown error',
            stack: error?.stack,
            name: error?.name,
        });
        // 确保返回 JSON 格式的错误
        return sendPredefinedError(res, 'INTERNAL_ERROR');
    }
}
