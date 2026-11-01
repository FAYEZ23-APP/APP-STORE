const fs = require('fs');

const allMigrations = fs.readFileSync('scripts/audit2/all-migrations.sql', 'utf8');

let raw = fs.readFileSync('scripts/audit2/catalog_inventory_output.txt');
let catalog = (raw[0] === 0xff && raw[1] === 0xfe) ? raw.toString('utf16le') : raw.toString('utf8');

// Parse indexes from all-migrations.sql
// EF produces: CREATE [UNIQUE] INDEX "Name" ON "Table" (...) [WHERE ...];
const idxRegex = /CREATE\s+(UNIQUE\s+)?INDEX\s+"([^"]+)"\s+ON\s+"([^"]+)"\s*\(([^)]+)\)(?:\s+WHERE\s+([^;]+))?/g;
let match;
const sqlIndexes = {};
while ((match = idxRegex.exec(allMigrations)) !== null) {
    sqlIndexes[match[2]] = {
        unique: !!match[1],
        name: match[2],
        table: match[3],
        columns: match[4].replace(/"/g, '').replace(/\s+/g, ''),
        filter: match[5] ? match[5].trim() : null
    };
}

console.log('Indexes in migration SQL:', Object.keys(sqlIndexes).length);

// Parse indexes from live catalog
const idxLines = catalog.split('=== INDEXES ===')[1].split('=== CHECK CONSTRAINTS ===')[0].split(/\r?\n/);
const liveIndexes = {};
for (const line of idxLines) {
    if (line.includes('---+---') || line.includes('tablename') || line.includes('rows)')) continue;
    const parts = line.split('|').map(s => s.trim());
    if (parts.length >= 3) {
        liveIndexes[parts[1]] = {
            table: parts[0],
            name: parts[1],
            def: parts[2]
        };
    }
}
console.log('Indexes in Live TEST_DB:', Object.keys(liveIndexes).length);

// Compare
for (const name of Object.keys(sqlIndexes)) {
    if (!liveIndexes[name]) {
        console.log(`[INDEX MISSING IN LIVE] ${name} on ${sqlIndexes[name].table}`);
    }
}

for (const name of Object.keys(liveIndexes)) {
    if (name.startsWith('PK_')) continue; // PKs are constraints
    if (!sqlIndexes[name]) {
        console.log(`[INDEX EXTRA IN LIVE] ${name} on ${liveIndexes[name].table}`);
    }
}
