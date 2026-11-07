# PostgreSQL Backup & Disaster Recovery Infrastructure Audit

**Project**: Egypt Shop (Marketplace MVP)  
**Database**: PostgreSQL 18 (`MarketplaceMVP` / `MarketplaceMVP_test`)  
**Scope**: Backup, Recovery & Business Continuity  
**Audit Date**: 2026-11-07  

---

## 1. Executive Summary & Current State

An audit of the current database backup infrastructure, configuration, and disaster recovery readiness was conducted prior to implementing the Phase 5 hardened encrypted backup solution.

| Area | Current Status | Assessment | Severity / Gap |
| :--- | :--- | :--- | :--- |
| **Backup Automation** | Basic PowerShell script (`scripts/backup-db.ps1`) | Partially automated | **HIGH**: Produces unencrypted `.dump` files; no automated scheduling. |
| **Encryption at Rest** | None | Non-compliant | **CRITICAL**: Backup artifacts are plaintext PostgreSQL custom archives. If exfiltrated, PII, hashed passwords, and financial records are exposed. |
| **Integrity & Checksums** | Basic length check (`Length > 0`) | Inadequate | **HIGH**: No cryptographic hash (SHA-256) or manifest metadata; bitrot or partial writes cannot be detected reliably. |
| **Least Privilege Account** | Default `postgres` superuser used in scripts | Non-compliant | **HIGH**: No dedicated least-privilege backup role (`pg_read_all_data`). |
| **Credential Management** | `PGPASSWORD` environment variable | Acceptable | Avoids CLI arguments, but lacks formal key management for encryption. |
| **Retention Policy** | Infinite accumulation in `backups/` | Inadequate | **MEDIUM**: No automated pruning (Grandfather-Father-Son / Daily-Weekly-Monthly). Disk exhaustion risk over time. |
| **Restore Verification** | Basic restore drill script (`scripts/restore-drill.ps1`) | Basic | Works on unencrypted dumps; lacks cryptographic validation, integrity checks, or encrypted pipeline integration. |
| **Offsite & Immutable Storage**| Local disk only (`marketplace/backups`) | High Risk | **CRITICAL**: Backups reside on same filesystem/host. Vulnerable to host failure, ransomware, or disk corruption. |
| **User File Storage** | Local filesystem (`wwwroot/uploads`, `App_Data/disputes`) | Unsynchronized | **MEDIUM**: File attachments and private dispute docs are not backed up atomically alongside the database snapshot. |
| **Point-in-Time Recovery** | Not configured (`archive_mode = off`) | Incomplete | **HIGH**: In the event of a midday crash, transactions since the last daily backup are lost (RPO = up to 24 hours). |

---

## 2. Detailed Technical Audit

### 2.1 PostgreSQL Engine & Configuration
- **Version**: PostgreSQL 18.x on port 5432.
- **Database Architecture**: 34 public base tables and 31 EF Core migrations (`__EFMigrationsHistory`).
- **Connection Model**: Npgsql with pooled connections (`Minimum Pool Size=2;Maximum Pool Size=20`).
- **Sensitive Data Stored**:
  - `Users`: Salted BCrypt password hashes, two-factor encrypted secrets (`ENC:v1:` AES-GCM), emails, phones.
  - `RefreshTokens`: Token family tracking (`FamilyId`), SHA-256 token hashes, lifecycle audit records.
  - `Orders`, `OrderItems`, `Shipments`: Financial transaction histories, delivery addresses, carrier tracking numbers.
  - `VendorWallets`, `BuyerWallets`, `WalletTransactions`: Balances and real-money ledgers.
  - `AdminAuditLogs`, `PrivacyIncidentLogs`: Statutory audit trails and data protection compliance records.

### 2.2 Existing Script Analysis (`scripts/backup-db.ps1`)
- **Strengths**:
  - Uses `pg_dump -Fc` (PostgreSQL custom format with internal zlib compression).
  - Uses `--no-owner --no-privileges` to facilitate portability across database instances.
  - Validates `Length > 0` before declaring success.
  - Deletes target file if `pg_dump` exits with a non-zero exit code.
- **Vulnerabilities & Gaps**:
  1. **Zero Encryption**: Dump file contains readable transaction records, customer names, addresses, and phone numbers.
  2. **No Cryptographic Hash**: Cannot verify whether an artifact has been altered, truncated, or suffered disk corruption.
  3. **No Manifest / Metadata**: Operator cannot determine which user ran the backup, what PostgreSQL dump version was used, or the exact commit/state.
  4. **No Retention Logic**: Every run generates a timestamped file that remains indefinitely.
  5. **No Key Separation**: Since there is no encryption, there is no key separation architecture.

### 2.3 Existing Restore Drill Analysis (`scripts/restore-drill.ps1`)
- **Strengths**:
  - Enforces safety guard: `DrillDbName` must end with `_test`.
  - Recreates clean drill database using `psql` (`DROP DATABASE IF EXISTS`, `CREATE DATABASE`).
  - Restores using `pg_restore`.
  - Verifies minimum table count (`>= 25`) and migration count.
  - Drops the temporary drill database upon completion.
- **Vulnerabilities & Gaps**:
  1. Cannot restore encrypted backups.
  2. Does not verify SHA-256 checksum against a known manifest before restoration.
  3. Does not run sanity checks on specific financial tables (`Orders`, `VendorWallets`, `BuyerWallets`).

---

## 3. Remediation & Target Architecture (Phase 5)

To achieve business continuity, regulatory compliance (Egyptian Personal Data Protection Law 151/2020), and resilience against ransomware or hardware destruction, Phase 5 implements:

1. **Dedicated Least-Privilege Database Account**:
   - Create a dedicated role `marketplace_backup` with `LOGIN`, `pg_read_all_data`, `NOINHERIT`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`.
   - Block interactive logins, alter schema, or DDL operations.

2. **Automated AES-256-GCM Encrypted Backups**:
   - Pipeline: `pg_dump -Fc -Z 9` -> Stream to AES-256-GCM authenticated encryption -> Output `marketplace_backup_{DB}_{timestamp}.dump.enc`.
   - Separate 256-bit encryption key (`BACKUP_ENCRYPTION_KEY` or secure keyfile).
   - Generate companion `marketplace_backup_{DB}_{timestamp}.meta.json` recording backup ID (UUID), timestamps, sizes, SHA-256 checksum, GCM nonce, GCM tag, and key fingerprint.

3. **Automated Grandfather-Father-Son Retention**:
   - Daily backups retained for 7 days.
   - Weekly backups (Sundays) retained for 4 weeks.
   - Monthly backups (1st of month) retained for 12 months.
   - Automated pruning script evaluates `.meta.json` timestamps and safely removes expired unneeded backups.

4. **Cryptographically Verified Disaster Recovery Drill**:
   - Pre-restore verification: SHA-256 checksum recomputation and AES-GCM tag verification.
   - Decrypt to ephemeral stream/file, restore via `pg_restore` into `MarketplaceMVP_restore_test`.
   - Rigorous sanity queries: table counts, migration histories, foreign key integrity, and row count validations.
   - Automatic cleanup of scratch drill databases.

5. **Offsite & Immutable Replication & PITR Guidance**:
   - Architecture for replicating encrypted artifacts to cloud object storage (AWS S3 / Azure Blob / Google Cloud Storage) with Object Lock / WORM immutability.
   - WAL archiving configuration guide for sub-hour Recovery Point Objective (RPO).
   - Documented Runbook for emergency disaster recovery operations.
