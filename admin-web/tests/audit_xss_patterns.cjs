const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../src');
const patterns = [
  'dangerouslySetInnerHTML',
  'innerHTML',
  'outerHTML',
  'insertAdjacentHTML',
  'eval(',
  'new Function',
  'javascript:',
];

const matches = [];

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanDir(full);
    } else if (/\.(jsx?|tsx?|html)$/.test(f)) {
      const content = fs.readFileSync(full, 'utf8');
      for (const p of patterns) {
        if (content.includes(p)) {
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.includes(p)) {
              matches.push({
                file: path.relative(path.resolve(__dirname, '..'), full).replace(/\\/g, '/'),
                line: idx + 1,
                pattern: p,
                text: line.trim(),
              });
            }
          });
        }
      }
    }
  }
}

console.log('Scanning src directory for unsafe patterns...');
scanDir(srcDir);

console.log(`Scan completed. Found ${matches.length} occurrences.`);
matches.forEach((m, i) => {
  console.log(`[${i + 1}] ${m.pattern} at ${m.file}:${m.line}`);
  console.log(`    Content: ${m.text.slice(0, 120)}`);
});
