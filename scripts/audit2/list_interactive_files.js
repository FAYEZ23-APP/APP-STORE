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
const filesToProcess = [];

jsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (/<(TouchableOpacity|Pressable|TouchableHighlight)\b/.test(content) || /<TextInput\b/.test(content)) {
    filesToProcess.push(file);
  }
});

console.log(`Files with interactive elements: ${filesToProcess.length}`);
