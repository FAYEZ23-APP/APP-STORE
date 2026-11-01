const fs = require('fs');

// Read snapshot
const snapshot = fs.readFileSync('backend/Marketplace.Infrastructure/Data/Migrations/AppDbContextModelSnapshot.cs', 'utf8');

// Read all-migrations.sql
const allMigrations = fs.readFileSync('scripts/audit2/all-migrations.sql', 'utf8');

// Read catalog output
let raw = fs.readFileSync('scripts/audit2/catalog_inventory_output.txt');
let catalog = (raw[0] === 0xff && raw[1] === 0xfe) ? raw.toString('utf16le') : raw.toString('utf8');

// Extract tables from snapshot
const modelEntityRegex = /modelBuilder\.Entity\("Marketplace\.Domain\.Entities\.([A-Za-z0-9]+)"/g;
let match;
const snapshotEntities = [];
while ((match = modelEntityRegex.exec(snapshot)) !== null) {
    snapshotEntities.push(match[1]);
}

console.log('Snapshot entities count:', snapshotEntities.length, snapshotEntities);

// Tables in all-migrations.sql
const createTableRegex = /CREATE TABLE "([A-Za-z0-9_]+)"/g;
const migrationTables = [];
while ((match = createTableRegex.exec(allMigrations)) !== null) {
    if (!migrationTables.includes(match[1])) {
        migrationTables.push(match[1]);
    }
}
console.log('Migration tables count:', migrationTables.length, migrationTables);

// Check FKs in all-migrations.sql
const fkSqlRegex = /CONSTRAINT "([^"]+)" FOREIGN KEY \("([^"]+)"\) REFERENCES "([^"]+)" \("([^"]+)"\)(?: ON DELETE ([A-Z ]+))?/g;
const sqlFks = [];
while ((match = fkSqlRegex.exec(allMigrations)) !== null) {
    sqlFks.push({
        constraint: match[1],
        column: match[2],
        foreignTable: match[3],
        foreignColumn: match[4],
        onDelete: match[5] || 'NO ACTION'
    });
}
console.log('Migration SQL FKs count:', sqlFks.length);

// Compare FK on delete between all-migrations.sql and catalog
const fkLines = catalog.split('=== FOREIGN KEYS WITH ON UPDATE / ON DELETE ===')[1].split('=== INDEXES ===')[0].split(/\r?\n/);
const liveFks = {};
for (const line of fkLines) {
    if (line.includes('---+---') || line.includes('table_name') || line.includes('rows)')) continue;
    const parts = line.split('|').map(s => s.trim());
    if (parts.length >= 7) {
        liveFks[parts[2]] = {
            table: parts[0],
            column: parts[1],
            foreignTable: parts[3],
            deleteRule: parts[6]
        };
    }
}

console.log('\n=== COMPARING FK ON DELETE (MIGRATION SCRIPT vs LIVE TEST_DB) ===');
for (const sfk of sqlFks) {
    const live = liveFks[sfk.constraint];
    if (!live) {
        console.log(`[FK MISSING IN LIVE] ${sfk.constraint}`);
    } else {
        const sqlDel = sfk.onDelete.trim();
        const liveDel = live.deleteRule.trim();
        if (sqlDel !== liveDel) {
            console.log(`[FK ON DELETE MISMATCH] ${sfk.constraint} on ${live.table}.${live.column}: SQL=${sqlDel} vs Live=${liveDel}`);
        }
    }
}
