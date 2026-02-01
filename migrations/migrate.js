#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bcinv',
  user: process.env.DB_USER || 'bcinv_user',
  password: process.env.DB_PASSWORD
};

const MIGRATIONS_DIR = __dirname;

async function runMigrations() {
  const client = new Client(dbConfig);
  
  try {
    console.log('🔄 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✓ Connected to database');
    console.log('');

    // Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of executed migrations
    const result = await client.query('SELECT name FROM migrations ORDER BY executed_at');
    const executedMigrations = result.rows.map(row => row.name);

    // Get list of migration files
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('⚠️  No migration files found');
      return;
    }

    console.log(`📋 Found ${files.length} migration file(s)`);
    console.log('');

    let ranCount = 0;

    // Run pending migrations
    for (const file of files) {
      if (executedMigrations.includes(file)) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }

      console.log(`🔄 Running migration: ${file}`);
      
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        
        // Record migration (if not already recorded by the SQL file)
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
          [file]
        );
        
        await client.query('COMMIT');
        console.log(`✓ Successfully executed ${file}`);
        ranCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Error executing ${file}:`);
        console.error(err.message);
        throw err;
      }
    }

    console.log('');
    if (ranCount === 0) {
      console.log('✅ Database is up to date (no new migrations)');
    } else {
      console.log(`✅ Successfully ran ${ranCount} migration(s)`);
    }
    console.log('');

  } catch (err) {
    console.error('❌ Migration failed:');
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };