const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const mobileDir = path.resolve(__dirname, '../../mobile');
const tempOutDir = path.resolve(mobileDir, 'temp_audit_bundle');

console.log('Starting temporary expo export into:', tempOutDir);

try {
  // Ensure temp dir doesn't exist initially
  if (fs.existsSync(tempOutDir)) {
    fs.rmSync(tempOutDir, { recursive: true, force: true });
  }

  // Run expo export
  const cmd = 'npx expo export --output-dir temp_audit_bundle --dump-sourcemap';
  console.log('Running:', cmd);
  const stdout = execSync(cmd, { cwd: mobileDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  console.log('Expo export output:\n', stdout);

  // Traverse tempOutDir
  function getFiles(dir) {
    let files = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const p = path.join(dir, file);
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        files = files.concat(getFiles(p));
      } else {
        files.push({ path: p, size: st.size });
      }
    });
    return files;
  }

  const allFiles = getFiles(tempOutDir);
  console.log(`\nGenerated ${allFiles.length} files:`);
  
  let totalBytes = 0;
  let jsBytes = 0;
  let jsGzipBytes = 0;

  allFiles.forEach(f => {
    const rel = path.relative(tempOutDir, f.path);
    totalBytes += f.size;
    const isJs = f.path.endsWith('.js') || f.path.endsWith('.hbc');
    if (isJs) {
      jsBytes += f.size;
      const content = fs.readFileSync(f.path);
      const gz = zlib.gzipSync(content);
      jsGzipBytes += gz.length;
      console.log(`  JS file: ${rel} - ${(f.size / 1024).toFixed(2)} KB (gzip: ${(gz.length / 1024).toFixed(2)} KB)`);
    } else {
      console.log(`  Asset: ${rel} - ${(f.size / 1024).toFixed(2)} KB`);
    }
  });

  console.log('\n--- BUNDLE MEASUREMENTS SUMMARY ---');
  console.log(`Total bundle directory size: ${(totalBytes / 1024).toFixed(2)} KB`);
  console.log(`Total JS size (uncompressed): ${(jsBytes / 1024).toFixed(2)} KB`);
  console.log(`Total JS size (gzipped): ${(jsGzipBytes / 1024).toFixed(2)} KB`);

} catch (err) {
  console.error('Error during expo export:', err.message);
  if (err.stdout) console.log('STDOUT:', err.stdout);
  if (err.stderr) console.error('STDERR:', err.stderr);
} finally {
  console.log('Cleaning up temporary export directory...');
  if (fs.existsSync(tempOutDir)) {
    fs.rmSync(tempOutDir, { recursive: true, force: true });
    console.log('Temporary directory deleted successfully.');
  }
}
