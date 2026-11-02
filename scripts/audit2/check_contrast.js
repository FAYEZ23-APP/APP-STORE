function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  const num = parseInt(hex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getContrast(hex1, hex2) {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const l1 = getLuminance(r1, g1, b1);
  const l2 = getLuminance(r2, g2, b2);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}

const pairs = [
  { fg: '#1F2329', bg: '#FAF8F5', name: 'Text Primary on Screen BG' },
  { fg: '#1F2329', bg: '#FFFFFF', name: 'Text Primary on Card BG' },
  { fg: '#595F69', bg: '#FAF8F5', name: 'Text Secondary on Screen BG' },
  { fg: '#595F69', bg: '#FFFFFF', name: 'Text Secondary on Card BG' },
  { fg: '#C8102E', bg: '#FAF8F5', name: 'Primary Red on Screen BG' },
  { fg: '#C8102E', bg: '#FFFFFF', name: 'Primary Red on White' },
  { fg: '#FFFFFF', bg: '#C8102E', name: 'White on Primary Red button' },
  { fg: '#8A5A00', bg: '#FAF8F5', name: 'Accent Gold Text on Screen BG (Remediated)' },
  { fg: '#8A5A00', bg: '#FFFFFF', name: 'Accent Gold Text on White (Remediated)' },
  { fg: '#1F2329', bg: '#D6A33A', name: 'Dark Text on Accent Gold button' },
  { fg: '#A80D26', bg: '#FFFFFF', name: 'Primary Hover on White' },
];

console.log('| Token / Usage | Foreground | Background | Contrast Ratio | WCAG AA Normal (4.5:1) | WCAG AA Large (3.0:1) |');
console.log('|---|---|---|---|---|---|');

let allPassed = true;
pairs.forEach(({ fg, bg, name }) => {
  const ratio = getContrast(fg, bg);
  const passAA = ratio >= 4.5 ? 'PASS' : 'FAIL';
  const passAALarge = ratio >= 3.0 ? 'PASS' : 'FAIL';
  if (passAA === 'FAIL') allPassed = false;
  console.log(`| ${name} | \`${fg}\` | \`${bg}\` | ${ratio.toFixed(2)}:1 | ${passAA} | ${passAALarge} |`);
});

console.log(`\nWCAG 2.1 AA Result: ${allPassed ? 'ALL TOKENS PASS' : 'FAILURES PRESENT'}`);
