const fs = require('fs/promises');
const path = require('path');
const { pool } = require('./client');

async function migrate() {
  const migrationPath = path.join(__dirname, 'migrations', '001_init.sql');
  const sql = await fs.readFile(migrationPath, 'utf8');
  await pool.query(sql);
}

module.exports = { migrate };
