const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const importDump = async () => {
  const dumpPath = path.join(__dirname, '../ivmscom_Inventra_dump.sql');
  
  if (!fs.existsSync(dumpPath)) {
    console.error('❌ Dump file not found:', dumpPath);
    process.exit(1);
  }

  console.log('📂 Reading SQL dump:', dumpPath);
  const dumpContent = fs.readFileSync(dumpPath, 'utf8');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    console.log('🔌 Connecting to database...');
    
    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'inventra_db';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Database \`${dbName}\` ready`);

    // Select database
    await connection.query(`USE \`${dbName}\``);

    console.log('📥 Importing dump...');
    const statements = dumpContent
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt && !stmt.startsWith('--'));

    let count = 0;
    for (const statement of statements) {
      try {
        await connection.query(statement);
        count++;
      } catch (err) {
        // Skip non-critical errors (like SET statements that MySQL doesn't understand)
        if (!err.message.includes('Unknown command') && !err.message.includes('is not supported')) {
          console.warn('⚠️ Statement error (continuing):', err.message.substring(0, 100));
        }
      }
    }

    console.log(`✅ Imported ${count} SQL statements successfully`);

    // Quick sanity check
    const [assetResult] = await connection.query('SELECT COUNT(*) as count FROM ASSET');
    console.log(`📊 Assets in database: ${assetResult[0]?.count || 0}`);

    const [userResult] = await connection.query('SELECT COUNT(*) as count FROM USER');
    console.log(`👤 Users in database: ${userResult[0]?.count || 0}`);

  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

importDump();
