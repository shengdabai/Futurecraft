import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

// config/env.ts 在 import 时读取环境变量，所以先设置，再用动态 import 加载路由。
// 这些用例只走参数校验分支，不会调用 Gemini 或 Apple。
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'futurecraft-validation-test-'));
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'x'.repeat(32);
process.env.GEMINI_API_KEY = 'test-placeholder';
process.env.DB_PATH = path.join(tmpDir, 'test.db');

let server: Server;
let baseUrl = '';
let closeDb: () => void;
let token = '';

before(async () => {
    // middleware/rateLimit.ts 在模块顶层用 setInterval 清理计数且没有 unref()，
    // 不处理的话测试进程永远不会退出。只在 import 期间把新建的 interval 设为 unref。
    const realSetInterval = globalThis.setInterval;
    globalThis.setInterval = ((...args: Parameters<typeof setInterval>) =>
        realSetInterval(...args).unref()) as typeof setInterval;
    let authRouter: typeof import('../src/routes/auth.js').default;
    let aiRouter: typeof import('../src/routes/ai.js').default;
    let iapRouter: typeof import('../src/routes/iap.js').default;
    let generateAccessToken: typeof import('../src/middleware/auth.js').generateAccessToken;
    try {
        ({ default: authRouter } = await import('../src/routes/auth.js'));
        ({ default: aiRouter } = await import('../src/routes/ai.js'));
        ({ default: iapRouter } = await import('../src/routes/iap.js'));
        ({ generateAccessToken } = await import('../src/middleware/auth.js'));
        ({ closeDb } = await import('../src/db/database.js'));
    } finally {
        globalThis.setInterval = realSetInterval;
    }
    const { default: express } = await import('express');

    token = generateAccessToken({ userId: 'validation-test-user', isGuest: false, region: 'GLOBAL' });

    const app = express();
    app.use(express.json());
    app.use('/auth', authRouter);
    app.use('/ai', aiRouter);
    app.use('/iap', iapRouter);

    await new Promise<void>((resolve) => {
        server = app.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function post(route: string, body: unknown, withToken = false) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (withToken) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${baseUrl}${route}`, { method: 'POST', headers, body: JSON.stringify(body) });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

/** 400 响应的约定形状：{ error, message, details: { 字段: string[] } }，不泄露 zod 内部结构。 */
function assertValidationError(
    res: { status: number; body: Record<string, unknown> },
    message: string,
    fields: string[],
) {
    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys(res.body).sort(), ['details', 'error', 'message']);
    assert.equal(res.body.error, 'InvalidRequest');
    assert.equal(res.body.message, message);

    const details = res.body.details as Record<string, unknown>;
    assert.equal(typeof details, 'object');
    assert.ok(details !== null && !Array.isArray(details), 'details must be a plain object');
    assert.deepEqual(Object.keys(details).sort(), [...fields].sort());
    for (const field of fields) {
        const messages = details[field];
        assert.ok(Array.isArray(messages) && messages.length > 0, `${field} must list at least one message`);
        for (const text of messages) assert.equal(typeof text, 'string');
    }
}

test('POST /auth/apple with an empty body lists both missing fields', async () => {
    const res = await post('/auth/apple', {});
    assertValidationError(res, '缺少必要的认证信息', ['authorizationCode', 'identityToken']);
});

test('POST /auth/apple rejects a malformed email and reports only that field', async () => {
    const res = await post('/auth/apple', { identityToken: 't', authorizationCode: 'c', email: 'not-an-email' });
    assertValidationError(res, '缺少必要的认证信息', ['email']);
});

test('POST /auth/guest rejects a non-UUID guestId without a details field', async () => {
    const res = await post('/auth/guest', { guestId: 'not-a-uuid' });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'InvalidRequest', message: '请求参数无效' });
});

test('POST /auth/guest still accepts any 8-4-4-4-12 hex guestId, as before the zod 4 upgrade', async () => {
    // zod 3 的 .uuid() 不检查版本位；zod 4 的 z.uuid() 会检查，所以这里用 z.guid() 保持原行为。
    const res = await post('/auth/guest', { guestId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.accessToken, 'string');
});

test('POST /ai/soul-scan reports every invalid field', async () => {
    const res = await post('/ai/soul-scan', { name: '', hobbies: 'reading' }, true);
    assertValidationError(res, '请求参数无效', ['hobbies', 'major', 'name']);
});

test('POST /iap/verify-purchase with an empty body lists the missing transaction fields', async () => {
    const res = await post('/iap/verify-purchase', {}, true);
    assertValidationError(res, '缺少交易信息', ['productId', 'transactionId']);
});

test('an invalid environment prints one line per issue and exits with code 1', () => {
    // 在空的临时目录里运行，dotenv 读不到任何 .env 文件。
    const envModule = new URL('../src/config/env.ts', import.meta.url).href;
    const result = spawnSync(
        process.execPath,
        ['--import', import.meta.resolve('tsx'), '--input-type=module', '-e', `await import(${JSON.stringify(envModule)});`],
        {
            cwd: tmpDir,
            env: { PATH: process.env.PATH ?? '', JWT_SECRET: 'too-short', GEMINI_API_KEY: '' },
            encoding: 'utf8',
        },
    );

    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /环境变量配置错误/);
    assert.match(result.stderr, /- JWT_SECRET: JWT_SECRET must be at least 32 characters/);
    assert.match(result.stderr, /- GEMINI_API_KEY: GEMINI_API_KEY is required/);
    assert.doesNotMatch(result.stderr, /TypeError/);
});
