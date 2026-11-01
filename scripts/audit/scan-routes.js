const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, '../../backend/Marketplace.API/Controllers');
const files = fs.readdirSync(controllersDir).filter(f => f.endsWith('.cs'));

const routes = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(controllersDir, file), 'utf8');
  const lines = content.split(/\r?\n/);

  let classRoute = '';
  let classAuth = null;
  let classFeature = null;

  let inClass = false;
  let currentAttributes = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!inClass) {
      if (line.startsWith('[Route("')) {
        const m = line.match(/\[Route\("([^"]+)"\)\]/);
        if (m) classRoute = m[1];
      }
      if (line.startsWith('[Authorize')) {
        const m = line.match(/\[Authorize(?:\(([^)]+)\))?\]/);
        if (m) classAuth = m[1] ? m[1].replace(/Roles\s*=\s*/g, 'Role:').replace(/"/g, '') : 'Authenticated';
      }
      if (line.startsWith('[AllowAnonymous]')) {
        classAuth = 'Anonymous';
      }
      if (line.startsWith('[RequireFeature(')) {
        const m = line.match(/\[RequireFeature\(FeatureFlag\.(\w+)\)\]/);
        if (m) classFeature = m[1];
      }
      if (/public\s+class\s+\w+Controller/.test(line)) {
        inClass = true;
      }
      continue;
    }

    // Inside class
    if (line.startsWith('[') && !line.startsWith('//')) {
      currentAttributes.push({ line, lineNum: i + 1 });
      continue;
    }

    // Check if line is a method declaration
    // Matches: public async Task<...>? MethodName(...) or public ActionResult MethodName(...)
    const methodMatch = line.match(/public\s+(?:async\s+)?(?:[\w\<\>,\.\?\s]+)\s+(\w+)\s*\(/);
    if (methodMatch && !line.includes('class ') && !line.includes('new ') && !line.includes('(' + methodMatch[1] + ')')) {
      const methodName = methodMatch[1];
      
      // Ignore constructor
      if (methodName + '.cs' === file || methodName === file.replace('.cs', '')) {
        currentAttributes = [];
        continue;
      }

      // Parse currentAttributes
      const httpVerbs = [];
      let methodAuth = null;
      let methodFeature = null;
      let methodRoute = null;

      for (const attr of currentAttributes) {
        const aStr = attr.line;
        const httpM = aStr.match(/\[Http(Get|Post|Put|Delete|Patch)(?:\("([^"]*)"\))?\]/);
        if (httpM) {
          httpVerbs.push({
            verb: httpM[1].toUpperCase(),
            subRoute: httpM[2] !== undefined ? httpM[2] : null,
            lineNum: attr.lineNum
          });
        }
        if (aStr.startsWith('[Route("')) {
          const rm = aStr.match(/\[Route\("([^"]+)"\)\]/);
          if (rm) methodRoute = rm[1];
        }
        if (aStr.startsWith('[Authorize')) {
          const am = aStr.match(/\[Authorize(?:\(([^)]+)\))?\]/);
          if (am) methodAuth = am[1] ? am[1].replace(/Roles\s*=\s*/g, 'Role:').replace(/"/g, '') : 'Authenticated';
        }
        if (aStr.startsWith('[AllowAnonymous]')) {
          methodAuth = 'Anonymous';
        }
        if (aStr.startsWith('[RequireFeature(')) {
          const fm = aStr.match(/\[RequireFeature\(FeatureFlag\.(\w+)\)\]/);
          if (fm) methodFeature = fm[1];
        }
      }

      if (httpVerbs.length > 0) {
        for (const hv of httpVerbs) {
          let fullRoute = '';
          const sub = hv.subRoute !== null ? hv.subRoute : (methodRoute !== null ? methodRoute : '');

          if (sub.startsWith('/')) {
            fullRoute = sub;
          } else if (sub.length > 0) {
            fullRoute = `/${classRoute}/${sub}`;
          } else {
            fullRoute = `/${classRoute}`;
          }

          routes.push({
            controller: file.replace('.cs', ''),
            action: methodName,
            method: hv.verb,
            route: fullRoute.replace(/\/+/g, '/'),
            auth: methodAuth || classAuth || 'Anonymous',
            feature: methodFeature || classFeature || 'None',
            source: `${file}:${hv.lineNum}`
          });
        }
      }

      currentAttributes = [];
    } else if (line.length > 0 && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*') && !line.startsWith('{')) {
      // If it's another statement and not an attribute, reset attributes if they weren't attached to a method
      if (!line.startsWith('[')) {
        // keep looking if line is XML doc or whitespace
        if (!line.startsWith('///')) {
          currentAttributes = [];
        }
      }
    }
  }
}

routes.sort((a, b) => a.route.localeCompare(b.route) || a.method.localeCompare(b.method));

console.log(`Verified ${routes.length} total endpoints across ${files.length} controllers.`);

fs.writeFileSync(path.join(__dirname, '../../docs/audit/routes.json'), JSON.stringify(routes, null, 2));

// Generate Markdown table
let md = '# Verified Backend API Route Catalog\n\n';
md += `> [!NOTE]\n> Generated by \`scripts/audit/scan-routes.js\`. Total endpoints: **${routes.length}** across **${files.length}** controllers.\n\n`;
md += '| # | Method | Route | Authorization | Feature Flag | Controller | Action | Source |\n';
md += '|---|---|---|---|---|---|---|---|\n';
routes.forEach((r, idx) => {
  md += `| ${idx + 1} | \`${r.method}\` | \`${r.route}\` | ${r.auth} | ${r.feature} | \`${r.controller}\` | \`${r.action}\` | \`${r.source}\` |\n`;
});

fs.writeFileSync(path.join(__dirname, '../../docs/audit/routes.md'), md);
console.log('Saved routes to docs/audit/routes.json and docs/audit/routes.md');
