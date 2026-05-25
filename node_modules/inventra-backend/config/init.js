const { executeQuery } = require('./database');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

async function initializeTables() {
    try {
        // Read the SQL setup file
        const sqlPath = path.join(__dirname, 'setup.sql');
        const sqlContent = await fs.readFile(sqlPath, 'utf8');

        // Split the SQL file into individual statements
        const statements = sqlContent
            .split(';')
            .map(statement => statement.trim())
            .filter(statement => statement.length > 0);

        // Execute each statement
        for (const statement of statements) {
            await executeQuery(statement);
        }

        logger.info('Database tables initialized successfully');
    } catch (error) {
        logger.error('Error initializing database tables:', error.message);
        throw error;
    }
}

module.exports = {
    initializeTables
};