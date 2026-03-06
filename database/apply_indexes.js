const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config({ path: __dirname + '/../backend/.env' });

async function applyIndexes() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ivmscom_inventra'
    });
    
    console.log('Connected to database');
    
    const sql = fs.readFileSync('add_performance_indexes.sql', 'utf8');
    const lines = sql.split('\n');
    let statement = '';
    let created = 0;
    let skipped = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('--') || trimmed.length === 0) continue;
      
      statement += line + '\n';
      
      if (trimmed.endsWith(';')) {
        const stmt = statement.trim().replace(/;$/, '');
        if (stmt.startsWith('CREATE INDEX')) {
          // Remove IF NOT EXISTS for MySQL compatibility
          const cleanStmt = stmt.replace(/IF NOT EXISTS /g, '');
          try {
            await conn.execute(cleanStmt);
            const match = cleanStmt.match(/idx_\w+/);
            console.log('✅ Created:', match ? match[0] : 'index');
            created++;
          } catch (err) {
            if (err.code === 'ER_DUP_KEYNAME') {
              const match = cleanStmt.match(/idx_\w+/);
              console.log('⏭️  Skipped (exists):', match ? match[0] : 'index');
              skipped++;
            } else {
              console.error('❌ Error:', err.message);
            }
          }
        }
        statement = '';
      }
    }
    
    console.log(`\nSummary: ${created} created, ${skipped} skipped`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    if (conn) await conn.end();
  }
}

applyIndexes().catch(console.error);
