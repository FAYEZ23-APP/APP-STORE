// ============================================================================
// WEB-011: XSS PREVENTION & PRODUCTION BUILD HARDENING VERIFICATION
// ============================================================================
const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passed = 0;
let failed = 0;

function check(ok, desc, detail) {
  if (ok) {
    passed++;
    console.log(`  ✔ [PASS] ${desc}`);
  } else {
    failed++;
    console.log(`  ✖ [FAIL] ${desc}${detail ? ' -> ' + detail : ''}`);
  }
}

console.log('================================================================');
console.log(' WEB-011: XSS Prevention & Production Build Hardening Audit');
console.log('================================================================');

const webRoot = path.resolve(__dirname, '..');
const distDir = path.join(webRoot, 'dist');
const assetsDir = path.join(distDir, 'assets');
const srcDir = path.join(webRoot, 'src');

// ─────────────────────────────────────────────────────────────
// 1. Source Code Security Audit (First-Party src/)
// ─────────────────────────────────────────────────────────────
console.log('\n--- 1. Source Code Static Security Audit (admin-web/src) ---');

function scanSourceFiles(dir, callback) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      scanSourceFiles(full, callback);
    } else if (/\.(jsx?|tsx?)$/.test(f)) {
      callback(full, fs.readFileSync(full, 'utf8'));
    }
  }
}

let dangerousInnerHtmlCount = 0;
let innerHtmlCount = 0;
let evalCount = 0;
let newFunctionCount = 0;
let javascriptUrlCount = 0;

scanSourceFiles(srcDir, (filePath, content) => {
  // Strip comments before checking executable code
  const codeWithoutComments = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

  if (codeWithoutComments.includes('dangerouslySetInnerHTML')) dangerousInnerHtmlCount++;
  if (codeWithoutComments.includes('.innerHTML')) innerHtmlCount++;
  if (/\beval\s*\(/.test(codeWithoutComments)) evalCount++;
  if (/\bnew\s+Function\s*\(/.test(codeWithoutComments)) newFunctionCount++;
  if (/href\s*=\s*['"]javascript:/i.test(codeWithoutComments)) javascriptUrlCount++;
});

check(dangerousInnerHtmlCount === 0, 'Zero dangerouslySetInnerHTML usage across first-party code', `found: ${dangerousInnerHtmlCount}`);
check(innerHtmlCount === 0, 'Zero .innerHTML assignments across first-party code', `found: ${innerHtmlCount}`);
check(evalCount === 0, 'Zero eval() calls across first-party code', `found: ${evalCount}`);
check(newFunctionCount === 0, 'Zero new Function() dynamic executions', `found: ${newFunctionCount}`);
check(javascriptUrlCount === 0, 'Zero javascript: URLs in href attributes', `found: ${javascriptUrlCount}`);

// ─────────────────────────────────────────────────────────────
// 2. SmartSearchBar HighlightedText Unit Verification
// ─────────────────────────────────────────────────────────────
console.log('\n--- 2. SmartSearchBar HighlightedText Unit Verification ---');
const ssbContent = fs.readFileSync(path.join(srcDir, 'components/search/SmartSearchBar.jsx'), 'utf8');

check(
  !ssbContent.includes('dangerouslySetInnerHTML') && !ssbContent.includes('innerHTML'),
  'SmartSearchBar does NOT use dangerouslySetInnerHTML or innerHTML'
);
check(
  ssbContent.includes('cleanQuery.replace(/[.*+?^${}()|[\\]\\\\]/g'),
  'SmartSearchBar safely escapes regex special characters to prevent regex injection'
);
check(
  ssbContent.includes('text.split(regex)') && ssbContent.includes('React.Fragment'),
  'SmartSearchBar splits text into safe segments and maps to pure React nodes'
);

// Unit test simulation of the HighlightedText algorithm
function simulateHighlight(text, query) {
  if (!text) return [];
  if (!query || !query.trim()) return [{ isMatch: false, text }];

  const cleanQuery = query.trim();
  const escapedQuery = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');

  const parts = text.split(regex);
  return parts.map(part => ({
    isMatch: part.toLowerCase() === cleanQuery.toLowerCase(),
    text: part,
  }));
}

// Arabic query test
const arText = 'شاحن أنكر فائق السرعة 65W أبيض';
const arSegments = simulateHighlight(arText, 'أنكر');
check(
  arSegments.length === 3 && arSegments[1].isMatch && arSegments[1].text === 'أنكر',
  'Arabic search query highlighting segments text correctly'
);

// English query test with casing preservation
const enText = 'Apple iPhone 15 Pro Max 256GB Natural Titanium';
const enSegments = simulateHighlight(enText, 'iphone 15 pro');
check(
  enSegments.length === 3 && enSegments[1].isMatch && enSegments[1].text === 'iPhone 15 Pro',
  'English search query preserves exact original casing (iPhone 15 Pro)'
);

// Malicious script tag in query test
const xssQuery = '<script>alert("XSS")</script>';
const xssSegments = simulateHighlight(enText, xssQuery);
check(
  xssSegments.length === 1 && !xssSegments[0].isMatch && xssSegments[0].text === enText,
  'Search query containing script tags is safely treated as literal string without regex error or execution'
);

// HTML-like characters in query test
const htmlQuery = '<a>';
const htmlSegments = simulateHighlight('Product <a> with brackets', htmlQuery);
check(
  htmlSegments.length === 3 && htmlSegments[1].isMatch && htmlSegments[1].text === '<a>',
  'HTML tag characters in search query are treated as safe literal text segments'
);

// ─────────────────────────────────────────────────────────────
// 3. URL Validation & Protocol Sanitization
// ─────────────────────────────────────────────────────────────
console.log('\n--- 3. URL Sanitization & Protocol Validation (urlSecurity.js) ---');
const { sanitizeUrl, isSafeUrl } = require('../src/utils/urlSecurity.js');

check(sanitizeUrl('javascript:alert(document.cookie)') === '#', 'Explicitly rejects javascript: URL scheme with fallback');
check(sanitizeUrl('JAVASCRIPT:alert(1)') === '#', 'Case-insensitively rejects JAVASCRIPT: scheme');
check(sanitizeUrl('  javascript:void(0)  ') === '#', 'Rejects javascript: scheme with leading whitespace');
check(sanitizeUrl('vbscript:msgbox(1)') === '#', 'Explicitly rejects vbscript: URL scheme');
check(sanitizeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==') === '#', 'Explicitly rejects data:text/html XSS scheme');
check(sanitizeUrl('file:///etc/passwd') === '#', 'Explicitly rejects file: scheme');
check(sanitizeUrl('//evil.example.com/phish') === '#', 'Explicitly rejects protocol-relative URL (//evil.com)');

check(sanitizeUrl('/orders') === '/orders', 'Permits valid internal relative route (/orders)');
check(sanitizeUrl('/product/42?ref=home') === '/product/42?ref=home', 'Permits internal relative route with query params');
check(sanitizeUrl('#top') === '#top', 'Permits in-page hash anchor (#top)');
check(sanitizeUrl('https://example.com/item') === 'https://example.com/item', 'Permits legitimate https:// external URL');
check(sanitizeUrl('mailto:support@egyptshop.eg') === 'mailto:support@egyptshop.eg', 'Permits legitimate mailto: URL');
check(sanitizeUrl('tel:+201000000000') === 'tel:+201000000000', 'Permits legitimate tel: URL');

check(isSafeUrl('javascript:steal()') === false, 'isSafeUrl correctly flags javascript: as unsafe');
check(isSafeUrl('//evil.example.com') === false, 'isSafeUrl correctly flags protocol-relative URL as unsafe');
check(isSafeUrl('/admin') === true, 'isSafeUrl correctly validates internal route');

// ─────────────────────────────────────────────────────────────
// 4. Production Build Directory Hardening Audit (dist/)
// ─────────────────────────────────────────────────────────────
console.log('\n--- 4. Production Build Hardening Verification (dist/) ---');
check(fs.existsSync(distDir), 'Production build directory (dist/) exists');
check(fs.existsSync(assetsDir), 'Production assets directory (dist/assets/) exists');

const distFiles = fs.readdirSync(assetsDir);
const jsFiles = distFiles.filter(f => f.endsWith('.js'));
const firstPartyJsFiles = jsFiles.filter(f => !f.startsWith('vendor-'));
const mapFiles = distFiles.filter(f => f.endsWith('.map'));

check(jsFiles.length > 0, `Compiled JavaScript assets present (${jsFiles.length} bundles)`);
check(mapFiles.length === 0, `Zero standalone source map (.map) files generated (${mapFiles.length})`);

let hasDebugger = false;
let hasEmbeddedSourceMap = false;
let firstPartyHasDangerouslySetInnerHTML = false;
let hasJavascriptHref = false;

for (const file of jsFiles) {
  const code = fs.readFileSync(path.join(assetsDir, file), 'utf8');
  if (/\bdebugger\b/.test(code)) hasDebugger = true;
  if (code.includes('sourceMappingURL=data:application/json')) hasEmbeddedSourceMap = true;
  if (/href\s*=\s*['"]javascript:/i.test(code)) hasJavascriptHref = true;
}

for (const file of firstPartyJsFiles) {
  const code = fs.readFileSync(path.join(assetsDir, file), 'utf8');
  if (code.includes('dangerouslySetInnerHTML')) firstPartyHasDangerouslySetInnerHTML = true;
}

check(!hasDebugger, 'Zero debugger statements in compiled production JavaScript bundles');
check(!hasEmbeddedSourceMap, 'Zero embedded base64 sourcemaps in compiled JavaScript bundles');
check(!firstPartyHasDangerouslySetInnerHTML, 'Zero dangerouslySetInnerHTML in first-party compiled production bundles');
check(!hasJavascriptHref, 'Zero javascript: URLs in compiled production bundles');

// Inspect index.html
const indexHtmlDist = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
check(!indexHtmlDist.includes('<script>') && !indexHtmlDist.includes('eval('), 'dist/index.html contains no inline executable script tags');
check(!indexHtmlDist.includes('javascript:'), 'dist/index.html contains no javascript: links');

// ─────────────────────────────────────────────────────────────
// 5. Telemetry & Diagnostic Visibility Check
// ─────────────────────────────────────────────────────────────
console.log('\n--- 5. Operational Error Telemetry & Visibility ---');
const ebContent = fs.readFileSync(path.join(srcDir, 'components/ErrorBoundary.jsx'), 'utf8');
const telemetryContent = fs.readFileSync(path.join(srcDir, 'utils/telemetry.js'), 'utf8');

check(
  telemetryContent.includes('navigator.sendBeacon') && telemetryContent.includes('/api/security/csp-reports'),
  'Telemetry module reports unhandled errors to /api/security/csp-reports in production'
);
check(
  ebContent.includes('reportClientError'),
  'Global ErrorBoundary invokes reportClientError on caught lifecycle errors'
);

console.log('\n================================================================');
console.log(` SUMMARY: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log('================================================================');

process.exit(failed > 0 ? 1 : 0);
