import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// Demo storage is process-local; persistent accounts require a canonical backend.
interface User { id: string; username: string; type: 'regular' | 'guest'; salt?: string; passwordHash?: Buffer; credits?: number }
const users = new Map<string, User>();
const sessions = new Map<string, { userId: string; expiresAt: number }>();
const derivePassword = promisify(scrypt);
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateToken(userId: string) {
  const token = randomBytes(32).toString('base64url');
  for (const [value, session] of sessions) {
    if (session.expiresAt <= Date.now()) sessions.delete(value);
  }
  sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

// Allowed CORS origins. Configure via ALLOWED_ORIGINS (comma-separated) in
// the deployment environment; defaults to the production domain.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://zturnsgo.com')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers — reflect only allow-listed origins instead of a wildcard.
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0] || 'https://zturnsgo.com');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { path } = req.query;
  const endpoint = (Array.isArray(path) ? path.join('/') : path)
    || new URL(req.url || '/', 'http://localhost').pathname.replace(/^\/api\/?/, '');

  try {
    // Health check
    if (endpoint === 'health') {
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        endpoint: '/api/health'
      });
    }

    if (endpoint === 'register' && req.method === 'POST') {
      const { username, password } = req.body || {};

      if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,20}$/.test(username)
        || typeof password !== 'string' || password.length < 6 || password.length > 1024) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: '用户名和密码是必填项' }
        });
      }

      const salt = randomBytes(16).toString('hex');
      const passwordHash = await derivePassword(password, salt, 64) as Buffer;
      // Check after hashing as well, so simultaneous registrations cannot duplicate a name.
      if ([...users.values()].some(user => user.username === username)) {
        return res.status(409).json({ success: false, error: { code: 'USERNAME_EXISTS', message: '用户名已存在' } });
      }
      const userId = randomUUID();
      const userData: User = {
        username,
        salt,
        passwordHash,
        id: userId,
        type: 'regular'
      };

      users.set(userId, userData);
      const token = generateToken(userId);

      return res.status(201).json({
        success: true,
        data: {
          userId,
          username,
          token,
          type: 'regular'
        }
      });
    }

    if (endpoint === 'login' && req.method === 'POST') {
      const { username, password } = req.body || {};

      if (typeof username !== 'string' || typeof password !== 'string' || !password || password.length > 1024) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: '用户名和密码是必填项' }
        });
      }

      let userData = null;
      for (const [id, user] of users) {
        if (user.username === username) {
          userData = user;
          break;
        }
      }

      // Derive a dummy hash too, to avoid a fast path exposing unknown usernames.
      const candidate = await derivePassword(password, userData?.salt || 'unknown-user-salt', 64) as Buffer;
      if (!userData?.passwordHash || !timingSafeEqual(userData.passwordHash, candidate)) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' }
        });
      }

      const token = generateToken(userData.id);

      return res.status(200).json({
        success: true,
        data: {
          userId: userData.id,
          username: userData.username,
          token,
          type: 'regular'
        }
      });
    }

    // Guest registration
    if (endpoint === 'auth/guest' && req.method === 'POST') {
      const userId = `guest_${randomUUID()}`;
      const guestName = `游客${randomBytes(6).toString('hex')}`;

      const guestData: User = {
        username: guestName,
        id: userId,
        type: 'guest',
        credits: 100
      };

      users.set(userId, guestData);
      const token = generateToken(userId);

      return res.status(200).json({
        success: true,
        data: {
          userId,
          username: guestName,
          token,
          type: 'guest'
        }
      });
    }

    if (endpoint.startsWith('ai/') && req.method === 'POST') {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'AI 后端尚未连接' },
      });
    }

    // Get user info (basic)
    if (endpoint === 'auth/me' && req.method === 'GET') {
      const header = req.headers.authorization;
      const auth = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
      if (!auth) {
        return res.status(401).json({ success: false, error: { message: '需要认证' } });
      }

      const session = sessions.get(auth);
      if (!session || session.expiresAt <= Date.now()) {
        sessions.delete(auth);
        return res.status(401).json({ success: false, error: { message: '无效令牌' } });
      }

      const user = users.get(session.userId);
      if (!user) {
        return res.status(404).json({ success: false, error: { message: '用户不存在' } });
      }

      return res.status(200).json({
        success: true,
        data: {
          userId: user.id,
          username: user.username,
          type: user.type,
          credits: user.credits || 0
        }
      });
    }

    // No such endpoint
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'API 端点不存在' }
    });

  } catch (error: any) {
    console.error('API request failed');
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' }
    });
  }
}
