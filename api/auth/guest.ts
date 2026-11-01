/**
 * 游客登录 API
 * POST /api/auth/guest - 创建游客账户
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDatabase, generateId } from '../lib/db';
import { generateToken, hashPassword } from '../lib/auth';
import { sendError, sendSuccess } from '../lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'POST') {
            return sendError(res, 'METHOD_NOT_ALLOWED', '只支持 POST 方法', 405);
        }

        const userId = generateId();
        const username = `游客${Date.now()}`;
        const password = generateId(); // 随机密码，游客不需要记住
        const db = getDatabase();
        const passwordHash = await hashPassword(password); // Assuming hashPassword is available

        await db.createUser(userId, username, passwordHash);

        const token = generateToken({ userId, username });

        return sendSuccess(res, {
            userId,
            username,
            token,
            type: 'guest'
        }, 201);
    } catch (error: any) {
        console.error('Guest registration error:', error);
        return sendError(res, 'INTERNAL_ERROR', '创建游客用户失败', 500);
    }
}
