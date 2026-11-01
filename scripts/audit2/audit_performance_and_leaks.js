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

console.log('=================== 1. FLATLIST IMPLEMENTATION AUDIT ===================');
jsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(srcDir, file);
  if (content.includes('<FlatList')) {
    console.log(`\n--- FlatList in ${rel} ---`);
    // Extract keyExtractor
    const keyMatch = content.match(/keyExtractor=\{([^}]+)\}/);
    console.log(`  keyExtractor: ${keyMatch ? keyMatch[1].trim() : 'MISSING'}`);

    // Check windowing props
    const hasInitialNum = content.includes('initialNumToRender');
    const hasMaxToRender = content.includes('maxToRenderPerBatch');
    const hasWindowSize = content.includes('windowSize');
    const hasRemoveClipped = content.includes('removeClippedSubviews');
    const getItemLayout = content.includes('getItemLayout');

    console.log(`  Windowing props: initialNum=${hasInitialNum}, maxToRender=${hasMaxToRender}, windowSize=${hasWindowSize}, removeClippedSubviews=${hasRemoveClipped}, getItemLayout=${getItemLayout}`);

    // Check inline renderItem
    const inlineRenderMatch = content.match(/renderItem=\{[\s\n]*\((?:\{[^}]+\}|item|[^)]*)\)\s*=>/);
    console.log(`  renderItem inline arrow function: ${Boolean(inlineRenderMatch)}`);
  }
});

console.log('\n=================== 2. TIMERS & EVENT SUBSCRIPTION LEAKS ===================');
jsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(srcDir, file);

  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (/(setInterval|setTimeout|addEventListener|AppState\.addEventListener|NetInfo\.addEventListener)/.test(line)) {
      console.log(`  [${rel}:L${idx+1}] ${line.trim()}`);
    }
  });
});

console.log('\n=================== 3. CONTEXT PROVIDER VALUE MEMOIZATION ===================');
const contextDir = path.join(srcDir, 'context');
fs.readdirSync(contextDir).filter(f => f.endsWith('.js')).forEach(f => {
  const content = fs.readFileSync(path.join(contextDir, f), 'utf8');
  console.log(`\n--- ${f} ---`);
  const valueMatch = content.match(/<(\w+Context)\.Provider\s+value=\{\{([\s\S]*?)\}\}/);
  if (valueMatch) {
    console.log(`  Provider: <${valueMatch[1]}.Provider>`);
    console.log(`  Inline object literal without useMemo: YES (Re-creates context value object on EVERY render!)`);
    const keys = valueMatch[2].split(',').map(s => s.trim()).filter(Boolean);
    console.log(`  Exported properties/methods (${keys.length}): ${keys.slice(0, 5).join(', ')}...`);
  } else {
    const memoMatch = content.match(/value=\{([^}]+)\}/);
    console.log(`  Provider value: ${memoMatch ? memoMatch[1].trim() : 'unknown'}`);
  }
});
