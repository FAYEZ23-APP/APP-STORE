# Disaster Recovery & Encrypted Backup Runbook

**Project**: Egypt Shop (Marketplace MVP)  
**Database**: PostgreSQL 18 / `MarketplaceMVP`  
**Security Standard**: AES-256-GCM / WORM Storage / Egyptian Personal Data Protection Law 151/2020  
**Status**: Active Production Standard  

---

## 1. Business Continuity Objectives (RPO & RTO)

| Metric | Target | Method |
| :--- | :--- | :--- |
| **Recovery Point Objective (RPO)** | **$\le 15$ minutes** (with WAL archiving)<br>or **$\le 24$ hours** (daily snapshot) | Continuous PostgreSQL Write-Ahead Log (WAL) archiving to immutable object storage, plus daily encrypted full snapshots. |
| **Recovery Time Objective (RTO)** | **$\le 30$ minutes** | Automated decryption, integrity check, parallel `pg_restore` schema and data load into target instance. |

---

## 2. Backup Architecture & Encryption Specifications

```
                     ┌──────────────────────────────────────────────┐
                     │              PostgreSQL 18                   │
                     │             "MarketplaceMVP"                 │
                     └──────────────────────┬───────────────────────┘
                                            │
                                            ▼ (pg_dump -Fc -Z 9)
                                    [Unencrypted Stream]
                                            │
                                            ▼
                           ┌──────────────────────────────────┐
                           │   AES-256-GCM Encryption Engine  │
                           │   - 256-bit Key (Environment)    │
                           │   - 96-bit Random Nonce (IV)     │
                           │   - 128-bit Authentication Tag   │
                           └────────────────┬─────────────────┘
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    ▼                                               ▼
         [marketplace_backup.dump.enc]                  [marketplace_backup.meta.json]
         (Encrypted Binary Artifact)                    (Cryptographic Manifest)
         - Raw ciphertext                               - Backup UUID & Timestamps
         - Unreadable without key                       - SHA-256 Checksum
                                                        - Nonce & Auth Tag
                                                        - Key Fingerprint & Retention
                    │                                               │
                    └───────────────────────┬───────────────────────┘
                                            ▼
                           ┌──────────────────────────────────┐
                           │   Offsite WORM Object Storage    │
                           │  - AWS S3 / Azure Blob / GCS     │
                           │  - Object Lock (Immutable 30d)   │
                           └──────────────────────────────────┘
```

### 2.1 Encryption Standard
- **Algorithm**: `AES-256-GCM` (Authenticated Encryption with Associated Data).
- **Key Management**:
  - The 256-bit master key is supplied via `BACKUP_ENCRYPTION_KEY` from an isolated secret manager (AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault).
  - The encryption key is **never stored** inside the backup directory or database host.
  - A SHA-256 key fingerprint (first 16 hex characters) is recorded in the metadata manifest to identify the key without revealing any secret material.
- **Integrity & Authenticity**:
  - SHA-256 hash calculated over the complete encrypted binary artifact.
  - 16-byte AES-GCM authentication tag verifies ciphertext authenticity; any bit alteration causes immediate decryption failure.

---

## 3. Grandfather-Father-Son (GFS) Retention Policy

Backups are classified and retained across three tiers:

| Tier | Cadence | Retention Window | Purpose |
| :--- | :--- | :--- | :--- |
| **Daily (Son)** | Every 24 hours | **7 Days** | Daily operational recovery and rollback capability. |
| **Weekly (Father)** | Every Sunday 02:00 UTC | **4 Weeks** | Medium-term defect remediation and rollback. |
| **Monthly (Grandfather)**| 1st day of month 02:00 UTC | **12 Months** | Statutory financial accounting and annual audit requirements. |

Automated pruning (`pruneBackups`) evaluates the `retentionExpiry` timestamp in `.meta.json` and purges expired artifacts without deleting protected weekly or monthly tiers.

---

## 4. Offsite & Immutable Storage (WORM Configuration)

To protect against ransomware and catastrophic datacenter loss:
1. **Immutable Object Lock**:
   - S3 Bucket / Azure Blob / GCS configured with **Compliance Mode Object Lock**.
   - Retention period: 30 days lock (cannot be overwritten or deleted even by the root cloud account).
2. **Replication Command**:
   ```bash
   # AWS S3 with Object Lock
   aws s3 sync /var/backups/marketplace s3://marketplace-backups-immutable/ \
       --object-lock-mode COMPLIANCE \
       --object-lock-retain-until-date $(date -d "+30 days" --iso-8601=seconds)

   # Azure Blob with Immutable Storage
   azcopy sync "/var/backups/marketplace" "https://<storage>.blob.core.windows.net/backups?<sas-token>"
   ```

---

## 5. Synchronized User Uploads & Private Document Backups

Marketplace uploaded files must be synchronized atomically alongside database snapshots:
- **Public Product Images**: `Marketplace.API/wwwroot/uploads/products`
- **Merchant Verification Documents**: `Marketplace.API/App_Data/merchant-documents`
- **Private Dispute & Return Evidence**: `Marketplace.API/App_Data/disputes`

### Synchronization Procedure:
```powershell
# Sync media storage to encrypted staging archive
robocopy "D:\Backend\marketplace\backend\Marketplace.API\wwwroot\uploads" "D:\Backend\marketplace\backups\uploads" /MIR /R:2 /W:5
# Encrypt and package
tar -czf - -C "D:\Backend\marketplace\backups\uploads" . | openssl enc -aes-256-gcm -pbkdf2 -out "D:\Backend\marketplace\backups\uploads_backup_$(Get-Date -Format 'yyyyMMdd').tar.gz.enc"
```

---

## 6. Point-in-Time Recovery (PITR) Guide

For transactional consistency down to the second:

### 6.1 Enabling Continuous WAL Archiving (`postgresql.conf`):
```ini
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /var/wal_archive/%f && cp %p /var/wal_archive/%f'
archive_timeout = 900  # 15 minutes max WAL latency
```

### 6.2 Performing Point-in-Time Recovery:
1. Stop PostgreSQL service: `systemctl stop postgresql`.
2. Move damaged data directory to a safety location: `mv /var/lib/postgresql/18/main /var/lib/postgresql/18/main_damaged`.
3. Restore the most recent daily encrypted base backup via `restore-drill-encrypted.ps1`.
4. Create `recovery.signal` in the PostgreSQL data directory.
5. In `postgresql.conf`, specify:
   ```ini
   restore_command = 'cp /var/wal_archive/%f %p'
   recovery_target_time = '2026-11-07 14:30:00 UTC'
   recovery_target_action = 'promote'
   ```
6. Start PostgreSQL service: `systemctl start postgresql`.
7. PostgreSQL replays WAL files up to the target time and automatically promotes the database.

---

## 7. Disaster Recovery Step-by-Step Runbook (Emergency Restores)

### Incident Response Steps for On-Call Engineers:

#### Step 1: Declare Incident & Lock Inbound Traffic
- Notify the incident team.
- Route maintenance page at CDN/Ingress layer (`HTTP 503 Maintenance`).

#### Step 2: Locate Known-Good Encrypted Backup Artifact
- Identify the latest clean backup in the offsite or local backup directory:
  ```powershell
  Get-ChildItem -Path "backups\*.meta.json" | Get-Content | ConvertFrom-Json | Select-Object backupId, databaseName, createdAt, sha256
  ```

#### Step 3: Run Disaster Recovery Restore Drill
- Execute the tested drill script targeting the scratch test database first:
  ```powershell
  .\scripts\restore-drill-encrypted.ps1 -BackupEncFile "backups\marketplace_backup_MarketplaceMVP_20261107_020000.dump.enc" -DrillDbName "MarketplaceMVP_restore_test"
  ```
- Verify: Table count $\ge 30$, migrations $\ge 30$, Users and Orders sanity verified.

#### Step 4: Perform Production Database Restoration
- Ensure application backend instances are stopped (`Stop-Service marketplace-api`).
- Restore the clean decrypted archive into the primary database:
  ```bash
  pg_restore -h <db_host> -p 5432 -U marketplace_backup -d MarketplaceMVP --clean --if-exists --no-owner --no-privileges decrypted_backup.dump
  ```

#### Step 5: Post-Restore Sanity Checks
- Verify database connectivity: `GET /api/health` returns `200 OK` and `"database": "Connected"`.
- Verify user login and recent transactions:
  - Check latest order ID: `SELECT max("Id") FROM "Orders";`
  - Check wallet balances: `SELECT sum("Balance") FROM "BuyerWallets";`
- Review administrative audit logs: `SELECT * FROM "AdminAuditLogs" ORDER BY "Timestamp" DESC LIMIT 5;`

#### Step 6: Resume Service & Post-Mortem
- Re-enable API instances and lift CDN maintenance mode.
- Schedule post-incident review and verify zero data corruption.
