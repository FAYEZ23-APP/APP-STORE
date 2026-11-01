const fs = require('fs');
const path = require('path');

const controllersDir = path.resolve(__dirname, '../../backend/Marketplace.API/Controllers');
const validatorsDir = path.resolve(__dirname, '../../backend/Marketplace.Application/Validators');

// 1. Map all validators to their target types
const validatorFiles = [];
function findFiles(dir, filter) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findFiles(fullPath, filter);
    } else if (filter(entry.name)) {
      validatorFiles.push(fullPath);
    }
  }
}
findFiles(validatorsDir, name => name.endsWith('.cs'));

const typeToValidator = {};
for (const vFile of validatorFiles) {
  const content = fs.readFileSync(vFile, 'utf8');
  const matches = content.matchAll(/public\s+class\s+(\w+)\s*:\s*AbstractValidator<([^>]+)>/g);
  for (const m of matches) {
    typeToValidator[m[2].trim()] = m[1].trim();
  }
}

// 2. Parse Controllers
const controllerFiles = fs.readdirSync(controllersDir).filter(f => f.endsWith('.cs')).sort();
const routes = [];

const primitives = new Set([
  'int', 'int?', 'string', 'string?', 'bool', 'bool?', 'double', 'double?',
  'decimal', 'decimal?', 'long', 'long?', 'Guid', 'Guid?', 'DateTime', 'DateTime?',
  'CancellationToken', 'ClaimsPrincipal', 'HttpContext', 'HttpRequest'
]);

for (const cFile of controllerFiles) {
  const filePath = path.join(controllersDir, cFile);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  let classRoute = '';
  let classAuthorize = null;
  let classRoles = null;
  let classFeature = null;
  let classRateLimit = null;
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
        const m = line.match(/\[Authorize(?:\(Roles\s*=\s*"([^"]+)"\))?\]/);
        if (m) {
          classAuthorize = true;
          if (m[1]) classRoles = m[1].split(',').map(r => r.trim());
        }
      }
      if (line.startsWith('[EnableRateLimiting("')) {
        const m = line.match(/\[EnableRateLimiting\("([^"]+)"\)\]/);
        if (m) classRateLimit = m[1];
      }
      if (line.startsWith('[RequireFeature(')) {
        const m = line.match(/\[RequireFeature\(FeatureFlag\.(\w+)\)\]/);
        if (m) classFeature = m[1];
      }
      if (/public\s+class\s+(\w+Controller)/.test(line)) {
        inClass = true;
      }
      continue;
    }

    // Inside class
    if (line.startsWith('[') && !line.startsWith('//')) {
      currentAttributes.push({ line, lineNum: i + 1 });
      continue;
    }

    // Match public method declaration start
    const methodMatch = line.match(/public\s+(?:async\s+)?([^\(\)]+?)\s+(\w+)\s*\((.*)/);
    if (methodMatch && !line.includes('class ') && !line.includes('new ') && !line.startsWith('//')) {
      const returnTypeRaw = methodMatch[1].trim();
      const methodName = methodMatch[2].trim();
      
      let afterParen = methodMatch[3];
      let fullParams = '';
      if (afterParen.includes(')')) {
        fullParams = afterParen.substring(0, afterParen.indexOf(')'));
      } else {
        fullParams = afterParen;
        let lineCursor = i;
        while (lineCursor < lines.length - 1) {
          lineCursor++;
          const nextL = lines[lineCursor].trim();
          if (nextL.includes(')')) {
            fullParams += ' ' + nextL.substring(0, nextL.indexOf(')'));
            break;
          } else {
            fullParams += ' ' + nextL;
          }
        }
      }
      const paramsSignature = fullParams;

      // Ignore constructors
      if (methodName + '.cs' === cFile || methodName === cFile.replace('.cs', '')) {
        currentAttributes = [];
        continue;
      }

      // Parse method attributes
      const httpVerbs = [];
      let methodAuthorize = classAuthorize;
      let methodRoles = classRoles;
      let methodFeature = classFeature;
      let methodRateLimit = classRateLimit;
      let isAnonymous = false;
      let producesResponseType = null;

      for (const attr of currentAttributes) {
        const aStr = attr.line;
        const httpM = aStr.match(/\[Http(Get|Post|Put|Delete|Patch)(?:\("([^"]*)"\))?\]/);
        if (httpM) {
          httpVerbs.push({
            verb: httpM[1].toUpperCase(),
            subRoute: httpM[2] !== undefined ? httpM[2] : '',
            lineNum: attr.lineNum
          });
        }
        if (aStr.startsWith('[AllowAnonymous]')) {
          isAnonymous = true;
          methodAuthorize = false;
          methodRoles = null;
        }
        if (aStr.startsWith('[Authorize')) {
          isAnonymous = false;
          methodAuthorize = true;
          const rm = aStr.match(/\[Authorize(?:\(Roles\s*=\s*"([^"]+)"\))?\]/);
          if (rm && rm[1]) {
            methodRoles = rm[1].split(',').map(r => r.trim());
          }
        }
        if (aStr.startsWith('[RequireFeature(')) {
          const fm = aStr.match(/\[RequireFeature\(FeatureFlag\.(\w+)\)\]/);
          if (fm) methodFeature = fm[1];
        }
        if (aStr.startsWith('[EnableRateLimiting("')) {
          const rlm = aStr.match(/\[EnableRateLimiting\("([^"]+)"\)\]/);
          if (rlm) methodRateLimit = rlm[1];
        }
        if (aStr.includes('[ProducesResponseType(')) {
          const pm = aStr.match(/\[ProducesResponseType\((?:typeof\(([^)]+)\),\s*)?StatusCodes\.Status20\w+\)\]/);
          if (pm && pm[1]) {
            producesResponseType = pm[1].trim();
          }
        }
      }

      if (httpVerbs.length > 0) {
        // Parse parameters to find request DTO
        let requestDto = null;
        
        // Split parameters taking into account potential generics or attributes
        const rawParams = paramsSignature.split(',').map(p => p.trim()).filter(Boolean);
        for (const rawParam of rawParams) {
          // Remove default value: e.g., "int page = 1" -> "int page"
          let cleanParam = rawParam.split('=')[0].trim();
          // Check for IFormFile
          if (cleanParam.includes('IFormFile')) {
            requestDto = cleanParam.includes('List<') ? 'List<IFormFile>' : 'IFormFile';
            break;
          }
          // Remove attributes like [FromBody], [FromQuery], [FromRoute], [FromServices], [FromHeader(Name = "...")]
          const isFromRoute = /\[FromRoute/i.test(cleanParam);
          const isFromHeader = /\[FromHeader/i.test(cleanParam);
          const isFromServices = /\[FromServices/i.test(cleanParam);
          if (isFromRoute || isFromHeader || isFromServices) continue;

          cleanParam = cleanParam.replace(/\[[^\]]+\]/g, '').trim();
          const parts = cleanParam.split(/\s+/).filter(Boolean);
          if (parts.length >= 2) {
            const typeName = parts[parts.length - 2].trim();
            if (!primitives.has(typeName)) {
              requestDto = typeName;
              break;
            }
          }
        }

        // Determine Response DTO
        let responseDto = producesResponseType;
        if (!responseDto) {
          const actM = returnTypeRaw.match(/ActionResult<([^>]+)>/);
          if (actM) {
            responseDto = actM[1].trim();
          } else if (returnTypeRaw.includes('Task<ActionResult>')) {
            responseDto = 'void';
          } else if (returnTypeRaw.includes('Task<IActionResult>')) {
            responseDto = 'IActionResult';
          } else {
            responseDto = returnTypeRaw;
          }
        }

        // Clean up DTO names
        const cleanRequestDto = requestDto ? requestDto.replace('?', '').split('.').pop() : null;
        const cleanResponseDto = responseDto ? responseDto.replace('?', '').split('.').pop() : null;

        // Check validator
        let validator = null;
        if (cleanRequestDto && typeToValidator[cleanRequestDto]) {
          validator = typeToValidator[cleanRequestDto];
        }

        for (const hv of httpVerbs) {
          let fullRoute = '';
          const sub = hv.subRoute;
          if (sub.startsWith('/')) {
            fullRoute = sub;
          } else if (classRoute) {
            fullRoute = sub ? `/${classRoute}/${sub}` : `/${classRoute}`;
          } else {
            fullRoute = sub ? `/${sub}` : '/';
          }
          fullRoute = fullRoute.replace(/\/+/g, '/');

          let authDesc = 'Anonymous';
          if (!isAnonymous && methodAuthorize) {
            authDesc = methodRoles ? `Roles: ${methodRoles.join(',')}` : 'Authenticated';
          }

          routes.push({
            method: hv.verb,
            path: fullRoute,
            controller: cFile.replace('.cs', ''),
            action: methodName,
            auth: authDesc,
            roles: methodRoles,
            rateLimitPolicy: methodRateLimit,
            featureFlag: methodFeature || null,
            requestDto: cleanRequestDto,
            responseDto: cleanResponseDto,
            validator: validator,
            source: `backend/Marketplace.API/Controllers/${cFile}:${hv.lineNum}`
          });
        }
      }

      currentAttributes = [];
    }
  }
}

// Add Minimal API routes from Program.cs
routes.push({
  method: 'GET',
  path: '/health',
  controller: 'Program',
  action: 'getHealthResponse',
  auth: 'Anonymous',
  roles: null,
  rateLimitPolicy: null,
  featureFlag: null,
  requestDto: null,
  responseDto: '{ status: string, database: string }',
  validator: null,
  source: 'backend/Marketplace.API/Program.cs:709'
});

routes.push({
  method: 'GET',
  path: '/api/health',
  controller: 'Program',
  action: 'getHealthResponse',
  auth: 'Anonymous',
  roles: null,
  rateLimitPolicy: null,
  featureFlag: null,
  requestDto: null,
  responseDto: '{ status: string, database: string }',
  validator: null,
  source: 'backend/Marketplace.API/Program.cs:710'
});

routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

const outPath = path.resolve(__dirname, '../../docs/audit2/routes.json');
fs.writeFileSync(outPath, JSON.stringify(routes, null, 2), 'utf8');

console.log(`Successfully inventoried ${routes.length} routes to ${outPath}`);
