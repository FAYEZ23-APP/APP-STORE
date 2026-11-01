const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../../mobile/src');

function getAllFiles(dir, exts = ['.js', '.jsx', '.json']) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, exts));
    } else {
      const ext = path.extname(file);
      if (exts.includes(ext)) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const allSrcFiles = getAllFiles(srcDir);

console.log(`Scanned ${allSrcFiles.length} files in mobile/src`);

// 1. API Modules and Endpoints
console.log('\n=================== 1. API ENDPOINTS ===================');
const apiDir = path.join(srcDir, 'api');
const apiFiles = fs.readdirSync(apiDir).filter(f => f.endsWith('.js'));
apiFiles.forEach(f => {
  const content = fs.readFileSync(path.join(apiDir, f), 'utf8');
  console.log(`\n--- ${f} ---`);
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // match client.get, client.post, client.put, client.delete, axios.post
    const match = line.match(/(client|axios)\.(get|post|put|delete|patch)\(\s*[`'"]([^`'"]+)[`'"]/);
    if (match) {
      console.log(`  L${idx+1}: ${match[2].toUpperCase()} ${match[3]}`);
    } else {
      const templMatch = line.match(/(client|axios)\.(get|post|put|delete|patch)\(\s*`([^`]+)`/);
      if (templMatch) {
        console.log(`  L${idx+1}: ${templMatch[2].toUpperCase()} \`${templMatch[3]}\``);
      }
    }
  });
});

// 2. Storage Keys
console.log('\n=================== 2. STORAGE USAGE ===================');
allSrcFiles.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(srcDir, filePath);
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('AsyncStorage.') || line.includes('SecureStore.')) {
      console.log(`  [${rel}:L${idx+1}] ${line.trim()}`);
    }
  });
});

// 3. Console calls
console.log('\n=================== 3. CONSOLE CALLS ===================');
allSrcFiles.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(srcDir, filePath);
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (/console\.(log|warn|error|info|debug)\(/.test(line)) {
      console.log(`  [${rel}:L${idx+1}] ${line.trim()}`);
    }
  });
});

// 4. EXPO_PUBLIC_* variables
console.log('\n=================== 4. EXPO_PUBLIC_* USAGE ===================');
allSrcFiles.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(srcDir, filePath);
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('EXPO_PUBLIC_')) {
      console.log(`  [${rel}:L${idx+1}] ${line.trim()}`);
    }
  });
});

// 5. RTL risks (left/right styling)
console.log('\n=================== 5. RTL POTENTIAL ISSUES ===================');
allSrcFiles.forEach(filePath => {
  if (filePath.endsWith('.json')) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(srcDir, filePath);
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (/(marginLeft|marginRight|paddingLeft|paddingRight|borderLeft|borderRight|\bleft\s*:|\bright\s*:)/.test(line)) {
      // Ignore if it's already using I18nManager or conditional
      console.log(`  [${rel}:L${idx+1}] ${line.trim()}`);
    }
  });
});
