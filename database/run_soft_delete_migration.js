const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

async function runSoftDeleteMigration() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'inventra_db',
      multipleStatements: true
    });

    console.log('Connected to database');

    const dbName = process.env.DB_NAME || 'inventra_db';

    const ensureColumn = async (tableName, columnName, definition) => {
      const [rows] = await connection.execute(
        `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
        [dbName, tableName, columnName]
      );

      if (rows.length === 0) {
        await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
        console.log(`- added column ${tableName}.${columnName}`);
      } else {
        console.log(`- column ${tableName}.${columnName} already exists`);
      }
    };

    const ensureIndex = async (tableName, indexName, columnName) => {
      const [rows] = await connection.execute(
        `SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
        [dbName, tableName, indexName]
      );

      if (rows.length === 0) {
        await connection.query(`ALTER TABLE ${tableName} ADD INDEX ${indexName} (${columnName})`);
        console.log(`- added index ${indexName} on ${tableName}(${columnName})`);
      } else {
        console.log(`- index ${indexName} already exists`);
      }
    };

    await ensureColumn('SOLUTION_PRINCIPAL', 'deleted_at', 'DATETIME NULL');
    await ensureColumn('PMAINTENANCE', 'deleted_at', 'DATETIME NULL');
    await ensureIndex('SOLUTION_PRINCIPAL', 'idx_solution_principal_deleted_at', 'deleted_at');
    await ensureIndex('PMAINTENANCE', 'idx_pmaintenance_deleted_at', 'deleted_at');

    console.log('Soft-delete migration completed successfully');
    console.log('- ensured deleted_at column on SOLUTION_PRINCIPAL');
    console.log('- ensured deleted_at column on PMAINTENANCE');
    console.log('- ensured indexes for deleted_at columns');
  } catch (error) {
    console.error('Soft-delete migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runSoftDeleteMigration();
