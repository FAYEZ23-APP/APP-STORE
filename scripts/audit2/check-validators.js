const fs = require('fs');
const path = require('path');

function getFiles(dir, filter) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (!fullPath.includes('bin') && !fullPath.includes('obj')) {
        results = results.concat(getFiles(fullPath, filter));
      }
    } else if (filter.test(file)) {
      results.push(fullPath);
    }
  });
  return results;
}

const dtosDir = path.resolve('backend/Marketplace.Application/DTOs');
const validatorsDir = path.resolve('backend/Marketplace.Application/Validators');

const dtoFiles = getFiles(dtosDir, /\.cs$/);
const validatorFiles = getFiles(validatorsDir, /\.cs$/);

const requestClasses = new Map();
const requestRegex = /public\s+(?:record|class)\s+([A-Za-z0-9_]+Request)\b/g;

for (const file of dtoFiles) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = requestRegex.exec(content)) !== null) {
    const className = match[1];
    requestClasses.set(className, path.basename(file));
  }
}

const validatedClasses = new Set();
const validatorRegex = /AbstractValidator<([A-Za-z0-9_]+Request)>/g;

for (const file of validatorFiles) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = validatorRegex.exec(content)) !== null) {
    validatedClasses.add(match[1]);
  }
}

console.log(`Discovered ${requestClasses.size} Request DTOs and ${validatedClasses.size} Validators.\n`);

const missing = [];
for (const [reqClass, fileName] of requestClasses.entries()) {
  if (!validatedClasses.has(reqClass)) {
    missing.push({ reqClass, fileName });
  }
}

if (missing.length > 0) {
  console.log(`❌ FAILED: ${missing.length} Request DTO(s) are missing FluentValidation validators:`);
  console.table(missing);
  process.exit(1);
} else {
  console.log(`✅ PASSED: All ${requestClasses.size} Request DTOs have corresponding FluentValidation AbstractValidator<T> implementations.`);
  process.exit(0);
}
