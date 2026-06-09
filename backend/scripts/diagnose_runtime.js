#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const modulesToCheck = [
  'express', 'cors', 'mysql2', 'exceljs', 'archiver', 'html-pdf', 'phantomjs-prebuilt'
];

console.log('Runtime diagnostics for Inventra backend');
console.log('Working directory:', process.cwd());
console.log('Node version:', process.version);

// Check modules
console.log('\nChecking module resolution (require.resolve)');
modulesToCheck.forEach((m) => {
  try {
    const resolved = require.resolve(m);
    console.log(`  ✓ ${m} -> ${resolved}`);
  } catch (err) {
    console.log(`  ✗ ${m} -> NOT FOUND`);
  }
});

// Check for presence of key files used by controllers
const checkFiles = [
  '../utils/pdfGenerator.js',
  '../utils/logger.js',
  '../utils/helpers.js'
];

console.log('\nChecking important local utility files');
checkFiles.forEach((f) => {
  const p = path.join(__dirname, f);
  try {
    fs.accessSync(p, fs.constants.R_OK);
    console.log(`  ✓ ${f} exists`);
  } catch (err) {
    console.log(`  ✗ ${f} missing or not readable`);
  }
});

// Optional: check DB connectivity if env vars set
const DB_HOST = process.env.DB_HOST || process.env.MYSQL_HOST || process.env.DB_HOSTNAME || 'ivms2006.com';
const DB_USER = process.env.DB_USER || process.env.MYSQL_USER || process.env.DB_USERNAME;
const DB_PASS = process.env.DB_PASS || process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME || process.env.MYSQL_DATABASE || process.env.DB_DATABASE;

if (DB_HOST && DB_USER && DB_NAME) {
  (async () => {
    try {
      const mysql = require('mysql2/promise');
      console.log('\nAttempting DB connection using environment variables...');
      const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASS, database: DB_NAME });
      console.log('  ✓ Connected to database:', DB_NAME, '@', DB_HOST);

      const tablesToCheck = ['PMAINTENANCE','ASSET','INVENTORY','CUSTOMER','PROJECT','SOLUTION_PRINCIPAL'];
      for (const t of tablesToCheck) {
        try {
          const [rows] = await conn.execute(`SELECT 1 FROM ${t} LIMIT 1`);
          console.log(`  ✓ Table exists: ${t}`);
        } catch (err) {
          console.log(`  ✗ Table missing or inaccessible: ${t} -> ${err.message}`);
        }
      }

      await conn.end();
    } catch (err) {
      console.log('  ✗ DB connection failed:', err.message);
    }
  })();
} else {
  console.log('\nDB env vars not fully set. Skipping DB connectivity checks.');
  console.log('Set DB_HOST, DB_USER, DB_PASS (optional), DB_NAME to enable checks.');
}
