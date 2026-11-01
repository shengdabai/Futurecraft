import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const require = createRequire(new URL('../backend/package.json', import.meta.url));
const jwt = require('jsonwebtoken');
const secret = 'fixture-only-signing-key-at-least-32-characters';
async function load(entry, { env = {}, mocks = {}, clock = Date } = {}) {
    const source = await readFile(entry, 'utf8');
    const result = await build({ stdin: { contents: source + (entry === 'api/index.ts' ? '\nexport const testUsers = users;' : ''),
        loader: 'ts', sourcefile: entry, resolveDir: dirname(resolve(entry)) }, bundle: true, write: false,
        platform: 'node', format: 'cjs', packages: 'external',
        plugins: [{ name: 'isolated-readers', setup(builder) {
            builder.onResolve({ filter: /.*/ }, args => args.path in mocks
                ? { path: args.path, namespace: 'fixture' } : undefined);
            builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path] }));
        } }],
    });
    const module = { exports: {} };
    runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require,
        Buffer, URL, Date: clock, process: { env }, console: { log() {}, warn() {}, error() {} },
        fetch() { throw new Error('External requests are forbidden in tests'); } });
    return module.exports;
}
function response() {
    return { code: 200, headers: {}, status(code) { this.code = code; return this; },
        json(body) { this.body = body; return this; }, setHeader(key, value) { this.headers[key] = value; }, end() {} };
}
async function call(handler, path, body, authorization, method = 'POST') {
    const res = response();
    await handler({ method, url: `/api/${path}?unused=1`, body,
        headers: authorization ? { authorization } : {}, query: { path } }, res);
    return res;
}

test('JWT configuration fails closed; valid, expired, wrong-key and malformed tokens differ', async () => {
    for (const JWT_SECRET of [undefined, '', 'short', ' '.repeat(40)]) {
        const auth = await load('api/lib/auth.ts', { env: { JWT_SECRET } });
        assert.throws(() => auth.generateToken({ userId: 'fixture', username: 'tester' }), /JWT_SECRET/);
        assert.equal(auth.verifyToken(jwt.sign({ userId: 'fixture', username: 'tester' }, secret)), null);
    }
    const auth = await load('api/lib/auth.ts', { env: { JWT_SECRET: secret } });
    const token = auth.generateToken({ userId: 'fixture', username: 'tester' });
    assert.equal(auth.verifyToken(token).userId, 'fixture');
    for (const bad of [jwt.sign({ userId: 'fixture', username: 'tester' }, 'wrong-key'),
        jwt.sign({ userId: 'fixture', username: 'tester' }, secret, { expiresIn: -1 }),
        jwt.sign({ userId: 'fixture', username: 'tester' }, secret),
        jwt.sign({ userId: 12, username: 'tester' }, secret, { expiresIn: '1h' }),
        jwt.sign({ userId: 'fixture', username: 'tester' }, secret, { algorithm: 'HS384', expiresIn: '1h' })]) {
        assert.equal(auth.verifyToken(bad), null);
    }
    assert.equal(auth.extractToken({ headers: { authorization: ['Bearer example'] } }), null);
    for (const value of [null, {}, 123]) {
        assert.equal(auth.isValidUsername(value), false);
        assert.equal(auth.isValidPassword(value), false);
    }
    assert.equal(auth.isValidPassword('字'.repeat(25)), false);
    const hash = await auth.hashPassword('fixture-password');
    assert.notEqual(hash, 'fixture-password');
    assert.equal(await auth.verifyPassword('fixture-password', hash), true);
    assert.equal(await auth.verifyPassword('wrong-password', hash), false);
});

test('API resolves real request paths and safely rejects invalid bodies and duplicate names', async () => {
    const { default: handler } = await load('api/index.ts');
    const health = response();
    await handler({ method: 'GET', url: '/api/health', query: {}, headers: {} }, health);
    assert.equal(health.code, 200);
    for (const body of [undefined, null, {}, { username: {}, password: 123 }, { username: 'ab', password: '123456' }]) {
        assert.equal((await call(handler, 'register', body)).code, 400);
    }
    const account = { username: 'fixture_user', password: 'fixture-password' };
    const registrations = await Promise.all([call(handler, 'register', account), call(handler, 'register', account)]);
    assert.deepEqual(registrations.map(r => r.code).sort(), [201, 409]);
    assert.equal((await call(handler, 'login', { ...account, password: 'wrong-password' })).code, 401);
    const signedIn = await call(handler, 'login', account);
    assert.equal(signedIn.code, 200);
    assert.ok(!JSON.stringify(signedIn.body).includes(account.password));
    assert.match(signedIn.body.data.token, /^[A-Za-z0-9_-]{43}$/);
    const me = await call(handler, 'auth/me', undefined, `Bearer ${signedIn.body.data.token}`, 'GET');
    assert.equal(me.body.data.username, account.username);
    assert.equal((await call(handler, 'auth/me', undefined, signedIn.body.data.token, 'GET')).code, 401);
    assert.equal((await call(handler, 'auth/me', undefined, `Bearer token_0_${me.body.data.userId}`, 'GET')).code, 401);
    for (const route of ['ai/soul-scan', 'ai/simulation', 'ai/skill-tree', 'ai/chat']) {
        assert.equal((await call(handler, route, {})).code, 503);
    }
});

test('sessions expire, guest identities are unique, and query.path remains supported', async () => {
    let now = 1000;
    class Clock extends Date { static now() { return now; } }
    const { default: handler } = await load('api/index.ts', { clock: Clock });
    const first = await call(handler, 'auth/guest', {});
    const second = await call(handler, 'auth/guest', {});
    assert.notEqual(first.body.data.userId, second.body.data.userId);
    assert.notEqual(first.body.data.token, second.body.data.token);
    now += 7 * 24 * 60 * 60 * 1000;
    assert.equal((await call(handler, 'auth/me', undefined, `Bearer ${first.body.data.token}`, 'GET')).code, 401);
    const res = response();
    await handler({ method: 'GET', query: { path: ['health'] }, headers: {} }, res);
    assert.equal(res.code, 200);
});

test('demo account storage contains a salted derived hash and no plaintext password', async () => {
    const { default: handler, testUsers } = await load('api/index.ts');
    const res = await call(handler, 'register', { username: 'hash_fixture', password: 'fixture-password' });
    assert.equal(res.code, 201);
    const stored = testUsers.get(res.body.data.userId);
    assert.equal(stored.password, undefined);
    assert.equal(Buffer.isBuffer(stored.passwordHash), true);
    assert.equal(stored.passwordHash.length, 64);
    assert.match(stored.salt, /^[a-f0-9]{32}$/);
    assert.match(res.body.data.token, /^[A-Za-z0-9_-]{43}$/);
});

test('guest endpoint resolves dependencies and hashes passwords with fixture-only storage', async () => {
    const { default: handler } = await load('api/auth/guest.ts', { env: { JWT_SECRET: secret }, mocks: {
        '../lib/db': `export const generateId=()=> 'fixture-guest'; export const getDatabase=()=>({
            createUser: async (_id,_name,hash)=> { if(!hash.startsWith('$2')) throw Error('Unhashed password'); }
        });`,
    } });
    assert.equal((await call(handler, 'auth/guest', {})).code, 201);
});

// main's IAP route (server catalog, GK-06) replaced this branch's 503 stub in the merge. Development mode
// without App Store keys deliberately skips Apple verification there (see backend/src/routes/iap.test.ts),
// so this test covers every other environment: with real catalog products, nothing is granted and the
// database is never opened.
test('IAP never grants credits or subscriptions without verified Apple evidence outside keyless development', async () => {
    for (const env of [{ NODE_ENV: 'production' },
        { NODE_ENV: 'development', APP_STORE_KEY_ID: 'fixture-key', APP_STORE_ISSUER_ID: 'fixture-issuer' },
        { NODE_ENV: 'production', APP_STORE_KEY_ID: 'fixture-key', APP_STORE_ISSUER_ID: 'fixture-issuer' }]) {
        const { default: router } = await load('backend/src/routes/iap.ts', {
            env, mocks: {
                '../middleware/auth.js': 'export const authMiddleware=()=>{};',
                '../db/database.js': 'export const getDb=()=>{throw Error("Database must not be accessed")};',
                '../db/iapRepository.js': 'export const findByTransactionId=()=>{throw Error("No transactions")}; export const createTransaction=()=>{throw Error("No transactions")};',
                '../db/userRepository.js': 'export const findById=()=>{throw Error("No users")}; export const updateCreditBalance=()=>{}; export const updateSubscriptionTier=()=>{}; export const updateSubscriptionExpiresAt=()=>{};',
            },
        });
        for (const [path, productId] of [['/verify-purchase', 'com.zturns.futurecraft.points.250'],
            ['/sync-subscription', 'com.zturns.futurecraft.sub.monthly']]) {
            const handler = router.stack.find(layer => layer.route?.path === path).route.stack[0].handle;
            const res = response();
            await handler({ body: { transactionId: 'fixture-tx', productId, points: 100000 }, user: { userId: 'fixture' } }, res);
            assert.equal(res.code, 400);
            assert.equal(res.body.error, 'VerificationFailed');
        }
    }
});
