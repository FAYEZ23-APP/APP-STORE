const { getValidatedTestDb } = require('../../backend/tests/helpers/test_harness');
const { Client } = require('pg');

async function main() {
    const { connStr } = getValidatedTestDb();
    const client = new Client({ connectionString: connStr });
    await client.connect();
    const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ReturnRequests' ORDER BY ordinal_position");
    console.log(res.rows);
    await client.end();
}

main().catch(console.error);
