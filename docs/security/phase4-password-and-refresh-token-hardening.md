# Phase 4 — Password Hashing, Refresh Token Rotation & Secure Cleanup

## 1. Password Storage Audit & BCrypt Hardening
- **Audit Findings**:
  - `User.PasswordHash` is stored strictly as a one-way salted BCrypt hash (`$2a$` / `$2b$`, 60 characters).
  - Plaintext passwords are never stored in the database, never reversibly encrypted, never returned in API responses (`AuthResponse`, `UserProfileResponse`, `AdminUserDto`), never exported in personal data packages (`PrivacyService`), and masked in structured/exception logs (`SensitiveDataMasker`).
- **BCrypt Implementation ([`BCryptPasswordHasher.cs`](file:///d:/Backend/marketplace/backend/Marketplace.Infrastructure/Auth/BCryptPasswordHasher.cs))**:
  - Uses `BCrypt.Net-Next` (`4.0.3`, MIT License — already present, zero new dependencies added).
  - Generates a unique 128-bit cryptographic salt automatically on every `Hash(password)` call.
  - Configurable work factor via `Auth:BCryptWorkFactor` (default **`12`**, clamped safely to `[10, 15]`).
  - Constant-time verification via `BCrypt.Net.BCrypt.Verify`, catching malformed hash exceptions safely (`return false`).
- **Hardware Benchmark ([`bcrypt_benchmark.txt`](file:///d:/Backend/marketplace/backend/tests/bcrypt_benchmark.txt))**:
  - Measured on host hardware (8 logical cores, .NET 10.0.5):
    - Cost `10`: hash avg `71.4 ms`, verify avg `67.8 ms`
    - Cost `11`: hash avg `132.4 ms`, verify avg `145.9 ms`
    - Cost `12`: hash avg `301.9 ms`, verify avg `289.8 ms` *(selected default)*
    - Cost `13`: hash avg `721.8 ms`, verify avg `832.4 ms`
    - Cost `14`: hash avg `1580.5 ms`, verify avg `1502.3 ms`
- **Transparent Hash Migration**:
  - `IPasswordHasher.NeedsRehash(string hash)` inspects the BCrypt version prefix and embedded cost factor.
  - On successful `LoginAsync`, if `NeedsRehash` returns `true` (e.g., legacy cost `10` or `11`), the user's password is transparently re-hashed at work factor `12` and persisted without interrupting login.

---

## 2. Refresh Token Rotation & Token-Family Replay Detection
- **Cryptographic Generation & Storage**:
  - 32 bytes (256 bits) from `RandomNumberGenerator.GetBytes(32)` encoded as URL-safe Base64.
  - Only the lowercase hex SHA-256 digest (`TokenHash`) is stored in `"RefreshTokens"`.
- **Token Family Schema ([`RefreshToken.cs`](file:///d:/Backend/marketplace/backend/Marketplace.Domain/Entities/RefreshToken.cs))**:
  - `FamilyId` (`uuid NOT NULL`): Identifies the login session chain per device. Initial login creates a new `FamilyId`; every rotated replacement inherits the same `FamilyId`.
  - `ConsumedAt` (`timestamp with time zone NULL`): Set atomically when a refresh token is exchanged for a successor.
  - `RevokeReason` (`varchar(40) NULL`): Tracks lifecycle transitions (`Rotated`, `ReuseDetected`, `Logout`, `LogoutAll`, `PasswordChange`, `PasswordReset`, `DeviceLimit`, `Expired`, `AccountInactive`, `AdminIdleTimeout`, `AdminAbsoluteLifetime`).
- **Atomic Single-Use Rotation & Replay Detection ([`AuthService.cs`](file:///d:/Backend/marketplace/backend/Marketplace.Application/Services/AuthService.cs))**:
  - Presenting a token where `ConsumedAt IS NOT NULL` immediately triggers `RevokeFamilyAsync(tokenRecord.FamilyId, "ReuseDetected", now)`, revoking all active tokens in that `FamilyId`, recording a `RefreshTokenReuseDetected` entry in `"AdminAuditLogs"`, and throwing `401 Unauthorized`.
  - Rotation executes inside a database transaction using an atomic conditional update:
    ```sql
    UPDATE "RefreshTokens"
    SET "ConsumedAt" = @now, "RevokedAt" = @now, "LastUsedAt" = @now, "RevokeReason" = 'Rotated'
    WHERE "Id" = @id AND "ConsumedAt" IS NULL AND "RevokedAt" IS NULL
    ```
  - If `rowsAffected == 0` (concurrent race with the same refresh token), the transaction rolls back and the entire `FamilyId` is immediately revoked as a replay event.

---

## 3. Removal of the 20-Second Grace Window
- **Security Assessment**:
  - Previously, `AuthService.RefreshTokenAsync` allowed a rotated refresh token to be reused within 20 seconds if the caller supplied the same `DeviceId`, revoking the first replacement token and minting a second one.
  - Because `DeviceId` is a client-supplied identifier (not a cryptographic secret), an attacker who intercepted a refresh token—or a replayed request within 20 seconds—could mint a valid token and silently hijack the session without triggering replay detection.
  - Both client applications ([`mobile/src/api/client.js`](file:///d:/Backend/marketplace/mobile/src/api/client.js) and [`admin-web/src/api/client.js`](file:///d:/Backend/marketplace/admin-web/src/api/client.js)) already serialize concurrent 401 refresh calls in-memory via `performSingleFlightRefresh()`.
- **Decision**:
  - **Eliminated** the server-side 20-second grace window completely. Every refresh token is strictly single-use; any second presentation (even `<100ms` later with the identical `DeviceId`) is rejected with `401` and revokes the token family.

---

## 4. Hardened Background Cleanup (`RefreshTokenCleanupService`)
- **Implementation ([`RefreshTokenCleanupService.cs`](file:///d:/Backend/marketplace/backend/Marketplace.Infrastructure/BackgroundServices/RefreshTokenCleanupService.cs))**:
  - **Concurrency Protection**: Combines an in-process non-blocking `SemaphoreSlim` with a PostgreSQL session-level advisory lock (`pg_try_advisory_lock(0x52544B43_4C4E50)`) so multiple API instances never run competing cleanup jobs.
  - **Security Retention Window**: Configurable via `Auth:RefreshTokenCleanup:SecurityRetentionDays` (default **`30` days**). Recently revoked/consumed tokens are kept for 30 days to preserve replay-detection forensics and audit trails.
  - **Live-Family Protection**: Never deletes a rotated predecessor whose `FamilyId` still has an active (`RevokedAt IS NULL AND ExpiresAt > now`) descendant token.
  - **Bounded Batches**: Deletes at most `BatchSize` (default `500`) rows per short transaction up to `MaxBatchesPerRun` (default `200`), nulling inbound `ReplacedByTokenId` self-references before deleting each batch to avoid long table locks or FK violations.
  - **Resilience & Observability**: Tracks `TotalRuns`, `TotalDeleted`, `ConsecutiveFailures`, `LastSuccessAt`, `LastFailureAt`, `LastFailureType`, and `SkippedBecauseLocked` via `IRefreshTokenCleanupService.GetMetrics()`, applying exponential backoff on transient failures.
