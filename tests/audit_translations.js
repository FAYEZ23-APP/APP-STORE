const fs = require('fs');
const path = require('path');

function scanDir(dir, ext) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        results = results.concat(scanDir(fullPath, ext));
      }
    } else if (ext.some(e => file.endsWith(e))) {
      results.push(fullPath);
    }
  }
  return results;
}

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const missing = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/t\(\s*['"](profile\.[^'"]+)['"]\s*\)/);
    if (match) {
      missing.push({ line: i + 1, key: match[1], text: line.trim() });
    }
  }
  return missing;
}

console.log('--- ADMIN-WEB PROFILE FILES ---');
const webFiles = scanDir('admin-web/src/components/profile', ['.jsx', '.js']).concat(['admin-web/src/pages/ProfilePage.jsx']);
for (const f of webFiles) {
  const issues = auditFile(f);
  if (issues.length > 0) {
    console.log(`\nFile: ${f} (${issues.length} calls without fallback):`);
    issues.forEach(iss => console.log(`  Line ${iss.line}: ${iss.key}`));
  }
}

console.log('\n--- MOBILE PROFILE FILES ---');
const mobileFiles = scanDir('mobile/src/components/profile', ['.js', '.jsx']).concat(['mobile/src/screens/common/ProfileScreen.js']);
for (const f of mobileFiles) {
  const issues = auditFile(f);
  if (issues.length > 0) {
    console.log(`\nFile: ${f} (${issues.length} calls without fallback):`);
    issues.forEach(iss => console.log(`  Line ${iss.line}: ${iss.key}`));
  }
}
