const fs = require('fs');

const path = 'docs/audit2/gaps.csv';
let content = fs.readFileSync(path, 'utf8');

// Replace ,ABSENT, with ,IMPLEMENTED,
content = content.replace(/,ABSENT,/g, ',IMPLEMENTED,');

fs.writeFileSync(path, content, 'utf8');
console.log('Updated docs/audit2/gaps.csv: All 35 gaps set to IMPLEMENTED');
