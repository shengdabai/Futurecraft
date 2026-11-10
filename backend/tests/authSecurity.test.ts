import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';

const dir = mkdtempSync(join(tmpdir(), 'futurecraft-auth-'));
const secret = 'fixture-only-signing-key-at-least-32-characters';
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = secret;
process.env.GEMINI_API_KEY = 'test-placeholder';
process.env.DB_PATH = join(dir, 'test.db');
let server: Server;
let base: string;
let closeDb: () => void;
let auth: typeof import('../src/middleware/auth.js');

before(async () => {
    const { default: express } = await import('express');
    const { default: router } = await import('../src/routes/auth.js');
    ({ closeDb } = await import('../src/db/database.js'));
    auth = await import('../src/middleware/auth.js');
    const app = express();
    app.use(express.json());
    app.use('/auth', router);
    app.get('/protected', auth.authMiddleware, (_req, res) => res.json({ ok: true }));
    app.get('/optional', auth.optionalAuthMiddleware, (req, res) => res.json({ user: req.user ?? null }));
    await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    closeDb();
    rmSync(dir, { recursive: true, force: true });
});

async function post(path: string, body: unknown, token?: string) {
    return fetch(`${base}/auth/${path}`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body) });
}

test('guest restoration requires the same guest access token', async () => {
    const first = await (await post('guest', {})).json();
    const second = await (await post('guest', {})).json();
    const body = { guestId: first.user.id };
    assert.equal((await post('guest', body)).status, 403);
    assert.equal((await post('guest', body, second.accessToken)).status, 403);
    assert.equal((await post('guest', body, first.refreshToken)).status, 403);
    assert.equal((await post('guest', body, 'invalid')).status, 403);
    const restored = await post('guest', body, first.accessToken);
    assert.equal(restored.status, 200);
    assert.equal((await restored.json()).user.id, first.user.id);
});

test('JWT middleware rejects wrong algorithms, missing claims, expired tokens and refresh tokens', async () => {
    const claims = { userId: 'fixture', isGuest: true, region: 'GLOBAL', type: 'access' };
    const invalid = [jwt.sign(claims, secret), jwt.sign({ ...claims, userId: 1 }, secret, { expiresIn: '1h' }),
        jwt.sign(claims, secret, { algorithm: 'HS384', expiresIn: '1h' }),
        jwt.sign(claims, secret, { expiresIn: -1 }),
        auth.generateRefreshToken(claims), 'invalid'];
    for (const token of invalid) {
        const headers = { Authorization: `Bearer ${token}` };
        assert.equal((await fetch(`${base}/protected`, { headers })).status, 401);
        assert.equal((await (await fetch(`${base}/optional`, { headers })).json()).user, null);
    }
    assert.equal((await post('refresh', {}, auth.generateAccessToken(claims))).status, 401);
    const refreshed = await post('refresh', {}, auth.generateRefreshToken(claims));
    assert.equal(refreshed.status, 200);
    const token = (await refreshed.json()).accessToken;
    assert.equal((await fetch(`${base}/protected`, { headers: { Authorization: `Bearer ${token}` } })).status, 200);
});

test('Apple verification failures fail closed in development too', async () => {
    const result = await post('apple', { identityToken: 'invalid', authorizationCode: 'fixture' });
    assert.equal(result.status, 401);
    assert.equal((await result.json()).error, 'InvalidToken');
});
