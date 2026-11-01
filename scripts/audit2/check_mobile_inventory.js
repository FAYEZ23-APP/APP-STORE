const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, '../../mobile/package.json');
const lockPath = path.resolve(__dirname, '../../mobile/package-lock.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

console.log('--- DEPENDENCY INVENTORY ---');
const deps = Object.keys(pkg.dependencies || {});
const devDeps = Object.keys(pkg.devDependencies || {});

console.log('Dependencies count:', deps.length);
console.log('DevDependencies count:', devDeps.length);

console.log('\nKey packages comparison:');
['expo', 'react', 'react-native', 'expo-secure-store', 'expo-updates', 'axios', 'i18next', 'react-i18next'].forEach(name => {
  const declared = pkg.dependencies[name] || pkg.devDependencies?.[name];
  const locked = lock.packages?.['node_modules/' + name]?.version || lock.dependencies?.[name]?.version;
  console.log(`${name}: declared=${declared}, locked=${locked}`);
});
