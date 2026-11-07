# CI/CD & Software Supply Chain Security Governance

> **Project**: Egypt Shop Marketplace  
> **Standard**: SLSA Level 3 / OWASP Software Component Verification Standard (SCVS)  
> **Date**: 2026-11-07  
> **Phase**: PHASE 13 — Secure CI/CD, Dependency Governance & Software Supply Chain Security  

---

## 1. Branch Protection & Release Gates

To guarantee that unreviewed or vulnerable code never enters production, the following GitHub branch protection rules are mandated on `main`:

1. **Require Pull Request Reviews Before Merging**:
   - Minimum required approvals: **1**.
   - Dismiss stale pull request approvals when new commits are pushed: **Enabled**.
   - Require review from Code Owners (`.github/CODEOWNERS`): **Enabled**.
2. **Require Status Checks to Pass Before Merging**:
   - `Secret & Credential Leak Scanning (Gitleaks)`: Must pass.
   - `Backend Build, SAST & xUnit Tests (.NET 10)`: Must pass.
   - `Admin Web Security, npm Audit & Build`: Must pass.
   - `Mobile Security, i18n & Unit Tests (Expo 58)`: Must pass.
   - `CodeQL SAST Analysis (csharp)`: Must pass.
   - `CodeQL SAST Analysis (javascript-typescript)`: Must pass.
3. **Restrict Deletions & Force Pushes**:
   - `Do not allow bypassing the above settings`: **Enabled**.
   - `Disallow force pushes`: **Enabled**.
   - `Disallow branch deletions`: **Enabled**.

---

## 2. Supply Chain Security Controls (SLSA Level 3 Alignment)

| Control Area | Implementation in Repository | Verification Method |
|:---|:---|:---|
| **Action Pinning** | All third-party GitHub Actions pinned to immutable 40-character commit SHAs | Regex check in `test_audit_phase13_cicd_supply_chain.js` |
| **Least Privilege Permissions** | Top-level `permissions: contents: read` explicitly declared on all workflows | YAML static parser in automated tests |
| **Deterministic Builds** | `npm ci` enforced in Web and Mobile; `<Deterministic>true</Deterministic>` in .NET | CI workflow steps and `Directory.Build.props` |
| **Secret Leak Prevention** | Custom Gitleaks rules for Postgres, JWT, Bosta, Resend in `.gitleaks.toml` | Automated CI Gitleaks gate on all pushes |
| **Automated Dependency Updates**| Dependabot configured weekly for NuGet, Web, Mobile, and Actions | `.github/dependabot.yml` |
| **Code Ownership Enforcement** | Strict CODEOWNERS for security, database migrations, and financial logic | `.github/CODEOWNERS` |
| **SBOM Transparency** | Standard CycloneDX v1.5 JSON manifests generated for all 3 tiers | `docs/security/sbom/` |

---

## 3. Secret Leak Triage & Key Rotation Runbook

In the event that a secret is flagged by Gitleaks:
1. **Immediate Revocation**:
   - For Database credentials: Rotate PostgreSQL user password in production immediately via Vault or secret manager.
   - For JWT Keys: Invalidate all existing tokens by incrementing `User.TokenVersion` and rotating `Jwt:SecretKey`.
   - For Bosta / Carrier credentials: Re-generate API secret in the carrier portal and update environment variables.
2. **Git History Cleansing**:
   - Use `git-filter-repo` or BFG Repo-Cleaner to purge the sensitive commit from the entire tree.
   - Never simply commit an edit removing the secret without rewriting history and rotating the secret.
3. **Audit Trails**:
   - Check access logs during the exposure window to confirm if unauthorized API calls occurred.
