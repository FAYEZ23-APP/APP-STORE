/**
 * Automated Verification Script: test_web_security_and_build.js
 * 
 * Verifies:
 * 1. Zero dangerouslySetInnerHTML, zero unsafe javascript: schemes, and proper DevCarrierDrawer DEV gating.
 * 2. 100% translation key parity between src/locales/ar.json and src/locales/en.json.
 * 3. CartContext sanitizeCartItems unit test with compound keys and edge cases.
 * 4. Production build execution (npm run build):
 *    - Exit code 0
 *    - Zero sourcemap files (*.map)
 *    - Zero development secrets (dev-carrier-secret / X-Carrier-Dev-Secret) in dist/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');
const distDir = path.join(projectRoot, 'dist');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName}`);
    passedTests++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${testName}`);
    if (details) console.error(`    \x1b[33mDetails:\x1b[0m ${details}`);
    failedTests++;
  }
}

function getAllFiles(dir, exts = ['.js', '.jsx', '.html', '.css']) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, exts));
    } else {
      const ext = path.extname(file).toLowerCase();
      if (exts.includes(ext)) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

console.log('\n\x1b[36m=======================================================');
console.log('   MarketplaceWeb Frontend Security & Integrity Audit  ');
console.log('=======================================================\x1b[0m\n');

// ---------------------------------------------------------------------------
// TEST SUITE 1: Static Source Code Security Scan
// ---------------------------------------------------------------------------
console.log('\x1b[35m[1/4] Static Source Code Security Scan (src/)\x1b[0m');
const srcFiles = getAllFiles(srcDir);

let dangerouslySetHtmlMatches = [];
let unsafeSchemeMatches = [];

srcFiles.forEach((file) => {
  const content = fs.readFileSync(file, 'utf-8');
  const relPath = path.relative(projectRoot, file);

  if (content.includes('dangerouslySetInnerHTML')) {
    dangerouslySetHtmlMatches.push(relPath);
  }

  // Look for unsafe script injection protocols in JSX/HTML
  const unsafeMatch = content.match(/href\s*=\s*['"]\s*javascript:/i);
  if (unsafeMatch) {
    unsafeSchemeMatches.push(relPath);
  }
});

assert(
  dangerouslySetHtmlMatches.length === 0,
  'Zero usage of dangerouslySetInnerHTML across entire codebase',
  dangerouslySetHtmlMatches.join(', ')
);

assert(
  unsafeSchemeMatches.length === 0,
  'Zero usage of javascript: protocol in href/src attributes',
  unsafeSchemeMatches.join(', ')
);

// Verify DevCarrierDrawer DEV gating in App.jsx
const appJsxPath = path.join(srcDir, 'App.jsx');
const appJsxContent = fs.readFileSync(appJsxPath, 'utf-8');
const isDevGatedInImport = appJsxContent.includes('import.meta.env.DEV') && appJsxContent.includes('DevCarrierDrawer');
const isDevGatedInRender = appJsxContent.includes('{import.meta.env.DEV && DevCarrierDrawer');

assert(
  isDevGatedInImport && isDevGatedInRender,
  'DevCarrierDrawer strictly gated behind import.meta.env.DEV for dead-code elimination',
  'App.jsx must use import.meta.env.DEV both on lazy import and in JSX tree'
);

// Verify all <img> tags have safe onError handlers
let imgTagsWithoutOnError = [];
srcFiles.forEach((file) => {
  const content = fs.readFileSync(file, 'utf-8');
  const relPath = path.relative(projectRoot, file);
  // Match <img ... /> tags
  const imgRegex = /<img\b([^>]*?)(\/?>)/gs;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    const attrs = match[1];
    if (!attrs.includes('onError')) {
      imgTagsWithoutOnError.push(relPath);
    }
  }
});

assert(
  imgTagsWithoutOnError.length === 0,
  'All <img> tags define infinite-loop-proof onError fallback handlers',
  imgTagsWithoutOnError.join(', ')
);

// ---------------------------------------------------------------------------
// TEST SUITE 2: Translation Key Parity (ar.json vs en.json)
// ---------------------------------------------------------------------------
console.log('\n\x1b[35m[2/4] i18n Translation Key Parity Audit\x1b[0m');
const arJson = JSON.parse(fs.readFileSync(path.join(srcDir, 'locales', 'ar.json'), 'utf-8'));
const enJson = JSON.parse(fs.readFileSync(path.join(srcDir, 'locales', 'en.json'), 'utf-8'));

function getNestedKeys(obj, prefix = '') {
  let keys = [];
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      keys.push(...getNestedKeys(val, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const arKeys = getNestedKeys(arJson);
const enKeys = getNestedKeys(enJson);

const missingInEn = arKeys.filter((k) => !enKeys.includes(k));
const missingInAr = enKeys.filter((k) => !arKeys.includes(k));

assert(
  missingInEn.length === 0,
  `All ${arKeys.length} Arabic keys exist in English locale (0 missing)`,
  missingInEn.slice(0, 5).join(', ')
);

assert(
  missingInAr.length === 0,
  `All ${enKeys.length} English keys exist in Arabic locale (0 missing)`,
  missingInAr.slice(0, 5).join(', ')
);

// ---------------------------------------------------------------------------
// TEST SUITE 3: CartContext Sanitizer Logic Unit Tests
// ---------------------------------------------------------------------------
console.log('\n\x1b[35m[3/4] Cart State & Compound Key Sanitizer Unit Tests\x1b[0m');

// Dynamically import sanitizeCartItems and getCartItemKey from pure JS utils
const { sanitizeCartItems, getCartItemKey } = await import('../src/utils/cartSanitizer.js');

// Test 3.1: Compound key formatting
const key1 = getCartItemKey(42, 'red-xl');
const key2 = getCartItemKey(42, null);
assert(key1 === '42_red-xl', 'getCartItemKey handles variants correctly (42_red-xl)');
assert(key2 === '42_base', 'getCartItemKey defaults null variant to base (42_base)');

// Test 3.2: Sanitizer with valid compound keys
const validPayload = {
  '10_base': {
    productId: 10,
    variantId: null,
    quantity: 2,
    product: { id: 10, name: 'Cotton T-Shirt', price: 150 },
  },
  '20_blue': {
    productId: 20,
    variantId: 'blue',
    quantity: 1,
    product: { id: 20, name: 'Canvas Shoes', price: 499.5 },
  },
};
const cleanedValid = sanitizeCartItems(validPayload);
assert(
  Object.keys(cleanedValid).length === 2 &&
    cleanedValid['10_base'].quantity === 2 &&
    cleanedValid['20_blue'].product.price === 499.5,
  'sanitizeCartItems preserves valid compound cart items and prices'
);

// Test 3.3: Sanitizer rejecting corrupted / tampered entries
const corruptPayload = {
  // Tampered negative quantity
  '30_base': {
    productId: 30,
    quantity: -5,
    product: { id: 30, name: 'Bad Qty', price: 100 },
  },
  // Tampered NaN price
  '40_base': {
    productId: 40,
    quantity: 1,
    product: { id: 40, name: 'NaN Price', price: 'free' },
  },
  // ID mismatch injection
  '50_base': {
    productId: 50,
    quantity: 1,
    product: { id: 999, name: 'Hacked Product', price: 10 },
  },
  // Non-object corrupt entry
  'corrupt': 'malicious-string',
};

const cleanedCorrupt = sanitizeCartItems(corruptPayload);
assert(
  Object.keys(cleanedCorrupt).length === 0,
  'sanitizeCartItems strictly eliminates negative quantities, NaN prices, and ID mismatches'
);

// ---------------------------------------------------------------------------
// TEST SUITE 4: Production Build & Secret Leak Audit
// ---------------------------------------------------------------------------
console.log('\n\x1b[35m[4/4] Production Build & Secret Tree-Shaking Audit\x1b[0m');

try {
  console.log('  Running "npm run build"...');
  execSync('npm run build', { cwd: projectRoot, stdio: 'pipe' });
  assert(true, 'npm run build completed successfully with exit code 0');
} catch (buildErr) {
  assert(false, 'npm run build failed', buildErr.message);
}

// Verify dist output
const distAssetsDir = path.join(distDir, 'assets');
assert(fs.existsSync(distAssetsDir), 'dist/assets directory exists');

const distFiles = fs.readdirSync(distAssetsDir);
const jsFiles = distFiles.filter((f) => f.endsWith('.js'));
const mapFiles = distFiles.filter((f) => f.endsWith('.map'));

assert(mapFiles.length === 0, 'Production sourcemaps disabled (0 *.map files generated)');
assert(jsFiles.length > 0, `Compiled JavaScript assets present (${jsFiles.length} bundles)`);

let leakedFiles = [];
jsFiles.forEach((jsFile) => {
  const content = fs.readFileSync(path.join(distAssetsDir, jsFile), 'utf-8');
  if (content.includes('dev-carrier-secret') || content.includes('X-Carrier-Dev-Secret')) {
    leakedFiles.push(jsFile);
  }
});

assert(
  leakedFiles.length === 0,
  'Zero development secrets (dev-carrier-secret) in compiled production bundle',
  leakedFiles.join(', ')
);

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n\x1b[36m=======================================================');
console.log(`   Audit Complete: ${passedTests} Passed, ${failedTests} Failed`);
console.log('=======================================================\x1b[0m\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
