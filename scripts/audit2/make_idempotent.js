const fs = require('fs');

const sqlPath = 'scripts/audit2/MarketplaceMVP-Complete-Upgrade.sql';
let content = fs.readFileSync(sqlPath, 'utf8');

// 1. Ensure no UTF-8 BOM
if (content.charCodeAt(0) === 0xFEFF) {
  content = content.substring(1);
}

const lines = content.split(/\r?\n/);
const newLines = [];

let colCount = 0;
let tableCount = 0;
let indexCount = 0;
let fkCount = 0;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  // A. Replace CREATE TABLE "..." with CREATE TABLE IF NOT EXISTS "..."
  if (/^\s*CREATE TABLE\s+"[^"]+"/.test(line) && !line.includes('IF NOT EXISTS')) {
    line = line.replace(/CREATE TABLE\s+("[^"]+")/, 'CREATE TABLE IF NOT EXISTS $1');
    tableCount++;
  }

  // B. Replace CREATE INDEX "..." with CREATE INDEX IF NOT EXISTS "..."
  if (/^\s*CREATE INDEX\s+"[^"]+"/.test(line) && !line.includes('IF NOT EXISTS')) {
    line = line.replace(/CREATE INDEX\s+("[^"]+")/, 'CREATE INDEX IF NOT EXISTS $1');
    indexCount++;
  }

  // C. Replace CREATE UNIQUE INDEX "..." with CREATE UNIQUE INDEX IF NOT EXISTS "..."
  if (/^\s*CREATE UNIQUE INDEX\s+"[^"]+"/.test(line) && !line.includes('IF NOT EXISTS')) {
    line = line.replace(/CREATE UNIQUE INDEX\s+("[^"]+")/, 'CREATE UNIQUE INDEX IF NOT EXISTS $1');
    indexCount++;
  }

  // D. Replace ALTER TABLE "..." ADD "..." (columns) with ALTER TABLE "..." ADD COLUMN IF NOT EXISTS "..."
  if (/ALTER TABLE\s+"[^"]+"\s+ADD\s+"[^"]+"/.test(line) && !line.includes('ADD CONSTRAINT')) {
    line = line.replace(/ALTER TABLE\s+("[^"]+")\s+ADD\s+("[^"]+")/, 'ALTER TABLE $1 ADD COLUMN IF NOT EXISTS $2');
    colCount++;
  }

  // E. Safe guard ADD CONSTRAINT: wrap with IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '...')
  // Example: ALTER TABLE "Products" ADD CONSTRAINT "FK_Products_Categories_CategoryId" FOREIGN KEY ("CategoryId") REFERENCES "Categories" ("Id") ON DELETE RESTRICT;
  const fkMatch = line.match(/^\s*ALTER TABLE\s+("[^"]+")\s+ADD CONSTRAINT\s+("[^"]+")\s+(.*);/);
  if (fkMatch && !lines[Math.max(0, i - 1)].includes('pg_constraint')) {
    const tbl = fkMatch[1];
    const cName = fkMatch[2].replace(/"/g, '');
    const rest = fkMatch[3];
    line = `    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${cName}') THEN\n        ALTER TABLE ${tbl} ADD CONSTRAINT "${cName}" ${rest};\n    END IF;`;
    fkCount++;
  }

  newLines.push(line);
}

const result = newLines.join('\n');
fs.writeFileSync(sqlPath, result, 'utf8');

console.log(`Transformed:
  - Columns (ADD COLUMN IF NOT EXISTS): ${colCount}
  - Tables (CREATE TABLE IF NOT EXISTS): ${tableCount}
  - Indexes (CREATE INDEX IF NOT EXISTS): ${indexCount}
  - Foreign Keys (pg_constraint guards): ${fkCount}
`);
