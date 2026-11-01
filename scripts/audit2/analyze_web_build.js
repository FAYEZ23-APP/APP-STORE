import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import zlib from 'zlib';

const adminWebDir = path.resolve('admin-web');
const tempDir = path.join(os.tmpdir(), `web_audit_build_${Date.now()}`);

console.log(`[INFO] Building admin-web to temp folder: ${tempDir}`);

let buildOutput = '';
let analysis = {
  success: false,
  files: [],
  totalSizeBytes: 0,
  totalGzipSizeBytes: 0,
  sourceMapsFound: [],
  devStringsFound: [],
  secretsFound: [],
  error: null,
};

try {
  fs.mkdirSync(tempDir, { recursive: true });

  // Run build into tempDir
  buildOutput = execSync(`npx vite build --outDir "${tempDir}"`, {
    cwd: adminWebDir,
    encoding: 'utf-8',
    env: { ...process.env, NODE_ENV: 'production' },
  });

  analysis.success = true;

  // Inspect generated files
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile()) {
        const relPath = path.relative(tempDir, fullPath);
        const contentBuffer = fs.readFileSync(fullPath);
        const contentStr = contentBuffer.toString('utf-8');
        const sizeBytes = contentBuffer.length;
        const gzipSizeBytes = zlib.gzipSync(contentBuffer).length;

        analysis.files.push({
          path: relPath,
          sizeBytes,
          sizeKb: (sizeBytes / 1024).toFixed(2),
          gzipSizeBytes,
          gzipSizeKb: (gzipSizeBytes / 1024).toFixed(2),
        });

        analysis.totalSizeBytes += sizeBytes;
        analysis.totalGzipSizeBytes += gzipSizeBytes;

        if (relPath.endsWith('.map')) {
          analysis.sourceMapsFound.push(relPath);
        }

        // Grep for dev strings & secrets
        const devPatterns = [
          { pattern: /DevCarrierDrawer/i, name: 'DevCarrierDrawer' },
          { pattern: /carrier.*drawer/i, name: 'carrierDrawer' },
          { pattern: /localhost:5209/i, name: 'localhost:5209' },
          { pattern: /\[API REQUEST\]/i, name: '[API REQUEST] log' },
          { pattern: /console\.log\(/i, name: 'console.log' },
          { pattern: /AIza[0-9A-Za-z-_]{35}/, name: 'Google API Key pattern' },
        ];

        for (const p of devPatterns) {
          const match = contentStr.match(p.pattern);
          if (match) {
            analysis.devStringsFound.push({
              file: relPath,
              matched: p.name,
              snippet: match[0].substring(0, 50),
            });
          }
        }
      }
    }
  }

  scanDir(tempDir);
} catch (err) {
  analysis.error = err.message || String(err);
  console.error('[ERROR] Build failed:', err.message);
} finally {
  // Always clean up temp folder
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log(`[INFO] Cleaned up temporary directory: ${tempDir}`);
    }
  } catch (cleanErr) {
    console.error('[WARN] Failed to delete temp directory:', cleanErr.message);
  }
}

console.log(JSON.stringify(analysis, null, 2));
