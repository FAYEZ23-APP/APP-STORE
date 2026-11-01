const fs = require('fs');
const path = require('path');

const routesPath = path.resolve(__dirname, '../../docs/audit2/routes.json');
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));

const mobileApiDir = path.resolve(__dirname, '../../mobile/src/api');
const webApiDir = path.resolve(__dirname, '../../admin-web/src/api');
const mobileSrcDir = path.resolve(__dirname, '../../mobile/src');
const webSrcDir = path.resolve(__dirname, '../../admin-web/src');

function getAllFiles(dir, filter) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of list) {
    const fullPath = path.join(dir, entry = file.name);
    if (file.isDirectory()) {
      if (file.name !== 'node_modules' && file.name !== '.git') {
        results = results.concat(getAllFiles(path.join(dir, file.name), filter));
      }
    } else if (filter(file.name)) {
      results.push(path.join(dir, file.name));
    }
  }
  return results;
}

// 1. Extract API module functions reliably
function extractApiFunctions(apiDir, clientName) {
  const apiFiles = fs.readdirSync(apiDir).filter(f => f.endsWith('.js') && f !== 'client.js');
  const apiCalls = [];

  for (const file of apiFiles) {
    const content = fs.readFileSync(path.join(apiDir, file), 'utf8');
    const lines = content.split(/\r?\n/);
    const moduleName = file.replace('.js', '');

    let currentExportName = null;
    let currentParams = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect export const foo = (params) => { ...
      const expMatch = line.match(/export\s+const\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)/);
      if (expMatch) {
        currentExportName = expMatch[1];
        currentParams = expMatch[2];
      }

      const fnMatch = line.match(/export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
      if (fnMatch) {
        currentExportName = fnMatch[1];
        currentParams = fnMatch[2];
      }

      // Detect client.(get|post|put|delete|patch)(url, ...)
      const clientCallMatch = line.match(/client\.(get|post|put|delete|patch)\(\s*([`'"][^`'"]+[`'"])/);
      if (clientCallMatch) {
        const verb = clientCallMatch[1].toUpperCase();
        let rawUrl = clientCallMatch[2].replace(/[`'"]/g, '');
        // Strip query string e.g. ?query=...
        const urlWithoutQuery = rawUrl.split('?')[0];

        let normPath = urlWithoutQuery.startsWith('/api') ? urlWithoutQuery : '/api' + (urlWithoutQuery.startsWith('/') ? urlWithoutQuery : '/' + urlWithoutQuery);
        // Replace ${...} with {id}
        normPath = normPath.replace(/\$\{[^}]+\}/g, '{id}');

        apiCalls.push({
          client: clientName,
          module: moduleName,
          fnName: currentExportName || `${moduleName}_call_${i+1}`,
          params: currentParams,
          verb,
          rawUrl,
          normPath,
          source: `${clientName}/src/api/${file}:${i+1}`
        });
      }
    }
  }

  return apiCalls;
}

const mobileCalls = extractApiFunctions(mobileApiDir, 'mobile');
const webCalls = extractApiFunctions(webApiDir, 'admin-web');
const allCalls = [...mobileCalls, ...webCalls];

// 2. Scan UI files to see where functions are invoked
const mobileFiles = getAllFiles(mobileSrcDir, f => (f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.tsx') || f.endsWith('.ts')) && !f.includes('src\\api\\'));
const webFiles = getAllFiles(webSrcDir, f => (f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.tsx') || f.endsWith('.ts')) && !f.includes('src\\api\\'));

function findUsages(call, sourceFiles, clientDir) {
  const usages = [];
  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const relPath = path.relative(clientDir, file).replace(/\\/g, '/');

    const pattern1 = new RegExp(`\\b${call.fnName}\\s*\\(`, 'g');
    const pattern2 = new RegExp(`\\b${call.module}\\.${call.fnName}\\s*\\(`, 'g');
    if (pattern1.test(content) || pattern2.test(content)) {
      usages.push(relPath);
    }
  }
  return usages;
}

for (const call of mobileCalls) {
  call.screens = findUsages(call, mobileFiles, mobileSrcDir);
}
for (const call of webCalls) {
  call.screens = findUsages(call, webFiles, webSrcDir);
}

// 3. Match API calls against backend routes
function normalizeBackendRoute(routePath) {
  return routePath.replace(/:int/g, '').replace(/\{[^}]+\}/g, '{id}').toLowerCase();
}

function normalizeClientRoute(clientPath) {
  return clientPath.replace(/\{[^}]+\}/g, '{id}').toLowerCase();
}

// Match each route
const routeMatrix = [];
const uncalledBackendRoutes = [];
const clientCallsToNonExistent = [];

for (const br of routes) {
  const normBrPath = normalizeBackendRoute(br.path);
  
  // Find matching client calls
  const matches = allCalls.filter(c => {
    if (c.verb !== br.method) return false;
    const normCPath = normalizeClientRoute(c.normPath);
    return normCPath === normBrPath;
  });

  const mobileMatches = matches.filter(m => m.client === 'mobile');
  const webMatches = matches.filter(m => m.client === 'admin-web');

  const mobileScreens = [...new Set(mobileMatches.flatMap(m => m.screens))];
  const webPages = [...new Set(webMatches.flatMap(m => m.screens))];

  if (matches.length === 0) {
    uncalledBackendRoutes.push(br);
  }

  routeMatrix.push({
    backendRoute: `${br.method} ${br.path}`,
    auth: br.auth,
    featureFlag: br.featureFlag || 'None',
    mobileCallerCount: mobileMatches.length,
    mobileScreens: mobileScreens.join('; ') || 'None',
    webCallerCount: webMatches.length,
    webPages: webPages.join('; ') || 'None',
    requestDto: br.requestDto || 'None',
    validator: br.validator || 'None',
    responseDto: br.responseDto || 'None',
    hasCallers: matches.length > 0
  });
}

// Check client calls that did not match any backend route
for (const call of allCalls) {
  const normCPath = normalizeClientRoute(call.normPath);
  const matched = routes.some(br => {
    if (br.method !== call.verb) return false;
    const normBrPath = normalizeBackendRoute(br.path);
    return normBrPath === normCPath;
  });

  if (!matched) {
    clientCallsToNonExistent.push(call);
  }
}

// 4. Generate CSV
let csv = 'Method,Path,Auth,FeatureFlag,MobileScreens,WebPages,RequestDto,Validator,ResponseDto,HasClientCaller\n';
for (const rm of routeMatrix) {
  const [method, ...rest] = rm.backendRoute.split(' ');
  const rPath = rest.join(' ');
  csv += `"${method}","${rPath}","${rm.auth}","${rm.featureFlag}","${rm.mobileScreens}","${rm.webPages}","${rm.requestDto}","${rm.validator}","${rm.responseDto}",${rm.hasCallers}\n`;
}

const csvPath = path.resolve(__dirname, '../../docs/audit2/contract-matrix.csv');
fs.writeFileSync(csvPath, csv, 'utf8');

console.log(`Generated contract matrix CSV with ${routeMatrix.length} rows at ${csvPath}`);
console.log(`Total backend routes: ${routes.length}`);
console.log(`Uncalled backend routes: ${uncalledBackendRoutes.length}`);
console.log(`Client calls pointing to non-existent routes: ${clientCallsToNonExistent.length}`);

// Save detailed report
const summary = {
  totalBackendRoutes: routes.length,
  totalMobileApiCalls: mobileCalls.length,
  totalWebApiCalls: webCalls.length,
  uncalledBackendRoutesCount: uncalledBackendRoutes.length,
  uncalledBackendRoutes: uncalledBackendRoutes.map(r => `${r.method} ${r.path} (${r.controller}.${r.action})`),
  clientCallsToNonExistentCount: clientCallsToNonExistent.length,
  clientCallsToNonExistent: clientCallsToNonExistent.map(c => `${c.client} -> ${c.verb} ${c.rawUrl} in ${c.source}:${c.fnName}`)
};

fs.writeFileSync(path.resolve(__dirname, '../../docs/audit2/contract-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log('Saved contract summary to docs/audit2/contract-summary.json');
