const fs = require('fs');
const path = require('path');

const migrationsDir = 'backend/Marketplace.Infrastructure/Data/Migrations';
const files = fs.readdirAll ? [] : fs.readdirSync(migrationsDir).filter(f => f.endsWith('.cs') && !f.endsWith('.Designer.cs') && f !== 'AppDbContextModelSnapshot.cs');

console.log(`Found ${files.length} migration files.\n`);

const results = [];

for (const file of files.sort()) {
    const fullPath = path.join(migrationsDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');

    // Check Down method
    const downMatch = content.match(/protected override void Down\(MigrationBuilder migrationBuilder\)[\s\S]*?\{([\s\S]*?)\n    \}/);
    const downBody = downMatch ? downMatch[1].trim() : '';

    // Check destructive ops
    const dropTableMatches = [...content.matchAll(/migrationBuilder\.DropTable\([^)]+\)/g)].map(m => m[0]);
    const dropColumnMatches = [...content.matchAll(/migrationBuilder\.DropColumn\([^)]+\)/g)].map(m => m[0]);
    const dropIndexMatches = [...content.matchAll(/migrationBuilder\.DropIndex\([^)]+\)/g)].map(m => m[0]);
    const rawSqlMatches = [...content.matchAll(/migrationBuilder\.Sql\("([^"]+)"\)/g)].map(m => m[1]);

    // Check locks: CreateIndex without concurrently (EF default)
    const createIndexMatches = [...content.matchAll(/migrationBuilder\.CreateIndex\(/g)].map(m => m[0]);

    // Check non-nullable columns added without default
    const addColumnMatches = [...content.matchAll(/migrationBuilder\.AddColumn<[^>]+>\(\s*name:\s*"([^"]+)",\s*table:\s*"([^"]+)",(?:[\s\S]*?nullable:\s*(false|true))?(?:[\s\S]*?defaultValue(?:Sql)?:\s*([^,)]+))?/g)];
    const riskyAddColumns = [];
    for (const ac of addColumnMatches) {
        const colName = ac[1];
        const tableName = ac[2];
        const isNullable = ac[3] === 'true';
        const hasDefault = !!ac[4];
        if (!isNullable && !hasDefault) {
            riskyAddColumns.push({ colName, tableName });
        }
    }

    results.push({
        file,
        dropTableCount: dropTableMatches.length,
        dropColumnCount: dropColumnMatches.length,
        dropIndexCount: dropIndexMatches.length,
        dropIndexes: dropIndexMatches,
        rawSqlCount: rawSqlMatches.length,
        rawSqls: rawSqlMatches,
        riskyAddColumns,
        downEmpty: downBody.length === 0,
        downThrows: downBody.includes('throw new') || downBody.includes('NotSupportedException'),
        downDropsTables: (downBody.match(/migrationBuilder\.DropTable/g) || []).length,
        downDropsColumns: (downBody.match(/migrationBuilder\.DropColumn/g) || []).length
    });
}

for (const r of results) {
    console.log(`=== ${r.file} ===`);
    console.log(`- Destructive ops: DropTable=${r.dropTableCount}, DropColumn=${r.dropColumnCount}, DropIndex=${r.dropIndexCount}`);
    if (r.dropIndexCount > 0) {
        console.log(`  Dropped Indexes: ${r.dropIndexes.join('; ')}`);
    }
    if (r.rawSqlCount > 0) {
        console.log(`  Raw SQL statements: ${r.rawSqls.join('; ')}`);
    }
    if (r.riskyAddColumns.length > 0) {
        console.log(`  Risky AddColumn (NOT NULL without default): ${r.riskyAddColumns.map(c=>`${c.tableName}.${c.colName}`).join(', ')}`);
    }
    console.log(`- Down() Safety: Empty=${r.downEmpty}, Throws=${r.downThrows}, DropsTables=${r.downDropsTables}, DropsColumns=${r.downDropsColumns}`);
}
