const fs = require('fs');
let content = fs.readFileSync('backend/tests/test_wave7_features_postgres.js', 'utf8');

const oldRunPsql = `function runPsql(connStr, query) {
  try {
    const output = execSync('psql -v ON_ERROR_STOP=1 -A -t', {
      input: query,
      env: { ...process.env, PGCONNECT_STRING: connStr },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return output.toString().trim();
  } catch (err) {
    throw new Error(\`psql command failed: \${err.stderr ? err.stderr.toString() : err.message}\`);
  }
}`;

const newRunPsql = `const psqlPath = 'C:\\\\Program Files\\\\PostgreSQL\\\\18\\\\bin\\\\psql.exe';

function runPsql(connStr, query) {
  try {
    const output = execSync(\`"\${psqlPath}" -h localhost -p 5432 -U postgres -d MarketplaceMVP_test -t\`, {
      input: query,
      env: { ...process.env, PGPASSWORD: 'newpassword' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return output.toString().trim();
  } catch (err) {
    throw new Error(\`psql command failed: \${err.stderr ? err.stderr.toString() : err.message}\`);
  }
}`;

content = content.replace(oldRunPsql, newRunPsql);
fs.writeFileSync('backend/tests/test_wave7_features_postgres.js', content, 'utf8');
console.log('runPsql updated in test_wave7_features_postgres.js');
