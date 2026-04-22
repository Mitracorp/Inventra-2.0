const { pool } = require('./config/database');

async function check() {
  try {
    console.log('--- Database Check ---');
    const [rows] = await pool.execute('SHOW TABLES');
    console.log('Tables in database:');
    rows.forEach(row => console.log(Object.values(row)[0]));
    
    console.log('\n--- Checking ASSET table ---');
    try {
      const [assetRows] = await pool.execute('DESCRIBE ASSET');
      console.log('ASSET table structure:', assetRows.map(r => r.Field).join(', '));
      const [count] = await pool.execute('SELECT COUNT(*) as count FROM ASSET');
      console.log('ASSET count:', count[0].count);
    } catch (e) {
      console.log('Error accessing ASSET table:', e.message);
    }
  } catch (err) {
    console.error('Connection failed:', err.message);
  } finally {
    process.exit();
  }
}

check();
