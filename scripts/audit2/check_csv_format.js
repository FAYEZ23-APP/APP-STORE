const fs = require('fs');
const path = require('path');

const csvPath = path.resolve(__dirname, '../../docs/audit2/gaps.csv');
const lines = fs.readFileSync(csvPath, 'utf8').split('\n');
console.log('Total lines:', lines.length);

lines.forEach((l, idx) => {
  if (!l.trim()) return;
  let inQuotes = false;
  let commas = 0;
  for (let i = 0; i < l.length; i++) {
    if (l[i] === '"') inQuotes = !inQuotes;
    else if (l[i] === ',' && !inQuotes) commas++;
  }
  const cols = commas + 1;
  if (cols !== 11) {
    console.log(`Line ${idx + 1} has ${cols} columns: ${l.slice(0, 70)}...`);
  }
});
