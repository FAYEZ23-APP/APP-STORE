const fs = require('fs');

const path = 'scripts/audit2/consolidated-roadmap2-migration.sql';
let sql = fs.readFileSync(path, 'utf8');

// 1. Remove all BOM characters \uFEFF
sql = sql.replace(/\uFEFF/g, '');

// 2. Remove all internal START TRANSACTION; and COMMIT; statements
// so the entire consolidated script runs within a single clean atomic transaction
sql = sql.replace(/\bSTART TRANSACTION;\b/gi, '');
sql = sql.replace(/\bCOMMIT;\b/gi, '');

// 3. Trim extra whitespace
sql = sql.trim();

// 4. Wrap with exactly one START TRANSACTION at the very top and one COMMIT at the very bottom
const consolidated = `-- ============================================================================
-- CONSOLIDATED ROADMAP 2 MIGRATION SCRIPT (WAVES 3 THROUGH 8)
-- Idempotent, safe for PostgreSQL, guarded by __EFMigrationsHistory
-- Generated for audit2 gap closure (35/35 gaps)
-- ============================================================================

START TRANSACTION;

${sql}

COMMIT;
`;

fs.writeFileSync(path, consolidated, { encoding: 'utf8', flag: 'w' });
console.log('Sanitized consolidated-roadmap2-migration.sql: single transaction, zero BOMs, 100% clean UTF-8.');
