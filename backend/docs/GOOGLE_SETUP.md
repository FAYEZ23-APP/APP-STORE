# Google OAuth 2.0 Setup Guide & Architecture

This document specifies the operational configuration, GCP project requirements, and security controls for Google Authentication in the Egyptian Marketplace platform.

> [!IMPORTANT]
> The Google Authentication feature is disabled by default (`Auth:GoogleEnabled=false`) and must remain OFF until all production credentials, OAuth consent verification, and Egyptian legal compliance (PDPL 151/2020) are fully completed.

---

## 1. Google Cloud Platform (GCP) Project Ownership

1. **Entity Ownership**:
   - The GCP project **MUST** be owned by the official registered corporate operating entity within Google Cloud Organization.
   - **NEVER** create or host OAuth credentials under personal `@gmail.com` accounts or contractor accounts.
   - Admin access must be managed via Cloud Identity / Google Workspace with role-based IAM (Principle of Least Privilege).

2. **Project Organization & Region**:
   - Organization: Operating Entity Domain (e.g., `marketplace.eg`).
   - Project Name: `marketplace-egypt-prod` (and separate `marketplace-egypt-staging`).
   - Audit logging: Cloud Audit Logs enabled for all IAM and credential access.

---

## 2. OAuth 2.0 Consent Screen Configuration

1. **User Type**:
   - Set to **External**.

2. **App Information**:
   - **App Name**: Egyptian Marketplace (سوق مصر).
   - **User Support Email**: `support@marketplace.eg` (an official monitored group inbox, not a personal email).
   - **App Logo**: Official 120x120 SVG/PNG logo.

3. **App Domain Links (Compliant with Egyptian PDPL 151/2020)**:
   - **Application Home Page**: `https://marketplace.eg`
   - **Application Privacy Policy**: `https://marketplace.eg/privacy` (explicitly referencing PDPL Law 151/2020 and user rights to erasure).
   - **Application Terms of Service**: `https://marketplace.eg/terms`
   - **Authorized Domains**: `marketplace.eg`

4. **OAuth Scopes**:
   - Request strictly minimum scopes:
     - `openid` (Associate user with unique Google Subject identifier)
     - `https://www.googleapis.com/auth/userinfo.email` (View email address)
     - `https://www.googleapis.com/auth/userinfo.profile` (View basic profile name)
   - No sensitive or restricted scopes (no Google Drive, Contacts, Gmail, etc.).

5. **Verification**:
   - Submit app for official Google Brand and Scope Verification before enabling in production.

---

## 3. Client IDs Configuration

Two separate OAuth client credentials are required:

### A. Web Client ID (Backend Audience Verification)
- **Application Type**: Web application
- **Name**: `Marketplace Backend & Web Client`
- **Authorized JavaScript Origins**:
  - Production: `https://marketplace.eg`, `https://admin.marketplace.eg`
  - Staging: `https://staging.marketplace.eg`
- **Authorized Redirect URIs**:
  - `https://marketplace.eg/auth/google/callback`
- **Purpose**: The Client ID issued here is configured in backend environment variables (`Auth:GoogleClientId` / `Auth:GoogleWebClientId`). The backend verifies that the `aud` claim in incoming ID tokens matches this Client ID.

### B. Android Client ID (Mobile App Native Sign-In)
- **Application Type**: Android
- **Name**: `Marketplace Android App`
- **Package Name**: Match exactly `android.package` in `mobile/app.json`:
  ```
  com.egyptianmarketplace.app
  ```
- **SHA-1 Certificate Fingerprint per Build Type**:
  > [!WARNING]
  > **DO NOT INVENT VALUES**. Every fingerprint must be copied verbatim from the actual signing keystore or Google Play Console.

  1. **Debug Keystore** (Local developer testing):
     - Command to extract:
       ```bash
       keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
       ```
     - Copy the SHA-1 fingerprint output into the GCP Android Client ID for Development.

  2. **Staging / Internal Distribution**:
     - Command to extract from staging release keystore:
       ```bash
       keytool -list -v -keystore /path/to/staging.keystore -alias staging-alias
       ```

  3. **Production / Google Play App Signing**:
     - Do not use the local upload key. In Google Play Console:
       - Navigate to: **Release** > **Setup** > **App Integrity** > **App signing**.
       - Copy the **App signing key certificate SHA-1 fingerprint**.
       - Register this exact SHA-1 in the GCP Console under the Android Client ID.

---

## 4. Environment Variables & Startup Guards

| Environment Variable | Description | Production Default |
|---|---|---|
| `Auth__GoogleEnabled` | Enables Google OAuth routes | `false` |
| `Auth__AllowFakeGoogleTokens` | Allows mock test tokens (`mock-google-token:*`) | `false` (Fails startup if `true` in Prod) |
| `Auth__GoogleClientId` | Primary Google Web Client ID | Configured from GCP |
| `Auth__GoogleWebClientId` | Explicit Web Client ID | Configured from GCP |
| `Auth__GoogleAndroidClientId`| Explicit Android Client ID | Configured from GCP |

### Production Startup Guards
When `ASPNETCORE_ENVIRONMENT=Production`:
1. If `Auth:GoogleEnabled=true`, at least one valid, non-empty Google Client ID must be configured.
2. If `Auth:GoogleEnabled=true` and `Auth:AllowFakeGoogleTokens=true`, the application **refuses to start** and immediately terminates.

---

## 5. Security & Account Linking Architecture

1. **Linking by Subject (`sub`), Never by Email Alone**:
   - The platform stores Google OAuth links in the `ExternalLogins` table:
     - `Provider`: `"Google"`
     - `Subject`: Google's immutable user identifier (`sub` claim)
     - `UserId`: FK to `Users.Id`
     - Unique constraint: `(Provider, Subject)`
   - When an ID token arrives, the backend queries `ExternalLogins` by `Subject`.

2. **Existing Password Account Protection**:
   - If an ID token arrives for an email address that already has an active password-based account, the system **rejects automatic linking** with HTTP `409 Conflict`:
     > "A password account with this email already exists. Please log in with your email and password first to link your Google account."
   - This prevents account takeover attacks where an attacker creates an external login with a target victim's email address.

3. **Token Verification**:
   Every token received by `POST /api/auth/google` is verified cryptographically:
   - Signature: Validated using Google's public JSON Web Key Sets (JWKS).
   - `iss`: Must equal `accounts.google.com` or `https://accounts.google.com`.
   - `aud`: Must match configured `GoogleClientId`.
   - `exp`: Token must not be expired.
   - `email_verified`: Must be `true`.

4. **Account Deletion for Google-Only Users**:
   - Under Egyptian Personal Data Protection Law (PDPL 151/2020), users have the right to account anonymization and erasure (`DELETE /api/users/me`).
   - Users who registered exclusively through Google have `PasswordHash = null`.
   - To delete a Google-only account, the user **must re-authenticate** by submitting a fresh Google ID token. The system verifies that the token's `sub` matches the user's `ExternalLogins` record before proceeding with account deletion.
