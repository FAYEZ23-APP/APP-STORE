const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../src');
const hrefRegex = /href\s*=\s*(?:\{([^}]+)\}|"([^"]+)"|'([^']+)')/g;

const matches = [];

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanDir(full);
    } else if (/\.(jsx?|tsx?)$/.test(f)) {
      const content = fs.readFileSync(full, 'utf8');
      let m;
      while ((m = hrefRegex.exec(content)) !== null) {
        const value = m[1] || m[2] || m[3];
        matches.push({
          file: path.relative(path.resolve(__dirname, '..'), full).replace(/\\/g, '/'),
          val: value.trim(),
        });
      }
    }
  }
}

scanDir(srcDir);
console.log(`Found ${matches.length} href occurrences:`);
matches.forEach((m, i) => {
  console.log(`[${i + 1}] ${m.file} -> href=${m.val}`);
});
