const fs = require('fs');

let raw = fs.readFileSync('scripts/audit2/catalog_inventory_output.txt');
let catalog;
if (raw[0] === 0xff && raw[1] === 0xfe) {
    catalog = raw.toString('utf16le');
} else {
    catalog = raw.toString('utf8');
}

const sections = {};
let currentSection = null;
let lines = catalog.split(/\r?\n/);

for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('=== ') && trimmed.endsWith(' ===')) {
        currentSection = trimmed.replace(/===/g, '').trim();
        sections[currentSection] = [];
    } else if (currentSection && trimmed.length > 0) {
        sections[currentSection].push(trimmed);
    }
}

console.log('Available sections:', Object.keys(sections));

const tables = (sections['TABLES IN PUBLIC'] || [])
    .filter(l => !l.startsWith('---') && !l.startsWith('table_name') && !l.includes('rows)'))
    .map(l => l.trim());

console.log(`\nFound ${tables.length} tables in TEST_DB:`, tables);

const fkLines = sections['FOREIGN KEYS WITH ON UPDATE / ON DELETE'] || [];
const fks = [];
for (const line of fkLines) {
    if (line.includes('---+---') || line.includes('table_name') || line.includes('rows)')) continue;
    const parts = line.split('|').map(s => s.trim());
    if (parts.length >= 7) {
        fks.push({
            table: parts[0],
            column: parts[1],
            constraint: parts[2],
            foreignTable: parts[3],
            foreignColumn: parts[4],
            updateRule: parts[5],
            deleteRule: parts[6]
        });
    }
}

console.log(`\nFound ${fks.length} Foreign Keys:`);
for (const fk of fks) {
    console.log(`- ${fk.table}.${fk.column} -> ${fk.foreignTable}.${fk.foreignColumn} | ON DELETE ${fk.deleteRule} (${fk.constraint})`);
}

const idxLines = sections['INDEXES'] || [];
const indexes = [];
for (const line of idxLines) {
    if (line.includes('---+---') || line.includes('tablename') || line.includes('rows)')) continue;
    const parts = line.split('|').map(s => s.trim());
    if (parts.length >= 3) {
        indexes.push({
            table: parts[0],
            name: parts[1],
            def: parts[2]
        });
    }
}

console.log(`\nFound ${indexes.length} Indexes:`);
for (const idx of indexes) {
    console.log(`- ${idx.table} : ${idx.name} => ${idx.def}`);
}
