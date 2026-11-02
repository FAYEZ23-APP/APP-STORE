const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../../mobile/src');

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

const jsFiles = getAllFiles(srcDir);
jsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((l, idx) => {
    if (l.includes('<TextInput')) {
      let tag = l;
      for (let j = idx + 1; j < Math.min(idx + 12, lines.length); j++) {
        tag += ' ' + lines[j];
        if (lines[j].includes('>')) break;
      }
      if (!/accessibilityLabel|placeholder|aria-label/.test(tag)) {
        console.log(`[${path.relative(srcDir, file)}:L${idx+1}] ${tag.substring(0, 100)}...`);
      }
    }
  });
});
