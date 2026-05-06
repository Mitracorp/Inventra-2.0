const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const seedData = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'inventra_db'
  });

  try {
    console.log('🌱 Seeding sample data...');

    // First, import the user dump
    const dumpPath = path.join(__dirname, '../ivmscom_Inventra_dump.sql');
    const dumpContent = fs.readFileSync(dumpPath, 'utf8');
    
    // Clean and execute dump statements
    const dumpStatements = dumpContent
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt && !stmt.startsWith('--') && !stmt.startsWith('/*'));

    console.log('📥 Importing user data from dump...');
    for (const statement of dumpStatements) {
      try {
        if (statement.length > 10) {
          await connection.query(statement);
        }
      } catch (err) {
        // Silently skip SET variable errors
        if (!err.message.includes("can't be set") && !err.message.includes('Unknown command')) {
          console.warn('⚠️', err.message.substring(0, 60));
        }
      }
    }

    // Insert sample categories
    console.log('📁 Adding sample categories...');
    const categories = ['Laptop', 'Desktop', 'Monitor', 'Printer', 'Network Equipment'];
    for (const category of categories) {
      await connection.query(
        'INSERT IGNORE INTO CATEGORY (Category) VALUES (?)',
        [category]
      );
    }

    // Insert sample models
    console.log('💻 Adding sample models...');
    const models = [
      { name: 'Dell XPS 13', category: 'Laptop' },
      { name: 'HP Pavilion Desktop', category: 'Desktop' },
      { name: 'LG 27" Monitor', category: 'Monitor' },
      { name: 'Canon LaserJet', category: 'Printer' },
      { name: 'Cisco Switch', category: 'Network Equipment' }
    ];

    for (const model of models) {
      const [catResult] = await connection.query(
        'SELECT Category_ID FROM CATEGORY WHERE Category = ?',
        [model.category]
      );
      const catId = catResult[0]?.Category_ID || 1;
      
      await connection.query(
        'INSERT IGNORE INTO MODEL (Model_Name, Category_ID) VALUES (?, ?)',
        [model.name, catId]
      );
    }

    // Insert sample customers
    console.log('🏢 Adding sample customers...');
    const customers = [
      { ref: 'CUST001', name: 'Acme Corporation', branch: 'Kuala Lumpur' },
      { ref: 'CUST002', name: 'TechSoft Solutions', branch: 'Singapore' },
      { ref: 'CUST003', name: 'Global Enterprises', branch: 'Petaling Jaya' }
    ];

    for (const customer of customers) {
      await connection.query(
        'INSERT IGNORE INTO CUSTOMER (Customer_Ref_Number, Customer_Name, Branch) VALUES (?, ?, ?)',
        [customer.ref, customer.name, customer.branch]
      );
    }

    // Insert sample recipients
    console.log('👥 Adding sample recipients...');
    const recipients = [
      { name: 'John Doe', dept: 'IT', pos: 'IT Manager' },
      { name: 'Jane Smith', dept: 'HR', pos: 'HR Director' },
      { name: 'Mike Johnson', dept: 'Finance', pos: 'CFO' }
    ];

    for (const recipient of recipients) {
      await connection.query(
        'INSERT IGNORE INTO RECIPIENTS (Recipient_Name, Department, Position) VALUES (?, ?, ?)',
        [recipient.name, recipient.dept, recipient.pos]
      );
    }

    // Insert sample projects
    console.log('📋 Adding sample projects...');
    const projects = [
      { ref: 'PRJ001', title: 'Office IT Infrastructure', warranty: '3 Years', pm: 'Monthly' },
      { ref: 'PRJ002', title: 'Network Upgrade', warranty: '2 Years', pm: 'Quarterly' },
      { ref: 'PRJ003', title: 'Server Maintenance', warranty: 'Lifetime', pm: 'Monthly' }
    ];

    for (const project of projects) {
      await connection.query(
        'INSERT IGNORE INTO PROJECT (Project_Ref_Number, Project_Title, Warranty, Preventive_Maintenance, PM_Frequency) VALUES (?, ?, ?, ?, ?)',
        [project.ref, project.title, project.warranty, project.pm, 1]
      );
    }

    // Insert sample assets
    console.log('📦 Adding sample assets...');
    const assets = [
      { serial: 'DELL-XPS-2024-001', tag: 'ASSET-001', name: 'Dell XPS Laptop', model: 'Dell XPS 13', cat: 'Laptop', status: 'Active', windows: 'Windows 11', office: 'Yes', av: 'Norton' },
      { serial: 'HP-PAVIL-2024-002', tag: 'ASSET-002', name: 'HP Desktop Computer', model: 'HP Pavilion Desktop', cat: 'Desktop', status: 'Active', windows: 'Windows 10', office: 'Yes', av: 'McAfee' },
      { serial: 'LG-MON-2024-003', tag: 'ASSET-003', name: '27 inch Monitor', model: 'LG 27" Monitor', cat: 'Monitor', status: 'Active', windows: 'N/A', office: 'N/A', av: 'N/A' },
      { serial: 'CANON-PRN-2024-004', tag: 'ASSET-004', name: 'Canon Printer', model: 'Canon LaserJet', cat: 'Printer', status: 'Active', windows: 'N/A', office: 'N/A', av: 'N/A' },
      { serial: 'CISCO-SW-2024-005', tag: 'ASSET-005', name: 'Cisco Network Switch', model: 'Cisco Switch', cat: 'Network Equipment', status: 'Active', windows: 'N/A', office: 'N/A', av: 'N/A' }
    ];

    for (const asset of assets) {
      const [catResult] = await connection.query(
        'SELECT Category_ID FROM CATEGORY WHERE Category = ?',
        [asset.cat]
      );
      const catId = catResult[0]?.Category_ID || 1;

      const [modelResult] = await connection.query(
        'SELECT Model_ID FROM MODEL WHERE Model_Name = ?',
        [asset.model]
      );
      const modelId = modelResult[0]?.Model_ID || 1;

      const [recipResult] = await connection.query(
        'SELECT Recipients_ID FROM RECIPIENTS LIMIT 1'
      );
      const recipId = recipResult[0]?.Recipients_ID || 1;

      await connection.query(
        'INSERT IGNORE INTO ASSET (Asset_Serial_Number, Asset_Tag_ID, Item_Name, Model_ID, Category_ID, Recipients_ID, Status, Windows, Microsoft_Office, AV) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [asset.serial, asset.tag, asset.name, modelId, catId, recipId, asset.status, asset.windows, asset.office, asset.av]
      );
    }

    // Create inventory records
    console.log('📊 Creating inventory records...');
    const [projects2] = await connection.query('SELECT Project_ID FROM PROJECT LIMIT 1');
    const projId = projects2[0]?.Project_ID || 1;

    const [customers2] = await connection.query('SELECT Customer_ID FROM CUSTOMER LIMIT 1');
    const custId = customers2[0]?.Customer_ID || 1;

    const [assets2] = await connection.query('SELECT Asset_ID FROM ASSET');
    for (const asset of assets2) {
      await connection.query(
        'INSERT IGNORE INTO INVENTORY (Project_ID, Customer_ID, Asset_ID) VALUES (?, ?, ?)',
        [projId, custId, asset.Asset_ID]
      );
    }

    // Check final counts
    const [assetCount] = await connection.query('SELECT COUNT(*) as count FROM ASSET');
    const [userCount] = await connection.query('SELECT COUNT(*) as count FROM USER');
    const [categoryCount] = await connection.query('SELECT COUNT(*) as count FROM CATEGORY');

    console.log('\n✅ Seeding complete!');
    console.log(`   📦 Assets: ${assetCount[0].count}`);
    console.log(`   👤 Users: ${userCount[0].count}`);
    console.log(`   📁 Categories: ${categoryCount[0].count}`);

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

seedData();
