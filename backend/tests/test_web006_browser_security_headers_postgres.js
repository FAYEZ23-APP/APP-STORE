// ============================================================================
// WEB-006: BROWSER SECURITY HEADERS & CONTENT SECURITY POLICY TEST SUITE
// Tests on live ASP.NET Core backend with PostgreSQL (TEST_DB)
// ============================================================================
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getFreePort, getValidatedTestDb, stopServer, waitForHealth } = require('./helpers/test_harness');

let failed = 0;
let passed = 0;

function check(ok, desc, detail) {
  if (ok) {
    passed++;
    console.log(`  ✔ [PASS] ${desc}`);
  } else {
    failed++;
    console.log(`  ✖ [FAIL] ${desc}${detail ? ' -> ' + detail : ''}`);
  }
}

async function request(url, options = {}) {
  const { headers, ...rest } = options;
  const res = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
  });

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

(async () => {
  console.log('================================================================');
  console.log(' WEB-006: Browser Security Headers & Content Security Policy');
  console.log('================================================================');

  const { connStr, dbName } = getValidatedTestDb();
  const port = await getFreePort();
  const BASE = `http://127.0.0.1:${port}`;
  console.log(`Allocated ephemeral test port: ${port} | DB: ${dbName}`);

  const runId = Math.floor(100000 + Math.random() * 900000).toString();
  const apiCsproj = path.resolve(__dirname, '../Marketplace.API/Marketplace.API.csproj');
  const logPath = path.resolve(__dirname, `../../test_web006_server_${runId}.log`);
  const logFd = fs.openSync(logPath, 'w');

  const serverProcess = spawn('dotnet', [
    'run',
    '--no-build',
    '--project', apiCsproj,
    '--urls', BASE,
  ], {
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Development',
      ConnectionStrings__DefaultConnection: connStr,
      Jwt__Key: 'IntegrationTestSecretKey_AtLeast32CharsLong_WEB006Test!',
      Jwt__Issuer: 'MarketplaceAPI',
      Jwt__Audience: 'MarketplaceClient',
      Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
      Auth__RequireVerification: 'false',
      Features__EnableWallet: 'false',
      Features__EnableVendorPayouts: 'false',
      SecurityHeaders__EnableCsp: 'true',
      SecurityHeaders__CspReportOnly: 'false',
      SecurityHeaders__ReportUri: '/api/security/csp-reports',
      SecurityHeaders__EnableHsts: 'true',
      SecurityHeaders__HstsMaxAgeSeconds: '31536000',
      SecurityHeaders__HstsIncludeSubDomains: 'true',
      SecurityHeaders__HstsPreload: 'false',
    },
  });

  const cleanup = (hadError = false) => {
    if (hadError && fs.existsSync(logPath)) {
      console.log('\n--- SERVER LOG OUTPUT ---');
      try {
        console.log(fs.readFileSync(logPath, 'utf8'));
      } catch {}
    }
    stopServer(serverProcess, logFd, logPath);
  };
  process.on('SIGINT', () => { cleanup(true); process.exit(1); });

  try {
    console.log('\n--- Preflight Healthcheck ---');
    await waitForHealth(BASE, 60000);
    check(true, 'Backend API responded 200 OK on health endpoint');

    // ─────────────────────────────────────────────────────────────
    // TEST 1: CSP Header Presence & Directive Structure
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 1: Content-Security-Policy Presence & Directives ---');
    const healthRes = await request(`${BASE}/api/health`);
    const csp = healthRes.headers.get('content-security-policy');
    check(Boolean(csp), 'Content-Security-Policy HTTP header is present on API responses');
    check(csp.includes("default-src 'self'"), 'CSP defines default-src \'self\'');
    check(csp.includes("object-src 'none'"), 'CSP strictly restricts object-src to \'none\'');
    check(csp.includes("base-uri 'self'"), 'CSP restricts base-uri to \'self\'');
    check(csp.includes("form-action 'self'"), 'CSP restricts form-action to \'self\'');
    check(!csp.includes("'unsafe-eval'"), 'CSP strictly omits \'unsafe-eval\'');

    // ─────────────────────────────────────────────────────────────
    // TEST 2: Google Maps & External Integrations Compatibility
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 2: Integrations Compatibility (Google Maps, Fonts, Images) ---');
    check(
      csp.includes("https://maps.googleapis.com") && csp.includes("https://maps.gstatic.com"),
      'CSP permits Google Maps JS API and tiles (maps.googleapis.com, maps.gstatic.com) in script-src'
    );
    check(
      csp.includes("https://fonts.googleapis.com") && csp.includes("https://fonts.gstatic.com"),
      'CSP permits Google Fonts (fonts.googleapis.com stylesheets & fonts.gstatic.com font files)'
    );
    check(
      csp.includes("img-src 'self' data: blob: https:"),
      'CSP permits product uploads, data: URIs, blob: previews, and HTTPS external images'
    );
    check(
      csp.includes("connect-src 'self' https://maps.googleapis.com https://maps.gstatic.com"),
      'CSP permits API calls to backend and Google Maps geocoding endpoints'
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 3: Clickjacking Defense & Frame Ancestors Alignment
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 3: Clickjacking Protection & Frame Ancestors ---');
    const xFrame = healthRes.headers.get('x-frame-options');
    check(xFrame === 'DENY', 'X-Frame-Options is strictly set to DENY', `got: ${xFrame}`);
    check(csp.includes("frame-ancestors 'none'"), 'CSP frame-ancestors is strictly aligned to \'none\'');

    // ─────────────────────────────────────────────────────────────
    // TEST 4: MIME Sniffing, Referrer Policy & Permissions Policy
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 4: Additional Browser Security Headers ---');
    const xContentType = healthRes.headers.get('x-content-type-options');
    check(xContentType === 'nosniff', 'X-Content-Type-Options is strictly set to nosniff', `got: ${xContentType}`);

    const referrerPolicy = healthRes.headers.get('referrer-policy');
    check(
      referrerPolicy === 'strict-origin-when-cross-origin',
      'Referrer-Policy is set to strict-origin-when-cross-origin',
      `got: ${referrerPolicy}`
    );

    const permissionsPolicy = healthRes.headers.get('permissions-policy');
    check(
      Boolean(permissionsPolicy) &&
      permissionsPolicy.includes('camera=()') &&
      permissionsPolicy.includes('microphone=()') &&
      permissionsPolicy.includes('payment=()') &&
      permissionsPolicy.includes('geolocation=(self)'),
      'Permissions-Policy disables camera, microphone, payment while preserving geolocation for mapping'
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 5: HSTS Conditional Enforcement
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 5: HTTP Strict Transport Security (HSTS) Verification ---');
    // On local HTTP without HTTPS proxy headers, HSTS MUST BE ABSENT
    const httpHsts = healthRes.headers.get('strict-transport-security');
    check(httpHsts === null, 'HSTS is strictly ABSENT on local HTTP requests without HTTPS proxy headers');

    // With X-Forwarded-Proto: https, HSTS MUST BE PRESENT
    const httpsRes = await request(`${BASE}/api/health`, {
      headers: { 'X-Forwarded-Proto': 'https' },
    });
    const httpsHsts = httpsRes.headers.get('strict-transport-security');
    check(Boolean(httpsHsts), 'HSTS is PRESENT when request is forwarded over HTTPS (X-Forwarded-Proto: https)');
    check(httpsHsts.includes('max-age=31536000'), 'HSTS max-age is at least 1 year (31,536,000s)');
    check(httpsHsts.includes('includeSubDomains'), 'HSTS includes includeSubDomains directive');
    check(!httpsHsts.includes('preload'), 'HSTS does NOT prematurely include preload without domain audit');

    // ─────────────────────────────────────────────────────────────
    // TEST 6: CSP Violation Reporting Endpoint
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 6: CSP Violation Reporting Endpoint ---');
    const sampleViolationReport = {
      'csp-report': {
        'document-uri': 'http://localhost:5173/admin',
        'referrer': '',
        'violated-directive': 'script-src',
        'effective-directive': 'script-src',
        'original-policy': csp,
        'disposition': 'report',
        'blocked-uri': 'http://malicious-cdn.example/evil.js',
        'line-number': 12,
        'column-number': 34,
        'source-file': 'http://localhost:5173/src/main.jsx',
        'status-code': 200,
        'script-sample': '',
      },
    };

    const reportRes = await request(`${BASE}/api/security/csp-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/csp-report' },
      body: JSON.stringify(sampleViolationReport),
    });
    check(reportRes.status === 204, 'POST /api/security/csp-reports accepts violation report with HTTP 204 NoContent');

    // ─────────────────────────────────────────────────────────────
    // TEST 7: Uniform Coverage (Homepage, Auth, Config, Fallback)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 7: Uniform Header Coverage Across Application Endpoints ---');
    const endpointsToTest = [
      { path: '/api/config', desc: 'Config API endpoint' },
      { path: '/api/categories', desc: 'Categories catalog endpoint' },
      { path: '/health', desc: 'Root health endpoint' },
    ];

    for (const ep of endpointsToTest) {
      const res = await request(`${BASE}${ep.path}`);
      const epCsp = res.headers.get('content-security-policy');
      const epXfo = res.headers.get('x-frame-options');
      const epXcto = res.headers.get('x-content-type-options');
      check(
        Boolean(epCsp) && epXfo === 'DENY' && epXcto === 'nosniff',
        `Security headers uniformly applied to ${ep.desc} (${ep.path})`
      );
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 8: Zero Duplicate Headers Check
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 8: Duplicate Header Prevention ---');
    const rawHeaders = healthRes.headers.raw ? healthRes.headers.raw() : null;
    if (rawHeaders) {
      const cspCount = (rawHeaders['content-security-policy'] || []).length;
      check(cspCount <= 1, `Exactly 1 CSP header emitted (found: ${cspCount})`);
    } else {
      // Fetch API standard
      const cspVal = healthRes.headers.get('content-security-policy');
      const commaSeparatedPolicies = cspVal.split('default-src').length - 1;
      check(commaSeparatedPolicies === 1, 'No duplicate or concatenated CSP policies detected on response');
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 9: Nginx Reverse Proxy Template Hardening
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 9: Nginx Deployment Template Verification ---');
    const nginxPath = path.resolve(__dirname, '../../admin-web/nginx.conf.template');
    const nginxContent = fs.readFileSync(nginxPath, 'utf8');

    check(nginxContent.includes('X-Frame-Options "DENY"'), 'nginx.conf.template defines X-Frame-Options DENY');
    check(nginxContent.includes('X-Content-Type-Options "nosniff"'), 'nginx.conf.template defines X-Content-Type-Options nosniff');
    check(nginxContent.includes('Referrer-Policy "strict-origin-when-cross-origin"'), 'nginx.conf.template defines Referrer-Policy');
    check(nginxContent.includes('Permissions-Policy'), 'nginx.conf.template defines Permissions-Policy');
    check(nginxContent.includes('frame-ancestors \'none\''), 'nginx.conf.template enforces frame-ancestors \'none\' in CSP');
    check(nginxContent.includes('object-src \'none\''), 'nginx.conf.template enforces object-src \'none\' in CSP');
    check(nginxContent.includes('proxy_hide_header X-Frame-Options'), 'nginx.conf.template strips upstream headers to prevent duplicates');
    check(nginxContent.includes('proxy_hide_header Content-Security-Policy'), 'nginx.conf.template strips upstream CSP to prevent duplicate policies');

    // ─────────────────────────────────────────────────────────────
    // TEST 10: HTML Meta Tag Alignment
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 10: index.html Meta Tag Security Alignment ---');
    const indexPath = path.resolve(__dirname, '../../admin-web/index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');

    check(indexContent.includes('http-equiv="Content-Security-Policy"'), 'index.html defines Content-Security-Policy meta tag');
    check(indexContent.includes('object-src \'none\''), 'index.html meta tag specifies object-src \'none\'');
    check(indexContent.includes('base-uri \'self\''), 'index.html meta tag specifies base-uri \'self\'');
    check(!indexContent.includes('frame-ancestors'), 'index.html meta tag omits frame-ancestors (unsupported in HTML meta)');

    // ─────────────────────────────────────────────────────────────
    // TEST 11: CSP Report-Only Mode Transition Verification
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 11: CSP Report-Only Mode Transition Verification ---');
    const port2 = await getFreePort();
    const BASE2 = `http://127.0.0.1:${port2}`;
    const logPath2 = path.resolve(__dirname, `../../test_web006_ro_server_${runId}.log`);
    const logFd2 = fs.openSync(logPath2, 'w');

    const roServer = spawn('dotnet', [
      'run',
      '--no-build',
      '--project', apiCsproj,
      '--urls', BASE2,
    ], {
      stdio: ['ignore', logFd2, logFd2],
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
        ConnectionStrings__DefaultConnection: connStr,
        Jwt__Key: 'IntegrationTestSecretKey_AtLeast32CharsLong_WEB006Test!',
        Jwt__Issuer: 'MarketplaceAPI',
        Jwt__Audience: 'MarketplaceClient',
        Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
        Auth__RequireVerification: 'false',
        SecurityHeaders__EnableCsp: 'true',
        SecurityHeaders__CspReportOnly: 'true',
      },
    });

    try {
      await waitForHealth(BASE2, 60000);
      const roRes = await request(`${BASE2}/api/health`);
      const roCsp = roRes.headers.get('content-security-policy-report-only');
      const enforcingCsp = roRes.headers.get('content-security-policy');
      check(Boolean(roCsp), 'When CspReportOnly is true, Content-Security-Policy-Report-Only header is emitted');
      check(enforcingCsp === null, 'When CspReportOnly is true, enforcing Content-Security-Policy is absent');
    } finally {
      stopServer(roServer, logFd2, logPath2);
    }

    console.log('\n================================================================');
    console.log(` SUMMARY: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log('================================================================');

    cleanup(failed > 0);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test run failed with unhandled exception:', err);
    cleanup(true);
    process.exit(1);
  }
})();
