const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { findPostgresTool, parseConnectionString, runPsqlQuery } = require('../tests/helpers/pg_utils');

/**
 * Derives a 32-byte (256-bit) Buffer encryption key from an env var or string.
 * Supports raw 32-byte string, 64-char hex, or base64.
 */
function resolveEncryptionKey(keyInput) {
  const raw = keyInput || process.env.BACKUP_ENCRYPTION_KEY;
  if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error('BACKUP_ENCRYPTION_KEY is required and was not provided.');
  }

  const trimmed = raw.trim();
  // Check if hex
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  // Check if base64
  if (trimmed.length === 44 && /^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    const buf = Buffer.from(trimmed, 'base64');
    if (buf.length === 32) return buf;
  }
  // Otherwise derive 32-byte key using SHA-256
  return crypto.createHash('sha256').update(trimmed, 'utf8').digest();
}

/**
 * Calculates SHA-256 fingerprint for a key (first 16 hex chars)
 */
function getKeyFingerprint(keyBuf) {
  return crypto.createHash('sha256').update(keyBuf).digest('hex').substring(0, 16);
}

/**
 * Calculates SHA-256 checksum of a file.
 */
function calculateFileSha256(filePath) {
  const hash = crypto.createHash('sha256');
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

/**
 * Determines retention category and expiration date for a backup.
 */
function getRetentionMetadata(date = new Date()) {
  const isFirstOfMonth = date.getUTCDate() === 1;
  const isSunday = date.getUTCDay() === 0;

  if (isFirstOfMonth) {
    // Retain for 12 months (365 days)
    const expiresAt = new Date(date);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 365);
    return { category: 'monthly', expiresAt: expiresAt.toISOString() };
  } else if (isSunday) {
    // Retain for 4 weeks (28 days)
    const expiresAt = new Date(date);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 28);
    return { category: 'weekly', expiresAt: expiresAt.toISOString() };
  } else {
    // Retain for 7 days
    const expiresAt = new Date(date);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 7);
    return { category: 'daily', expiresAt: expiresAt.toISOString() };
  }
}

/**
 * Creates an AES-256-GCM encrypted PostgreSQL custom-format backup.
 */
function createEncryptedBackup({
  connStr,
  dbName,
  outputDir,
  encryptionKey,
  compressionLevel = 9,
  retentionPolicy = { dailyDays: 7, weeklyWeeks: 4, monthlyMonths: 12 },
}) {
  const parsedConn = parseConnectionString(connStr);
  const targetDb = dbName || parsedConn.database;

  if (!targetDb) {
    throw new Error('Database name could not be determined.');
  }

  const keyBuf = resolveEncryptionKey(encryptionKey);
  const keyFingerprint = getKeyFingerprint(keyBuf);
  const backupId = crypto.randomUUID();
  const now = new Date();
  const timestampStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);

  const resolvedOutputDir = path.resolve(outputDir || path.join(__dirname, '../../backups'));
  if (!fs.existsSync(resolvedOutputDir)) {
    fs.mkdirSync(resolvedOutputDir, { recursive: true });
  }

  const baseFileName = `marketplace_backup_${targetDb}_${timestampStr}_${backupId.slice(0, 8)}`;
  const tmpDumpPath = path.join(resolvedOutputDir, `${baseFileName}.tmp.dump`);
  const tmpEncPath = path.join(resolvedOutputDir, `${baseFileName}.tmp.enc`);
  const finalEncPath = path.join(resolvedOutputDir, `${baseFileName}.dump.enc`);
  const finalMetaPath = path.join(resolvedOutputDir, `${baseFileName}.meta.json`);

  const pgDump = findPostgresTool('pg_dump');
  const env = { ...process.env, PGPASSWORD: parsedConn.password };

  // Step 1: Run pg_dump
  const dumpArgs = [
    '-h', parsedConn.host,
    '-p', String(parsedConn.port),
    '-U', parsedConn.user,
    '-Fc',
    '-Z', String(compressionLevel),
    '--no-owner',
    '--no-privileges',
    '-f', tmpDumpPath,
    targetDb,
  ];

  const dumpRes = spawnSync(pgDump, dumpArgs, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (dumpRes.status !== 0) {
    if (fs.existsSync(tmpDumpPath)) fs.unlinkSync(tmpDumpPath);
    throw new Error(`pg_dump failed with exit code ${dumpRes.status}: ${dumpRes.stderr || dumpRes.stdout}`);
  }

  if (!fs.existsSync(tmpDumpPath) || fs.statSync(tmpDumpPath).size === 0) {
    if (fs.existsSync(tmpDumpPath)) fs.unlinkSync(tmpDumpPath);
    throw new Error('pg_dump produced an empty 0-byte file.');
  }

  const unencryptedSizeBytes = fs.statSync(tmpDumpPath).size;

  // Step 2: Encrypt with AES-256-GCM
  const iv = crypto.randomBytes(12); // 96-bit nonce
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);

  const unencryptedData = fs.readFileSync(tmpDumpPath);
  const ciphertextPart1 = cipher.update(unencryptedData);
  const ciphertextPart2 = cipher.final();
  const authTag = cipher.getAuthTag(); // 16-byte tag

  // Write temporary encrypted file
  const encryptedPayload = Buffer.concat([ciphertextPart1, ciphertextPart2]);
  fs.writeFileSync(tmpEncPath, encryptedPayload);

  // Remove temporary unencrypted dump immediately
  fs.unlinkSync(tmpDumpPath);

  // Atomically finalize encrypted file
  fs.renameSync(tmpEncPath, finalEncPath);

  const encryptedSizeBytes = fs.statSync(finalEncPath).size;
  const sha256Checksum = calculateFileSha256(finalEncPath);
  const retention = getRetentionMetadata(now);

  // Capture pg_dump version
  const verRes = spawnSync(pgDump, ['--version'], { encoding: 'utf8' });
  const pgDumpVersion = (verRes.stdout || '').trim();

  // Step 3: Write companion metadata manifest
  const manifest = {
    backupId,
    databaseName: targetDb,
    createdAt: now.toISOString(),
    pgDumpVersion,
    format: 'custom',
    compression: compressionLevel,
    unencryptedSizeBytes,
    encryptedSizeBytes,
    sha256: sha256Checksum,
    encryption: {
      algorithm: 'aes-256-gcm',
      nonce: iv.toString('base64'),
      tag: authTag.toString('base64'),
      keyFingerprint,
    },
    retentionCategory: retention.category,
    retentionExpiry: retention.expiresAt,
    exitCode: 0,
  };

  fs.writeFileSync(finalMetaPath, JSON.stringify(manifest, null, 2), 'utf8');

  // Step 4: Prune expired backups according to retention policy
  const prunedCount = pruneBackups(resolvedOutputDir);

  return {
    backupId,
    encFile: finalEncPath,
    metaFile: finalMetaPath,
    manifest,
    prunedCount,
  };
}

/**
 * Validates checksum, auth tag, and decrypts an encrypted backup artifact.
 */
function verifyAndDecryptBackup({ encFile, metaFile, encryptionKey, targetDecryptedFile }) {
  if (!fs.existsSync(encFile)) {
    throw new Error(`Encrypted backup file not found: ${encFile}`);
  }
  if (!fs.existsSync(metaFile)) {
    throw new Error(`Metadata manifest file not found: ${metaFile}`);
  }

  const manifest = JSON.parse(fs.readFileSync(metaFile, 'utf8'));

  // 1. Verify SHA-256 Checksum
  const actualSha256 = calculateFileSha256(encFile);
  if (actualSha256 !== manifest.sha256) {
    throw new Error(
      `Checksum verification failed! Manifest: ${manifest.sha256}, Actual: ${actualSha256}. Artifact is corrupted or tampered.`
    );
  }

  // 2. Resolve Key & Verify Fingerprint
  const keyBuf = resolveEncryptionKey(encryptionKey);
  const currentFingerprint = getKeyFingerprint(keyBuf);
  if (manifest.encryption.keyFingerprint && manifest.encryption.keyFingerprint !== currentFingerprint) {
    throw new Error(
      `Encryption key fingerprint mismatch! Expected: ${manifest.encryption.keyFingerprint}, Provided: ${currentFingerprint}`
    );
  }

  // 3. Decrypt with AES-256-GCM
  const iv = Buffer.from(manifest.encryption.nonce, 'base64');
  const tag = Buffer.from(manifest.encryption.tag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
  decipher.setAuthTag(tag);

  const encryptedData = fs.readFileSync(encFile);
  const decryptedPart1 = decipher.update(encryptedData);
  const decryptedPart2 = decipher.final(); // Throws if auth tag mismatch or wrong key
  const decryptedData = Buffer.concat([decryptedPart1, decryptedPart2]);

  // 4. Validate PostgreSQL custom dump magic bytes ("PGDMP" = 0x50 0x47 0x44 0x4D 0x50 0x01)
  if (
    decryptedData.length < 5 ||
    decryptedData.toString('ascii', 0, 5) !== 'PGDMP'
  ) {
    throw new Error('Decrypted content does not have a valid PostgreSQL custom dump header (PGDMP).');
  }

  fs.writeFileSync(targetDecryptedFile, decryptedData);
  return { manifest, decryptedBytes: decryptedData.length };
}

/**
 * Runs a complete disaster recovery restore drill against a scratch database (MUST end with _test).
 */
function runRestoreDrill({
  backupEncFile,
  metaFile,
  drillDbName = 'MarketplaceMVP_restore_test',
  connStr,
  encryptionKey,
  keepDrillDb = false,
}) {
  // CRITICAL SAFETY GUARD: Drill DB must end with _test (Rule 2 & 3)
  if (!drillDbName || !drillDbName.toLowerCase().endsWith('_test')) {
    throw new Error(`CRITICAL SAFETY ABORT: DrillDbName '${drillDbName}' does not end with '_test'.`);
  }

  const parsed = parseConnectionString(connStr);
  const safeDrillDb = drillDbName.toLowerCase();
  const tmpDecryptedDump = path.join(path.dirname(backupEncFile), `restore_drill_${Date.now()}.tmp.dump`);

  try {
    // 1. Verify and decrypt
    const { manifest } = verifyAndDecryptBackup({
      encFile: backupEncFile,
      metaFile,
      encryptionKey,
      targetDecryptedFile: tmpDecryptedDump,
    });

    // 2. Re-create clean drill database via psql
    runPsqlQuery(connStr, `DROP DATABASE IF EXISTS "${safeDrillDb}";`, 'postgres');
    runPsqlQuery(connStr, `CREATE DATABASE "${safeDrillDb}";`, 'postgres');

    // 3. Execute pg_restore
    const pgRestore = findPostgresTool('pg_restore');
    const env = { ...process.env, PGPASSWORD: parsed.password };
    const restoreArgs = [
      '-h', parsed.host,
      '-p', String(parsed.port),
      '-U', parsed.user,
      '-d', safeDrillDb,
      '--no-owner',
      '--no-privileges',
      tmpDecryptedDump,
    ];

    const restoreRes = spawnSync(pgRestore, restoreArgs, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    // pg_restore exit code 0 or 1 (warnings) is standard
    if (restoreRes.status !== 0 && restoreRes.status !== 1) {
      throw new Error(`pg_restore failed with exit code ${restoreRes.status}: ${restoreRes.stderr || restoreRes.stdout}`);
    }

    // 4. Verification Queries
    const tableCountStr = runPsqlQuery(
      connStr,
      "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';",
      safeDrillDb
    );
    const tableCount = parseInt(tableCountStr, 10) || 0;

    const migrationCountStr = runPsqlQuery(
      connStr,
      'SELECT count(*) FROM "__EFMigrationsHistory";',
      safeDrillDb
    );
    const migrationCount = parseInt(migrationCountStr, 10) || 0;

    // Check critical tables existence and count
    const usersCountStr = runPsqlQuery(connStr, 'SELECT count(*) FROM "Users";', safeDrillDb);
    const usersCount = parseInt(usersCountStr, 10) || 0;

    const productsCountStr = runPsqlQuery(connStr, 'SELECT count(*) FROM "Products";', safeDrillDb);
    const productsCount = parseInt(productsCountStr, 10) || 0;

    const tokensCountStr = runPsqlQuery(connStr, 'SELECT count(*) FROM "RefreshTokens";', safeDrillDb);
    const tokensCount = parseInt(tokensCountStr, 10) || 0;

    if (tableCount < 25) {
      throw new Error(`Restored database has only ${tableCount} tables (expected >= 25).`);
    }

    if (migrationCount < 20) {
      throw new Error(`Restored database has only ${migrationCount} migrations (expected >= 20).`);
    }

    return {
      success: true,
      drillDbName: safeDrillDb,
      backupId: manifest.backupId,
      tableCount,
      migrationCount,
      usersCount,
      productsCount,
      tokensCount,
      sha256Verified: true,
      authTagVerified: true,
    };
  } finally {
    if (fs.existsSync(tmpDecryptedDump)) {
      try { fs.unlinkSync(tmpDecryptedDump); } catch {}
    }
    if (!keepDrillDb) {
      try {
        runPsqlQuery(connStr, `DROP DATABASE IF EXISTS "${safeDrillDb}";`, 'postgres');
      } catch {}
    }
  }
}

/**
 * Prunes expired backups based on retention policy.
 * Preserves weekly (Sunday) and monthly (1st of month) backups according to policy tiers.
 */
function pruneBackups(backupsDir) {
  if (!fs.existsSync(backupsDir)) return 0;
  const now = new Date();
  let prunedCount = 0;

  const files = fs.readdirSync(backupsDir);
  const metaFiles = files.filter(f => f.endsWith('.meta.json'));

  for (const mf of metaFiles) {
    const metaPath = path.join(backupsDir, mf);
    try {
      const manifest = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (!manifest.retentionExpiry) continue;

      const expiryDate = new Date(manifest.retentionExpiry);
      if (now > expiryDate) {
        // Safe to prune
        const baseName = mf.replace(/\.meta\.json$/, '');
        const encPath = path.join(backupsDir, `${baseName}.dump.enc`);

        if (fs.existsSync(encPath)) {
          fs.unlinkSync(encPath);
        }
        fs.unlinkSync(metaPath);
        prunedCount++;
      }
    } catch {}
  }

  return prunedCount;
}

module.exports = {
  resolveEncryptionKey,
  getKeyFingerprint,
  calculateFileSha256,
  createEncryptedBackup,
  verifyAndDecryptBackup,
  runRestoreDrill,
  pruneBackups,
};
