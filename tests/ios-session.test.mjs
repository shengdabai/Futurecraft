import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const hasSwift = spawnSync('swiftc', ['--version']).status === 0;
const guestId = '11111111-1111-4111-8111-111111111111';
const user = { id: guestId };
const me = (status = 200, token = 'old-access') => ({ path: '/auth/me', token, status, body: user });
const refresh = (status = 200, body = { accessToken: 'new-access' }) =>
    ({ path: '/auth/refresh', token: 'stored-refresh', method: 'POST', status, body });

test('iOS session restoration executes the actual Swift methods against HTTP fixtures', {
    skip: hasSwift ? false : 'swiftc unavailable; run this regression on a Swift-enabled host',
    timeout: 120_000,
}, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'futurecraft-ios-session-'));
    try {
        const source = await readFile(new URL('../FutureCraftiOS/FutureCraftiOS/Networking/AuthManager.swift', import.meta.url), 'utf8');
        const start = source.indexOf('    /// 游客登录');
        const end = source.indexOf('    /// 登出', start);
        assert.ok(start >= 0 && end > start, 'production methods must be included verbatim');
        // Only platform storage/models are substituted; URLSession and the production methods execute normally.
        const harness = `
import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
struct User: Codable { let id: String }
struct AuthResponse: Codable { let accessToken: String; let refreshToken: String; let user: User }
enum AuthError: Error { case serverError }
enum Region: String {
    case global = "GLOBAL"
    var baseURL: String { CommandLine.arguments[1] }
}
enum Constants { enum Keys { static let guestId = "fixtureGuestId" } }
final class UserDefaults {
    static let standard = UserDefaults()
    var values: [String: String] = [:]
    func string(forKey key: String) -> String? { values[key] }
    func set(_ value: String, forKey key: String) { values[key] = value }
}
final class KeychainManager {
    static let shared = KeychainManager()
    var access: String? = "old-access"
    var refresh: String? = CommandLine.arguments[5] == "nil" ? nil : "stored-refresh"
    var userId: String? = "${guestId}"
    func getAccessToken() -> String? { access }
    func getRefreshToken() -> String? { refresh }
    func getUserId() -> String? { userId }
    func saveAccessToken(_ value: String) -> Bool { access = value; return true }
    func saveRefreshToken(_ value: String) -> Bool { refresh = value; return true }
    func saveUserId(_ value: String) -> Bool { userId = value; return true }
    func clearAllTokens() { access = nil; refresh = nil; userId = nil }
}
final class AuthManager {
${source.slice(start, end)}
}
@main struct Probe {
    static func main() async throws {
        let manager = AuthManager()
        let restored = await manager.tryRestoreSession(region: .global)
        precondition((restored?.id == "${guestId}") == (CommandLine.arguments[2] == "true"), "restored identity")
        let expectedAccess = CommandLine.arguments[3] == "nil" ? nil : CommandLine.arguments[3]
        let expectedRefresh = CommandLine.arguments[4] == "nil" ? nil : CommandLine.arguments[4]
        precondition(KeychainManager.shared.access == expectedAccess, "access token retention")
        precondition(KeychainManager.shared.refresh == expectedRefresh, "refresh token retention")
        precondition(KeychainManager.shared.userId == (expectedAccess == nil ? nil : "${guestId}"), "stored identity")
        // Check the returning-guest path also supplies the original ID and the retained token.
        if expectedAccess != nil {
            UserDefaults.standard.set("${guestId}", forKey: Constants.Keys.guestId)
            let login = try await manager.loginAsGuest(region: .global)
            precondition(login.user.id == "${guestId}", "guest identity")
        }
    }
}
`;
        const swiftFile = join(directory, 'SessionProbe.swift');
        const binary = join(directory, 'session-probe');
        await writeFile(swiftFile, harness);
        await run('swiftc', ['-parse-as-library', swiftFile, '-o', binary], { timeout: 60_000 });

        const scenarios = [
            { name: 'valid access needs no refresh', steps: [me()], restored: true },
            { name: 'expired access refreshes once and retries me', steps: [me(401), refresh(), me(200, 'new-access')], restored: true, access: 'new-access' },
            { name: 'me server error retains credentials', steps: [me(503)] },
            { name: 'me forbidden does not clear credentials', steps: [me(403)] },
            { name: 'me network error retains credentials', steps: [{ ...me(), disconnect: true }] },
            { name: 'refresh server error retains credentials', steps: [me(401), refresh(503)] },
            { name: 'refresh network error retains credentials', steps: [me(401), { ...refresh(), disconnect: true }] },
            { name: 'malformed refresh retains credentials', steps: [me(401), refresh(200, {})] },
            { name: 'refresh unauthorized clears credentials', steps: [me(401), refresh(401)], access: null, refreshToken: null },
            { name: 'refresh forbidden clears credentials', steps: [me(401), refresh(403)], access: null, refreshToken: null },
            { name: 'retry server error retains refreshed credentials', steps: [me(401), refresh(), me(503, 'new-access')], access: 'new-access' },
            { name: 'retry unauthorized never loops or clears refresh', steps: [me(401), refresh(), me(401, 'new-access')], access: 'new-access' },
            { name: 'missing refresh retains access for guest fallback', steps: [me(401)], refreshToken: null, initialRefresh: null },
        ];
        for (const scenario of scenarios) {
            await t.test(scenario.name, async () => {
                const access = scenario.access === undefined ? 'old-access' : scenario.access;
                const refreshToken = scenario.refreshToken === undefined ? 'stored-refresh' : scenario.refreshToken;
                const steps = [...scenario.steps];
                if (access !== null) steps.push({ path: '/auth/guest', method: 'POST', token: refreshToken ?? access,
                    status: 200, body: { accessToken: 'guest-access', refreshToken: 'guest-refresh', user },
                    requestBody: { region: 'GLOBAL', guestId } });
                const observed = [];
                const server = createServer(async (req, res) => {
                    let body = '';
                    for await (const chunk of req) body += chunk;
                    observed.push({ path: req.url, method: req.method, token: req.headers.authorization,
                        body: body ? JSON.parse(body) : undefined });
                    const step = steps[observed.length - 1];
                    if (step?.disconnect) {
                        res.writeHead(200, { 'Content-Length': '1000' });
                        res.write('{');
                        setTimeout(() => res.destroy(), 10);
                        return;
                    }
                    res.writeHead(step?.status ?? 500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(step?.body ?? {}));
                });
                try {
                    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
                    await run(binary, [`http://127.0.0.1:${server.address().port}`, String(scenario.restored ?? false),
                        access ?? 'nil', refreshToken ?? 'nil', scenario.initialRefresh === null ? 'nil' : 'stored-refresh'],
                    { timeout: 15_000 });
                    assert.deepEqual(observed, steps.map(step => ({ path: step.path, method: step.method ?? 'GET',
                        token: `Bearer ${step.token}`, body: step.requestBody })));
                } finally {
                    server.closeAllConnections();
                    await new Promise(resolve => server.close(resolve));
                }
            });
        }
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
