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
let upgradedTouchables = 0;
let upgradedInputs = 0;

jsFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const isCrlf = content.includes('\r\n');
  content = content.replace(/\r\n/g, '\n');
  let changed = false;

  // 1. Upgrade Touchables
  const newContent = content.replace(/<(TouchableOpacity|Pressable|TouchableHighlight)\b([^>]*?)(\/?>)/g, (match, tag, attrs, closing) => {
    if (/accessibilityRole|accessibilityLabel|aria-label/.test(attrs)) {
      return match;
    }
    upgradedTouchables++;
    changed = true;
    // Add accessibility attributes
    if (attrs.includes('\n')) {
      return `<${tag} accessible={true} accessibilityRole="button"${attrs}${closing}`;
    } else {
      return `<${tag} accessible={true} accessibilityRole="button"${attrs}${closing}`;
    }
  });

  content = newContent;

  // 2. Upgrade specific unlabelled TextInputs if in this file
  const inputUpgrades = content.replace(/<TextInput\b([^>]*?)(\/?>)/g, (match, attrs, closing) => {
    if (/accessibilityLabel|placeholder|aria-label/.test(attrs)) {
      return match;
    }
    upgradedInputs++;
    changed = true;
    return `<TextInput accessibilityLabel="Input" accessible={true}${attrs}${closing}`;
  });

  content = inputUpgrades;

  if (changed) {
    if (isCrlf) content = content.replace(/\n/g, '\r\n');
    fs.writeFileSync(file, content, 'utf8');
  }
});

console.log(`Successfully upgraded ${upgradedTouchables} touchables and ${upgradedInputs} text inputs!`);
