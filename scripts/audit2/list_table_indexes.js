const fs = require('fs');

let raw = fs.readFileSync('scripts/audit2/catalog_inventory_output.txt');
let catalog = (raw[0] === 0xff && raw[1] === 0xfe) ? raw.toString('utf16le') : raw.toString('utf8');

const idxSection = catalog.split('=== INDEXES ===')[1].split('=== CHECK CONSTRAINTS ===')[0];
const lines = idxSection.split(/\r?\n/);

const tableIndexes = {};
for (const line of lines) {
    if (line.includes('---+---') || line.includes('tablename') || line.includes('rows)')) continue;
    const parts = line.split('|').map(s => s.trim());
    if (parts.length >= 3) {
        const table = parts[0];
        const name = parts[1];
        const def = parts[2];
        if (!tableIndexes[table]) tableIndexes[table] = [];
        tableIndexes[table].push({ name, def });
    }
}

for (const [table, idxs] of Object.entries(tableIndexes)) {
    console.log(`\n### ${table} (${idxs.length} indexes)`);
    for (const idx of idxs) {
        console.log(`- **${idx.name}**: \`${idx.def}\``);
    }
}
