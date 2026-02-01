require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'bcinv',
  user: process.env.DB_USER || 'bcinv_user',
  password: process.env.DB_PASSWORD,
});

async function runMigrations() {
  console.log('🔄 Running database migrations...');
  
  try {
    // Read and execute schema
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      console.error('❌ Schema file not found:', schemaPath);
      process.exit(1);
    }
    
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Executing schema...');
    await pool.query(schema);
    
    console.log('✅ Migrations completed successfully');
    
    // Verify tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('\n📊 Database tables:');
    tablesResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    
    // Verify views
    const viewsResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (viewsResult.rows.length > 0) {
      console.log('\n👁️  Database views:');
      viewsResult.rows.forEach(row => {
        console.log(`  ✓ ${row.table_name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
