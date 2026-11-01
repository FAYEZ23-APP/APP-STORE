# Overall Audit Commands Log

| Timestamp | Command | Purpose | Output / Exit Code |
|-----------|---------|---------|--------------------|
| 2026-11-01T20:07:04+02:00 | `Get-ChildItem -Path . -Force` | List repository root contents | Exit Code 0 |
| 2026-11-01T20:07:22+02:00 | `Get-ChildItem -Path docs/audit2 -Force` | List docs/audit2 contents | Exit Code 0 |
| 2026-11-01T20:07:47+02:00 | `Get-ChildItem -Path docs -Force; Get-ChildItem -Path scripts -Force` | List docs and scripts directories | Exit Code 0 |
| 2026-11-01T20:08:09+02:00 | `Get-ChildItem -Path scripts/audit2 -Force; Get-ChildItem -Path docs/audit -Force` | List scripts/audit2 and docs/audit | Exit Code 0 |
| 2026-11-01T20:10:17+02:00 | `[Environment]::GetEnvironmentVariable("TEST_DB", "User")` | Check TEST_DB environment variable | Exit Code 0, DB: MarketplaceMVP_test |
| 2026-11-01T20:15:53+02:00 | `powershell -ExecutionPolicy Bypass -File scripts/audit2/measure-stats.ps1` | Measure LOC, migrations, tables, routes, screens, pages | Exit Code 0 (Backend: 17464 LOC, Migrations: 21, Tables: 28, Routes: 116, Screens: 29, Pages: 24) |
| 2026-11-01T20:17:01+02:00 | `powershell -ExecutionPolicy Bypass -File scripts/audit2/inspect-tests.ps1` | Inspect all test files across repository | Exit Code 0 (114 files including logs/tools) |
| 2026-11-01T20:18:46+02:00 | `git rev-parse HEAD` | Check current git HEAD commit | Exit Code 0 (`7906e43db2ba7934ff85de5a38500f6ed8149cd3`) |
| 2026-11-01T20:19:26+02:00 | `git status --short` | Inspect working directory git status | Exit Code 0 (452 uncommitted changes) |
| 2026-11-01T20:21:05+02:00 | `powershell -ExecutionPolicy Bypass -File scripts/audit2/git-stats.ps1` | Analyze git history, commits, authors, churn hotspots | Exit Code 0 (14 commits, 2 author names, bus factor 1) |
| 2026-11-01T20:21:45+02:00 | `dotnet build backend/Marketplace.API/Marketplace.API.csproj --no-incremental` | Build backend API with incremental false | Exit Code 1 (File lock by existing PID 4744) |
| 2026-11-01T20:23:09+02:00 | `Get-Process -Id 4744; netstat -ano \| findstr 4744` | Inspect process 4744 on port 5209 | Exit Code 0 (Running Marketplace.API.exe on 5209) |
| 2026-11-01T20:26:12+02:00 | `dotnet build backend/Marketplace.API/Marketplace.API.csproj -o "$env:TEMP/marketplace_build_check"` | Test clean backend build to temporary directory | Exit Code 0 (0 errors, 8 warnings) |
| 2026-11-01T20:27:37+02:00 | `Remove-Item -Recurse -Force "$env:TEMP/marketplace_build_check"` | Clean up temporary build check files | Exit Code 0 |
| 2026-11-01T20:28:06+02:00 | `dotnet list backend/Marketplace.API package --vulnerable; dotnet list ... --outdated` | Check NuGet vulnerabilities and outdated packages | Exit Code 0 (0 vulnerabilities, 4 minor updates) |
| 2026-11-01T20:29:01+02:00 | `dotnet list backend/Marketplace.Application package --vulnerable; ... Infrastructure` | Check Application & Infrastructure NuGet packages | Exit Code 0 (0 vulnerabilities) |
| 2026-11-01T20:30:29+02:00 | `npm --prefix admin-web run build` | Test production build of admin-web | Exit Code 0 (Built in 6.42s) |
| 2026-11-01T20:31:19+02:00 | `npm --prefix admin-web audit` | Check npm vulnerabilities in admin-web | Exit Code 1 (2 vulnerabilities: 1 moderate, 1 high) |
| 2026-11-01T20:32:56+02:00 | `npm --prefix mobile audit` | Check npm vulnerabilities in mobile | Exit Code 1 (29 vulnerabilities: 1 low, 24 moderate, 4 high) |
| 2026-11-01T20:36:49+02:00 | `powershell -ExecutionPolicy Bypass -File scripts/audit2/check-licenses.ps1` | Inventory third-party licenses and copyleft risks | Exit Code 0 (0 copyleft risks across backend, mobile, web) |
| 2026-11-01T20:39:38+02:00 | `powershell -ExecutionPolicy Bypass -File scripts/audit2/test-readme-clone.ps1` | Clone in temp directory, test README steps and cleanup | Exit Code 0 (Clean clone restored & built; DB setup missing) |
| 2026-11-01T20:41:09+02:00 | `powershell -ExecutionPolicy Bypass -File scripts/run-all-tests.ps1` | Run all test suites against real PostgreSQL TEST_DB | Exit Code 1 (8 PASS, 5 FAIL) |
| 2026-11-01T20:47:39+02:00 | `Get-Content backend/tests/test_account_deletion_mock.js` | Inspect reason for mock test failure | Exit Code 0 (Brittle literal string matching on C# code) |
| 2026-11-01T21:03:21+02:00 | `Get-Content 20261030011003_MakeOrderIdempotencyIndexUnique.cs` | Verify idempotency unique index fix | Exit Code 0 (Unique index with filter verified) |
| 2026-11-01T21:04:31+02:00 | `Get-ChildItem backend/Marketplace.Infrastructure ... LogMasking` | Verify log masking in notification senders | Exit Code 0 (Masking confirmed on OTP/Email/Phone) |
| 2026-11-01T21:05:22+02:00 | `Select-String ... CancelOrderAsync` | Verify cancellation lock in OrderService.cs | Exit Code 0 (Pessimistic row lock FOR UPDATE confirmed) |
| 2026-11-01T21:05:52+02:00 | `Select-String ... UpdateOrderStatus` | Verify seller status update endpoint authorization | Exit Code 0 (Restricted to Admin only) |
| 2026-11-01T21:07:04+02:00 | `git diff --cached --name-only admin-web \| Measure-Object -Line` | Check staged files count for admin-web | Exit Code 0 (86 files staged, uncommitted) |
| 2026-11-01T21:07:33+02:00 | `git ls-tree HEAD admin-web` | Verify if admin-web is present in HEAD commit | Exit Code 0 (No output; completely absent from HEAD) |
| 2026-11-01T21:08:03+02:00 | `git status --short \| Group-Object ...` | Group uncommitted changes by status code | Exit Code 0 (452 total uncommitted files) |
