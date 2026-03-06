const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

async function addPerformanceIndexes() {
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
    console.log('📊 Adding performance indexes...\n');

    // Read SQL file
    const sqlFile = path.join(__dirname, 'add_performance_indexes.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Split SQL into individual statements (skip comments and empty lines)
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let successCount = 0;
    let skipCount = 0;

    for (const statement of statements) {
      try {
        // Skip comments and SELECT queries for verification
        if (statement.startsWith('--') || statement.toUpperCase().startsWith('SELECT')) {
          continue;
        }

        await connection.query(statement);
        
        // Extract index name from CREATE INDEX statement
        const indexMatch = statement.match(/CREATE INDEX.*?(idx_\w+)/i);
        if (indexMatch) {
          console.log(`✅ Created index: ${indexMatch[1]}`);
          successCount++;
        }
      } catch (error) {
        // Ignore "Duplicate key" errors (index already exists)
        if (error.code === 'ER_DUP_KEYNAME') {
          const indexMatch = statement.match(/CREATE INDEX.*?(idx_\w+)/i);
          if (indexMatch) {
            console.log(`⏭️  Skipped (exists): ${indexMatch[1]}`);
            skipCount++;
          }
        } else {
          console.error('❌ Error creating index:', error.message);
        }
      }
    }

    console.log('\n📊 Performance Indexes Summary:');
    console.log(`   ✅ Created: ${successCount} indexes`);
    console.log(`   ⏭️  Skipped: ${skipCount} indexes (already exist)`);
    console.log(`   📈 Total: ${successCount + skipCount} indexes processed`);

    // Get index statistics
    const [indexes] = await connection.query(`
      SELECT 
          TABLE_NAME,
          COUNT(DISTINCT INDEX_NAME) as INDEX_COUNT
      FROM 
          INFORMATION_SCHEMA.STATISTICS
      WHERE 
          TABLE_SCHEMA = DATABASE()
          AND INDEX_NAME LIKE 'idx_%'
      GROUP BY TABLE_NAME
      ORDER BY TABLE_NAME
    `);

    console.log('\n📋 Indexes by Table:');
    indexes.forEach(row => {
      console.log(`   • ${row.TABLE_NAME}: ${row.INDEX_COUNT} indexes`);
    });

    console.log('\n✅ Performance optimization complete!');
    console.log('💡 Tip: Run ANALYZE TABLE command periodically to update index statistics');

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

addPerformanceIndexes();
