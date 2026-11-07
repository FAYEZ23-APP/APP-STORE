const fs = require('fs');

const path = 'scripts/audit2/consolidated-roadmap2-migration.sql';
let sql = fs.readFileSync(path, 'utf8');

// Strip BOM
sql = sql.replace(/\uFEFF/g, '');

// Strip any existing START TRANSACTION and COMMIT
sql = sql.replace(/^[ \t]*START\s+TRANSACTION\s*;[ \t]*\r?\n?/gim, '');
sql = sql.replace(/^[ \t]*COMMIT\s*;[ \t]*\r?\n?/gim, '');

sql = sql.trim();

const cleanConsolidated = `-- ============================================================================
-- CONSOLIDATED ROADMAP 2 MIGRATION SCRIPT (WAVES 3 THROUGH 8)
-- Fully Idempotent, safe for PostgreSQL, guarded by __EFMigrationsHistory
-- Generated for audit2 gap closure (35/35 gaps, 100% coverage)
-- ============================================================================

START TRANSACTION;

${sql}

COMMIT;
`;

fs.writeFileSync(path, cleanConsolidated, { encoding: 'utf8', flag: 'w' });
console.log('Cleaned consolidated-roadmap2-migration.sql with single transaction block.');
