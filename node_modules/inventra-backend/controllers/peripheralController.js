const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get all peripheral types for dropdown/autocomplete
 */
const getAllPeripheralTypes = async (req, res, next) => {
  try {
    const [peripheralTypes] = await pool.execute(`
      SELECT 
        Peripheral_Type_ID as id,
        Peripheral_Type_Name as name,
        Peripheral_Type_ID,
        Peripheral_Type_Name
      FROM PERIPHERAL_TYPE 
      ORDER BY Peripheral_Type_Name ASC
    `);

    res.status(200).json({
      success: true,
      data: peripheralTypes
    });
  } catch (error) {
    logger.error('Error in getAllPeripheralTypes:', error);
    console.error('Error fetching peripheral types:', error);
    
    // Return fallback peripheral types if database query fails
    const fallbackPeripheralTypes = [
      { id: 1, name: 'Keyboard', Peripheral_Type_ID: 1, Peripheral_Type_Name: 'Keyboard' },
      { id: 2, name: 'Mouse', Peripheral_Type_ID: 2, Peripheral_Type_Name: 'Mouse' },
      { id: 3, name: 'Monitor', Peripheral_Type_ID: 3, Peripheral_Type_Name: 'Monitor' },
      { id: 4, name: 'Ethernet Cable', Peripheral_Type_ID: 4, Peripheral_Type_Name: 'Ethernet Cable' },
      { id: 5, name: 'Power Cable', Peripheral_Type_ID: 5, Peripheral_Type_Name: 'Power Cable' }
    ];
    
    res.status(200).json({
      success: true,
      data: fallbackPeripheralTypes,
      fallback: true
    });
  }
};

/**
 * Get or create peripheral type by name (hybrid functionality)
 * This is the core method for supporting free-text + dropdown behavior
 */
const getOrCreatePeripheralType = async (req, res, next) => {
  try {
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Peripheral type name is required and must be a non-empty string'
      });
    }

    const peripheralTypeName = name.trim();
    console.log(`Getting or creating peripheral type: "${peripheralTypeName}"`);

    // First try to find existing peripheral type (case-insensitive)
    const [existing] = await pool.execute(
      'SELECT Peripheral_Type_ID, Peripheral_Type_Name FROM PERIPHERAL_TYPE WHERE LOWER(Peripheral_Type_Name) = LOWER(?)',
      [peripheralTypeName]
    );
    
    if (existing.length > 0) {
      console.log(`Found existing peripheral type: ID=${existing[0].Peripheral_Type_ID}, Name="${existing[0].Peripheral_Type_Name}"`);
      return res.status(200).json({
        success: true,
        data: {
          id: existing[0].Peripheral_Type_ID,
          name: existing[0].Peripheral_Type_Name,
          Peripheral_Type_ID: existing[0].Peripheral_Type_ID,
          Peripheral_Type_Name: existing[0].Peripheral_Type_Name,
          isNew: false
        }
      });
    }

    // Create new peripheral type
    const [result] = await pool.execute(
      'INSERT INTO PERIPHERAL_TYPE (Peripheral_Type_Name) VALUES (?)',
      [peripheralTypeName]
    );

    const newPeripheralTypeId = result.insertId;
    console.log(`✅ Created new peripheral type: ID=${newPeripheralTypeId}, Name="${peripheralTypeName}"`);

    logger.info(`New peripheral type created: ${peripheralTypeName} (ID: ${newPeripheralTypeId}) by user ${req.user?.userId || 'system'}`);

    res.status(201).json({
      success: true,
      data: {
        id: newPeripheralTypeId,
        name: peripheralTypeName,
        Peripheral_Type_ID: newPeripheralTypeId,
        Peripheral_Type_Name: peripheralTypeName,
        isNew: true
      },
      message: `New peripheral type "${peripheralTypeName}" created successfully`
    });
  } catch (error) {
    // Handle duplicate key error (in case of race condition)
    if (error.code === 'ER_DUP_ENTRY') {
      try {
        // Try to get the peripheral type that was created by another request
        const [existing] = await pool.execute(
          'SELECT Peripheral_Type_ID, Peripheral_Type_Name FROM PERIPHERAL_TYPE WHERE LOWER(Peripheral_Type_Name) = LOWER(?)',
          [req.body.name.trim()]
        );
        
        if (existing.length > 0) {
          return res.status(200).json({
            success: true,
            data: {
              id: existing[0].Peripheral_Type_ID,
              name: existing[0].Peripheral_Type_Name,
              Peripheral_Type_ID: existing[0].Peripheral_Type_ID,
              Peripheral_Type_Name: existing[0].Peripheral_Type_Name,
              isNew: false
            }
          });
        }
      } catch (retryError) {
        console.error('Error in retry after duplicate:', retryError);
      }
    }

    logger.error('Error in getOrCreatePeripheralType:', error);
    console.error('Error getting/creating peripheral type:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get or create peripheral type',
      message: error.message
    });
  }
};

/**
 * Search peripheral types by partial name match
 */
const searchPeripheralTypes = async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim() === '') {
      // Return all peripheral types if no search query
      return getAllPeripheralTypes(req, res, next);
    }

    const searchTerm = `%${q.trim()}%`;
    
    const [peripheralTypes] = await pool.execute(`
      SELECT 
        Peripheral_Type_ID as id,
        Peripheral_Type_Name as name,
        Peripheral_Type_ID,
        Peripheral_Type_Name
      FROM PERIPHERAL_TYPE 
      WHERE Peripheral_Type_Name LIKE ?
      ORDER BY 
        CASE WHEN Peripheral_Type_Name LIKE ? THEN 1 ELSE 2 END,  -- Exact matches first
        Peripheral_Type_Name ASC
      LIMIT 20
    `, [searchTerm, q.trim()]);

    res.status(200).json({
      success: true,
      data: peripheralTypes,
      query: q.trim()
    });
  } catch (error) {
    logger.error('Error in searchPeripheralTypes:', error);
    console.error('Error searching peripheral types:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to search peripheral types'
    });
  }
};

/**
 * Create a peripheral record for an asset
 */
const createPeripheral = async (req, res, next) => {
  try {
    const { 
      asset_id, 
      peripheral_type_name, 
      serial_code, 
      condition = 'Good', 
      remarks = '' 
    } = req.body;
    
    if (!asset_id || !peripheral_type_name) {
      return res.status(400).json({
        success: false,
        error: 'Asset ID and peripheral type name are required'
      });
    }

    // Get or create peripheral type
    const peripheralTypeName = peripheral_type_name.trim();
    
    // First try to find existing peripheral type
    let peripheralTypeId;
    const [existingType] = await pool.execute(
      'SELECT Peripheral_Type_ID FROM PERIPHERAL_TYPE WHERE LOWER(Peripheral_Type_Name) = LOWER(?)',
      [peripheralTypeName]
    );
    
    if (existingType.length > 0) {
      peripheralTypeId = existingType[0].Peripheral_Type_ID;
      console.log(`Using existing peripheral type: ID=${peripheralTypeId}, Name="${peripheralTypeName}"`);
    } else {
      // Create new peripheral type
      const [typeResult] = await pool.execute(
        'INSERT INTO PERIPHERAL_TYPE (Peripheral_Type_Name) VALUES (?)',
        [peripheralTypeName]
      );
      peripheralTypeId = typeResult.insertId;
      console.log(`✅ Created new peripheral type: ID=${peripheralTypeId}, Name="${peripheralTypeName}"`);
      logger.info(`New peripheral type created: ${peripheralTypeName} (ID: ${peripheralTypeId}) by user ${req.user?.userId || 'system'}`);
    }

    // Create peripheral record
    const [result] = await pool.execute(
      'INSERT INTO PERIPHERAL (Peripheral_Type_ID, Asset_ID, Serial_Code, `Condition`, Remarks) VALUES (?, ?, ?, ?, ?)',
      [peripheralTypeId, asset_id, serial_code || null, condition, remarks]
    );

    const peripheralId = result.insertId;
    console.log(`✅ Created peripheral: ID=${peripheralId}, Asset_ID=${asset_id}, Type="${peripheralTypeName}"`);

    logger.info(`Peripheral created: ${peripheralTypeName} for Asset_ID ${asset_id} by user ${req.user?.userId || 'system'}`);

    res.status(201).json({
      success: true,
      data: {
        peripheral_id: peripheralId,
        peripheral_type_id: peripheralTypeId,
        peripheral_type_name: peripheralTypeName,
        asset_id: asset_id,
        serial_code: serial_code,
        condition: condition,
        remarks: remarks
      },
      message: `Peripheral "${peripheralTypeName}" created successfully`
    });
  } catch (error) {
    logger.error('Error in createPeripheral:', error);
    console.error('Error creating peripheral:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to create peripheral',
      message: error.message
    });
  }
};

/**
 * Get peripherals for a specific asset
 */
const getPeripheralsByAsset = async (req, res, next) => {
  try {
    const { assetId } = req.params;

    const [peripherals] = await pool.execute(`
      SELECT 
        p.Peripheral_ID,
        p.Serial_Code,
        p.Condition,
        p.Remarks,
        pt.Peripheral_Type_ID,
        pt.Peripheral_Type_Name
      FROM PERIPHERAL p
      LEFT JOIN PERIPHERAL_TYPE pt ON p.Peripheral_Type_ID = pt.Peripheral_Type_ID
      WHERE p.Asset_ID = ?
      ORDER BY pt.Peripheral_Type_Name ASC
    `, [assetId]);

    res.status(200).json({
      success: true,
      data: peripherals,
      asset_id: assetId
    });
  } catch (error) {
    logger.error('Error in getPeripheralsByAsset:', error);
    console.error('Error fetching peripherals for asset:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch peripherals'
    });
  }
};

/**
 * Create a new peripheral type explicitly
 */
const createPeripheralType = async (req, res, next) => {
  try {
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Peripheral type name is required and must be a non-empty string'
      });
    }

    const peripheralTypeName = name.trim();

    // Check if peripheral type already exists
    const [existing] = await pool.execute(
      'SELECT Peripheral_Type_ID FROM PERIPHERAL_TYPE WHERE LOWER(Peripheral_Type_Name) = LOWER(?)',
      [peripheralTypeName]
    );
    
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Peripheral type "${peripheralTypeName}" already exists`,
        existingId: existing[0].Peripheral_Type_ID
      });
    }

    // Create new peripheral type
    const [result] = await pool.execute(
      'INSERT INTO PERIPHERAL_TYPE (Peripheral_Type_Name) VALUES (?)',
      [peripheralTypeName]
    );

    const newPeripheralTypeId = result.insertId;
    logger.info(`New peripheral type created: ${peripheralTypeName} (ID: ${newPeripheralTypeId}) by user ${req.user?.userId || 'system'}`);

    res.status(201).json({
      success: true,
      data: {
        id: newPeripheralTypeId,
        name: peripheralTypeName,
        Peripheral_Type_ID: newPeripheralTypeId,
        Peripheral_Type_Name: peripheralTypeName
      },
      message: `Peripheral type "${peripheralTypeName}" created successfully`
    });
  } catch (error) {
    logger.error('Error in createPeripheralType:', error);
    console.error('Error creating peripheral type:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to create peripheral type',
      message: error.message
    });
  }
};

module.exports = {
  getAllPeripheralTypes,
  getOrCreatePeripheralType,
  searchPeripheralTypes,
  createPeripheral,
  getPeripheralsByAsset,
  createPeripheralType
};