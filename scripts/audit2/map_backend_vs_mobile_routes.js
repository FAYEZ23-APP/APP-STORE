const fs = require('fs');
const path = require('path');

const controllersDir = path.resolve(__dirname, '../../backend/Marketplace.API/Controllers');
const mobileApiDir = path.resolve(__dirname, '../../mobile/src/api');

// 1. Scan backend controllers
const controllerFiles = fs.readdirSync(controllersDir).filter(f => f.endsWith('.cs'));
const backendEndpoints = [];

controllerFiles.forEach(file => {
  const content = fs.readFileSync(path.join(controllersDir, file), 'utf8');
  let baseRoute = '';
  const routeMatch = content.match(/\[Route\("api\/([^"]+)"\)\]/);
  if (routeMatch) {
    baseRoute = '/api/' + routeMatch[1];
  } else {
    const simpleRoute = content.match(/\[Route\("([^"]+)"\)\]/);
    if (simpleRoute) {
      baseRoute = simpleRoute[1].startsWith('/') ? simpleRoute[1] : '/' + simpleRoute[1];
    }
  }

  // Scan action methods: HttpGet, HttpPost, HttpPut, HttpDelete, HttpPatch
  const actionRegex = /\[Http(Get|Post|Put|Delete|Patch)(?:\("([^"]*)"\))?\]/g;
  let match;
  while ((match = actionRegex.exec(content)) !== null) {
    const verb = match[1].toUpperCase();
    const subRoute = match[2] || '';
    let fullRoute = baseRoute;
    if (subRoute) {
      if (subRoute.startsWith('/')) {
        fullRoute = subRoute;
      } else {
        fullRoute = baseRoute ? `${baseRoute}/${subRoute}` : `/${subRoute}`;
      }
    }
    backendEndpoints.push({
      controller: file,
      verb,
      fullRoute: fullRoute.replace(/\/+/g, '/'),
    });
  }
});

console.log(`Discovered ${backendEndpoints.length} backend endpoints across ${controllerFiles.length} controllers.`);

// 2. Scan mobile API endpoints
const mobileApiFiles = fs.readdirSync(mobileApiDir).filter(f => f.endsWith('.js') && f !== 'client.js');
const mobileCalls = [];

mobileApiFiles.forEach(file => {
  const content = fs.readFileSync(path.join(mobileApiDir, file), 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // client.get('/endpoint', ...)
    const m = line.match(/(client|axios)\.(get|post|put|delete|patch)\(\s*([`'"])(.*?)\3/);
    if (m) {
      const verb = m[2].toUpperCase();
      let route = m[4];
      mobileCalls.push({
        file,
        line: idx + 1,
        verb,
        rawRoute: route,
        cleanRoute: ('/api' + (route.startsWith('/') ? route : '/' + route)).replace(/\$\{[^}]+\}/g, '{id}').replace(/\?.*$/, '')
      });
    }
  });
});

console.log(`Discovered ${mobileCalls.length} mobile API calls across ${mobileApiFiles.length} API files.`);

console.log('\n--- COMPARISON ---');
mobileCalls.forEach(call => {
  // Try to match with backendEndpoints
  // Normalize both by replacing route params like {id:int} or {id} with {param}
  const normMobile = call.cleanRoute.replace(/\{[^}]+\}/g, '{param}').toLowerCase();
  const match = backendEndpoints.find(be => {
    const normBackend = be.fullRoute.replace(/\{[^}]+(:[^}]+)?\}/g, '{param}').toLowerCase();
    return be.verb === call.verb && (normBackend === normMobile || normBackend === normMobile.replace('/api', ''));
  });

  if (match) {
    console.log(`[MATCH] ${call.verb} ${call.rawRoute} -> ${match.controller} (${match.fullRoute})`);
  } else {
    console.log(`[MISMATCH / UNVERIFIED] ${call.file}:L${call.line} ${call.verb} ${call.rawRoute} (normalized: ${normMobile})`);
  }
});
