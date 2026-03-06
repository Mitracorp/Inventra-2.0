const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

async function runMigration() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'inventra_db',
      multipleStatements: true
    });

    console.log('✅ Connected to database');

    // Read SQL file
    const sqlFile = path.join(__dirname, 'add_asset_flag_remarks.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('📄 Executing migration...');
    
    // Execute SQL
    await connection.query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('   - Added Is_Flagged column (TINYINT)');
    console.log('   - Added Flag_Remarks column (TEXT)');
    console.log('   - Added Flag_Date column (DATETIME)');
    console.log('   - Added Flagged_By column (VARCHAR)');
    console.log('   - Created index on Is_Flagged');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('📦 Database connection closed');
    }
  }
}

runMigration();
