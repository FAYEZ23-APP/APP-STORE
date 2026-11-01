const fs = require('fs');
const path = require('path');

// 1. WCAG Contrast Calculation
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const num = parseInt(hex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function getsRGB(c) {
  c = c / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function getLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * getsRGB(r) + 0.7152 * getsRGB(g) + 0.0722 * getsRGB(b);
}

function getContrast(hex1, hex2) {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}

console.log('=================== 1. THEME TOKEN CONTRAST RATIOS ===================');
const pairs = [
  { fg: '#1F2329', bg: '#FAF8F5', name: 'textPrimary on screenBg' },
  { fg: '#1F2329', bg: '#FFFFFF', name: 'textPrimary on cardBg' },
  { fg: '#595F69', bg: '#FAF8F5', name: 'textSecondary on screenBg' },
  { fg: '#595F69', bg: '#FFFFFF', name: 'textSecondary on cardBg' },
  { fg: '#8C929B', bg: '#FAF8F5', name: 'oldPrice/disabledText on screenBg' },
  { fg: '#8C929B', bg: '#FFFFFF', name: 'oldPrice/disabledText on cardBg' },
  { fg: '#FFFFFF', bg: '#C8102E', name: 'white on primary red' },
  { fg: '#FFFFFF', bg: '#D6A33A', name: 'white on accent gold' },
  { fg: '#D6A33A', bg: '#FAF8F5', name: 'accent gold on screenBg' },
  { fg: '#D6A33A', bg: '#FFFFFF', name: 'accent gold on cardBg' },
  { fg: '#16A34A', bg: '#DCFCE7', name: 'success green on successSoft' },
  { fg: '#C8102E', bg: '#FDF2F4', name: 'danger red on dangerSoft' },
  { fg: '#475569', bg: '#FFFFFF', name: 'tabBarInactive on cardBg' },
  { fg: '#D6A33A', bg: '#1F2329', name: 'accent gold on dark charcoal' },
  { fg: '#FFFFFF', bg: '#1F2329', name: 'white on dark charcoal' }
];

pairs.forEach(p => {
  const ratio = getContrast(p.fg, p.bg);
  const passesNormal = ratio >= 4.5 ? 'PASS' : (ratio >= 3.0 ? 'LARGE-ONLY' : 'FAIL');
  console.log(`${p.name.padEnd(35)}: ${ratio.toFixed(2)}:1 [${passesNormal}] (fg: ${p.fg}, bg: ${p.bg})`);
});

// 2. Scan mobile/src for hardcoded strings, touch targets, accessibility, and RTL
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

console.log('\n=================== 2. ACCESSIBILITY & TOUCH TARGETS ===================');
let totalTouchables = 0;
let touchablesWithA11y = 0;
let totalInputs = 0;
let inputsWithA11y = 0;
const smallTargets = [];

jsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(srcDir, file);

  // Match TouchableOpacity, Pressable, TouchableHighlight
  const touchableMatches = content.match(/<(TouchableOpacity|Pressable|TouchableHighlight)\b([^>]*?)>/g) || [];
  touchableMatches.forEach(tag => {
    totalTouchables++;
    if (/accessibilityLabel|accessibilityRole|aria-label/.test(tag)) {
      touchablesWithA11y++;
    }
  });

  // Match TextInput
  const inputMatches = content.match(/<TextInput\b([^>]*?)>/g) || [];
  inputMatches.forEach(tag => {
    totalInputs++;
    if (/accessibilityLabel|placeholder|aria-label/.test(tag)) {
      inputsWithA11y++;
    }
  });

  // Check small styles (width < 44 or height < 44)
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const m = line.match(/(width|height|minWidth|minHeight)\s*:\s*(\d+)/);
    if (m) {
      const prop = m[1];
      const val = parseInt(m[2], 10);
      if (val < 44 && val > 0 && /(btn|button|icon|touchable|chip|pill|tab|action)/i.test(line)) {
        smallTargets.push({ file: rel, line: idx + 1, prop, val, text: line.trim() });
      }
    }
  });
});

console.log(`Total Touchable components: ${totalTouchables}`);
console.log(`Touchables with accessibilityLabel/role: ${touchablesWithA11y} (${((touchablesWithA11y/totalTouchables)*100).toFixed(1)}%)`);
console.log(`Total TextInputs: ${totalInputs}`);
console.log(`TextInputs with accessibilityLabel/placeholder: ${inputsWithA11y} (${((inputsWithA11y/totalInputs)*100).toFixed(1)}%)`);
console.log(`Potential touch targets below 44px (sample of ${smallTargets.length}):`);
smallTargets.slice(0, 10).forEach(t => {
  console.log(`  [${t.file}:L${t.line}] ${t.prop}: ${t.val}px -> ${t.text}`);
});

console.log('\n=================== 3. HARDCODED STRINGS IN JSX / ALERTS ===================');
const hardcodedAlerts = [];
const hardcodedJsx = [];

jsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(srcDir, file);
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Check Alert.alert with raw literal
    const alertMatch = line.match(/Alert\.alert\(\s*['"]([^'"]+)['"]/);
    if (alertMatch) {
      // Check if it's literal Arabic or English (not a variable or t call)
      const text = alertMatch[1];
      if (/[\u0600-\u06FFa-zA-Z]{3,}/.test(text) && !text.includes('.')) {
        hardcodedAlerts.push({ file: rel, line: idx + 1, text });
      }
    }

    // Check raw JSX text >Arabic or English<
    const jsxMatch = line.match(/>([^<>{}\n\r]+)</);
    if (jsxMatch) {
      const txt = jsxMatch[1].trim();
      // filter out whitespace, icons, numbers, currencies
      if (txt.length > 2 && /[\u0600-\u06FFa-zA-Z]{2,}/.test(txt) && !txt.startsWith('&') && !/^(EGP|LE|USD|SAR)$/i.test(txt)) {
        hardcodedJsx.push({ file: rel, line: idx + 1, text: txt });
      }
    }
  });
});

console.log(`Found ${hardcodedAlerts.length} hardcoded Alert.alert literals:`);
hardcodedAlerts.slice(0, 10).forEach(a => console.log(`  [${a.file}:L${a.line}] "${a.text}"`));

console.log(`Found ${hardcodedJsx.length} hardcoded JSX text literals:`);
hardcodedJsx.slice(0, 15).forEach(j => console.log(`  [${j.file}:L${j.line}] "${j.text}"`));

console.log('\n=================== 4. SCREEN-STATE MATRIX ===================');
const screensDir = path.join(srcDir, 'screens');
const screenFiles = getAllFiles(screensDir);

screenFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(screensDir, file);

  const hasLoading = /ActivityIndicator|loading|isLoading|Skeleton/i.test(content);
  const hasEmpty = /empty|no.*found|قائمة فارغة|لا يوجد|length\s*===?\s*0/i.test(content);
  const hasError = /error|isError|errorMessage|Alert\.alert|catch/i.test(content);
  const hasOffline = /offline|NetInfo|انقطاع الاتصال|شبكة/i.test(content);
  const hasForbidden = /forbidden|403|userRole|غير مصرح/i.test(content);

  console.log(`${rel.padEnd(45)} | Load: ${hasLoading ? 'YES' : 'NO '} | Empty: ${hasEmpty ? 'YES' : 'NO '} | Err: ${hasError ? 'YES' : 'NO '} | Off: ${hasOffline ? 'YES' : 'NO '} | 403: ${hasForbidden ? 'YES' : 'NO '}`);
});
