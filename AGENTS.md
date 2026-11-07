# Global Rules for Marketplace Project

## Project Paths
- **Repository Root**: `D:\Backend\marketplace`
- **Backend Project Folder**: `D:\Backend\marketplace\backend`
- **Mobile Project Folder**: `D:\Backend\marketplace\mobile`
- **Admin Web Project Folder**: `D:\Backend\marketplace\admin-web`

## Global Rules
1. **Work only in the single unified project folders**:
   - Backend: `D:\Backend\marketplace\backend`
   - Mobile: `D:\Backend\marketplace\mobile`
   - Admin Web: `D:\Backend\marketplace\admin-web`
2. **NEVER run database commands against any real database**:
   - No `dotnet ef database update`, `dotnet ef database drop`, `psql`, or `pg_dump` on real data.
   - Generate migrations only (`dotnet ef migrations add ... --output-dir ...`), show the generated SQL (`dotnet ef migrations script ...`); the user applies it manually.
3. **Tests run only on PostgreSQL through TEST_DB**:
   - If `TEST_DB` is unset or not PostgreSQL, mark those tests NOT RUN. Never switch to InMemory.
4. **Do NOT deploy anything**:
   - The hosting platform is paused. Local work only.
5. **Never print or commit secrets**:
   - Secrets come from environment variables. Never commit or log secrets.
   - Every number or output in a report must come from a command just run and saved under tests/ or reports/. Never retype output.
6. **New dependencies policy**:
   - State package, version and licence before adding; prefer none. Run the package vulnerability audit and report it.
7. **Mobile and Web standards**:
   - i18n only (ar primary, en fallback), RTL-safe logical styles (start/end), theme tokens, the i18n check must pass.
8. **Execute ONE stage/part at a time**:
   - After each part report: files changed, endpoints added, migration SQL, tests (provider, pass/fail/skipped), and what could NOT be verified.
   - STOP and wait for user confirmation before proceeding to the next part.
9. **Biometric Security & Token Binding**:
   - The biometric authentication gate operates as a UI-level lock (`UnlockScreen`).
   - The refresh token is encrypted in `expo-secure-store` and is NOT cryptographically bound to hardware biometric keys (`requireAuthentication: false`). Adding or removing fingerprints does not invalidate the underlying SecureStore token.
10. **Financial & Real-Money Features Governance**:
   - Real-money features (`Features:EnableWallet`, `Features:EnableVendorPayouts`, `Features:EnableCoupons`) stay OFF (`false`) by default across all environments until formal legal and accounting sign-off is completed.
   - All wallet and vendor payout routes return 404 when these flags are disabled.

11. **Ownership & Access Control**:
   - Ownership or unauthorized resource access failures MUST return 403 (ForbiddenException) or 404 (NotFoundException), NEVER 500.
