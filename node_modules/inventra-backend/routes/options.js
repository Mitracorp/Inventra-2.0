const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Get all Windows versions
router.get('/windows', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT DISTINCT Windows FROM ASSET WHERE Windows IS NOT NULL AND Windows != "" ORDER BY Windows DESC'
    );
    const versions = rows.map(row => row.Windows);
    
    // Add default options if none exist
    const defaultVersions = ['Windows 10', 'Windows 11', 'Windows Server', 'None'];
    const allVersions = [...new Set([...defaultVersions, ...versions])].sort((a, b) => b.localeCompare(a));
    
    res.json({ success: true, data: allVersions });
  } catch (error) {
    console.error('Error fetching Windows versions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch Windows versions' });
  }
});

// Add new Windows version
router.post('/windows', async (req, res) => {
  try {
    const { value } = req.body;
    
    if (!value || !value.trim()) {
      return res.status(400).json({ success: false, error: 'Value is required' });
    }

    // Check if it already exists
    const [existing] = await pool.execute(
      'SELECT Windows FROM ASSET WHERE Windows = ? LIMIT 1',
      [value.trim()]
    );

    if (existing.length > 0) {
      return res.json({ success: true, message: 'Version already exists', data: value.trim() });
    }

    res.json({ success: true, message: 'Windows version can now be used', data: value.trim() });
  } catch (error) {
    console.error('Error adding Windows version:', error);
    res.status(500).json({ success: false, error: 'Failed to add Windows version' });
  }
});

// Get all Office versions
router.get('/office', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT DISTINCT Microsoft_Office FROM ASSET WHERE Microsoft_Office IS NOT NULL AND Microsoft_Office != "" ORDER BY Microsoft_Office DESC'
    );
    const versions = rows.map(row => row.Microsoft_Office);
    
    // Add default options if none exist
    const defaultVersions = ['Office 2019', 'Office 2021', 'Microsoft 365', 'None'];
    const allVersions = [...new Set([...defaultVersions, ...versions])].sort((a, b) => b.localeCompare(a));
    
    res.json({ success: true, data: allVersions });
  } catch (error) {
    console.error('Error fetching Office versions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch Office versions' });
  }
});

// Add new Office version
router.post('/office', async (req, res) => {
  try {
    const { value } = req.body;
    
    if (!value || !value.trim()) {
      return res.status(400).json({ success: false, error: 'Value is required' });
    }

    // Check if it already exists
    const [existing] = await pool.execute(
      'SELECT Microsoft_Office FROM ASSET WHERE Microsoft_Office = ? LIMIT 1',
      [value.trim()]
    );

    if (existing.length > 0) {
      return res.json({ success: true, message: 'Version already exists', data: value.trim() });
    }

    res.json({ success: true, message: 'Office version can now be used', data: value.trim() });
  } catch (error) {
    console.error('Error adding Office version:', error);
    res.status(500).json({ success: false, error: 'Failed to add Office version' });
  }
});

// Get all Software options (with price)
router.get('/software', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT Software_ID, Software_Name, Price FROM SOFTWARE ORDER BY Software_Name'
    );
    // Filter out 'None' entries - these shouldn't be in the dropdown
    const software = rows
      .filter(row => row.Software_Name.toLowerCase() !== 'none')
      .map(row => ({
        Software_ID: row.Software_ID,
        Software_Name: row.Software_Name,
        Price: row.Price
      }));
    
    res.json({ success: true, data: software });
  } catch (error) {
    console.error('Error fetching software:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch software' });
  }
});

// Add new Software (with price)
router.post('/software', async (req, res) => {
  try {
    const { value, price } = req.body;
    
    if (!value || !value.trim()) {
      return res.status(400).json({ success: false, error: 'Value is required' });
    }

    // Validate price (optional but if provided must be a number)
    if (price !== null && price !== undefined && price !== '' && isNaN(Number(price))) {
      return res.status(400).json({ success: false, error: 'Price must be a number' });
    }

    // Prevent 'None' from being added as a software option
    if (value.trim().toLowerCase() === 'none') {
      return res.status(400).json({ success: false, error: 'Cannot add "None" as a software option' });
    }

    // Check if it already exists
    const [existing] = await pool.execute(
      'SELECT Software_ID, Price FROM SOFTWARE WHERE Software_Name = ?',
      [value.trim()]
    );

    if (existing.length > 0) {
      return res.json({ success: true, message: 'Software already exists', data: {
        Software_ID: existing[0].Software_ID,
        Software_Name: value.trim(),
        Price: existing[0].Price
      } });
    }

    // Insert new software
    const [result] = await pool.execute(
      'INSERT INTO SOFTWARE (Software_Name, Price) VALUES (?, ?)',
      [value.trim(), price !== '' && price !== null && price !== undefined ? Number(price) : null]
    );

    res.json({ 
      success: true, 
      message: 'Software added successfully', 
      data: {
        Software_ID: result.insertId,
        Software_Name: value.trim(),
        Price: price !== '' && price !== null && price !== undefined ? Number(price) : null
      },
      id: result.insertId 
    });
  } catch (error) {
    console.error('Error adding software:', error);
    res.status(500).json({ success: false, error: 'Failed to add software' });
  }
});

// Get all Antivirus options
router.get('/antivirus', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT DISTINCT Antivirus FROM PROJECT WHERE Antivirus IS NOT NULL AND Antivirus != "" ORDER BY Antivirus'
    );
    const antivirusList = rows.map(row => row.Antivirus);
    
    res.json({ success: true, data: antivirusList });
  } catch (error) {
    console.error('Error fetching antivirus:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch antivirus' });
  }
});

// Add new Antivirus
router.post('/antivirus', async (req, res) => {
  try {
    const { value } = req.body;
    
    if (!value || !value.trim()) {
      return res.status(400).json({ success: false, error: 'Value is required' });
    }

    // Check if it already exists
    const [existing] = await pool.execute(
      'SELECT Antivirus FROM PROJECT WHERE Antivirus = ? LIMIT 1',
      [value.trim()]
    );

    if (existing.length > 0) {
      return res.json({ success: true, message: 'Antivirus already exists', data: value.trim() });
    }

    res.json({ success: true, message: 'Antivirus can now be used', data: value.trim() });
  } catch (error) {
    console.error('Error adding antivirus:', error);
    res.status(500).json({ success: false, error: 'Failed to add antivirus' });
  }
});

// Get all customers
router.get('/customers', async (req, res) => {
  try {
    // Get distinct customer names with their reference numbers
    const [rows] = await pool.execute(`
      SELECT DISTINCT 
        Customer_Name, 
        Customer_Ref_Number,
        MIN(Customer_ID) as Customer_ID
      FROM CUSTOMER 
      GROUP BY Customer_Name, Customer_Ref_Number
      ORDER BY Customer_Name
    `);
    res.json({ success: true, customers: rows });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch customers' });
  }
});

// Get branches for a specific customer name
router.get('/customer-branches/:customerName', async (req, res) => {
  try {
    const { customerName } = req.params;
    const [rows] = await pool.execute(
      'SELECT DISTINCT Branch FROM CUSTOMER WHERE Customer_Name = ? AND Branch IS NOT NULL AND Branch != "" ORDER BY Branch',
      [customerName]
    );
    const branches = rows.map(row => row.Branch);
    res.json({ success: true, branches });
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch branches' });
  }
});

// Get all asset categories
router.get('/asset-categories', async (req, res) => {
  try {
    const { customer, branch } = req.query;
    
    // If customer and branch are provided, filter categories by assets in that branch
    if (customer && branch) {
      const [rows] = await pool.execute(
        `SELECT DISTINCT c.Category 
         FROM CATEGORY c
         INNER JOIN ASSET a ON c.Category_ID = a.Category_ID
         INNER JOIN INVENTORY i ON a.Asset_ID = i.Asset_ID
         INNER JOIN CUSTOMER cu ON i.Customer_ID = cu.Customer_ID
         WHERE cu.Customer_Name = ? 
         AND cu.Branch = ?
         AND c.Category IS NOT NULL 
         AND c.Category != ""
         ORDER BY c.Category`,
        [customer, branch]
      );
      const categories = rows.map(row => row.Category);
      return res.json({ success: true, categories });
    }
    
    // Default: return all categories
    const [rows] = await pool.execute(
      'SELECT DISTINCT Category_ID, Category FROM CATEGORY WHERE Category IS NOT NULL AND Category != "" ORDER BY Category'
    );
    const categories = rows.map(row => row.Category);
    res.json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

module.exports = router;
