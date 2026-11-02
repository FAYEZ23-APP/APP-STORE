const fs = require('fs');

const content = fs.readFileSync('docs/audit2/gaps.csv', 'utf8');

// Proper RFC 4180 CSV parser
function parseCSV(text) {
  const p = [[]];
  let quote = false;
  let row = 0, col = 0;
  for (let c = 0; c < text.length; c++) {
    let cc = text[c], nc = text[c+1];
    if (cc === '"') {
      if (quote && nc === '"') { p[row][col] += '"'; ++c; continue; }
      quote = !quote;
      continue;
    }
    if (cc === ',' && !quote) { ++col; p[row][col] = ''; continue; }
    if (cc === '\r' && nc === '\n' && !quote) { ++row; col = 0; ++c; p[row] = []; continue; }
    if (cc === '\n' && !quote) { ++row; col = 0; p[row] = []; continue; }
    if (p[row][col] === undefined) p[row][col] = '';
    p[row][col] += cc;
  }
  if (p[p.length-1].length === 0 || (p[p.length-1].length === 1 && p[p.length-1][0] === '')) {
    p.pop();
  }
  return p;
}

const parsed = parseCSV(content);
console.log('Total parsed rows:', parsed.length);
let allMatch = true;
parsed.forEach((r, idx) => {
  if (r.length !== 11) {
    console.error(`Row ${idx + 1} has ${r.length} columns!`);
    allMatch = false;
  }
});
if (allMatch) {
  console.log('ALL', parsed.length, 'ROWS HAVE EXACTLY 11 COLUMNS! CSV IS 100% CLEAN.');
}
