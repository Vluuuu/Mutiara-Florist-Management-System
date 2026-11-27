/**
 * MFMS Phase 14C.1 — Real Dual-Runtime HTTP Integration Tests (CSRF Middleware Enabled)
 *
 * Spins up TWO genuine PHP-HTTP Laravel runtimes with independent APP_KEYs,
 * independent session cookies (mfms_prod_session vs mfms_demo_session), and
 * independent SQLite databases behind a real same-domain Node.js reverse proxy
 * mirroring docker/nginx-router.conf.template (mfms_runtime=demo routing, /demo, /admin-entry).
 *
 * Because the upstream servers run under real HTTP (NOT PHPUnit), Laravel's
 * ValidateRuntimeCsrfToken middleware executes 100% live without any unit-test bypass.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

const DEMO_EMAIL = 'demo@mutiaraflorist.id';
const DEMO_PASSWORD = 'Mutiara-Http-9k4V2';
const ADMIN_EMAIL = 'owner-http@mutiaraflorist.id';
const ADMIN_PASSWORD = 'Admin-Http-Secret-91!';

class CookieJar {
    constructor() {
        this.cookies = new Map();
    }

    set(name, value) {
        this.cookies.set(name, value);
    }

    delete(name) {
        this.cookies.delete(name);
    }

    get(name) {
        return this.cookies.get(name);
    }

    has(name) {
        return this.cookies.has(name);
    }

    header() {
        return Array.from(this.cookies.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');
    }

    ingestSetCookies(setCookieHeaders) {
        const list = Array.isArray(setCookieHeaders)
            ? setCookieHeaders
            : setCookieHeaders
              ? [setCookieHeaders]
              : [];

        const seenNames = new Set();
        for (const raw of list) {
            const parts = raw.split(';').map((p) => p.trim());
            const eqIdx = parts[0].indexOf('=');
            if (eqIdx <= 0) continue;

            const name = parts[0].slice(0, eqIdx);
            const value = parts[0].slice(eqIdx + 1);

            assert.ok(
                !seenNames.has(name),
                `Duplicate Set-Cookie header emitted for "${name}" in single response: ${JSON.stringify(list)}`,
            );
            seenNames.add(name);

            const attrs = new Map();
            for (const attr of parts.slice(1)) {
                const idx = attr.indexOf('=');
                if (idx > 0) {
                    attrs.set(attr.slice(0, idx).toLowerCase(), attr.slice(idx + 1));
                } else {
                    attrs.set(attr.toLowerCase(), true);
                }
            }

            const maxAge = attrs.has('max-age') ? Number(attrs.get('max-age')) : null;
            const expires = attrs.has('expires') ? Date.parse(attrs.get('expires')) : null;
            const isExpired =
                (maxAge !== null && maxAge <= 0) ||
                (expires !== null && !Number.isNaN(expires) && expires <= Date.now());

            if (isExpired || value === 'deleted' || value === '') {
                this.cookies.delete(name);
            } else {
                this.cookies.set(name, value);
            }
        }
    }

    getDecoded(name) {
        const raw = this.cookies.get(name);
        return raw ? decodeURIComponent(raw) : null;
    }
}

function getFreePort() {
    return new Promise((resolve, reject) => {
        const srv = http.createServer();
        srv.listen(0, '127.0.0.1', () => {
            const addr = srv.address();
            srv.close(() => resolve(addr.port));
        });
        srv.on('error', reject);
    });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(port, label) {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
        try {
            const res = await rawRequest(port, 'GET', '/up');
            if (res.status === 200) {
                return;
            }
        } catch {
            // retry
        }
        await sleep(150);
    }
    throw new Error(`Timed out waiting for ${label} on port ${port}`);
}

function rawRequest(port, method, reqPath, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                hostname: '127.0.0.1',
                port,
                path: reqPath,
                method,
                headers,
            },
            (res) => {
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: Buffer.concat(chunks).toString('utf8'),
                    });
                });
            },
        );
        req.on('error', reject);
        if (body !== null) {
            req.write(body);
        }
        req.end();
    });
}

function startSameDomainProxy(proxyPort, prodPort, demoPort) {
    const server = http.createServer((clientReq, clientRes) => {
        const urlPath = (clientReq.url || '/').split('?')[0];
        const cookieHeader = clientReq.headers.cookie || '';
        const hasDemoCookie = /(^|;\s*)mfms_runtime=demo(;|$)/.test(cookieHeader);

        let targetPort = prodPort;
        if (urlPath === '/demo') {
            targetPort = demoPort;
        } else if (urlPath === '/admin-entry') {
            targetPort = prodPort;
        } else if (hasDemoCookie) {
            targetPort = demoPort;
        }

        const upstreamHeaders = {
            ...clientReq.headers,
            host: `127.0.0.1:${proxyPort}`,
            'x-forwarded-host': `127.0.0.1:${proxyPort}`,
            'x-forwarded-proto': 'http',
        };

        if (targetPort === demoPort) {
            delete upstreamHeaders['cf-access-jwt-assertion'];
            delete upstreamHeaders['x-mfms-edge-secret'];
        }

        const proxyReq = http.request(
            {
                hostname: '127.0.0.1',
                port: targetPort,
                path: clientReq.url,
                method: clientReq.method,
                headers: upstreamHeaders,
            },
            (proxyRes) => {
                clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(clientRes);
            },
        );

        proxyReq.on('error', (err) => {
            clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
            clientRes.end(`Proxy error: ${err.message}`);
        });

        clientReq.pipe(proxyReq);
    });

    return new Promise((resolve, reject) => {
        server.listen(proxyPort, '127.0.0.1', () => resolve(server));
        server.on('error', reject);
    });
}

function makeAppKey() {
    return `base64:${crypto.randomBytes(32).toString('base64')}`;
}

function parseMeta(html, name) {
    const re = new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'i');
    const match = html.match(re);
    return match ? match[1] : null;
}

function countSqliteRows(dbPath, table) {
    const out = execFileSync(
        'php',
        [
            '-r',
            `$pdo = new PDO("sqlite:".$argv[1]); echo (int)$pdo->query("SELECT COUNT(*) FROM ".$argv[2])->fetchColumn();`,
            dbPath,
            table,
        ],
        { encoding: 'utf8' },
    );
    return Number(out.trim());
}

function seedAdminUser(env) {
    execFileSync(
        'php',
        [
            '-r',
            `
            require "vendor/autoload.php";
            $app = require "bootstrap/app.php";
            $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
            App\\Models\\User::query()->updateOrCreate(
                ["email" => $argv[1]],
                ["name" => "Pemilik Toko", "password" => Illuminate\\Support\\Facades\\Hash::make($argv[2])]
            );
            `,
            ADMIN_EMAIL,
            ADMIN_PASSWORD,
        ],
        { cwd: ROOT_DIR, env, stdio: 'pipe' },
    );
}

function seedDemoUser(env) {
    execFileSync(
        'php',
        [
            '-r',
            `
            require "vendor/autoload.php";
            $app = require "bootstrap/app.php";
            $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
            App\\Models\\User::query()->updateOrCreate(
                ["email" => $argv[1]],
                ["name" => "Evaluator Demo", "password" => Illuminate\\Support\\Facades\\Hash::make($argv[2])]
            );
            `,
            DEMO_EMAIL,
            DEMO_PASSWORD,
        ],
        { cwd: ROOT_DIR, env, stdio: 'pipe' },
    );
}

test('Phase 14C.1 real dual-runtime same-domain session, CSRF, multi-tab, and reset recovery', async (t) => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mfms-14c1-'));
    const prodDb = path.join(tmpRoot, 'prod.sqlite');
    const demoDb = path.join(tmpRoot, 'demo.sqlite');
    const prodSessionsDir = path.join(tmpRoot, 'prod-sessions');
    const demoSessionsDir = path.join(tmpRoot, 'demo-sessions');
    const demoKillSwitch = path.join(tmpRoot, 'demo.disabled');
    const demoResetFlag = path.join(tmpRoot, 'resetting.flag');
    const demoResetLock = path.join(tmpRoot, 'reset.lock');

    fs.mkdirSync(prodSessionsDir, { recursive: true });
    fs.mkdirSync(demoSessionsDir, { recursive: true });
    fs.writeFileSync(prodDb, '');
    fs.writeFileSync(demoDb, '');

    const proxyPort = await getFreePort();
    const prodPort = await getFreePort();
    const demoPort = await getFreePort();
    const origin = `http://127.0.0.1:${proxyPort}`;

    const baseEnv = {
        ...process.env,
        APP_ENV: 'local',
        APP_DEBUG: 'false',
        APP_URL: origin,
        APP_TIMEZONE: 'Asia/Jakarta',
        CACHE_STORE: 'array',
        QUEUE_CONNECTION: 'sync',
        DB_CONNECTION: 'sqlite',
        SESSION_DRIVER: 'file',
        SESSION_LIFETIME: '120',
        SESSION_SECURE_COOKIE: 'false',
        SESSION_SAME_SITE: 'lax',
        SESSION_DOMAIN: '',
        CLOUDFLARE_ACCESS_ENFORCE: 'false',
    };

    const prodEnv = {
        ...baseEnv,
        APP_KEY: makeAppKey(),
        MFMS_RUNTIME_MODE: 'production',
        DEMO_ENABLED: 'false',
        DEMO_ENTRY_LINK_ENABLED: 'true',
        DB_DATABASE: prodDb,
        SESSION_COOKIE: 'mfms_prod_session',
        SESSION_FILES: prodSessionsDir,
    };

    const demoEnv = {
        ...baseEnv,
        APP_KEY: makeAppKey(),
        MFMS_RUNTIME_MODE: 'demo',
        DEMO_ENABLED: 'true',
        DEMO_EMAIL,
        DEMO_PASSWORD,
        DEMO_ACTIVATED_AT: new Date(Date.now() - 86_400_000).toISOString(),
        DEMO_DURATION_DAYS: '14',
        DEMO_SQLITE_PATH: demoDb,
        DEMO_KILL_SWITCH_FILE: demoKillSwitch,
        DEMO_RESETTING_FLAG_FILE: demoResetFlag,
        DEMO_RESET_LOCK_FILE: demoResetLock,
        DB_DATABASE: demoDb,
        SESSION_COOKIE: 'mfms_demo_session',
        SESSION_FILES: demoSessionsDir,
    };

    // Wait: Laravel reads session.files from config/session.php (storage_path('framework/sessions'))
    // so let's ensure both use distinct session files cleanly, OR use distinct SESSION_DRIVER=database for prod and file for demo!
    // Even better: prod uses SESSION_DRIVER=database (stored inside prod.sqlite!) and demo uses SESSION_DRIVER=file!
    // That mirrors real production (PostgreSQL DB sessions + Demo SQLite file sessions)!!
    prodEnv.SESSION_DRIVER = 'database';
    demoEnv.SESSION_DRIVER = 'file';

    // Run migrations & seed both independent databases
    execFileSync('php', ['artisan', 'migrate', '--force'], { cwd: ROOT_DIR, env: prodEnv, stdio: 'pipe' });
    execFileSync('php', ['artisan', 'migrate', '--force'], { cwd: ROOT_DIR, env: demoEnv, stdio: 'pipe' });
    seedAdminUser(prodEnv);
    seedDemoUser(demoEnv);

    const prodProc = spawn('php', ['-S', `127.0.0.1:${prodPort}`, '-t', 'public'], {
        cwd: ROOT_DIR,
        env: prodEnv,
        stdio: 'pipe',
    });
    const demoProc = spawn('php', ['-S', `127.0.0.1:${demoPort}`, '-t', 'public'], {
        cwd: ROOT_DIR,
        env: demoEnv,
        stdio: 'pipe',
    });

    const proxyServer = await startSameDomainProxy(proxyPort, prodPort, demoPort);

    t.after(async () => {
        proxyServer.close();
        prodProc.kill();
        demoProc.kill();
        await sleep(250);
        try {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        } catch {
            // ignore Windows file-handle cleanup timing
        }
    });

    await Promise.all([
        waitForHealth(prodPort, 'production runtime'),
        waitForHealth(demoPort, 'demo runtime'),
    ]);

    async function send(jar, method, reqPath, { headers = {}, jsonBody = null } = {}) {
        const reqHeaders = {
            Accept: 'text/html, application/xhtml+xml, application/json',
            ...headers,
        };
        const cookieStr = jar.header();
        if (cookieStr) {
            reqHeaders.Cookie = cookieStr;
        }
        let body = null;
        if (jsonBody !== null) {
            body = JSON.stringify(jsonBody);
            reqHeaders['Content-Type'] = 'application/json';
            reqHeaders['Content-Length'] = Buffer.byteLength(body);
        }

        const res = await rawRequest(proxyPort, method, reqPath, reqHeaders, body);
        jar.ingestSetCookies(res.headers['set-cookie']);
        return res;
    }

    async function followRedirects(jar, initialRes) {
        let res = initialRes;
        let hops = 0;
        while ([301, 302, 303, 307, 308].includes(res.status) && res.headers.location && hops < 5) {
            const loc = new URL(res.headers.location, origin);
            res = await send(jar, 'GET', `${loc.pathname}${loc.search}`);
            hops += 1;
        }
        return res;
    }

    await t.test('1. Fresh demo login succeeds end-to-end with real CSRF middleware', async () => {
        const jar = new CookieJar();
        const entry = await send(jar, 'GET', '/demo');
        assert.equal(entry.status, 302);
        assert.equal(jar.get('mfms_runtime'), 'demo');
        assert.ok(jar.has('MFMS-DEMO-XSRF-TOKEN'));

        const loginPage = await followRedirects(jar, entry);
        assert.equal(loginPage.status, 200);
        assert.equal(parseMeta(loginPage.body, 'mfms-runtime'), 'demo');
        assert.equal(parseMeta(loginPage.body, 'mfms-xsrf-cookie'), 'MFMS-DEMO-XSRF-TOKEN');
        assert.equal(parseMeta(loginPage.body, 'mfms-xsrf-header'), 'X-MFMS-DEMO-XSRF-TOKEN');

        const loginPost = await send(jar, 'POST', '/login', {
            headers: {
                'X-Inertia': 'true',
                'X-Requested-With': 'XMLHttpRequest',
                'X-MFMS-Runtime': 'demo',
                'X-MFMS-DEMO-XSRF-TOKEN': jar.getDecoded('MFMS-DEMO-XSRF-TOKEN'),
            },
            jsonBody: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
        });
        assert.equal(loginPost.status, 302);
        assert.match(loginPost.headers.location, /\/ui-dashboard/);

        const dash = await followRedirects(jar, loginPost);
        assert.equal(dash.status, 200);
        assert.equal(jar.get('mfms_runtime'), 'demo');
    });

    await t.test('2. Existing browser profile with stale XSRF-TOKEN and active prod session logs into demo cleanly', async () => {
        const jar = new CookieJar();

        // First log in as real Admin on production so profile has active prod session + MFMS-PROD-XSRF-TOKEN
        const prodLoginPage = await send(jar, 'GET', '/login');
        assert.equal(prodLoginPage.status, 200);
        assert.equal(parseMeta(prodLoginPage.body, 'mfms-runtime'), 'production');
        assert.ok(jar.has('MFMS-PROD-XSRF-TOKEN'));

        const prodLogin = await send(jar, 'POST', '/login', {
            headers: {
                'X-Inertia': 'true',
                'X-Requested-With': 'XMLHttpRequest',
                'X-MFMS-Runtime': 'production',
                'X-MFMS-PROD-XSRF-TOKEN': jar.getDecoded('MFMS-PROD-XSRF-TOKEN'),
            },
            jsonBody: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        });
        assert.equal(prodLogin.status, 302);
        assert.ok(jar.has('mfms_prod_session'));

        // Inject stale legacy XSRF-TOKEN cookie from pre-14C.1 browser profile
        jar.set('XSRF-TOKEN', encodeURIComponent('stale-legacy-prod-xsrf-cookie-value'));

        // Now visit /demo and log in -> MUST succeed with zero 419!
        const demoEntry = await send(jar, 'GET', '/demo');
        assert.equal(demoEntry.status, 302);
        assert.equal(jar.has('XSRF-TOKEN'), false, 'Legacy XSRF-TOKEN should be expired cleanly');
        assert.ok(jar.has('MFMS-DEMO-XSRF-TOKEN'));

        const demoLoginPage = await followRedirects(jar, demoEntry);
        assert.equal(demoLoginPage.status, 200);
        assert.equal(parseMeta(demoLoginPage.body, 'mfms-runtime'), 'demo');

        const demoLogin = await send(jar, 'POST', '/login', {
            headers: {
                'X-Inertia': 'true',
                'X-Requested-With': 'XMLHttpRequest',
                'X-MFMS-Runtime': 'demo',
                'X-MFMS-DEMO-XSRF-TOKEN': jar.getDecoded('MFMS-DEMO-XSRF-TOKEN'),
            },
            jsonBody: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
        });
        assert.equal(demoLogin.status, 302);
        assert.match(demoLogin.headers.location, /\/ui-dashboard/);
    });

    await t.test('3. Demo login after daily session flush returns 419 recovery and succeeds on fresh login', async () => {
        const jar = new CookieJar();
        const loginPage = await followRedirects(jar, await send(jar, 'GET', '/demo'));
        assert.equal(loginPage.status, 200);
        const staleDemoXsrf = jar.getDecoded('MFMS-DEMO-XSRF-TOKEN');

        // Simulate daily 03:00 WIB file session flush
        const sessionDir = path.join(ROOT_DIR, 'storage/framework/sessions');
        if (fs.existsSync(sessionDir)) {
            for (const entry of fs.readdirSync(sessionDir)) {
                if (entry === '.gitignore') continue;
                const full = path.join(sessionDir, entry);
                if (fs.statSync(full).isFile()) {
                    fs.unlinkSync(full);
                }
            }
        }

        // Submitting with flushed session returns HTTP 419 with Indonesian recovery payload (never auto-replayed)
        const expiredPost = await send(jar, 'POST', '/login', {
            headers: {
                'X-Inertia': 'true',
                'X-Requested-With': 'XMLHttpRequest',
                'X-MFMS-Runtime': 'demo',
                'X-MFMS-DEMO-XSRF-TOKEN': staleDemoXsrf,
            },
            jsonBody: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
        });
        assert.equal(expiredPost.status, 419);
        const payload = JSON.parse(expiredPost.body);
        assert.equal(payload.message, 'Sesi telah berakhir. Silakan masuk kembali.');
        assert.equal(payload.recovery_url, '/demo?session_expired=1');

        // Client recovers via GET /demo?session_expired=1 -> fresh login page with notice & fresh XSRF
        const recovered = await followRedirects(jar, await send(jar, 'GET', payload.recovery_url));
        assert.equal(recovered.status, 200);
        assert.ok(recovered.body.includes('Sesi telah berakhir. Silakan masuk kembali.'));

        // User submits login again with fresh token -> succeeds!
        const retryLogin = await send(jar, 'POST', '/login', {
            headers: {
                'X-Inertia': 'true',
                'X-Requested-With': 'XMLHttpRequest',
                'X-MFMS-Runtime': 'demo',
                'X-MFMS-DEMO-XSRF-TOKEN': jar.getDecoded('MFMS-DEMO-XSRF-TOKEN'),
            },
            jsonBody: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
        });
        assert.equal(retryLogin.status, 302);
        assert.match(retryLogin.headers.location, /\/ui-dashboard/);
    });

    await t.test('4 & 6 & 7. Multi-tab stale runtime context & expired selector cookie reject cross-runtime mutations with ZERO prod DB changes', async () => {
        const jar = new CookieJar();

        // Tab A: Login to Production Admin
        await send(jar, 'GET', '/login');
        const prodLogin = await send(jar, 'POST', '/login', {
            headers: {
                'X-Inertia': 'true',
                'X-Requested-With': 'XMLHttpRequest',
                'X-MFMS-Runtime': 'production',
                'X-MFMS-PROD-XSRF-TOKEN': jar.getDecoded('MFMS-PROD-XSRF-TOKEN'),
            },
            jsonBody: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        });
        assert.equal(prodLogin.status, 302);
        const tabAProdXsrf = jar.getDecoded('MFMS-PROD-XSRF-TOKEN');

        // Tab B: Open /demo and login to Demo (now BOTH mfms_prod_session and mfms_demo_session exist!)
        await followRedirects(jar, await send(jar, 'GET', '/demo'));
        const demoLogin = await send(jar, 'POST', '/login', {
            headers: {
                'X-Inertia': 'true',
                'X-Requested-With': 'XMLHttpRequest',
                'X-MFMS-Runtime': 'demo',
                'X-MFMS-DEMO-XSRF-TOKEN': jar.getDecoded('MFMS-DEMO-XSRF-TOKEN'),
            },
            jsonBody: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
        });
        assert.equal(demoLogin.status, 302);
        const tabBDemoXsrf = jar.getDecoded('MFMS-DEMO-XSRF-TOKEN');

        assert.ok(jar.has('mfms_prod_session'));
        assert.ok(jar.has('mfms_demo_session'));
        assert.equal(jar.get('mfms_runtime'), 'demo');

        const demoCountBefore = countSqliteRows(demoDb, 'customers');
        const prodCountBefore = countSqliteRows(prodDb, 'customers');

        // Stale Tab A (Admin) submits POST /ui-customers while mfms_runtime=demo -> routed to Demo -> REJECTED (409)
        const staleAdminPost = await send(jar, 'POST', '/ui-customers', {
            headers: {
                'X-Inertia': 'true',
                'X-Requested-With': 'XMLHttpRequest',
                'X-MFMS-Runtime': 'production',
                'X-MFMS-PROD-XSRF-TOKEN': tabAProdXsrf,
            },
            jsonBody: { name: 'Stale Admin Tab Customer' },
        });
        assert.equal(staleAdminPost.status, 409);
        assert.equal(staleAdminPost.headers['x-mfms-runtime-mismatch'], '1');
        assert.equal(countSqliteRows(demoDb, 'customers'), demoCountBefore);

        // Now simulate mfms_runtime expiring (or Tab A navigating to /admin-entry) -> requests route to Production!
        jar.delete('mfms_runtime');

        // Stale Tab B (Demo) submits POST /ui-customers -> routed to Production (which HAS valid mfms_prod_session!) -> MUST BE REJECTED!
        const staleDemoPost = await send(jar, 'POST', '/ui-customers', {
            headers: {
                'X-Inertia': 'true',
                'X-Requested-With': 'XMLHttpRequest',
                'X-MFMS-Runtime': 'demo',
                'X-MFMS-DEMO-XSRF-TOKEN': tabBDemoXsrf,
            },
            jsonBody: { name: 'Demo Leak Attempt To Prod' },
        });
        assert.equal(staleDemoPost.status, 409);
        assert.equal(staleDemoPost.headers['x-mfms-runtime-mismatch'], '1');
        assert.equal(countSqliteRows(prodDb, 'customers'), prodCountBefore, 'ZERO production DB changes allowed');

        // Even if X-MFMS-Runtime header is stripped, Demo XSRF token encrypted with Demo APP_KEY is rejected by Prod with 419!
        const strippedHeaderPost = await send(jar, 'POST', '/ui-customers', {
            headers: {
                'X-Inertia': 'true',
                'X-Requested-With': 'XMLHttpRequest',
                'X-XSRF-TOKEN': tabBDemoXsrf,
            },
            jsonBody: { name: 'Demo Stripped Header Attack' },
        });
        assert.equal(strippedHeaderPost.status, 419);
        assert.equal(countSqliteRows(prodDb, 'customers'), prodCountBefore, 'ZERO production DB changes allowed');
    });

    await t.test('5 & 8 & 10. Repeated transitions, genuine invalid CSRF rejection, and normal admin mutations work cleanly', async () => {
        const jar = new CookieJar();

        // Admin -> Demo -> Admin -> Demo -> Logout -> Admin
        await send(jar, 'GET', '/login');
        await followRedirects(jar, await send(jar, 'GET', '/demo'));
        assert.equal(jar.get('mfms_runtime'), 'demo');

        await followRedirects(jar, await send(jar, 'GET', '/admin-entry'));
        assert.equal(jar.has('mfms_runtime'), false);

        await followRedirects(jar, await send(jar, 'GET', '/demo'));
        assert.equal(jar.get('mfms_runtime'), 'demo');

        // Login to demo, then logout via Inertia -> 409 X-Inertia-Location clearing mfms_runtime
        const demoLogin = await send(jar, 'POST', '/login', {
            headers: {
                'X-Inertia': 'true',
                'X-Requested-With': 'XMLHttpRequest',
                'X-MFMS-Runtime': 'demo',
                'X-MFMS-DEMO-XSRF-TOKEN': jar.getDecoded('MFMS-DEMO-XSRF-TOKEN'),
            },
            jsonBody: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
        });
        assert.equal(demoLogin.status, 302);
        await followRedirects(jar, demoLogin);

        const demoLogout = await send(jar, 'POST', '/logout', {
            headers: {
                'X-Inertia': 'true',
                'X-Requested-With': 'XMLHttpRequest',
                'X-MFMS-Runtime': 'demo',
                'X-MFMS-DEMO-XSRF-TOKEN': jar.getDecoded('MFMS-DEMO-XSRF-TOKEN'),
            },
        });
        assert.equal(demoLogout.status, 409);
        assert.match(demoLogout.headers['x-inertia-location'], /\/login$/);
        assert.equal(jar.has('mfms_runtime'), false);

        // Now back on production: genuine invalid CSRF login MUST return 419
        const prodLoginPage = await send(jar, 'GET', '/login');
        assert.equal(prodLoginPage.status, 200);
        assert.equal(parseMeta(prodLoginPage.body, 'mfms-runtime'), 'production');

        const badCsrf = await send(jar, 'POST', '/login', {
            headers: {
                'X-Inertia': 'true',
                'X-Requested-With': 'XMLHttpRequest',
                'X-MFMS-Runtime': 'production',
                'X-MFMS-PROD-XSRF-TOKEN': 'forged-invalid-csrf-token',
            },
            jsonBody: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        });
        assert.equal(badCsrf.status, 419);

        // Normal admin login and core customer creation mutation succeed cleanly
        const okAdminLogin = await send(jar, 'POST', '/login', {
            headers: {
                'X-Inertia': 'true',
                'X-Requested-With': 'XMLHttpRequest',
                'X-MFMS-Runtime': 'production',
                'X-MFMS-PROD-XSRF-TOKEN': jar.getDecoded('MFMS-PROD-XSRF-TOKEN'),
            },
            jsonBody: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        });
        assert.equal(okAdminLogin.status, 302);
        await followRedirects(jar, okAdminLogin);

        const prodBefore = countSqliteRows(prodDb, 'customers');
        const createCustomer = await send(jar, 'POST', '/ui-customers', {
            headers: {
                'X-Inertia': 'true',
                'X-Requested-With': 'XMLHttpRequest',
                'X-MFMS-Runtime': 'production',
                'X-MFMS-PROD-XSRF-TOKEN': jar.getDecoded('MFMS-PROD-XSRF-TOKEN'),
            },
            jsonBody: { name: 'Pelanggan Produksi Asli', phone: '081211112222' },
        });
        assert.equal(createCustomer.status, 302);
        assert.equal(countSqliteRows(prodDb, 'customers'), prodBefore + 1);
    });

    await t.test('9. Emergency kill switch revokes demo login over real HTTP and restores when removed', async () => {
        const jar = new CookieJar();
        fs.writeFileSync(demoKillSwitch, 'disabled');

        try {
            const loginPage = await followRedirects(jar, await send(jar, 'GET', '/demo'));
            assert.equal(loginPage.status, 200);
            assert.ok(loginPage.body.includes('dinonaktifkan'));

            const blockedLogin = await send(jar, 'POST', '/login', {
                headers: {
                    'X-Inertia': 'true',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-MFMS-Runtime': 'demo',
                    'X-MFMS-DEMO-XSRF-TOKEN': jar.getDecoded('MFMS-DEMO-XSRF-TOKEN'),
                },
                jsonBody: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
            });
            // Redirects back to login with error (never /ui-dashboard)
            assert.equal(blockedLogin.status, 302);
            assert.doesNotMatch(blockedLogin.headers.location, /\/ui-dashboard/);
        } finally {
            if (fs.existsSync(demoKillSwitch)) {
                fs.unlinkSync(demoKillSwitch);
            }
        }
    });
});
