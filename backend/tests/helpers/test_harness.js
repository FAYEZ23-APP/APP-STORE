const net = require('net');
const fs = require('fs');
const { execSync } = require('child_process');

/**
 * Allocates an ephemeral random free TCP port on 127.0.0.1, guaranteed outside 5209-5300.
 */
function getFreePort() {
  return new Promise((resolve, reject) => {
    function tryBind() {
      const srv = net.createServer();
      srv.unref();
      srv.on('error', reject);
      srv.listen(0, '127.0.0.1', () => {
        const addr = srv.address();
        const port = addr && typeof addr === 'object' ? addr.port : 0;
        srv.close((err) => {
          if (err) return reject(err);
          if (port >= 5209 && port <= 5300) {
            return tryBind();
          }
          resolve(port);
        });
      });
    }
    tryBind();
  });
}

/**
 * Validates TEST_DB is PostgreSQL, never InMemory, and its database name ends with "_test".
 * Prints only the database name (never credentials).
 */
function getValidatedTestDb() {
  let connStr = process.env.TEST_DB && process.env.TEST_DB.trim() ? process.env.TEST_DB.trim() : '';
  if (!connStr) {
    try {
      connStr = execSync(
        'powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'TEST_DB\', \'User\')"',
        { encoding: 'utf8' }
      ).trim();
    } catch {}
  }

  if (!connStr) {
    console.error('ABORT: TEST_DB environment variable is unset.');
    process.exit(1);
  }

  const lower = connStr.toLowerCase();
  if (lower.includes('inmemory') || lower.includes('mode=memory')) {
    console.error('ABORT: InMemory database detected. Only PostgreSQL _test databases are permitted.');
    process.exit(1);
  }

  if (!lower.includes('host=') && !lower.includes('server=')) {
    console.error('ABORT: TEST_DB is not a valid PostgreSQL connection string.');
    process.exit(1);
  }

  const match = connStr.match(/(?:^|;)\s*database\s*=\s*([^;]+)/i);
  const dbName = match ? match[1].trim() : '';
  console.log(`Database Name: ${dbName || '(missing)'}`);

  if (!dbName || !dbName.endsWith('_test')) {
    console.error(`ABORT: Database name '${dbName}' does not end with '_test'.`);
    process.exit(1);
  }

  return { connStr, dbName };
}

/**
 * Terminates ONLY the spawned child process tree (by PID) and closes optional log file descriptor.
 */
function stopServer(proc, logFd = null, logPath = null) {
  if (proc && proc.pid) {
    try {
      execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      try {
        proc.kill('SIGKILL');
      } catch {}
    }
  }
  if (typeof logFd === 'number') {
    try {
      fs.closeSync(logFd);
    } catch {}
  }
  if (logPath && fs.existsSync(logPath)) {
    try {
      fs.unlinkSync(logPath);
    } catch {}
  }
}

/**
 * Waits for /api/health (or /health) to respond with 200 OK.
 */
async function waitForHealth(baseUrl, maxWaitMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`API host at ${baseUrl} did not become healthy within ${maxWaitMs}ms.`);
}

/**
 * Emits a machine-readable check result line consumed by scripts/run-all-tests.ps1.
 */
function emitCheckResult({ suite, id, name, provider = 'PostgreSQL (TEST_DB)', status, notes }) {
  console.log('[CHECK_RESULT]' + JSON.stringify({ suite, id, name, provider, status, notes }));
}

module.exports = {
  getFreePort,
  getValidatedTestDb,
  stopServer,
  waitForHealth,
  emitCheckResult,
};
