# Deployment & Operational Runbook

> [!IMPORTANT]
> This runbook contains **environment variable names ONLY**.
> No secrets, keys, passwords, tokens, or default connection strings are stored in this document or in the repository. All credentials must be provisioned via your cloud secret manager or platform environment variables.

---

## 1. Environment Variable Names

The following environment variables configure the backend service in staging and production:

### Core & Server
| Variable Name | Description |
|:---|:---|
| `ASPNETCORE_ENVIRONMENT` | Application environment (`Staging` or `Production`). Note: Swagger and `/api/dev/*` are strictly disabled when set to `Staging` or `Production`. |
| `PORT` | Container listening port injected dynamically by PaaS providers (Railway, Render, AWS ECS, GCP Cloud Run). The application automatically binds `http://0.0.0.0:${PORT}`. |
| `ConnectionStrings__DefaultConnection` | PostgreSQL connection string. Must target managed PostgreSQL (e.g. Supabase, Neon, AWS RDS). |
| `Database__AutoMigrate` | Automatic EF Core migration flag. **Must be set to `false` in Staging and Production** per strict operational rules. |

### Security & Tokens
| Variable Name | Description |
|:---|:---|
| `Jwt__Key` | Secret key for HMAC-SHA256 signing of JWT access tokens (minimum 32 characters / 256 bits). |
| `Jwt__Issuer` | Token issuer claim identifier. |
| `Jwt__Audience` | Token audience claim identifier. |
| `Jwt__ExpiryMinutes` | Access token lifespan in minutes (recommended: `15`). |
| `Jwt__RefreshTokenExpiryDays` | Refresh token duration in days (recommended: `30`). |
| `Auth__RefreshTokenGraceWindowSeconds` | Rotation grace window in seconds for mobile retry handling under transient network drops (default: `20`). |
| `Auth__CodeSecret` | Secret key for HMAC-SHA256 hashing of OTP verification codes before persistence. |

### Authentication & Providers
| Variable Name | Description |
|:---|:---|
| `Auth__RequireVerification` | Enforces OTP verification before account activation (`true` in Staging and Production). |
| `Auth__PhoneSignupEnabled` | Enables Egyptian mobile phone registration with SMS OTP. |
| `Auth__GoogleEnabled` | Enables Google OAuth Sign-In. |
| `Auth__AllowFakeGoogleTokens` | Must be `false` in Staging and Production. Enables mock token verification for testing only. |
| `Auth__GoogleClientId` | Google OAuth Web Client ID for token audience verification. |
| `Auth__GoogleWebClientId` | Secondary Google Web Client ID (if applicable). |
| `Auth__GoogleAndroidClientId` | Google Android Client ID for mobile application token verification. |

### Feature Gates & Administration
| Variable Name | Description |
|:---|:---|
| `Features__EnableWallet` | Controls seller wallet balance and transaction ledger. Default `false`. |
| `Features__EnableVendorPayouts` | Controls vendor payout request workflow. Default `false`. |
| `Features__EnableCoupons` | Controls promotional coupon creation and checkout redemption. Default `false`. |
| `Features__AllowFinancialInProduction` | Safety lock for financial features in Production. Default `false`. |
| `Admin__WebEnabled` | Enables administrative API endpoints (`/api/admin/*`). Default `false`. |
| `Admin__Require2FA` | Enforces two-factor authentication for administrative operations (`true` in Production). |

### Rate Limiting & Networking
| Variable Name | Description |
|:---|:---|
| `RateLimiting__AuthPermitLimit` | Maximum registration and login requests per sliding IP window. |
| `RateLimiting__RefreshPermitLimit` | Maximum refresh token requests per IP window. |
| `RateLimiting__UploadPermitLimit` | Maximum file upload requests per IP window. |
| `RateLimiting__GeneralPermitLimit` | General fallback API rate limit per IP window. |

### External Integrations
| Variable Name | Description |
|:---|:---|
| `Email__Host` | SMTP host for verification and password reset emails. |
| `Email__Port` | SMTP port (e.g. `587`). |
| `Email__User` | SMTP username. |
| `Email__Password` | SMTP password. |
| `Email__Sender` | Outgoing email address shown to recipients. |
| `SMS__ApiKey` | Gateway API key for SMS OTP delivery. |
| `SMS__Sender` | Sender ID registered with SMS aggregator. |
| `Carrier__Secret` | Shared secret key for shipping carrier status callback authentication. |

---

## 2. Dockerfile & Container Port Handling

The application is packaged with a multi-stage `Dockerfile`:
- **Build Stage**: Compiles and publishes binaries using `mcr.microsoft.com/dotnet/sdk:10.0`.
- **Runtime Stage**: Minimal production image using `mcr.microsoft.com/dotnet/aspnet:10.0`.

### Dynamic Port Binding
Cloud platforms (Railway, Render, Cloud Run) assign dynamic ports through the `PORT` environment variable. The application initializes Kestrel to respect this variable:

```csharp
// Program.cs
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}
```

### Docker Build & Run Commands
```bash
# Build production Docker image
docker build -t marketplace-api:latest -f backend/Dockerfile backend/

# Run container locally with mapped port and uploads volume
docker run -d \
  --name marketplace-api \
  -p 5209:5209 \
  -e ASPNETCORE_ENVIRONMENT=Production \
  -e PORT=5209 \
  -e ConnectionStrings__DefaultConnection="<CONNECTION_STRING>" \
  -e Jwt__Key="<JWT_SECRET>" \
  -e Auth__CodeSecret="<AUTH_CODE_SECRET>" \
  -v marketplace_uploads:/app/wwwroot/uploads \
  marketplace-api:latest
```

---

## 3. Manual Database Migration Procedure

> [!CAUTION]
> **NEVER run `dotnet ef database update` directly against staging or production.**
> Per global governance rules, all database schema modifications must be scripted as SQL, reviewed by the team, and applied manually via SQL client.

### Step 3.1: Generate Idempotent SQL Migration Script
Run the EF Core CLI from the repository root to generate an idempotent migration script:

```powershell
# From Repository Root (D:\Backend\marketplace):
dotnet ef migrations script `
  --idempotent `
  --project backend/Marketplace.Infrastructure/Marketplace.Infrastructure.csproj `
  --startup-project backend/Marketplace.API/Marketplace.API.csproj `
  --output ./migrations/release_bundle.sql
```

### Step 3.2: Inspect the Script
Verify that:
1. All DDL statements (`CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`) are safe and non-blocking.
2. Table and column names match PostgreSQL conventions (double-quoted PascalCase or snake_case matching EF model).
3. `__EFMigrationsHistory` insert statements are present at the end of each migration block.

### Step 3.3: Apply SQL Script Manually
Execute the SQL script against the target database using `psql`:

```bash
psql -h <DB_HOST> -p <DB_PORT> -U <DB_USER> -d <DB_NAME> -f ./migrations/release_bundle.sql
```

---

## 4. Database Backup & Restore Procedures

### Pre-Deployment Backup
Before executing any migration or deployment, take a full binary dump:

```bash
# Create custom-format compressed backup (.dump)
pg_dump \
  -h <DB_HOST> \
  -p <DB_PORT> \
  -U <DB_USER> \
  -d <DB_NAME> \
  -F c -b -v \
  -f "marketplace_predeploy_$(date +%Y%m%d_%H%M%S).dump"
```

### Restore Procedure
In case of severe schema corruption or critical deployment failure:

```bash
# Restore from binary dump with clean overwrite
pg_restore \
  -h <DB_HOST> \
  -p <DB_PORT> \
  -U <DB_USER> \
  -d <DB_NAME> \
  --clean \
  --if-exists \
  -v "marketplace_predeploy_YYYYMMDD_HHMMSS.dump"
```

---

## 5. Uploads Storage Persistence

The application serves user-generated media (product photos, review attachments) from:
```
/app/wwwroot/uploads
```

### Storage Requirements
1. **Persistent Volume Mount**: A persistent volume or cloud storage mount must be bound to `/app/wwwroot/uploads`.
2. **Permissions**: The runtime container user must have read/write access to `/app/wwwroot/uploads`.
3. **Container Restarts**: Ephemeral container storage will destroy uploaded user images if a persistent volume is not mounted.

#### Docker Compose Example:
```yaml
services:
  backend:
    image: marketplace-api:latest
    volumes:
      - uploads_data:/app/wwwroot/uploads
volumes:
  uploads_data:
    driver: local
```

---

## 6. Health Check Endpoint

### Endpoint Details
- **Route**: `GET /api/health`
- **Authentication**: None (Public)
- **Response**: HTTP 200 OK
```json
{
  "status": "Healthy"
}
```

### Cloud Orchestrator Configuration
- **Liveness Probe**: `GET /api/health`, Initial Delay: 10s, Period: 15s, Timeout: 3s
- **Readiness Probe**: `GET /api/health`, Initial Delay: 5s, Period: 10s, Timeout: 3s

---

## 7. Rollback Strategy

If a deployment fails validation tests:

1. **Application Rollback**:
   - Revert container image tag to the previous stable release SHA in your PaaS/Kubernetes manifest.
   - The health check probe prevents traffic routing to faulty instances.

2. **Database Rollback**:
   - **Additive Migrations** (new nullable columns, new tables): No database rollback needed. The previous application release remains fully compatible.
   - **Breaking Migrations**: Restore the database from the pre-deployment `pg_dump` taken in Step 4:
     ```bash
     pg_restore -h <DB_HOST> -p <DB_PORT> -U <DB_USER> -d <DB_NAME> --clean --if-exists -v marketplace_predeploy_backup.dump
     ```
3. **Verify Health**:
   - Query `GET /api/health` to confirm the restored release is serving requests.
