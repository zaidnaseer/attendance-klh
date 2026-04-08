const fs = require('fs/promises');
const path = require('path');
const { pool } = require('./client');

async function migrate() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = await fs.readdir(migrationsDir);
  const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
  
  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Get already applied migrations
  const { rows } = await pool.query('SELECT name FROM _migrations');
  const appliedMigrations = new Set(rows.map(r => r.name));
  
  for (const file of sqlFiles) {
    if (!appliedMigrations.has(file)) {
      console.log(`Running migration: ${file}`);
      const migrationPath = path.join(migrationsDir, file);
      const sql = await fs.readFile(migrationPath, 'utf8');
      await pool.query(sql);
      
      // Record migration as applied
      await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
    } else {
      console.log(`Skipping migration: ${file} (already applied)`);
    }
  }
  console.log('All migrations applied successfully.');
}

module.exports = { migrate };
