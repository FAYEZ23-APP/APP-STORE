const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function findPostgresTool(toolName) {
  try {
    const which = execSync(`where ${toolName}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (which) return which.split(/\r?\n/)[0].trim();
  } catch {}

  const candidates = [
    `C:\\Program Files\\PostgreSQL\\18\\bin\\${toolName}.exe`,
    `C:\\Program Files\\PostgreSQL\\17\\bin\\${toolName}.exe`,
    `C:\\Program Files\\PostgreSQL\\16\\bin\\${toolName}.exe`,
    `C:\\Program Files\\PostgreSQL\\15\\bin\\${toolName}.exe`,
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) return cand;
  }
  return toolName;
}

function parseConnectionString(connStr) {
  const get = (keyRegex) => {
    const match = connStr.match(new RegExp(`(?:^|;)\\s*(?:${keyRegex})\\s*=\\s*([^;]+)`, 'i'));
    return match ? match[1].trim() : null;
  };

  return {
    host: get('Host|Server') || 'localhost',
    port: get('Port') || '5432',
    user: get('Username|User ID|User|Uid') || 'postgres',
    password: get('Password') || '',
    database: get('Database') || '',
  };
}

function runPsqlQuery(connStr, sql, targetDb = null) {
  const psql = findPostgresTool('psql');
  const parsed = parseConnectionString(connStr);
  const db = targetDb || parsed.database;
  const env = { ...process.env, PGPASSWORD: parsed.password };

  const res = spawnSync(
    psql,
    ['-h', parsed.host, '-p', parsed.port, '-U', parsed.user, '-d', db, '-t', '-A', '-c', sql],
    { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );

  if (res.status !== 0) {
    throw new Error(`psql error (${res.status}): ${res.stderr || res.stdout}`);
  }
  return (res.stdout || '').trim();
}

module.exports = {
  findPostgresTool,
  parseConnectionString,
  runPsqlQuery,
};
