const fs = require('fs');
const path = require('path');
const babelParser = require('@babel/parser');

const srcDir = path.resolve(__dirname, '../src');

function getAllFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(full));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(full);
    }
  });
  return results;
}

console.log('================================================================');
console.log('🧪 TEST SUITE: MOBILE AST EXPORTS & IMPORTS INTEGRITY');
console.log('================================================================\n');

const files = getAllFiles(srcDir);
const fileExports = new Map();
const fileAsts = new Map();

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  try {
    const ast = babelParser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'flow'],
    });
    fileAsts.set(file, ast);
    const namedExports = new Set();
    let hasDefaultExport = false;

    for (const node of ast.program.body) {
      if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          if (node.declaration.declarations) {
            for (const d of node.declaration.declarations) {
              namedExports.add(d.id.name);
            }
          } else if (node.declaration.id) {
            namedExports.add(node.declaration.id.name);
          }
        }
        if (node.specifiers) {
          for (const s of node.specifiers) {
            namedExports.add(s.exported.name);
          }
        }
      } else if (node.type === 'ExportDefaultDeclaration') {
        hasDefaultExport = true;
      }
    }
    fileExports.set(file, { namedExports, hasDefaultExport });
  } catch (e) {
    console.error('Parse error in', file, e.message);
  }
}

let missingCount = 0;
for (const [file, ast] of fileAsts.entries()) {
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      const source = node.source.value;
      if (source.startsWith('.')) {
        let resolved = path.resolve(path.dirname(file), source);
        if (!fs.existsSync(resolved)) {
          if (fs.existsSync(resolved + '.js')) resolved = resolved + '.js';
          else if (fs.existsSync(resolved + '.jsx')) resolved = resolved + '.jsx';
          else if (fs.existsSync(path.join(resolved, 'index.js')))
            resolved = path.join(resolved, 'index.js');
        }
        if (fileExports.has(resolved)) {
          const { namedExports, hasDefaultExport } = fileExports.get(resolved);
          for (const spec of node.specifiers) {
            if (spec.type === 'ImportSpecifier') {
              const importedName = spec.imported.name;
              if (!namedExports.has(importedName)) {
                console.error(
                  `❌ [FAIL] Missing named export: "${importedName}" imported in "${path.relative(
                    __dirname,
                    file
                  )}" from "${path.relative(__dirname, resolved)}"`
                );
                missingCount++;
              }
            } else if (spec.type === 'ImportDefaultSpecifier') {
              if (!hasDefaultExport) {
                console.error(
                  `❌ [FAIL] Missing default export in "${path.relative(
                    __dirname,
                    resolved
                  )}" imported in "${path.relative(__dirname, file)}"`
                );
                missingCount++;
              }
            }
          }
        }
      }
    }
  }
}

if (missingCount === 0) {
  console.log(`✅ [PASS] All ${files.length} mobile source files have valid imports and exports.`);
}

console.log('\n================================================================');
console.log(`TOTAL FILES: ${files.length} | MISSING EXPORTS: ${missingCount}`);
console.log('================================================================');

if (missingCount > 0) {
  process.exit(1);
}
