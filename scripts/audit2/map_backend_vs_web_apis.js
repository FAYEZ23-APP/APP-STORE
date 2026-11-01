import fs from 'fs';
import path from 'path';

const apiDir = path.resolve('admin-web/src/api');
const controllersDir = path.resolve('backend/Marketplace.API/Controllers');

// Extract all endpoints from backend controllers
const backendRoutes = [];
fs.readdirSync(controllersDir).forEach((file) => {
  if (file.endsWith('.cs')) {
    const content = fs.readFileSync(path.join(controllersDir, file), 'utf-8');
    
    // Class route
    const classRouteMatch = content.match(/\[Route\(["']([^"']+)["']\)\]/);
    let classRoute = classRouteMatch ? classRouteMatch[1] : '';

    // Method routes
    const methodRegex = /\[Http(Get|Post|Put|Delete|Patch)(?:\(["']([^"']*)["']\))?\]/g;
    let match;
    while ((match = methodRegex.exec(content)) !== null) {
      const verb = match[1].toUpperCase();
      let subRoute = match[2] || '';
      
      let fullRoute = '';
      if (subRoute.startsWith('/')) {
        fullRoute = subRoute;
      } else if (classRoute) {
        fullRoute = '/' + classRoute + (subRoute ? '/' + subRoute : '');
      } else {
        fullRoute = '/' + subRoute;
      }
      
      // Normalize route: remove leading /api if present for comparison, or keep both
      fullRoute = fullRoute.replace(/\/+/g, '/');

      // Check Authorize attribute
      const upToMatch = content.substring(0, match.index);
      const lastAuthorize = upToMatch.lastIndexOf('[Authorize');
      const lastMethod = upToMatch.lastIndexOf('public async');
      let isAuthorized = false;
      let roles = null;
      if (lastAuthorize > lastMethod || content.includes('[Authorize(Roles = "Admin")]')) {
        isAuthorized = true;
      }

      backendRoutes.push({
        file,
        verb,
        rawRoute: fullRoute,
        cleanRoute: fullRoute.replace(/\{[^}]+:[^}]+\}/g, '{param}').replace(/\{[^}]+\}/g, '{param}'),
      });
    }
  }
});

// Extract all endpoints from web API files
const webEndpoints = [];
fs.readdirSync(apiDir).forEach((file) => {
  if (file.endsWith('.js') && file !== 'client.js') {
    const content = fs.readFileSync(path.join(apiDir, file), 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      const callMatch = line.match(/(?:client|axios)\.(get|post|put|delete|patch)\(\s*[`'"]([^`'"]+)[`'"]/i);
      if (callMatch) {
        const verb = callMatch[1].toUpperCase();
        let rawUrl = callMatch[2];
        // Remove query parameters from url
        const cleanUrl = rawUrl.split('?')[0].replace(/\$\{[^}]+\}/g, '{param}');
        webEndpoints.push({
          file,
          line: idx + 1,
          verb,
          rawUrl,
          cleanUrl: cleanUrl.startsWith('/') ? cleanUrl : '/' + cleanUrl,
        });
      }
    });
  }
});

console.log(`Backend total routes: ${backendRoutes.length}`);
console.log(`Web total client calls: ${webEndpoints.length}`);

// Compare
const mismatches = [];
webEndpoints.forEach((w) => {
  // Client prepends /api automatically via BASE_URL
  const targetBackend = '/api' + w.cleanUrl;
  const directTarget = w.cleanUrl;

  const found = backendRoutes.find((b) => {
    return (b.verb === w.verb) && (b.cleanRoute === targetBackend || b.cleanRoute === directTarget);
  });

  if (!found) {
    mismatches.push(w);
  }
});

console.log('\n--- MISMATCHES FOUND ---');
console.log(JSON.stringify(mismatches, null, 2));

console.log('\n--- ALL WEB CALLS ---');
console.log(JSON.stringify(webEndpoints, null, 2));
