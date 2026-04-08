const mysql = require('mysql2/promise');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

const envCandidates = [
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../.env.production')
];

const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (envPath) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventra_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
const testConnection = async () => {
  try {
    console.log('Attempting to connect to DB with config:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database
    });
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    logger.info('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    logger.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Execute query with error handling
const executeQuery = async (query, params = []) => {
  try {
    const [results] = await pool.execute(query, params);
    return results;
  } catch (error) {
    logger.error('Database query error:', {
      query: query.substring(0, 100) + '...',
      error: error.message
    });
    throw error;
  }
};

// Get database connection
const getConnection = async () => {
  try {
    return await pool.getConnection();
  } catch (error) {
    logger.error('Failed to get database connection:', error.message);
    throw error;
  }
};

// Initialize database connection
const initializeDatabase = async () => {
  const isConnected = await testConnection();
  if (!isConnected) {
    console.log('❌ Database connection failed. Please check your credentials in .env file');
    console.log('Current config:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database,
      password: dbConfig.password ? '[SET]' : '[EMPTY]'
    });
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Verify MySQL server is running');
    console.log('2. Check username and password in backend/.env');
    console.log('3. Ensure database exists');
    console.log('4. Add your current IP (115.133.188.46) to cPanel Remote MySQL');
    
    console.log('\n⚠️ Server will continue with limited functionality...');
    console.log('Some API endpoints may not work without database connection.');
  } else {
    // Create SOLUTION_PRINCIPAL table if it doesn't exist
    try {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS SOLUTION_PRINCIPAL (
          Solution_Principal_ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          Solution_Principal_Name VARCHAR(255) NOT NULL,
          Description LONGTEXT,
          Equipment_Type VARCHAR(255),
          Quantity INT DEFAULT 0,
          Created_Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          Updated_Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_name (Solution_Principal_Name),
          INDEX idx_created_date (Created_Date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      
      await executeQuery(createTableQuery);
      console.log('✅ SOLUTION_PRINCIPAL table ready');
      
      // Create PM_SCHEDULE table if it doesn't exist
      const createPMScheduleTableQuery = `
        CREATE TABLE IF NOT EXISTS PM_SCHEDULE (
          Schedule_ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          Project_ID INT NOT NULL,
          Scheduled_Date DATE NOT NULL,
          Is_Custom BOOLEAN DEFAULT TRUE,
          Notes TEXT,
          Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          Updated_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_project_date (Project_ID, Scheduled_Date),
          FOREIGN KEY (Project_ID) REFERENCES PROJECT(Project_ID) ON DELETE CASCADE,
          INDEX idx_project_date (Project_ID, Scheduled_Date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      
      await executeQuery(createPMScheduleTableQuery);
      console.log('✅ PM_SCHEDULE table ready');
    } catch (error) {
      console.warn('⚠️ Could not create tables:', error.message);
    }
  }
};

module.exports = {
  pool,
  executeQuery,
  getConnection,
  testConnection,
  initializeDatabase
};