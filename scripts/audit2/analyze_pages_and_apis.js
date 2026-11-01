import fs from 'fs';
import path from 'path';

const pagesDir = path.resolve('admin-web/src/pages');
const apiDir = path.resolve('admin-web/src/api');

// Scan all API files to know exports and endpoints
const apiMap = {};
fs.readdirSync(apiDir).forEach(file => {
  if (file.endsWith('.js') && file !== 'client.js') {
    const content = fs.readFileSync(path.join(apiDir, file), 'utf-8');
    const exports = [];
    const exportRegex = /export\s+const\s+(\w+)\s*=\s*(?:\([^)]*\)|async\s*\([^)]*\))\s*=>\s*(?:client|axios)\.(\w+)\(\s*[`'"]([^`'"]+)[`'"]/g;
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push({
        fn: match[1],
        method: match[2].toUpperCase(),
        endpoint: match[3],
        file,
      });
      apiMap[match[1]] = {
        method: match[2].toUpperCase(),
        endpoint: match[3],
        file,
      };
    }
  }
});

function getPageFiles(dir) {
  let results = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getPageFiles(full));
    } else if (entry.isFile() && (entry.name.endsWith('.jsx') || entry.name.endsWith('.js'))) {
      results.push(full);
    }
  });
  return results;
}

const pageFiles = getPageFiles(pagesDir);
const pageAnalysis = [];

pageFiles.forEach(pf => {
  const relPath = path.relative(pagesDir, pf);
  const content = fs.readFileSync(pf, 'utf-8');

  // Find imported API functions
  const calledApis = [];
  Object.keys(apiMap).forEach(fn => {
    const regex = new RegExp(`\\b${fn}\\b`);
    if (regex.test(content)) {
      calledApis.push({
        fn,
        ...apiMap[fn],
      });
    }
  });

  // State inspection
  const hasLoading = /isLoading|loading|setLoading|isSubmitting/i.test(content);
  const hasError = /error|setError|err|errorMessage/i.test(content);
  const hasEmpty = /length === 0|empty|noItems|\.length \?|!.*\.length/i.test(content);
  const hasPagination = /page|pageSize|pagination|setPage/i.test(content);
  const hasDebounce = /debounce|timeout|clearTimeout/i.test(content);

  pageAnalysis.push({
    file: relPath.replace(/\\/g, '/'),
    calledApis,
    hasLoading,
    hasError,
    hasEmpty,
    hasPagination,
    hasDebounce,
    lines: content.split('\n').length,
  });
});

console.log(JSON.stringify({ apiMapCount: Object.keys(apiMap).length, pages: pageAnalysis }, null, 2));
