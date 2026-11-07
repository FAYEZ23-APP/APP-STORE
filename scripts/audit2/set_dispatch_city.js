const fs = require('fs');
let content = fs.readFileSync('backend/tests/test_wave7_features_postgres.js', 'utf8');

const target = 'sellerId = me.body.id;\n    }';
const addition = `sellerId = me.body.id;
    }

    // Set DispatchCity for seller in PostgreSQL
    runPsql(connStr, \`UPDATE "Users" SET "DispatchCity" = 'القاهرة' WHERE "Id" = \${sellerId};\`);`;

content = content.replace(target, addition);
fs.writeFileSync('backend/tests/test_wave7_features_postgres.js', content, 'utf8');
console.log('Added seller DispatchCity update.');
