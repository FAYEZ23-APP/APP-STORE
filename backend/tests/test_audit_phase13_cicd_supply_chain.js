/**
 * PHASE 13 — Secure CI/CD, Dependency Governance & Software Supply Chain Security
 * Automated Verification Suite
 *
 * Verifies 10 Supply Chain & Pipeline Hardening Requirements:
 * 1. GitHub Actions 40-Character Commit SHA Pinning (zero floating tags)
 * 2. Explicit Least-Privilege Workflow Permissions (`permissions: contents: read`)
 * 3. Workflow Concurrency Controls (`cancel-in-progress: true`)
 * 4. Dependabot Multi-Ecosystem Coverage (NuGet, Web npm, Mobile npm, Actions)
 * 5. CODEOWNERS Review Enforcement on Security, Financial & DB Migrations
 * 6. Gitleaks Configuration & Secret Rules (Postgres, JWT, Bosta, Resend, Keys)
 * 7. Roslyn Security Analyzers & Deterministic Build Configuration
 * 8. CycloneDX v1.5 Machine-Readable SBOM Manifest Validation
 * 9. Git & Docker Secret Protection Guards (.gitignore & .dockerignore)
 * 10. Dependency Vulnerability Status Verification (NuGet 0, Web npm 0)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] Scenario ${totalTests}: ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] Scenario ${totalTests}: ${message}`);
  }
}

console.log('================================================================================');
console.log('PHASE 13: SECURE CI/CD & SUPPLY CHAIN SECURITY VERIFICATION');
console.log('Repository Root:', REPO_ROOT);
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// Test 1: GitHub Actions 40-Character Commit SHA Pinning
// -----------------------------------------------------------------------------
console.log('[Check 1] GitHub Actions Commit SHA Pinning...');
const workflowDir = path.join(REPO_ROOT, '.github', 'workflows');
const workflowFiles = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

let allActionsPinned = true;
let totalActionsFound = 0;
const unpinnedActions = [];

workflowFiles.forEach(file => {
  const filePath = path.join(workflowDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('uses:')) {
      const actionRef = trimmed.replace('uses:', '').trim().split('#')[0].trim();
      // Skip local action references like ./.github/actions/...
      if (!actionRef.startsWith('.')) {
        totalActionsFound++;
        const parts = actionRef.split('@');
        if (parts.length < 2 || !/^[a-f0-9]{40}$/i.test(parts[1])) {
          allActionsPinned = false;
          unpinnedActions.push(`${file}:${idx + 1} (${actionRef})`);
        }
      }
    }
  });
});

assert(
  allActionsPinned && totalActionsFound > 0,
  `All ${totalActionsFound} GitHub Actions across workflows are pinned to 40-character SHAs (Unpinned: ${unpinnedActions.join(', ') || 'None'})`
);

// -----------------------------------------------------------------------------
// Test 2: Explicit Least-Privilege Workflow Permissions
// -----------------------------------------------------------------------------
console.log('\n[Check 2] Least-Privilege Workflow Permissions...');
let allWorkflowsHavePermissions = true;
workflowFiles.forEach(file => {
  const content = fs.readFileSync(path.join(workflowDir, file), 'utf8');
  if (!content.includes('permissions:') || !content.includes('contents: read')) {
    allWorkflowsHavePermissions = false;
  }
});
assert(
  allWorkflowsHavePermissions,
  `All workflow files (${workflowFiles.join(', ')}) define explicit least-privilege 'permissions: contents: read'`
);

// -----------------------------------------------------------------------------
// Test 3: Workflow Concurrency Controls
// -----------------------------------------------------------------------------
console.log('\n[Check 3] Concurrency Controls & In-Flight Run Cancellation...');
let allWorkflowsHaveConcurrency = true;
workflowFiles.forEach(file => {
  const content = fs.readFileSync(path.join(workflowDir, file), 'utf8');
  if (!content.includes('concurrency:') || !content.includes('cancel-in-progress: true')) {
    allWorkflowsHaveConcurrency = false;
  }
});
assert(
  allWorkflowsHaveConcurrency,
  `All workflow files enforce 'concurrency: cancel-in-progress: true' to prevent race conditions and wasted compute`
);

// -----------------------------------------------------------------------------
// Test 4: Dependabot Multi-Ecosystem Coverage
// -----------------------------------------------------------------------------
console.log('\n[Check 4] Dependabot Multi-Ecosystem Configuration...');
const dependabotPath = path.join(REPO_ROOT, '.github', 'dependabot.yml');
const dependabotExists = fs.existsSync(dependabotPath);
let dependabotValid = false;
if (dependabotExists) {
  const content = fs.readFileSync(dependabotPath, 'utf8');
  const hasNuget = content.includes('package-ecosystem: "nuget"');
  const hasWebNpm = content.includes('/admin-web');
  const hasMobileNpm = content.includes('/mobile');
  const hasActions = content.includes('package-ecosystem: "github-actions"');
  dependabotValid = hasNuget && hasWebNpm && hasMobileNpm && hasActions;
}
assert(
  dependabotExists && dependabotValid,
  'Dependabot configuration (.github/dependabot.yml) covers NuGet, admin-web, mobile, and github-actions'
);

// -----------------------------------------------------------------------------
// Test 5: CODEOWNERS Review Enforcement
// -----------------------------------------------------------------------------
console.log('\n[Check 5] Repository Code Ownership (CODEOWNERS)...');
const codeownersPath = path.join(REPO_ROOT, '.github', 'CODEOWNERS');
const codeownersExists = fs.existsSync(codeownersPath);
let codeownersCoversKeyAreas = false;
if (codeownersExists) {
  const content = fs.readFileSync(codeownersPath, 'utf8');
  codeownersCoversKeyAreas =
    content.includes('/.github/') &&
    content.includes('/backend/Marketplace.Infrastructure/Data/Migrations/') &&
    content.includes('OrderService.cs') &&
    content.includes('/admin-web/') &&
    content.includes('/mobile/');
}
assert(
  codeownersExists && codeownersCoversKeyAreas,
  'CODEOWNERS file enforces required review gates on CI/CD, migrations, financial services, web, and mobile'
);

// -----------------------------------------------------------------------------
// Test 6: Gitleaks Configuration & Secret Detection Rules
// -----------------------------------------------------------------------------
console.log('\n[Check 6] Gitleaks Secret Scanner Configuration...');
const gitleaksPath = path.join(REPO_ROOT, '.gitleaks.toml');
const gitleaksExists = fs.existsSync(gitleaksPath);
let gitleaksHasRules = false;
if (gitleaksExists) {
  const content = fs.readFileSync(gitleaksPath, 'utf8');
  gitleaksHasRules =
    content.includes('postgres-connection-string') &&
    content.includes('jwt-secret-key') &&
    content.includes('bosta-api-secret') &&
    content.includes('resend-api-key') &&
    content.includes('private-key');
}
assert(
  gitleaksExists && gitleaksHasRules,
  'Gitleaks config (.gitleaks.toml) defines custom rules for PostgreSQL, JWT, Bosta, Resend, and RSA/EC Private Keys'
);

// -----------------------------------------------------------------------------
// Test 7: Roslyn Security Analyzers & Deterministic Build Configuration
// -----------------------------------------------------------------------------
console.log('\n[Check 7] Roslyn SAST & Deterministic Build Configuration...');
const propsPath = path.join(REPO_ROOT, 'backend', 'Directory.Build.props');
const propsExists = fs.existsSync(propsPath);
let propsValid = false;
if (propsExists) {
  const content = fs.readFileSync(propsPath, 'utf8');
  propsValid =
    content.includes('<EnableNETAnalyzers>true</EnableNETAnalyzers>') &&
    content.includes('<AnalysisLevel>latest-recommended</AnalysisLevel>') &&
    content.includes('<Deterministic>true</Deterministic>');
}
assert(
  propsExists && propsValid,
  'backend/Directory.Build.props enables Roslyn security analyzers and deterministic build flags'
);

// -----------------------------------------------------------------------------
// Test 8: CycloneDX v1.5 Machine-Readable SBOM Manifests
// -----------------------------------------------------------------------------
console.log('\n[Check 8] CycloneDX v1.5 SBOM Validation...');
const sbomDir = path.join(REPO_ROOT, 'docs', 'security', 'sbom');
const backendSbomPath = path.join(sbomDir, 'backend-cyclonedx.json');
const webSbomPath = path.join(sbomDir, 'admin-web-cyclonedx.json');
const mobileSbomPath = path.join(sbomDir, 'mobile-cyclonedx.json');
const manifestMdPath = path.join(sbomDir, 'complete-sbom-manifest.md');

let sbomValid = true;
try {
  const bJson = JSON.parse(fs.readFileSync(backendSbomPath, 'utf8'));
  const wJson = JSON.parse(fs.readFileSync(webSbomPath, 'utf8'));
  const mJson = JSON.parse(fs.readFileSync(mobileSbomPath, 'utf8'));
  const mdExists = fs.existsSync(manifestMdPath);

  if (bJson.bomFormat !== 'CycloneDX' || bJson.specVersion !== '1.5' || bJson.components.length < 5) sbomValid = false;
  if (wJson.bomFormat !== 'CycloneDX' || wJson.specVersion !== '1.5' || wJson.components.length < 5) sbomValid = false;
  if (mJson.bomFormat !== 'CycloneDX' || mJson.specVersion !== '1.5' || mJson.components.length < 5) sbomValid = false;
  if (!mdExists) sbomValid = false;
} catch (e) {
  sbomValid = false;
}
assert(
  sbomValid,
  'CycloneDX v1.5 SBOM files exist and validate correctly for backend, admin-web, and mobile'
);

// -----------------------------------------------------------------------------
// Test 9: Git & Docker Secret Protection Guards
// -----------------------------------------------------------------------------
console.log('\n[Check 9] Git & Docker Secret Exclusion Guards...');
const gitignoreContent = fs.readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf8');
const dockerignoreContent = fs.readFileSync(path.join(REPO_ROOT, 'backend', '.dockerignore'), 'utf8');

const gitProtectsSecrets =
  gitignoreContent.includes('appsettings.Production.json') &&
  gitignoreContent.includes('.env') &&
  gitignoreContent.includes('*.key') &&
  gitignoreContent.includes('*.pfx');

const dockerProtectsSecrets =
  dockerignoreContent.includes('appsettings.Production.json') &&
  dockerignoreContent.includes('**/*.env*') &&
  dockerignoreContent.includes('**/*.key');

assert(
  gitProtectsSecrets && dockerProtectsSecrets,
  '.gitignore and backend/.dockerignore explicitly block production configs, environment secrets, and private keys'
);

// -----------------------------------------------------------------------------
// Test 10: Dependency Vulnerability Audit Status Check
// -----------------------------------------------------------------------------
console.log('\n[Check 10] Live Dependency Vulnerability Status Check...');
let nugetClean = false;
let webClean = false;

try {
  const nugetOut = execSync('dotnet list backend/Marketplace.slnx package --vulnerable', {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });
  if (nugetOut.includes('has no vulnerable packages')) {
    nugetClean = true;
  }
} catch (e) {
  nugetClean = false;
}

try {
  const webOut = execSync('npm audit --prefix admin-web', {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });
  if (webOut.includes('found 0 vulnerabilities')) {
    webClean = true;
  }
} catch (e) {
  webClean = false;
}

assert(
  nugetClean && webClean,
  `NuGet and Admin Web npm dependencies have zero known vulnerabilities (NuGet clean: ${nugetClean}, Web clean: ${webClean})`
);

// -----------------------------------------------------------------------------
// Final Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`PHASE 13 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
console.log('================================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
