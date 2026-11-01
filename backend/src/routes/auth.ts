import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { generateAccessToken, generateRefreshToken, authMiddleware } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { verifyAppleIdentityToken } from '../services/appleAuthService.js';
import * as userRepo from '../db/userRepository.js';

const router = Router();

// 输入验证 schemas
const appleLoginSchema = z.object({
    identityToken: z.string().min(1),
    authorizationCode: z.string().min(1),
    email: z.email().optional(),
    fullName: z.string().max(100).optional(),
    region: z.string().max(10).optional(),
});

const guestLoginSchema = z.object({
    guestId: z.guid().optional(),
    region: z.string().max(10).optional(),
});

// Apple Bundle ID - 应从环境变量读取
const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'com.futurecraft.app';

/**
 * POST /auth/apple
 * Apple 登录验证
 */
router.post('/apple', authLimiter, async (req: Request, res: Response) => {
    try {
        const parseResult = appleLoginSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: 'InvalidRequest',
                message: '缺少必要的认证信息',
                details: z.flattenError(parseResult.error).fieldErrors,
            });
        }

        const { identityToken, email, fullName, region } = parseResult.data;

        // 验证 Apple Identity Token
        let appleUserId: string;
        let verifiedEmail: string | undefined;

        try {
            const claims = await verifyAppleIdentityToken(identityToken, APPLE_BUNDLE_ID);
            appleUserId = claims.sub;
            verifiedEmail = claims.email;
        } catch (verifyError) {
            // 开发环境下允许降级（方便本地测试）
            if (process.env.NODE_ENV === 'development') {
                appleUserId = `apple_dev_${Buffer.from(identityToken).toString('base64url').substring(0, 20)}`;
            } else {
                return res.status(401).json({
                    error: 'InvalidToken',
                    message: 'Apple 身份验证失败',
                });
            }
        }

        // 查找或创建用户
        const existingUser = userRepo.findByAppleUserId(appleUserId);

        const user = existingUser
            ? userRepo.toUserObject(existingUser)
            : userRepo.toUserObject(
                userRepo.createUser({
                    id: uuidv4(),
                    username: fullName || verifiedEmail?.split('@')[0] || email?.split('@')[0] || 'User',
                    appleUserId,
                    isGuest: false,
                    region: region || 'GLOBAL',
                    creditBalance: 100,
                    subscriptionTier: 'FREE',
                }),
            );

        // 生成 Token（access 短过期，refresh 长过期）
        const accessToken = generateAccessToken({
            userId: user.id,
            isGuest: false,
            region: user.region,
        });

        const refreshToken = generateRefreshToken({
            userId: user.id,
            isGuest: false,
            region: user.region,
        });

        res.json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                isGuest: user.isGuest,
                region: user.region,
                username: user.username,
                avatarUrl: null,
                creditBalance: user.creditBalance,
                subscriptionTier: user.subscriptionTier,
                rpgProfile: null,
            },
        });
    } catch (error) {
        console.error('Apple login error:', error);
        res.status(500).json({
            error: 'AuthError',
            message: '登录失败，请稍后再试',
        });
    }
});

/**
 * POST /auth/guest
 * 游客登录
 */
router.post('/guest', authLimiter, async (req: Request, res: Response) => {
    try {
        const parseResult = guestLoginSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: 'InvalidRequest',
                message: '请求参数无效',
            });
        }

        const { guestId, region } = parseResult.data;

        // 如果提供了 guestId，尝试查找已有用户
        const existingUser = guestId ? userRepo.findById(guestId) : undefined;

        // 防止账户劫持：如果用户存在但不是 guest，拒绝访问
        if (existingUser && existingUser.is_guest !== 1) {
            return res.status(403).json({
                error: 'Forbidden',
                message: '该账户不是游客账户，请使用正确的登录方式',
            });
        }

        const user = existingUser
            ? userRepo.toUserObject(existingUser)
            : userRepo.toUserObject(
                userRepo.createUser({
                    id: uuidv4(),
                    username: 'Guest',
                    isGuest: true,
                    region: region || 'GLOBAL',
                    creditBalance: 20,
                    subscriptionTier: 'FREE',
                }),
            );

        const accessToken = generateAccessToken({
            userId: user.id,
            isGuest: true,
            region: user.region,
        });

        const refreshToken = generateRefreshToken({
            userId: user.id,
            isGuest: true,
            region: user.region,
        });

        res.json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                isGuest: user.isGuest,
                region: user.region,
                username: user.username,
                avatarUrl: null,
                creditBalance: user.creditBalance,
                subscriptionTier: user.subscriptionTier,
                rpgProfile: null,
            },
        });
    } catch (error) {
        console.error('Guest login error:', error);
        res.status(500).json({
            error: 'AuthError',
            message: '登录失败',
        });
    }
});

/**
 * GET /auth/me
 * 获取当前用户信息
 */
router.get('/me', authMiddleware, (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const row = userRepo.findById(userId);

    if (!row) {
        return res.status(404).json({
            error: 'UserNotFound',
            message: '用户不存在',
        });
    }

    const user = userRepo.toUserObject(row);

    res.json({
        id: user.id,
        isGuest: user.isGuest,
        region: user.region,
        username: user.username,
        avatarUrl: null,
        creditBalance: user.creditBalance,
        subscriptionTier: user.subscriptionTier,
        rpgProfile: null,
    });
});

/**
 * POST /auth/refresh
 * 刷新 Token
 */
router.post('/refresh', authMiddleware, (req: Request, res: Response) => {
    // 刷新端点只接受 refresh token
    if (req.user!.type !== 'refresh') {
        return res.status(401).json({
            error: 'InvalidTokenType',
            message: '请使用 refresh token 刷新',
        });
    }

    const newAccessToken = generateAccessToken({
        userId: req.user!.userId,
        isGuest: req.user!.isGuest,
        region: req.user!.region,
    });

    res.json({ accessToken: newAccessToken });
});

export default router;
