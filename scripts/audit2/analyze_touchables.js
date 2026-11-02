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

const files = getAllFiles(srcDir);
let touchableCount = 0;
let withA11yCount = 0;

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const matches = content.match(/<(TouchableOpacity|Pressable)[\s\S]*?>/g) || [];
  matches.forEach(m => {
    touchableCount++;
    if (m.includes('accessibilityLabel') || m.includes('accessibilityRole')) {
      withA11yCount++;
    }
  });
});

console.log(`Total touchables: ${touchableCount}, with a11y: ${withA11yCount} (${(withA11yCount/touchableCount*100).toFixed(1)}%)`);
