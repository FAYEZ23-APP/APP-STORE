const fs = require('fs');

let raw = fs.readFileSync('scripts/audit2/catalog_inventory_output.txt');
let catalog = (raw[0] === 0xff && raw[1] === 0xfe) ? raw.toString('utf16le') : raw.toString('utf8');

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

// 1. Columns
const colLines = sections['COLUMNS'] || [];
const columns = [];
for (const line of colLines) {
    if (line.includes('---+---') || line.includes('table_name') || line.includes('rows)')) continue;
    const p = line.split('|').map(s => s.trim());
    if (p.length >= 10) {
        columns.push({
            table: p[0],
            column: p[1],
            ordinal: parseInt(p[2], 10),
            dataType: p[3],
            udtName: p[4],
            maxLength: p[5] ? parseInt(p[5], 10) : null,
            precision: p[6] ? parseInt(p[6], 10) : null,
            scale: p[7] ? parseInt(p[7], 10) : null,
            isNullable: p[8] === 'YES',
            columnDefault: p[9] || null
        });
    }
}

// 2. Foreign keys
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

// 3. Indexes
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

console.log('=== SUMMARY OF LIVE CATALOG ===');
console.log(`Total columns: ${columns.length}`);
console.log(`Total FKs: ${fks.length}`);
console.log(`Total Indexes: ${indexes.length}`);

// Check FKs without an index on the leading column
console.log('\n=== FK INDEX CHECK ===');
for (const fk of fks) {
    // Look for an index on fk.table whose definition includes fk.column
    // Notice leading column matters most for FK index
    const matchingIdx = indexes.filter(idx => {
        if (idx.table !== fk.table) return false;
        // check if index definition covers this column
        const regex = new RegExp(`\\("${fk.column}"`, 'i');
        return regex.test(idx.def);
    });
    if (matchingIdx.length === 0) {
        console.log(`[MISSING FK INDEX] Table: ${fk.table}, Column: ${fk.column} -> references ${fk.foreignTable}.${fk.foreignColumn}`);
    } else {
        // Check if leading column
        const leadingRegex = new RegExp(`USING btree \\("${fk.column}"`, 'i');
        const isLeading = matchingIdx.some(idx => leadingRegex.test(idx.def));
        if (!isLeading) {
            console.log(`[NON-LEADING FK INDEX] Table: ${fk.table}, Column: ${fk.column} is NOT leading in index: ${matchingIdx.map(i=>i.name).join(', ')}`);
        }
    }
}

// Check Money columns
console.log('\n=== MONEY / DECIMAL COLUMNS ===');
const moneyCols = columns.filter(c => c.dataType === 'numeric' || c.dataType.includes('decimal') || c.udtName === 'numeric');
for (const c of moneyCols) {
    console.log(`- ${c.table}.${c.column} : ${c.dataType}(${c.precision},${c.scale}), Nullable: ${c.isNullable}, Default: ${c.columnDefault}`);
}

// Check Timestamp columns
console.log('\n=== TIMESTAMP COLUMNS ===');
const timeCols = columns.filter(c => c.dataType.includes('timestamp'));
for (const c of timeCols) {
    console.log(`- ${c.table}.${c.column} : ${c.dataType} (${c.udtName}), Nullable: ${c.isNullable}`);
}

// Check Text / String columns (unbounded text or varchar)
console.log('\n=== UNBOUNDED TEXT / JSON COLUMNS ===');
const unboundedCols = columns.filter(c => c.dataType === 'text' || (c.dataType === 'character varying' && !c.maxLength));
for (const c of unboundedCols) {
    console.log(`- ${c.table}.${c.column} : ${c.dataType}, Nullable: ${c.isNullable}`);
}
