const fs = require('fs');
const path = require('path');

function getAllFiles(dir, exts = ['.js']) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, exts));
    } else {
      if (exts.includes(path.extname(file))) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const files = getAllFiles('mobile/src');
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((l, idx) => {
    if (l.includes('colors.accent') || l.includes('accentHover') || l.includes('accentSoft')) {
      console.log(`[${path.relative('mobile/src', f)}:${idx+1}] ${l.trim()}`);
    }
  });
});
