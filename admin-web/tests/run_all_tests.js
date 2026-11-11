/**
 * Comprehensive Master Test Runner for admin-web
 * Executes all 6 test suites:
 * 1. test_web_suite.js (Remediation & WCAG Verification)
 * 2. test_web_security_and_build.js (Security, XSS, i18n & Build Tree-Shaking)
 * 3. test_bilingual_smart_search_web.js (Search Hook, Debounce & Component Behavior)
 * 4. test_seller_role_isolation.js (Role-based Routing & Shopping Isolation)
 * 5. test_storefront_gating_router.test.js (Storefront Feature Flag & Router Gating)
 * 6. test_production_build_hardening.cjs (WEB-011: XSS Prevention & Production Build Hardening)
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const suites = [
  { name: 'Audit Remediation & WCAG Suite', file: 'test_web_suite.js' },
  { name: 'Security, i18n & Tree-Shaking Suite', file: 'test_web_security_and_build.js' },
  { name: 'Bilingual Smart Search Suite', file: 'test_bilingual_smart_search_web.js' },
  { name: 'Seller & Role Isolation Suite', file: 'test_seller_role_isolation.js' },
  { name: 'Storefront Gating & Routing Suite', file: 'test_storefront_gating_router.test.js' },
  { name: 'XSS Prevention & Build Hardening Suite', file: 'test_production_build_hardening.cjs' },
  { name: 'Google Maps Security & Restrictions Suite', file: 'test_maps_security_and_restrictions.cjs' },
  { name: 'Profile Redesign & Identity Dashboard Suite', file: 'test_web_profile_redesign.js' },
];

console.log('\n===============================================================');
console.log('   MarketplaceWeb Master Test Runner (All Suites)');
console.log('===============================================================\n');

let allPassed = true;
const summary = [];

for (const suite of suites) {
  const filePath = path.join(__dirname, suite.file);
  console.log(`\n>>> Running [${suite.name}] (${suite.file})...`);
  const start = Date.now();
  const res = spawnSync(process.execPath, [filePath], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
  });
  const duration = ((Date.now() - start) / 1000).toFixed(2);

  if (res.status === 0) {
    summary.push({ name: suite.name, status: 'PASS', duration: `${duration}s` });
  } else {
    allPassed = false;
    summary.push({ name: suite.name, status: 'FAIL', duration: `${duration}s` });
  }
}

console.log('\n===============================================================');
console.log('   Master Test Execution Summary');
console.log('===============================================================');
for (const s of summary) {
  const color = s.status === 'PASS' ? '\x1b[32m' : '\x1b[31m';
  console.log(`  ${color}[${s.status}]\x1b[0m ${s.name.padEnd(42)} (${s.duration})`);
}
console.log('===============================================================\n');

if (!allPassed) {
  console.error('Master Test Runner FAILED. One or more test suites encountered errors.\n');
  process.exit(1);
} else {
  console.log('Master Test Runner PASSED! All suites succeeded with 0 errors.\n');
  process.exit(0);
}
