const Asset = require('../models/Asset');
const { formatResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const { logAssetChange, detectChanges } = require('../utils/auditLogger');
const { pool } = require('../config/database');

/**
 * Get all assets with pagination and filtering
 */
const getAllAssets = async (req, res, next) => {
  try {
    const userRole = req.user?.role;
    console.log('🔍 getAllAssets - User Role:', userRole);
    
    // Check if user is customer-type role (not Admin or Staff)
    const isCustomerRole = userRole && 
      userRole.toLowerCase() !== 'admin' && 
      userRole.toLowerCase() !== 'staff';
    
    console.log('🔍 Is Customer Role:', isCustomerRole);
    
    // Extract pagination and filtering parameters from query
    const {
      page = 1,
      limit = 25,
      search = '',
      sortField = 'Asset_ID',
      sortDirection = 'DESC',
      flagged = '' // New parameter for flagged assets filter
    } = req.query;
    
    // Extract column filters (parameters starting with filter_)
    const columnFilters = {};
    Object.keys(req.query).forEach(key => {
      if (key.startsWith('filter_')) {
        const columnName = key.replace('filter_', '');
        columnFilters[columnName] = req.query[key];
      }
    });
    
    // Calculate offset
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Get allowed Project_IDs for customer-type users
    let allowedProjectIds = null;
    
    if (isCustomerRole) {
      console.log('🔍 Filtering assets for customer:', userRole);
      try {
        // 1. Find Customer_IDs where Customer_Name matches user's role
        const [customerRows] = await pool.execute(
          'SELECT DISTINCT Customer_ID FROM CUSTOMER WHERE Customer_Name = ?',
          [userRole]
        );
        
        console.log('🔍 Found customer IDs:', customerRows);
        
        if (customerRows.length === 0) {
          // No matching customer found - return empty result
          return res.status(200).json({
            success: true,
            data: [],
            pagination: {
              currentPage: parseInt(page),
              totalPages: 0,
              totalItems: 0,
              itemsPerPage: parseInt(limit)
            },
            message: 'No assets found for your account'
          });
        }
        
        const customerIds = customerRows.map(row => row.Customer_ID);
        
        // 2. Get Project_IDs from INVENTORY for these customers
        const placeholders = customerIds.map(() => '?').join(',');
        const query = `SELECT DISTINCT i.Project_ID 
                       FROM INVENTORY i 
                       WHERE i.Customer_ID IN (${placeholders}) AND i.Project_ID IS NOT NULL`;
        console.log('🔍 Executing query:', query);
        console.log('🔍 With parameters:', customerIds);
        
        const [inventoryRows] = await pool.execute(query, customerIds);
        
        console.log('🔍 Found project IDs from inventory:', inventoryRows);
        
        if (inventoryRows.length === 0) {
          return res.status(200).json({
            success: true,
            data: [],
            pagination: {
              currentPage: parseInt(page),
              totalPages: 0,
              totalItems: 0,
              itemsPerPage: parseInt(limit)
            },
            message: 'No assets found for your account'
          });
        }
        
        allowedProjectIds = inventoryRows.map(row => row.Project_ID);
        console.log('🔍 Allowed Project IDs:', allowedProjectIds);
      } catch (dbError) {
        console.error('❌ Database error during customer filtering:', dbError);
        throw dbError;
      }
    } else {
      console.log('🔍 User is Admin/Staff - showing all assets');
    }
    
    // Get assets with pagination and customer filtering
    const result = await Asset.findAll({
      limit: parseInt(limit),
      offset,
      search,
      sortField,
      sortDirection,
      flagged: flagged === 'true' || flagged === '1', // Convert to boolean
      columnFilters,
      allowedProjectIds // Pass allowed project IDs for filtering
    });

    // Return paginated response
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error in getAllAssets:', error);
    console.error('Error fetching assets from database:', error);
    
    // Return proper error instead of mock data
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assets from database',
      message: error.message,
      details: 'Please check database connection and ensure the server is connected to: ivmscom_Inventra'
    });
  }
};

/**
 * Get single asset by ID
 */
const getAssetById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const asset = await Asset.findById(id);

    if (!asset) {
      return res.status(404).json({
        error: 'Asset not found'
      });
    }

    res.status(200).json(asset);
  } catch (error) {
    logger.error('Error in getAssetById:', error);
    res.status(500).json({
      error: 'Failed to fetch asset',
      message: error.message
    });
  }
};

/**
 * Get single asset by serial number
 */
const getAssetBySerialNumber = async (req, res, next) => {
  try {
    const { serialNumber } = req.params;
    
    // For now, we'll search through all assets to find by serial number
    // In a production app, you'd want a dedicated method for this
    const allAssets = await Asset.findAll();
    const asset = allAssets.find(a => a.Asset_Serial_Number === serialNumber);

    if (!asset) {
      return res.status(404).json({
        error: 'Asset not found'
      });
    }

    res.status(200).json(asset);
  } catch (error) {
    logger.error('Error in getAssetBySerialNumber:', error);
    res.status(500).json({
      error: 'Failed to fetch asset',
      message: error.message
    });
  }
};

/**
 * Get complete asset detail by ID (includes project, customer, peripherals)
 */
const getAssetDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const assetDetail = await Asset.findDetailById(id);

    if (!assetDetail) {
      return res.status(404).json({
        error: 'Asset not found'
      });
    }

    res.status(200).json(assetDetail);
  } catch (error) {
    logger.error('Error in getAssetDetail:', error);
    res.status(500).json({
      error: 'Failed to fetch asset detail',
      message: error.message
    });
  }
};

/**
 * Create new asset
 */
const createAsset = async (req, res, next) => {
  try {
    const assetData = req.body;

    // Check if asset with same serial number already exists
    const existingAsset = await Asset.findBySerialNumber(assetData.serialNumber);
    if (existingAsset) {
      return res.status(400).json(
        formatResponse(false, null, 'Asset with this serial number already exists')
      );
    }

    const assetId = await Asset.create(assetData);
    const newAsset = await Asset.findBySerialNumber(assetData.serialNumber);

    logger.info(`Asset created: ${assetData.serialNumber} by user ${req.user?.userId}`);

    res.status(201).json(
      formatResponse(true, newAsset, 'Asset created successfully')
    );
  } catch (error) {
    logger.error('Error in createAsset:', error);
    next(error);
  }
};
const createAssetWithDetails = async (req, res, next, importCache = null) => {
  try {
    const completeData = req.body;
    console.log('Creating asset with complete details:', completeData);

    // Validate required fields
    if (!completeData.project_reference_num || !completeData.serial_number || !completeData.tag_id || !completeData.item_name) {
      console.log('Validation failed - missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: project_reference_num, serial_number, tag_id, item_name'
      });
    }

    console.log('Checking for existing asset with serial number:', completeData.serial_number);
    
    // Check if asset with same serial number already exists
    const existingAsset = await Asset.findBySerialNumber(completeData.serial_number);
    if (existingAsset) {
      console.log('Asset already exists with serial number:', completeData.serial_number);
      return res.status(400).json({
        success: false,
        error: 'Asset with this serial number already exists'
      });
    }

    console.log('Creating recipient...');
    // Step 1: Get or create recipient
    let recipientId = null;
    if (completeData.recipient_name) {
      if (!completeData.department_name) {
        console.log('   ℹ️  No department provided, using default');
        completeData.department_name = 'N/A';
      }
      recipientId = await Asset.createRecipient(
        completeData.recipient_name,
        completeData.department_name,
        completeData.position || null
      );
      console.log('Recipient created with ID:', recipientId);
    } else {
      console.log('   ℹ️  No recipient data provided (recipient_name:', completeData.recipient_name, ', department:', completeData.department_name, ')');
    }

    console.log('Creating/getting category...');
    // Step 2: Get or create category (with cache support)
    let categoryId = null;
    if (completeData.category) {
      categoryId = await Asset.getOrCreateCategory(completeData.category, importCache);
      console.log('Category ID:', categoryId);
    }

    console.log('Creating/getting model...');
    // Step 3: Get or create model (with category link and cache support)
    let modelId = null;
    if (completeData.model) {
      modelId = await Asset.getOrCreateModel(completeData.model, categoryId, importCache);
      console.log('Model ID:', modelId, '(linked to Category ID:', categoryId, ')');
    }

    console.log('Processing Windows and MS Office versions...');
    // Step 3.5: Process Windows and MS Office with cache support
    let windowsVersion = null;
    const normalizedWindows = normalizeNullValue(completeData.windows);
    if (normalizedWindows) {
      windowsVersion = await Asset.getOrCreateWindows(normalizedWindows, importCache);
      console.log('Windows version:', windowsVersion);
    }
    
    let msOfficeVersion = null;
    const normalizedMsOffice = normalizeNullValue(completeData.microsoft_office);
    if (normalizedMsOffice) {
      msOfficeVersion = await Asset.getOrCreateMicrosoftOffice(normalizedMsOffice, importCache);
      console.log('MS Office version:', msOfficeVersion);
    }

    console.log('Creating asset record...');
    // Step 4: Create the asset
    const assetData = {
      Asset_Serial_Number: completeData.serial_number,
      Asset_Tag_ID: completeData.tag_id,
      Item_Name: completeData.item_name,
      Status: normalizeStatus(completeData.status),
      Recipients_ID: recipientId,
      Category_ID: categoryId,
      Model_ID: modelId,
      Windows: windowsVersion,
      Microsoft_Office: msOfficeVersion,
      Monthly_Prices: completeData.monthly_prices || null,
      AV: completeData.av !== undefined ? completeData.av : null
    };

    const newAsset = await Asset.create(assetData);
    console.log('Asset created:', newAsset);

    console.log('Creating peripherals...');
    // Step 5: Create peripherals if provided
    let peripheralIds = [];
    if (completeData.peripherals && Array.isArray(completeData.peripherals)) {
      console.log(`Found ${completeData.peripherals.length} peripherals to create`);
      console.log('Peripheral array:', JSON.stringify(completeData.peripherals, null, 2));
      const PeripheralImporter = require('../utils/peripheralImporter');
      
      for (const peripheral of completeData.peripherals) {
        console.log('Processing peripheral:', JSON.stringify(peripheral, null, 2));
        
        // Normalize peripheral name and serial code
        const normalizedPeripheralName = normalizeNullValue(peripheral.peripheral_name);
        const normalizedSerialCode = normalizeNullValue(peripheral.serial_code || peripheral.serial_code_name);
        
        console.log('peripheral.peripheral_name check:', {
          exists: !!normalizedPeripheralName,
          value: normalizedPeripheralName,
          type: typeof normalizedPeripheralName
        });
        
        if (normalizedPeripheralName) {
          try {
            // Check for duplicate peripheral before creating
            const isDuplicate = await PeripheralImporter.checkDuplicatePeripheral(
              newAsset.Asset_ID,
              normalizedPeripheralName,
              normalizedSerialCode
            );
            
            if (isDuplicate) {
              console.log(`⚠️  Skipping duplicate peripheral: ${normalizedPeripheralName} (${normalizedSerialCode || 'N/A'})`);
              continue; // Skip this peripheral
            }
            
            console.log(`🔧 Creating peripheral with data:`, {
              peripheral_name: normalizedPeripheralName,
              serial_code: normalizedSerialCode,
              condition: peripheral.condition,
              remarks: peripheral.remarks
            });
            
            const peripheralId = await Asset.createPeripheral(
              newAsset.Asset_ID,
              normalizedPeripheralName,
              normalizedSerialCode,
              peripheral.condition || 'Good',
              peripheral.remarks
            );
            peripheralIds.push(peripheralId);
            console.log('Peripheral created with ID:', peripheralId);
          } catch (peripheralError) {
            console.error('❌ Failed to create peripheral:', {
              peripheral_name: peripheral.peripheral_name,
              serial_code: peripheral.serial_code,
              asset_id: newAsset.Asset_ID,
              error_message: peripheralError.message,
              error_code: peripheralError.code,
              error_stack: peripheralError.stack
            });
            // Continue with other peripherals
          }
        } else {
          console.warn('⚠️  Skipping peripheral - missing peripheral_name:', JSON.stringify(peripheral, null, 2));
        }
      }
      console.log(`✅ Created ${peripheralIds.length} peripherals`);
    } else {
      console.log('No peripherals to create');
    }

    console.log('Linking software...');
    // Step 5.5: Link software to asset if provided (supports software name with price) with cache support
    if (completeData.softwareWithPrice && Array.isArray(completeData.softwareWithPrice)) {
      // New format: software with name and price
      console.log(`Processing ${completeData.softwareWithPrice.length} software item(s) with prices:`, completeData.softwareWithPrice);
      
      for (const softwareItem of completeData.softwareWithPrice) {
        if (softwareItem.name && softwareItem.name.trim() && softwareItem.name.toLowerCase() !== 'none') {
          try {
            // Get or create software with price
            const softwareId = await Asset.getOrCreateSoftwareWithPrice(
              softwareItem.name.trim(), 
              softwareItem.price, 
              importCache
            );
            
            if (softwareId) {
              // Link software to asset
              await pool.execute(
                'INSERT IGNORE INTO ASSET_SOFTWARE_BRIDGE (Asset_ID, Software_ID) VALUES (?, ?)',
                [newAsset.Asset_ID, softwareId]
              );
              console.log(`✅ Linked software: ${softwareItem.name} (ID: ${softwareId}, Price: ${softwareItem.price || 'N/A'})`);
            }
          } catch (softwareError) {
            console.log(`Failed to link software "${softwareItem.name}":`, softwareError.message);
            // Continue with other software
          }
        }
      }
    } else if (completeData.software) {
      // Legacy format: handle both array and string
      const softwareList = Array.isArray(completeData.software) 
        ? completeData.software 
        : [completeData.software];
      
      console.log(`Processing ${softwareList.length} software item(s):`, softwareList);
      
      for (const softwareName of softwareList) {
        if (softwareName && softwareName.trim() && softwareName.toLowerCase() !== 'none') {
          try {
            await Asset.linkSoftwareToAsset(newAsset.Asset_ID, softwareName.trim(), importCache);
            console.log(`✅ Linked software: ${softwareName}`);
          } catch (softwareError) {
            console.log(`Failed to link software "${softwareName}":`, softwareError.message);
            // Continue with other software
          }
        } else if (softwareName && softwareName.toLowerCase() === 'none') {
          console.log('✅ Software set to None - skipping');
        }
      }
    } else {
      console.log('No software to link');
    }

    console.log('Linking to project...');
    // Step 6: Link to project/customer via inventory
    let inventoryId = null;
    if (completeData.project_reference_num) {
      // Project reference is the minimum required field
      const customerName = completeData.customer_name || 'Unknown Customer';
      const branch = completeData.branch || completeData.customer_reference_number || 'Default Branch';
      
      console.log(`📦 Preparing inventory link with:`, {
        Asset_ID: newAsset.Asset_ID,
        project_reference_num: completeData.project_reference_num,
        customer_name: customerName,
        branch: branch
      });
      
      try {
        inventoryId = await Asset.linkToProject(
          newAsset.Asset_ID,
          completeData.project_reference_num,
          customerName,
          branch
        );
        console.log(`✅ LINKED TO PROJECT: Asset_ID ${newAsset.Asset_ID} → Inventory_ID ${inventoryId}`);
      } catch (linkError) {
        console.error('❌ Failed to link to project:', {
          error: linkError.message,
          asset_id: newAsset.Asset_ID,
          project_ref: completeData.project_reference_num,
          customer: customerName,
          branch: branch
        });
        // Continue anyway
      }
    } else {
      console.log(`⚠️  No project reference provided - creating basic inventory record for asset ${newAsset.Asset_ID}`);
      // Create a basic inventory record without project/customer linkage
      // This ensures the asset appears in inventory even without a project assignment
      try {
        const [result] = await pool.execute(
          'INSERT INTO INVENTORY (Asset_ID) VALUES (?)',
          [newAsset.Asset_ID]
        );
        inventoryId = result.insertId;
        console.log(`✅ CREATED BASIC INVENTORY: Asset_ID ${newAsset.Asset_ID} → Inventory_ID ${inventoryId} (no project/customer)`);
      } catch (inventoryError) {
        console.error('❌ Failed to create basic inventory record:', {
          error: inventoryError.message,
          asset_id: newAsset.Asset_ID
        });
        // Continue anyway - asset exists even without inventory
      }
    }

    // Step 7: PM record creation - DISABLED (PM records should be created manually only)
    // console.log('Creating PM record...');
    let pmId = null;
    // PM records are no longer automatically created for new assets
    // They should be created manually through the Preventive Maintenance module
    console.log('Skipping automatic PM record creation - PM records should be created manually');

    console.log('Fetching complete asset data...');
    // Fetch the complete asset data to return
    const completeAsset = await Asset.findDetailById(newAsset.Asset_ID);

    logger.info(`Asset created with details: ${completeData.serial_number} by user ${req.user?.userId || 'system'}`);

    // Log the creation in audit log
    const userId = req.user?.User_ID || req.user?.userId || 1;
    const username = req.user?.Username || req.user?.username || 'System';
    await logAssetChange(
      userId,
      newAsset.Asset_ID,
      'INSERT',
      `${username} created new Asset ${completeData.serial_number}`,
      []
    );

    console.log('Sending success response with asset data:', {
      Asset_ID: newAsset.Asset_ID,
      Serial_Number: completeAsset?.Asset_Serial_Number,
      Peripherals_Count: completeAsset?.Peripherals?.length || 0
    });
    res.status(201).json({
      success: true,
      message: `Asset ${completeData.serial_number} created successfully with ${peripheralIds.length} peripherals`,
      data: {
        ...completeAsset,
        asset_id: newAsset.Asset_ID,
        serial_number: completeAsset?.Asset_Serial_Number || completeData.serial_number,
        tag_id: completeAsset?.Asset_Tag_ID || completeData.tag_id,
        item_name: completeAsset?.Item_Name || completeData.item_name,
        category: completeAsset?.Category || completeData.category,
        model: completeAsset?.Model || completeData.model,
        recipient_name: completeAsset?.Recipient_Name || completeData.recipient_name,
        peripherals_created: peripheralIds.length,
        pmid: null, // PM records are created manually only
        inventory_id: inventoryId,
        peripheral_ids: peripheralIds
      },
      message: 'Asset created successfully - PM records should be created manually when needed'
    });
  } catch (error) {
    logger.error('Error in createAssetWithDetails:', error);
    console.error('Error creating asset with details:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to create asset',
      message: error.message
    });
  }
};

/**
 * Update asset by ID
 */
const updateAssetById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log('Updating asset ID:', id);
    console.log('Update data received:', updateData);

    // Check if asset exists
    const existingAsset = await Asset.findById(id);
    if (!existingAsset) {
      return res.status(404).json({
        error: 'Asset not found'
      });
    }

    // Handle updates - prioritize direct field updates over name-based lookups
    const finalUpdateData = {};
    
    // Direct field updates
    if (updateData.Asset_Serial_Number) finalUpdateData.Asset_Serial_Number = updateData.Asset_Serial_Number;
    if (updateData.Asset_Tag_ID) finalUpdateData.Asset_Tag_ID = updateData.Asset_Tag_ID;
    if (updateData.Item_Name) finalUpdateData.Item_Name = updateData.Item_Name;
    if (updateData.Status) finalUpdateData.Status = updateData.Status;
    
    // Add Windows, Office, and Monthly_Prices fields
    if (updateData.Windows !== undefined) finalUpdateData.Windows = updateData.Windows;
    if (updateData.Microsoft_Office !== undefined) finalUpdateData.Microsoft_Office = updateData.Microsoft_Office;
    if (updateData.Monthly_Prices !== undefined) finalUpdateData.Monthly_Prices = updateData.Monthly_Prices;
    
    // For ID fields, use them directly if provided
    if (updateData.Recipients_ID) finalUpdateData.Recipients_ID = updateData.Recipients_ID;
    if (updateData.Category_ID) finalUpdateData.Category_ID = updateData.Category_ID;
    if (updateData.Model_ID) finalUpdateData.Model_ID = updateData.Model_ID;

    // Handle name-based updates by updating existing records in-place
    if (updateData.Recipient_Name || updateData.Department || updateData.Position !== undefined) {
      try {
        const recipientId = await Asset.updateRecipientInfo(
          updateData.Recipient_Name,
          updateData.Department,
          updateData.Position,
          existingAsset.Recipients_ID
        );
        if (recipientId) {
          finalUpdateData.Recipients_ID = recipientId;
          console.log('Updated Recipients_ID to:', recipientId);
        }
      } catch (error) {
        console.warn('Could not update recipient information:', error.message);
      }
    }

    if (updateData.Category) {
      try {
        const categoryId = await Asset.updateCategoryInfo(updateData.Category, existingAsset.Category_ID);
        if (categoryId) {
          finalUpdateData.Category_ID = categoryId;
          console.log('Updated Category_ID to:', categoryId);
        }
      } catch (error) {
        console.warn('Could not update category:', error.message);
      }
    }

    if (updateData.Model) {
      try {
        // Pass the current or updated category ID to link model with category
        const categoryIdForModel = finalUpdateData.Category_ID || existingAsset.Category_ID;
        const modelId = await Asset.updateModelInfo(updateData.Model, existingAsset.Model_ID, categoryIdForModel);
        if (modelId) {
          finalUpdateData.Model_ID = modelId;
          console.log('Updated Model_ID to:', modelId, 'with Category_ID:', categoryIdForModel);
        }
      } catch (error) {
        console.warn('Could not update model:', error.message);
      }
    }

    // Handle Software update through bridge table (Software is not a column in ASSET table)
    // Support both softwareLinks array (from Edit Asset page) and Software string (legacy)
    if (updateData.softwareLinks !== undefined) {
      try {
        console.log('Updating software links (array format):', updateData.softwareLinks);
        
        // Remove all existing software links for this asset
        await pool.execute(
          'DELETE FROM ASSET_SOFTWARE_BRIDGE WHERE Asset_ID = ?',
          [id]
        );
        console.log('✅ Removed existing software links');
        
        // Add new software links
        if (Array.isArray(updateData.softwareLinks) && updateData.softwareLinks.length > 0) {
          for (const software of updateData.softwareLinks) {
            if (software.Software_ID) {
              // Insert the software link directly using the provided ID
              await pool.execute(
                'INSERT INTO ASSET_SOFTWARE_BRIDGE (Asset_ID, Software_ID) VALUES (?, ?)',
                [id, software.Software_ID]
              );
              console.log(`✅ Linked software ID ${software.Software_ID} (${software.Software_Name}) to asset`);
            }
          }
        }
      } catch (error) {
        console.error('Error updating software links:', error);
        console.warn('Could not update software links:', error.message);
      }
    } else if (updateData.Software !== undefined) {
      // Legacy support for single Software string
      try {
        if (updateData.Software && updateData.Software.trim()) {
          if (updateData.Software.toLowerCase() !== 'none') {
            await Asset.linkSoftwareToAsset(id, updateData.Software.trim());
            console.log('Updated software link:', updateData.Software);
          } else {
            console.log('Software set to None - asset has no software');
          }
        }
      } catch (error) {
        console.warn('Could not update software link:', error.message);
      }
    }

    // Handle Customer and Branch update (these are in INVENTORY table via CUSTOMER)
    if (updateData.Customer_Name !== undefined || updateData.Branch !== undefined) {
      try {
        console.log('Updating customer/branch information');
        
        // Get the current inventory record for this asset
        const [inventoryRows] = await pool.execute(
          'SELECT Inventory_ID, Customer_ID FROM INVENTORY WHERE Asset_ID = ? LIMIT 1',
          [id]
        );
        
        if (inventoryRows.length > 0) {
          const inventoryRecord = inventoryRows[0];
          
          // Get or create customer record
          const customerName = updateData.Customer_Name || existingAsset.Customer_Name;
          const branch = updateData.Branch || existingAsset.Branch;
          
          if (customerName && branch) {
            // Check if customer exists with this name and branch
            const [customerRows] = await pool.execute(
              'SELECT Customer_ID FROM CUSTOMER WHERE Customer_Name = ? AND Branch = ?',
              [customerName, branch]
            );
            
            let customerId;
            if (customerRows.length > 0) {
              customerId = customerRows[0].Customer_ID;
              console.log('Found existing customer ID:', customerId);
            } else {
              // Create new customer record
              const [insertResult] = await pool.execute(
                'INSERT INTO CUSTOMER (Customer_Name, Branch) VALUES (?, ?)',
                [customerName, branch]
              );
              customerId = insertResult.insertId;
              console.log('Created new customer with ID:', customerId);
            }
            
            // Update inventory record with new customer ID
            await pool.execute(
              'UPDATE INVENTORY SET Customer_ID = ? WHERE Inventory_ID = ?',
              [customerId, inventoryRecord.Inventory_ID]
            );
            console.log('Updated inventory record with Customer_ID:', customerId);
          }
        }
      } catch (error) {
        console.error('Error updating customer/branch:', error);
        console.warn('Could not update customer/branch information:', error.message);
      }
    }

    // Handle Peripherals update
    let peripheralsUpdated = false;
    if (updateData.peripherals && Array.isArray(updateData.peripherals)) {
      try {
        console.log('Updating peripherals for asset:', id);
        console.log('Peripheral data received:', updateData.peripherals);
        
        // Get existing peripherals for this asset
        const [existingPeripherals] = await pool.execute(
          'SELECT Peripheral_ID FROM PERIPHERAL WHERE Asset_ID = ?',
          [id]
        );
        
        // Track which peripherals to keep (ones with IDs that we update)
        const peripheralsToKeep = new Set();
        
        // Process each peripheral from the request
        for (const peripheral of updateData.peripherals) {
          // Skip empty peripherals
          if (!peripheral.Peripheral_Type_Name && !peripheral.Serial_Code && !peripheral.Condition && !peripheral.Remarks) {
            continue;
          }
          
          // Get or create peripheral type
          let peripheralTypeId = null;
          if (peripheral.Peripheral_Type_Name) {
            const [typeRows] = await pool.execute(
              'SELECT Peripheral_Type_ID FROM PERIPHERAL_TYPE WHERE Peripheral_Type_Name = ?',
              [peripheral.Peripheral_Type_Name]
            );
            
            if (typeRows.length > 0) {
              peripheralTypeId = typeRows[0].Peripheral_Type_ID;
            } else {
              // Create new peripheral type if it doesn't exist
              const [insertResult] = await pool.execute(
                'INSERT INTO PERIPHERAL_TYPE (Peripheral_Type_Name) VALUES (?)',
                [peripheral.Peripheral_Type_Name]
              );
              peripheralTypeId = insertResult.insertId;
              console.log('Created new peripheral type:', peripheral.Peripheral_Type_Name, 'with ID:', peripheralTypeId);
            }
          }
          
          if (peripheral.Peripheral_ID) {
            // Update existing peripheral
            await pool.execute(
              `UPDATE PERIPHERAL 
               SET Peripheral_Type_ID = ?, Serial_Code = ?, \`Condition\` = ?, Remarks = ?
               WHERE Peripheral_ID = ? AND Asset_ID = ?`,
              [
                peripheralTypeId,
                peripheral.Serial_Code || null,
                peripheral.Condition || null,
                peripheral.Remarks || null,
                peripheral.Peripheral_ID,
                id
              ]
            );
            peripheralsToKeep.add(peripheral.Peripheral_ID);
            console.log('Updated peripheral ID:', peripheral.Peripheral_ID);
            peripheralsUpdated = true;
          } else {
            // Insert new peripheral
            const [insertResult] = await pool.execute(
              'INSERT INTO PERIPHERAL (Asset_ID, Peripheral_Type_ID, Serial_Code, `Condition`, Remarks) VALUES (?, ?, ?, ?, ?)',
              [
                id,
                peripheralTypeId,
                peripheral.Serial_Code || null,
                peripheral.Condition || null,
                peripheral.Remarks || null
              ]
            );
            peripheralsToKeep.add(insertResult.insertId);
            console.log('Created new peripheral with ID:', insertResult.insertId);
            peripheralsUpdated = true;
          }
        }
        
        // Delete peripherals that were removed (not in the update list)
        for (const existing of existingPeripherals) {
          if (!peripheralsToKeep.has(existing.Peripheral_ID)) {
            await pool.execute(
              'DELETE FROM PERIPHERAL WHERE Peripheral_ID = ?',
              [existing.Peripheral_ID]
            );
            console.log('Deleted peripheral ID:', existing.Peripheral_ID);
            peripheralsUpdated = true;
          }
        }
        
        console.log('Peripheral update completed successfully');
      } catch (error) {
        console.error('Error updating peripherals:', error);
        console.warn('Could not update peripherals:', error.message);
      }
    }

    console.log('Final update data:', finalUpdateData);

    // Ensure we have data to update (either asset fields or peripherals)
    if (Object.keys(finalUpdateData).length === 0 && !peripheralsUpdated) {
      console.log('No valid updates to apply');
      return res.status(400).json({
        error: 'No valid updates provided'
      });
    }

    // Detect changes for audit log
    let changes = [];
    
    // Update the asset properties if there are any changes
    if (Object.keys(finalUpdateData).length > 0) {
      Object.assign(existingAsset, finalUpdateData);
      changes = detectChanges(existingAsset, finalUpdateData);
    
      // Get user ID from request for audit logging
      const userId = req.user?.User_ID || req.user?.userId || null;
      
      // Save the updated asset (pass userId for trigger)
      console.log('Executing update for Asset_ID:', existingAsset.Asset_ID);
      await existingAsset.update(userId);
    }
    
    // Log the update if there are changes
    if (changes.length > 0) {
      const userId = req.user?.User_ID || req.user?.userId || 1;
      const username = req.user?.Username || req.user?.username || 'System';
      const assetSerial = existingAsset.Asset_Serial_Number;
      
      // Create description for each change
      for (const change of changes) {
        const description = `${username} change ${change.fieldName} for ${assetSerial} from ${change.oldValue} to ${change.newValue}`;
        await logAssetChange(
          userId,
          existingAsset.Asset_ID,
          'UPDATE',
          description,
          [change]
        );
      }
    }
    
    // Fetch the updated asset to return with joined data
    const updatedAsset = await Asset.findById(id);

    console.log('Asset updated successfully:', updatedAsset);

    // Verify the update was applied correctly
    if (updatedAsset) {
      const verificationLog = {};
      if (finalUpdateData.Asset_Serial_Number) verificationLog.Serial = `${existingAsset.Asset_Serial_Number} -> ${updatedAsset.Asset_Serial_Number}`;
      if (finalUpdateData.Recipients_ID) verificationLog.Recipient = `ID ${finalUpdateData.Recipients_ID} -> ${updatedAsset.Recipient_Name}`;
      if (finalUpdateData.Category_ID) verificationLog.Category = `ID ${finalUpdateData.Category_ID} -> ${updatedAsset.Category}`;
      if (finalUpdateData.Model_ID) verificationLog.Model = `ID ${finalUpdateData.Model_ID} -> ${updatedAsset.Model}`;
      
      console.log('Update verification:', verificationLog);
    }

    logger.info(`Asset updated: ID ${id} by user ${req.user?.userId || 'unknown'}`);

    res.status(200).json(updatedAsset);
  } catch (error) {
    logger.error('Error in updateAssetById:', error);
    console.error('Error updating asset:', error);
    res.status(500).json({
      error: 'Failed to update asset',
      message: error.message
    });
  }
};

/**
 * Update asset
 */
const updateAsset = async (req, res, next) => {
  try {
    const { serialNumber } = req.params;
    const updateData = req.body;

    // Check if asset exists
    const existingAsset = await Asset.findBySerialNumber(serialNumber);
    if (!existingAsset) {
      return res.status(404).json(
        formatResponse(false, null, 'Asset not found')
      );
    }

    const success = await Asset.update(serialNumber, updateData);
    if (!success) {
      return res.status(400).json(
        formatResponse(false, null, 'Failed to update asset')
      );
    }

    const updatedAsset = await Asset.findBySerialNumber(serialNumber);

    logger.info(`Asset updated: ${serialNumber} by user ${req.user?.userId}`);

    res.status(200).json(
      formatResponse(true, updatedAsset, 'Asset updated successfully')
    );
  } catch (error) {
    logger.error('Error in updateAsset:', error);
    next(error);
  }
};

/**
 * Delete asset
 */
const deleteAsset = async (req, res, next) => {
  try {
    const { serialNumber } = req.params;

    // Check if asset exists
    const existingAsset = await Asset.findBySerialNumber(serialNumber);
    if (!existingAsset) {
      return res.status(404).json(
        formatResponse(false, null, 'Asset not found')
      );
    }

    const success = await Asset.delete(serialNumber);
    if (!success) {
      return res.status(400).json(
        formatResponse(false, null, 'Failed to delete asset')
      );
    }

    // Log the deletion
    const userId = req.user?.User_ID || req.user?.userId || 1;
    const username = req.user?.Username || req.user?.username || 'System';
    await logAssetChange(
      userId,
      existingAsset.Asset_ID,
      'DELETE',
      `${username} deleted Asset ${serialNumber}`,
      []
    );

    logger.info(`Asset deleted: ${serialNumber} by user ${req.user?.userId}`);

    res.status(200).json(
      formatResponse(true, null, 'Asset deleted successfully')
    );
  } catch (error) {
    logger.error('Error in deleteAsset:', error);
    next(error);
  }
};

/**
 * Delete asset by ID (with cascade deletion of peripherals and PM records)
 */
const deleteAssetById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log(`Delete request received for Asset_ID: ${id}`);

    // Check if asset exists and get its details
    const existingAsset = await Asset.findById(id);
    if (!existingAsset) {
      console.log(`Asset not found with ID: ${id}`);
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }

    console.log(`Found asset: ${existingAsset.Asset_Serial_Number}`);

    // Delete asset (this will cascade delete peripherals and PM records due to foreign key constraints)
    const result = await Asset.deleteById(id);
    
    if (!result.success) {
      console.error(`Failed to delete asset: ${result.error}`);
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to delete asset'
      });
    }

    logger.info(`Asset deleted: ID ${id}, Serial: ${existingAsset.Asset_Serial_Number}, Peripherals: ${result.peripheralsDeleted}, PM Records: ${result.pmRecordsDeleted}, PM Results: ${result.pmResultsDeleted}, Software Links: ${result.softwareLinksDeleted}, Inventory Rows Deleted: ${result.inventoryDeleted}, Inventory Rows Nulled: ${result.inventoryNulled}`);

    res.status(200).json({
      success: true,
      message: 'Asset and related records deleted successfully',
      data: {
        asset_id: id,
        serial_number: existingAsset.Asset_Serial_Number,
        peripherals_deleted: result.peripheralsDeleted,
        pm_records_deleted: result.pmRecordsDeleted,
        pm_results_deleted: result.pmResultsDeleted,
        software_links_deleted: result.softwareLinksDeleted,
        inventory_deleted: result.inventoryDeleted,
        inventory_nulled: result.inventoryNulled,
        // Backwards compatibility (previous field name)
        inventory_updated: result.inventoryUpdated
      }
    });
  } catch (error) {
    logger.error('Error in deleteAssetById:', error);
    console.error('Error deleting asset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete asset',
      message: error.message
    });
  }
};

/**
 * Get asset statistics for dashboard
 */
const getAssetStatistics = async (req, res, next) => {
  try {
    console.log('=== getAssetStatistics CONTROLLER CALLED ===');
    
    const Project = require('../models/Project');
    
    const statistics = await Asset.getStatistics();
    console.log('Statistics from Asset.getStatistics():', statistics);
    
    const projectStats = await Project.getStatistics();
    console.log('Project statistics:', projectStats);
    
    // Add project count as total customers (1 project = 1 customer)
    statistics.totalProjects = projectStats.total;

    console.log('Final statistics to send:', statistics);

    res.status(200).json(
      formatResponse(true, statistics, 'Asset statistics retrieved successfully')
    );
  } catch (error) {
    logger.error('Error in getAssetStatistics:', error);
    
    // Return proper error instead of mock data
    res.status(500).json(
      formatResponse(false, null, 'Failed to fetch asset statistics from database', { error: error.message })
    );
  }
};

/**
 * Helper function to process new asset creation in bulk
 */
const processNewAssets = async (assets) => {
  const results = {
    imported: 0,
    failed: 0,
    errors: []
  };

  for (const assetData of assets) {
    try {
      // Check if asset already exists
      const existingAsset = await Asset.findBySerialNumber(assetData.serial_number);
      if (existingAsset) {
        results.failed++;
        results.errors.push({
          serial_number: assetData.serial_number,
          error: 'Asset with this serial number already exists'
        });
        continue;
      }

      // Get or create recipient
      let recipientId = null;
      console.log(`   📋 Recipient data check:`, {
        recipient_name: assetData.recipient_name,
        department: assetData.department,
        department_name: assetData.department_name,
        position: assetData.position
      });
      
      if (assetData.recipient_name && assetData.recipient_name.trim() !== '') {
        try {
          const department = assetData.department_name || assetData.department || 'N/A';
          const position = assetData.position || 'N/A';
          
          console.log(`   👤 Creating recipient with: Name="${assetData.recipient_name}", Dept="${department}", Position="${position}"`);
          
          recipientId = await Asset.createRecipient(
            assetData.recipient_name.trim(),
            department,
            position
          );
          
          console.log(`   ✅ Recipient assigned: ID=${recipientId}, Name="${assetData.recipient_name}"`);
        } catch (recipientError) {
          console.error(`   ❌ Failed to create recipient:`, recipientError);
          console.error(`   Error details:`, recipientError.message);
          // Continue without recipient - asset can be created without one
        }
      } else {
        console.log(`   ⏭️  No recipient name provided, skipping recipient creation`);
      }

      // Get or create category (auto-creates new if not exists)
      let categoryId = null;
      if (assetData.category) {
        try {
          categoryId = await Asset.getOrCreateCategory(assetData.category);
          console.log(`   📦 Category ID: ${categoryId}`);
        } catch (categoryError) {
          console.log(`   ⚠️  Failed to get/create category: ${categoryError.message}`);
        }
      }

      // Get or create model (auto-creates new if not exists) - LINKED TO CATEGORY
      let modelId = null;
      if (assetData.model) {
        try {
          // Pass categoryId to link model with category
          modelId = await Asset.getOrCreateModel(assetData.model, categoryId);
          console.log(`   🏷️  Model ID: ${modelId} (linked to Category ID: ${categoryId})`);
        } catch (modelError) {
          console.log(`   ⚠️  Failed to get/create model: ${modelError.message}`);
        }
      }

      // Link software to asset (auto-creates new if not exists)
      // Special handling: 'None' means no software (don't link anything)
      let softwareToLink = null;
      let hasNoSoftware = false;
      if (assetData.software) {
        if (assetData.software.toLowerCase() === 'none') {
          hasNoSoftware = true;
          console.log(`   💿 Software set to None - asset has no software`);
        } else {
          softwareToLink = assetData.software;
          console.log(`   💿 Software to link: ${softwareToLink}`);
        }
      }

      // Create the asset
      const assetToCreate = {
        Asset_Serial_Number: assetData.serial_number,
        Asset_Tag_ID: assetData.tag_id,
        Item_Name: assetData.item_name,
        Status: normalizeStatus(assetData.status),
        Recipients_ID: recipientId,
        Category_ID: categoryId,
        Model_ID: modelId,
        Windows: assetData.windows || null,
        Microsoft_Office: assetData.microsoft_office || null,
        Monthly_Prices: assetData.monthly_prices || null
      };

      console.log(`   📦 Creating asset with data:`, {
        Serial: assetToCreate.Asset_Serial_Number,
        Recipients_ID: assetToCreate.Recipients_ID,
        Category_ID: assetToCreate.Category_ID,
        Model_ID: assetToCreate.Model_ID,
        Windows: assetToCreate.Windows,
        Microsoft_Office: assetToCreate.Microsoft_Office,
        Monthly_Prices: assetToCreate.Monthly_Prices
      });
      
      console.log(`   🔍 Raw field values from assetData:`, {
        windows: assetData.windows,
        microsoft_office: assetData.microsoft_office,
        monthly_prices: assetData.monthly_prices
      });

      const newAsset = await Asset.create(assetToCreate);
      console.log(`   ✅ Asset created: ID=${newAsset.Asset_ID}, Recipients_ID=${newAsset.Recipients_ID}`);
      
      // Verify recipient was saved
      if (recipientId && !newAsset.Recipients_ID) {
        console.error(`   ⚠️  WARNING: Recipient ID ${recipientId} was not saved to asset!`);
      }

      // Link software to asset via bridge table
      if (softwareToLink) {
        try {
          await Asset.linkSoftwareToAsset(newAsset.Asset_ID, softwareToLink);
          console.log(`   💿 Linked software: ${softwareToLink}`);
        } catch (softwareError) {
          console.log(`   ⚠️  Failed to link software: ${softwareError.message}`);
        }
      }

      // Create peripherals if provided - split comma-separated values
      if (assetData.peripherals && Array.isArray(assetData.peripherals)) {
        console.log(`   🔧 Creating ${assetData.peripherals.length} peripheral(s)...`);
        for (const peripheral of assetData.peripherals) {
          // Split comma-separated peripheral names and serial codes
          const peripheralNames = peripheral.peripheral_name ? 
            String(peripheral.peripheral_name).split(',').map(s => s.trim()).filter(s => s) : [];
          const serialCodes = peripheral.serial_code ? 
            String(peripheral.serial_code).split(',').map(s => s.trim()).filter(s => s) : [];
          
          // If single peripheral (no commas), add as-is
          if (peripheralNames.length <= 1 && serialCodes.length <= 1) {
            if (peripheral.peripheral_name) {
              try {
                const peripheralId = await Asset.createPeripheral(
                  newAsset.Asset_ID,
                  peripheral.peripheral_name,
                  peripheral.serial_code || null,
                  peripheral.condition || 'Good',
                  peripheral.remarks || null
                );
                console.log(`   ✅ Created peripheral: ${peripheral.peripheral_name} (ID: ${peripheralId}, Serial: ${peripheral.serial_code || 'N/A'})`);
              } catch (pError) {
                console.log(`   ⚠️  Failed to create peripheral ${peripheral.peripheral_name}: ${pError.message}`);
              }
            }
          } else {
            // Split into multiple peripherals
            const maxLength = Math.max(peripheralNames.length, serialCodes.length);
            for (let i = 0; i < maxLength; i++) {
              const newPeripheral = {
                peripheral_name: null,
                serial_code: null,
                condition: peripheral.condition || 'Good',
                remarks: peripheral.remarks || null
              };
              
              if (i < peripheralNames.length && peripheralNames[i]) {
                newPeripheral.peripheral_name = peripheralNames[i];
              }
              
              if (i < serialCodes.length && serialCodes[i]) {
                newPeripheral.serial_code = serialCodes[i];
              }
              
              if (newPeripheral.peripheral_name) {
                try {
                  const peripheralId = await Asset.createPeripheral(
                    newAsset.Asset_ID,
                    newPeripheral.peripheral_name,
                    newPeripheral.serial_code || null,
                    newPeripheral.condition,
                    newPeripheral.remarks
                  );
                  console.log(`   ✅ Created peripheral: ${newPeripheral.peripheral_name} (ID: ${peripheralId}, Serial: ${newPeripheral.serial_code || 'N/A'})`);
                } catch (pError) {
                  console.log(`   ⚠️  Failed to create peripheral ${newPeripheral.peripheral_name}: ${pError.message}`);
                }
              }
            }
          }
        }
      }

      // Link to project/customer via inventory
      if (assetData.project_ref_num && assetData.customer_name && assetData.branch) {
        try {
          const inventoryId = await Asset.linkToProject(
            newAsset.Asset_ID,
            assetData.project_ref_num,
            assetData.customer_name,
            assetData.branch
          );
          console.log(`   🔗 Linked asset ${assetData.serial_number} to project ${assetData.project_ref_num} (Inventory_ID: ${inventoryId})`);
        } catch (linkError) {
          console.log(`   ❌ CRITICAL: Failed to link to project: ${linkError.message}`);
          console.log(`   ⚠️  Asset created but orphaned - will not appear in asset list`);
          console.log(`   📋 Project data: ref=${assetData.project_ref_num}, customer=${assetData.customer_name}, branch=${assetData.branch}`);
          // This is critical - asset won't show in the list without inventory link
          throw new Error(`Failed to link asset to project: ${linkError.message}`);
        }
      } else {
        console.log(`   ⚠️  Missing project data - asset will be orphaned`);
        console.log(`   📋 Provided: project_ref_num=${assetData.project_ref_num}, customer_name=${assetData.customer_name}, branch=${assetData.branch}`);
        throw new Error('Cannot create asset without project link - project_ref_num, customer_name, and branch are required');
      }

      results.imported++;
      console.log(`   ✅ Created asset: ${assetData.serial_number}`);
      
    } catch (error) {
      results.failed++;
      results.errors.push({
        serial_number: assetData.serial_number || 'Unknown',
        error: error.message
      });
      console.error(`   ❌ Failed to create asset ${assetData.serial_number}:`, error.message);
    }
  }

  return results;
};

/**
 * Validate import data and detect new options that will be created
 * @route POST /api/v1/assets/validate-import
 */
const validateImportData = async (req, res, next) => {
  try {
    const { assets } = req.body;

    console.log('=== Validate Import Data Request ===');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Assets received:', assets ? `${assets.length} items` : 'null/undefined');
    
    if (!Array.isArray(assets) || assets.length === 0) {
      console.log('❌ Validation failed: assets is not a valid array');
      return res.status(400).json({
        success: false,
        error: 'Assets array is required'
      });
    }

    // Log first asset structure for debugging
    if (assets.length > 0) {
      console.log('First asset structure:', JSON.stringify(assets[0], null, 2));
    }

    console.log(`✓ Validating import data for ${assets.length} assets...`);

    const { pool } = require('../config/database');
    const newOptions = {
      categories: new Set(),
      models: new Set(),
      software: new Set(),
      windows: new Set(),
      office: new Set(),
      peripheralTypes: new Set()
    };

    // Get existing options from database
    console.log('Fetching existing categories...');
    const [existingCategories] = await pool.execute(
      'SELECT DISTINCT Category FROM CATEGORY WHERE Category IS NOT NULL'
    );
    console.log(`✓ Found ${existingCategories.length} categories`);
    
    console.log('Fetching existing models...');
    const [existingModels] = await pool.execute(
      'SELECT DISTINCT Model_Name FROM MODEL WHERE Model_Name IS NOT NULL'
    );
    console.log(`✓ Found ${existingModels.length} models`);
    
    console.log('Fetching existing software...');
    const [existingSoftware] = await pool.execute(
      'SELECT DISTINCT Software_Name FROM SOFTWARE WHERE Software_Name IS NOT NULL'
    );
    console.log(`✓ Found ${existingSoftware.length} software`);
    
    console.log('Fetching existing peripheral types...');
    const [existingPeripheralTypes] = await pool.execute(
      'SELECT DISTINCT Peripheral_Type_Name FROM PERIPHERAL_TYPE WHERE Peripheral_Type_Name IS NOT NULL'
    );
    console.log(`✓ Found ${existingPeripheralTypes.length} peripheral types`);
    
    console.log('Fetching existing Windows versions...');
    const [existingWindows] = await pool.execute(
      'SELECT DISTINCT Windows FROM ASSET WHERE Windows IS NOT NULL AND Windows != ""'
    );
    console.log(`✓ Found ${existingWindows.length} Windows versions`);
    
    console.log('Fetching existing Office versions...');
    const [existingOffice] = await pool.execute(
      'SELECT DISTINCT Microsoft_Office FROM ASSET WHERE Microsoft_Office IS NOT NULL AND Microsoft_Office != ""'
    );
    console.log(`✓ Found ${existingOffice.length} Office versions`);

    console.log('Processing existing data into sets...');
    const existingCategoryNames = new Set(existingCategories.map(c => c.Category.toLowerCase()));
    const existingModelNames = new Set(existingModels.map(m => m.Model_Name.toLowerCase()));
    const existingSoftwareNames = new Set(existingSoftware.map(s => s.Software_Name.toLowerCase()));
    const existingPeripheralTypeNames = new Set(existingPeripheralTypes.map(pt => pt.Peripheral_Type_Name.toLowerCase()));
    const existingWindowsVersions = new Set(existingWindows.map(w => w.Windows.toLowerCase()));
    const existingOfficeVersions = new Set(existingOffice.map(o => o.Microsoft_Office.toLowerCase()));

    console.log('Checking assets for new options with deduplication logic...');
    // Track what we've seen in this import (for deduplication)
    const seenInImport = {
      categories: new Set(),
      models: new Set(),
      software: new Set(),
      windows: new Set(),
      office: new Set()
    };
    
    // Check each asset for new options (only accept first occurrence)
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      
      try {
        // Check category - only accept FIRST new occurrence
        if (asset.category && typeof asset.category === 'string' && asset.category.trim() !== '') {
          const categoryName = asset.category.trim();
          const lowerCategoryName = categoryName.toLowerCase();
          
          // Only add if: 1) Not in database AND 2) First time seeing it in this import
          if (!existingCategoryNames.has(lowerCategoryName) && !seenInImport.categories.has(lowerCategoryName)) {
            newOptions.categories.add(categoryName);
            seenInImport.categories.add(lowerCategoryName);
            console.log(`  ✨ New category detected (first occurrence): "${categoryName}"`);
          } else if (!existingCategoryNames.has(lowerCategoryName)) {
            console.log(`  ⚠️  Duplicate new category skipped: "${categoryName}"`);
          }
        }

        // Check model - only accept FIRST new occurrence
        if (asset.model && typeof asset.model === 'string' && asset.model.trim() !== '') {
          const modelName = asset.model.trim();
          const lowerModelName = modelName.toLowerCase();
          
          // Only add if: 1) Not in database AND 2) First time seeing it in this import
          if (!existingModelNames.has(lowerModelName) && !seenInImport.models.has(lowerModelName)) {
            newOptions.models.add(modelName);
            seenInImport.models.add(lowerModelName);
            console.log(`  ✨ New model detected (first occurrence): "${modelName}"`);
          } else if (!existingModelNames.has(lowerModelName)) {
            console.log(`  ⚠️  Duplicate new model skipped: "${modelName}"`);
          }
        }

        // Check software - only accept FIRST new occurrence (skip 'None' and null-like values)
        const normalizedSoftware = normalizeNullValue(asset.software);
        if (normalizedSoftware && normalizedSoftware.toLowerCase() !== 'none') {
          const softwareName = normalizedSoftware.trim();
          const lowerSoftwareName = softwareName.toLowerCase();
          
          // Only add if: 1) Not in database AND 2) First time seeing it in this import
          if (!existingSoftwareNames.has(lowerSoftwareName) && !seenInImport.software.has(lowerSoftwareName)) {
            newOptions.software.add(softwareName);
            seenInImport.software.add(lowerSoftwareName);
            console.log(`  ✨ New software detected (first occurrence): "${softwareName}"`);
          } else if (!existingSoftwareNames.has(lowerSoftwareName)) {
            console.log(`  ⚠️  Duplicate new software skipped: "${softwareName}"`);
          }
        }

        // Check Windows - only accept FIRST new occurrence (skip null-like values)
        const normalizedWindows = normalizeNullValue(asset.windows);
        if (normalizedWindows) {
          const windowsVersion = normalizedWindows.trim();
          const lowerWindowsVersion = windowsVersion.toLowerCase();
          
          // Only add if: 1) Not in database AND 2) First time seeing it in this import
          if (!existingWindowsVersions.has(lowerWindowsVersion) && !seenInImport.windows.has(lowerWindowsVersion)) {
            newOptions.windows.add(windowsVersion);
            seenInImport.windows.add(lowerWindowsVersion);
            console.log(`  ✨ New Windows version detected (first occurrence): "${windowsVersion}"`);
          } else if (!existingWindowsVersions.has(lowerWindowsVersion)) {
            console.log(`  ⚠️  Duplicate new Windows version skipped: "${windowsVersion}"`);
          }
        }

        // Check Microsoft Office - only accept FIRST new occurrence (skip null-like values)
        const normalizedOffice = normalizeNullValue(asset.microsoft_office);
        if (normalizedOffice) {
          const officeVersion = normalizedOffice.trim();
          const lowerOfficeVersion = officeVersion.toLowerCase();
          
          // Only add if: 1) Not in database AND 2) First time seeing it in this import
          if (!existingOfficeVersions.has(lowerOfficeVersion) && !seenInImport.office.has(lowerOfficeVersion)) {
            newOptions.office.add(officeVersion);
            seenInImport.office.add(lowerOfficeVersion);
            console.log(`  ✨ New MS Office version detected (first occurrence): "${officeVersion}"`);
          } else if (!existingOfficeVersions.has(lowerOfficeVersion)) {
            console.log(`  ⚠️  Duplicate new MS Office version skipped: "${officeVersion}"`);
          }
        }
        
        // Check peripheral types if asset has peripherals (skip null-like values)
        if (asset.peripherals && Array.isArray(asset.peripherals)) {
          asset.peripherals.forEach(peripheral => {
            const normalizedPeripheralName = normalizeNullValue(peripheral.peripheral_name);
            if (normalizedPeripheralName) {
              // Split comma-separated peripheral names
              const peripheralNames = normalizedPeripheralName.split(',').map(s => s.trim()).filter(s => s);
              peripheralNames.forEach(name => {
                if (name && !existingPeripheralTypeNames.has(name.toLowerCase())) {
                  newOptions.peripheralTypes.add(name);
                }
              });
            }
          });
        }
      } catch (assetError) {
        console.error(`Error validating asset at index ${i}:`, assetError);
        console.error('Asset data:', JSON.stringify(asset, null, 2));
        // Continue with other assets - don't fail entire validation
      }
    }

    // Convert sets to arrays for response
    const newOptionsFound = {
      categories: Array.from(newOptions.categories),
      models: Array.from(newOptions.models),
      software: Array.from(newOptions.software),
      windows: Array.from(newOptions.windows),
      office: Array.from(newOptions.office),
      peripheralTypes: Array.from(newOptions.peripheralTypes)
    };

    const totalNewOptions = 
      newOptionsFound.categories.length +
      newOptionsFound.models.length +
      newOptionsFound.software.length +
      newOptionsFound.windows.length +
      newOptionsFound.office.length +
      newOptionsFound.peripheralTypes.length;
      newOptionsFound.office.length;

    console.log(`Validation complete: ${totalNewOptions} new options detected`);
    console.log('New options breakdown:', {
      categories: newOptionsFound.categories,
      models: newOptionsFound.models,
      software: newOptionsFound.software,
      windows: newOptionsFound.windows,
      office: newOptionsFound.office,
      peripheralTypes: newOptionsFound.peripheralTypes
    });

    res.status(200).json({
      success: true,
      hasNewOptions: totalNewOptions > 0,
      newOptions: newOptionsFound,
      summary: {
        totalAssets: assets.length,
        newCategories: newOptionsFound.categories.length,
        newModels: newOptionsFound.models.length,
        newSoftware: newOptionsFound.software.length,
        newWindows: newOptionsFound.windows.length,
        newOffice: newOptionsFound.office.length,
        newPeripheralTypes: newOptionsFound.peripheralTypes.length,
        totalNewOptions: totalNewOptions
      }
    });

  } catch (error) {
    // Force immediate console output
    const errorMessage = `VALIDATION ERROR: ${error.message}`;
    const errorStack = error.stack || 'No stack trace available';
    
    console.error('\n' + '='.repeat(80));
    console.error('❌ ERROR IN VALIDATE IMPORT DATA');
    console.error('='.repeat(80));
    console.error('Error Message:', errorMessage);
    console.error('Error Stack:', errorStack);
    console.error('='.repeat(80) + '\n');
    
    // Also log to ensure it's written immediately
    process.stderr.write(`\n[ERROR] ${errorMessage}\n${errorStack}\n\n`);
    
    res.status(500).json({
      success: false,
      error: 'Failed to validate import data',
      message: error.message,
      stack: errorStack,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Normalize null-like values to actual null
 * Treats 'n/a', 'N/A', '-', empty strings as null
 */
const normalizeNullValue = (value) => {
  if (value === null || value === undefined) return null;
  
  const strValue = String(value).trim();
  
  // Check if value is empty or represents "no value"
  if (strValue === '' || 
      strValue.toLowerCase() === 'n/a' || 
      strValue === '-' ||
      strValue === '--') {
    return null;
  }
  
  return strValue;
};

/**
 * Normalize status value to proper case (Active, Inactive, etc.)
 * Handles case-insensitive input from CSV imports
 */
const normalizeStatus = (status) => {
  if (!status) return 'Active';
  
  const statusLower = String(status).toLowerCase().trim();
  
  // Map common status values to proper case
  const statusMap = {
    'active': 'Active',
    'inactive': 'Inactive',
    'maintenance': 'Maintenance',
    'retired': 'Retired',
    'damaged': 'Damaged',
    'lost': 'Lost',
    'disposed': 'Disposed'
  };
  
  return statusMap[statusLower] || 'Active';
};

/**
 * Compare two asset objects to detect if there are actual changes
 * Returns true if there are differences, false if identical
 */
const hasAssetChanges = (existingAsset, newData) => {
  const changes = [];
  
  // Compare basic fields
  if (newData.tag_id && String(newData.tag_id).trim() !== String(existingAsset.Asset_Tag_ID || '').trim()) {
    changes.push({ field: 'tag_id', old: existingAsset.Asset_Tag_ID, new: newData.tag_id });
  }
  
  if (newData.item_name && String(newData.item_name).trim() !== String(existingAsset.Item_Name || '').trim()) {
    changes.push({ field: 'item_name', old: existingAsset.Item_Name, new: newData.item_name });
  }
  
  if (newData.status && normalizeStatus(newData.status) !== String(existingAsset.Status || '').trim()) {
    changes.push({ field: 'status', old: existingAsset.Status, new: normalizeStatus(newData.status) });
  }
  
  if (newData.category && String(newData.category).trim().toLowerCase() !== String(existingAsset.Category || '').trim().toLowerCase()) {
    changes.push({ field: 'category', old: existingAsset.Category, new: newData.category });
  }
  
  if (newData.model && String(newData.model).trim().toLowerCase() !== String(existingAsset.Model || '').trim().toLowerCase()) {
    changes.push({ field: 'model', old: existingAsset.Model, new: newData.model });
  }
  
  if (newData.recipient_name && String(newData.recipient_name).trim() !== String(existingAsset.Recipient_Name || '').trim()) {
    changes.push({ field: 'recipient_name', old: existingAsset.Recipient_Name, new: newData.recipient_name });
  }
  
  if (newData.department_name && String(newData.department_name).trim() !== String(existingAsset.Department || '').trim()) {
    changes.push({ field: 'department', old: existingAsset.Department, new: newData.department_name });
  }
  
  if (newData.position !== undefined && String(newData.position || '').trim() !== String(existingAsset.Position || '').trim()) {
    changes.push({ field: 'position', old: existingAsset.Position, new: newData.position });
  }
  
  if (newData.branch && String(newData.branch).trim() !== String(existingAsset.Branch || '').trim()) {
    changes.push({ field: 'branch', old: existingAsset.Branch, new: newData.branch });
  }
  
  // Compare project reference number (handle both field name formats)
  const newProjectRefNum = newData.project_reference_num || newData.project_ref_num;
  if (newProjectRefNum) {
    const newProjectRef = String(newProjectRefNum).trim();
    const oldProjectRef = String(existingAsset.Project_Ref_Number || '').trim();
    if (newProjectRef !== oldProjectRef) {
      changes.push({ field: 'project_reference_num', old: oldProjectRef, new: newProjectRef });
    }
  }
  
  if (newData.windows !== undefined) {
    const normalizedNewWindows = normalizeNullValue(newData.windows);
    const normalizedOldWindows = normalizeNullValue(existingAsset.Windows);
    if (normalizedNewWindows !== normalizedOldWindows) {
      changes.push({ field: 'windows', old: existingAsset.Windows, new: normalizedNewWindows });
    }
  }
  
  if (newData.microsoft_office !== undefined) {
    const normalizedNewOffice = normalizeNullValue(newData.microsoft_office);
    const normalizedOldOffice = normalizeNullValue(existingAsset.Microsoft_Office);
    if (normalizedNewOffice !== normalizedOldOffice) {
      changes.push({ field: 'microsoft_office', old: existingAsset.Microsoft_Office, new: normalizedNewOffice });
    }
  }
  
  if (newData.monthly_prices !== undefined) {
    const newPrice = (newData.monthly_prices === null || newData.monthly_prices === '' || newData.monthly_prices === 'N/A') 
      ? null 
      : parseFloat(newData.monthly_prices);
    const oldPrice = (existingAsset.Monthly_Prices === null || existingAsset.Monthly_Prices === '') 
      ? null 
      : parseFloat(existingAsset.Monthly_Prices);
    
    // Handle NaN values from parseFloat
    const newPriceValue = (newPrice !== null && !isNaN(newPrice)) ? newPrice : null;
    const oldPriceValue = (oldPrice !== null && !isNaN(oldPrice)) ? oldPrice : null;
    
    if (newPriceValue !== oldPriceValue) {
      changes.push({ field: 'monthly_prices', old: oldPriceValue, new: newPriceValue });
    }
  }
  
  return { hasChanges: changes.length > 0, changes };
};

/**
 * Update an existing asset with new data from bulk import
 */
const updateExistingAsset = async (existingAsset, newData, importCache) => {
  try {
    const assetId = existingAsset.Asset_ID;
    console.log(`   🔄 Updating existing asset: ${existingAsset.Asset_Serial_Number}`);
    
    const updateData = {};
  
  // Update basic fields
  if (newData.tag_id) updateData.Asset_Tag_ID = String(newData.tag_id).trim();
  if (newData.item_name) updateData.Item_Name = String(newData.item_name).trim();
  if (newData.status) updateData.Status = normalizeStatus(newData.status);
  if (newData.windows !== undefined) updateData.Windows = newData.windows;
  if (newData.microsoft_office !== undefined) updateData.Microsoft_Office = newData.microsoft_office;
  
  // Handle monthly_prices with proper parsing
  if (newData.monthly_prices !== undefined) {
    const newPrice = (newData.monthly_prices === null || newData.monthly_prices === '' || newData.monthly_prices === 'N/A') 
      ? null 
      : parseFloat(newData.monthly_prices);
    updateData.Monthly_Prices = (newPrice !== null && !isNaN(newPrice)) ? newPrice : null;
    console.log(`   💰 Updating Monthly_Prices: ${existingAsset.Monthly_Prices} → ${updateData.Monthly_Prices}`);
  }
  
  // Handle recipient update
  if (newData.recipient_name || newData.department_name || newData.position !== undefined) {
    const recipientId = await Asset.updateRecipientInfo(
      newData.recipient_name || existingAsset.Recipient_Name,
      newData.department_name || existingAsset.Department,
      newData.position !== undefined ? newData.position : existingAsset.Position,
      existingAsset.Recipients_ID
    );
    if (recipientId) updateData.Recipients_ID = recipientId;
  }
  
  // Handle category update
  if (newData.category) {
    const categoryId = await Asset.getOrCreateCategory(newData.category, importCache);
    if (categoryId) updateData.Category_ID = categoryId;
  }
  
  // Handle model update
  if (newData.model) {
    const categoryIdForModel = updateData.Category_ID || existingAsset.Category_ID;
    const modelId = await Asset.getOrCreateModel(newData.model, categoryIdForModel, importCache);
    if (modelId) updateData.Model_ID = modelId;
  }
  
  // Update the asset in database
  if (Object.keys(updateData).length > 0) {
    console.log(`   🔧 Applying updates to asset ${assetId}:`, updateData);
    const asset = new Asset(existingAsset);
    Object.assign(asset, updateData);
    await asset.update();
    console.log(`   ✅ Asset updated successfully: ${asset.Asset_Serial_Number}`);
  } else {
    console.log(`   ℹ️  No database updates needed (only software/customer changes)`);
  }
  
  // Handle software update - remove old software links and add new ones
  // Check if we have new software data to process
  const hasSoftwareUpdate = (newData.softwareWithPrice && newData.softwareWithPrice.length > 0) || 
                           (newData.software && normalizeNullValue(newData.software) && normalizeNullValue(newData.software).toLowerCase() !== 'none');
  
  if (hasSoftwareUpdate) {
    // STEP 1: Remove all existing software links for this asset
    console.log(`   🗑️  Removing old software links for asset ${assetId}...`);
    await pool.execute(
      'DELETE FROM ASSET_SOFTWARE_BRIDGE WHERE Asset_ID = ?',
      [assetId]
    );
    console.log(`   ✅ Old software links removed`);
    
    // STEP 2: Add new software links
    if (newData.softwareWithPrice && newData.softwareWithPrice.length > 0) {
      // New format: software with name and price
      console.log(`   📦 Adding ${newData.softwareWithPrice.length} new software item(s) with prices...`);
      
      for (const softwareItem of newData.softwareWithPrice) {
        if (softwareItem.name && softwareItem.name.trim() && softwareItem.name.toLowerCase() !== 'none') {
          try {
            // Get or create software with price
            const softwareId = await Asset.getOrCreateSoftwareWithPrice(
              softwareItem.name.trim(), 
              softwareItem.price, 
              importCache
            );
            
            if (softwareId) {
              // Link software to asset
              await pool.execute(
                'INSERT IGNORE INTO ASSET_SOFTWARE_BRIDGE (Asset_ID, Software_ID) VALUES (?, ?)',
                [assetId, softwareId]
              );
              console.log(`   ✅ Linked software: ${softwareItem.name} (ID: ${softwareId}, Price: ${softwareItem.price || 'N/A'})`);
            }
          } catch (softwareError) {
            console.log(`   ⚠️  Failed to link software "${softwareItem.name}":`, softwareError.message);
            // Continue with other software
          }
        }
      }
    } else if (newData.software) {
      // Legacy format: single software field
      const normalizedSoftware = normalizeNullValue(newData.software);
      if (normalizedSoftware && normalizedSoftware.toLowerCase() !== 'none') {
        console.log(`   📦 Adding legacy software: ${normalizedSoftware}`);
        await Asset.linkSoftwareToAsset(assetId, normalizedSoftware, importCache);
        console.log(`   ✅ Software linked successfully`);
      }
    }
  } else {
    console.log(`   ℹ️  No software update required`);
  }
  
  // Handle project reference number, customer, and branch updates through inventory
  const [inventoryRows] = await pool.execute(
    'SELECT Inventory_ID, Project_ID, Customer_ID FROM INVENTORY WHERE Asset_ID = ? LIMIT 1',
    [assetId]
  );
  
  if (inventoryRows.length > 0) {
    const inventoryId = inventoryRows[0].Inventory_ID;
    const inventoryUpdates = {};
    
    // Handle project reference number update (support both field name formats)
    const projectRefNum = newData.project_reference_num || newData.project_ref_num;
    if (projectRefNum) {
      const projectRefNumTrimmed = String(projectRefNum).trim();
      const [projectRows] = await pool.execute(
        'SELECT Project_ID FROM PROJECT WHERE Project_Ref_Number = ?',
        [projectRefNumTrimmed]
      );
      
      if (projectRows.length > 0) {
        const newProjectId = projectRows[0].Project_ID;
        if (newProjectId !== inventoryRows[0].Project_ID) {
          inventoryUpdates.Project_ID = newProjectId;
          console.log(`   📋 Updating Project_ID: ${inventoryRows[0].Project_ID} → ${newProjectId} (${projectRefNumTrimmed})`);
        }
      } else {
        console.warn(`   ⚠️  Project not found with reference: ${projectRefNumTrimmed}`);
      }
    }
    
    // Handle customer/branch update
    if (newData.customer_name || newData.branch) {
      const customerName = newData.customer_name || existingAsset.Customer_Name;
      const branch = newData.branch || existingAsset.Branch;
      
      if (customerName && branch) {
        const [customerRows] = await pool.execute(
          'SELECT Customer_ID FROM CUSTOMER WHERE Customer_Name = ? AND Branch = ?',
          [customerName, branch]
        );
        
        let customerId;
        if (customerRows.length > 0) {
          customerId = customerRows[0].Customer_ID;
        } else {
          const [result] = await pool.execute(
            'INSERT INTO CUSTOMER (Customer_Name, Branch) VALUES (?, ?)',
            [customerName, branch]
          );
          customerId = result.insertId;
        }
        
        if (customerId !== inventoryRows[0].Customer_ID) {
          inventoryUpdates.Customer_ID = customerId;
          console.log(`   👤 Updating Customer_ID: ${inventoryRows[0].Customer_ID} → ${customerId}`);
        }
      }
    }
    
    // Apply inventory updates if any
    if (Object.keys(inventoryUpdates).length > 0) {
      const updateFields = Object.keys(inventoryUpdates).map(field => `${field} = ?`).join(', ');
      const updateValues = [...Object.values(inventoryUpdates), inventoryId];
      
      await pool.execute(
        `UPDATE INVENTORY SET ${updateFields} WHERE Inventory_ID = ?`,
        updateValues
      );
      console.log(`   ✅ Inventory updated successfully`);
    }
  } else {
    // No inventory record exists, create one if project reference is provided
    const projectRefNum = newData.project_reference_num || newData.project_ref_num;
    if (projectRefNum) {
      const projectRefNumTrimmed = String(projectRefNum).trim();
      const customerName = newData.customer_name || existingAsset.Customer_Name || 'Unknown Customer';
      const branch = newData.branch || existingAsset.Branch || 'Default Branch';
      
      console.log(`   📦 Creating inventory link for asset ${assetId} with project ${projectRefNumTrimmed}`);
      
      try {
        await Asset.linkToProject(assetId, projectRefNumTrimmed, customerName, branch);
        console.log(`   ✅ Inventory link created successfully`);
      } catch (linkError) {
        console.error(`   ❌ Failed to create inventory link:`, linkError.message);
      }
    }
  }
  
  return assetId;
  
  } catch (error) {
    console.error(`   ❌ Error in updateExistingAsset:`, error);
    throw new Error(`Update failed: ${error.message}`);
  }
};

/**
 * Bulk import assets with comprehensive validation and processing
 * Supports multiple modes:
 * 1. Create new assets (default)
 * 2. Add peripherals to existing assets
 * 3. Update existing assets (when upsert=true)
 * 
 * Features deduplication to ensure only first occurrence of new models,
 * categories, Windows versions, MS Office versions, and software are accepted.
 */
const bulkImportAssets = async (req, res, next) => {
  // Import the deduplication cache
  const ImportCache = require('../utils/importCache');
  const importCache = new ImportCache();
  
  try {
    const { assets, importMode, upsert } = req.body; // upsert=true enables update mode

    if (!Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Assets array is required',
        imported: 0,
        failed: 0
      });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🚀 BULK IMPORT STARTED - ${assets.length} assets to process`);
    console.log(`📦 Import Mode: ${importMode || 'auto'}`);
    console.log(`🔄 Update Mode (Upsert): ${upsert ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🔄 Deduplication Cache: ENABLED`);
    console.log(`${'='.repeat(80)}\n`);    console.log(`\n${'='.repeat(60)}`);
    console.log(`Starting bulk import of ${assets.length} assets...`);
    console.log(`Import Mode: ${importMode || 'auto'}`);
    console.log(`${'='.repeat(60)}\n`);

    // Convert flat peripheral fields to peripherals array if needed
    console.log('🔄 Converting flat peripheral fields to array structure...');
    assets.forEach((asset, idx) => {
      if (!asset.peripherals && (asset.peripheral_name || asset.serial_code)) {
        console.log(`  Asset ${idx + 1} (${asset.serial_number}): Converting flat fields to peripherals array`);
        
        // Split comma-separated values
        const peripheralNames = asset.peripheral_name ? 
          String(asset.peripheral_name).split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'n/a' && s.toLowerCase() !== 'none') : [];
        const serialCodes = asset.serial_code ? 
          String(asset.serial_code).split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'n/a' && s.toLowerCase() !== 'none') : [];
        
        // Only create peripherals array if we have valid data
        if (peripheralNames.length > 0 || serialCodes.length > 0) {
          // Create peripherals array
          asset.peripherals = [];
          const maxLength = Math.max(peripheralNames.length, serialCodes.length);
          
          for (let i = 0; i < maxLength; i++) {
            const peripheral = {};
            
            if (i < peripheralNames.length && peripheralNames[i]) {
              peripheral.peripheral_name = peripheralNames[i];
            }
            
            if (i < serialCodes.length && serialCodes[i]) {
              peripheral.serial_code = serialCodes[i];
            }
            
            // Only add if we have at least a peripheral name
            if (peripheral.peripheral_name) {
              asset.peripherals.push(peripheral);
              console.log(`    → Peripheral ${i + 1}: ${peripheral.peripheral_name || 'N/A'} (${peripheral.serial_code || 'N/A'})`);
            }
          }
          
          console.log(`    ✅ Created peripherals array with ${asset.peripherals.length} items`);
        } else {
          console.log(`    ⏭️  Skipping - no valid peripheral data (all N/A or None)`);
        }
        
        // Remove flat fields to avoid confusion
        delete asset.peripheral_name;
        delete asset.serial_code;
      }
    });
    console.log('✅ Peripheral field conversion complete\n');

    const ImportModeDetector = require('../utils/importModeDetector');
    const PeripheralImporter = require('../utils/peripheralImporter');

    // Detect import mode if not explicitly specified
    // When upsert mode is enabled, always use 'new_assets' mode to allow sequential processing
    let detectedMode = importMode || 'auto';
    let modeAnalysis = null;
    
    if (upsert) {
      // In upsert mode, force sequential processing to enable update logic
      console.log('🔄 Upsert mode enabled - using sequential processing for create/update');
      detectedMode = 'new_assets';
    } else if (detectedMode === 'auto') {
      console.log('🔍 Running import mode detection...');
      modeAnalysis = await ImportModeDetector.detectImportMode(assets);
      detectedMode = modeAnalysis.mode;
      
      const recommendations = ImportModeDetector.getImportRecommendations(modeAnalysis);
      console.log('\n📋 Import Recommendations:');
      recommendations.suggestions.forEach(s => console.log(`   ℹ️  ${s}`));
      recommendations.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
      recommendations.requiredActions.forEach(a => console.log(`   ⚡ ${a}`));
      console.log('');
    }

    const results = {
      imported: 0,
      failed: 0,
      peripheralsAdded: 0,
      assetsCreated: 0,
      updated: 0,
      duplicates: 0,
      errors: [],
      warnings: [],
      mode: detectedMode,
      modeAnalysis: modeAnalysis
    };

    // Handle different import modes
    if (detectedMode === 'add_peripherals' || detectedMode === 'mixed') {
      // Separate rows by action
      const separated = modeAnalysis 
        ? ImportModeDetector.separateRowsByAction(assets, modeAnalysis)
        : { createAssets: [], addPeripherals: assets, skip: [] };
      
      console.log(`\n📦 Import Strategy:`);
      console.log(`   Create New Assets: ${separated.createAssets.length}`);
      console.log(`   Add Peripherals to Existing: ${separated.addPeripherals.length}`);
      console.log(`   Skip: ${separated.skip.length}\n`);
      
      // Handle peripheral-only imports
      if (separated.addPeripherals.length > 0) {
        console.log(`\n🔧 Adding peripherals to existing assets...`);
        const peripheralResults = await PeripheralImporter.addPeripheralsToExistingAssets(
          separated.addPeripherals
        );
        
        results.peripheralsAdded = peripheralResults.success;
        results.failed += peripheralResults.failed;
        results.errors.push(...peripheralResults.errors);
        results.warnings.push(...peripheralResults.warnings);
        results.imported += peripheralResults.success;
        
        // Track duplicate count
        if (peripheralResults.duplicates > 0) {
          results.duplicates = peripheralResults.duplicates;
        }
      }
      
      // Handle new asset creation if in mixed mode
      if (separated.createAssets.length > 0) {
        console.log(`\n📝 Creating new assets...`);
        const createResults = await processNewAssets(separated.createAssets);
        results.assetsCreated = createResults.imported;
        results.failed += createResults.failed;
        results.errors.push(...createResults.errors);
        results.imported += createResults.imported;
      }
      
      // Log final results
      const finalMessage = `Bulk import completed: ${results.imported} total (${results.assetsCreated} new assets, ${results.peripheralsAdded} peripheral additions), ${results.failed} failed${results.duplicates ? `, ${results.duplicates} duplicates skipped` : ''}`;
      console.log(`\n${finalMessage}`);
      logger.info(finalMessage);
      
      return res.status(200).json({
        success: results.imported > 0,
        message: finalMessage,
        imported: results.imported,
        assetsCreated: results.assetsCreated,
        peripheralsAdded: results.peripheralsAdded,
        failed: results.failed,
        duplicates: results.duplicates || 0,
        errors: results.errors.slice(0, 50),
        warnings: results.warnings.slice(0, 50),
        total: assets.length,
        mode: results.mode,
        modeAnalysis: results.modeAnalysis
      });
    }
    
    // Default mode: Create new assets only (original behavior)
    console.log(`\n📝 Creating new assets (default mode)...`);

    // Process assets SEQUENTIALLY to prevent race conditions in cache
    // (Parallel processing causes multiple assets to create the same model/category simultaneously)
    console.log('⚠️  Processing assets sequentially to ensure proper deduplication...');
    
    let processedCount = 0;

    for (let i = 0; i < assets.length; i++) {
      const assetData = assets[i];
      const rowNumber = i + 1;
      
      try {
        console.log(`\nProcessing asset ${rowNumber}/${assets.length}: ${assetData.serial_number}`);
        console.log(`   🔍 Full assetData received:`, {
          windows: assetData.windows,
          microsoft_office: assetData.microsoft_office,
          monthly_prices: assetData.monthly_prices,
          department: assetData.department,
          department_name: assetData.department_name,
          position: assetData.position
        });
        
        // Validate required fields (accept both field name formats)
        const projectRefNum = assetData.project_reference_num || assetData.project_ref_num;
        const requiredFields = [
          { value: projectRefNum, name: 'project_reference_num or project_ref_num' },
          { value: assetData.serial_number, name: 'serial_number' },
          { value: assetData.tag_id, name: 'tag_id' },
          { value: assetData.item_name, name: 'item_name' }
        ];
        
        for (const field of requiredFields) {
          if (!field.value || String(field.value).trim() === '') {
            throw new Error(`Missing required field: ${field.name}`);
          }
        }

        // Check for duplicate serial number in database
        const existingBySerial = await Asset.findBySerialNumber(assetData.serial_number);
        
        if (existingBySerial) {
          // If upsert mode is enabled, check for changes and update if needed
          if (upsert) {
            console.log(`   🔍 Found existing asset with serial number: ${assetData.serial_number}`);
            
            // Get full asset details for comparison
            const existingFullAsset = await Asset.findById(existingBySerial.Asset_ID);
            console.log(`   📊 Comparing data for asset ID: ${existingFullAsset.Asset_ID}`);
            console.log(`   📊 Old monthly_prices: ${existingFullAsset.Monthly_Prices}`);
            console.log(`   📊 New monthly_prices: ${assetData.monthly_prices}`);
            
            const { hasChanges, changes } = hasAssetChanges(existingFullAsset, assetData);
            
            if (!hasChanges) {
              console.log(`   ⏭️  No changes detected - skipping as duplicate`);
              results.duplicates = (results.duplicates || 0) + 1;
              continue;
            }
            
            console.log(`   📝 Changes detected (${changes.length} fields):`);
            changes.forEach(change => {
              console.log(`      - ${change.field}: "${change.old}" → "${change.new}"`);
            });
            
            try {
              await updateExistingAsset(existingFullAsset, assetData, importCache);
              results.updated = (results.updated || 0) + 1;
              results.imported++;
              console.log(`   ✅ Update completed for ${assetData.serial_number}`);
            } catch (updateError) {
              console.error(`   ❌ Update failed for ${assetData.serial_number}:`, updateError.message);
              throw new Error(`Failed to update asset: ${updateError.message}`);
            }
            
            processedCount++;
            continue;
          } else if (detectedMode === 'new_assets') {
            // In new_assets mode without upsert, reject duplicates
            throw new Error(`Asset with serial number '${assetData.serial_number}' already exists`);
          }
        }

        // Convert flat peripheral fields to array if needed
        if (!assetData.peripherals && (assetData.peripheral_name || assetData.serial_code)) {
          console.log(`Converting flat peripheral fields for ${assetData.serial_number}...`);
          const peripheralNames = assetData.peripheral_name ? 
            String(assetData.peripheral_name).split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'n/a' && s.toLowerCase() !== 'none') : [];
          const serialCodes = assetData.serial_code ? 
            String(assetData.serial_code).split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'n/a' && s.toLowerCase() !== 'none') : [];
          
          assetData.peripherals = [];
          const maxLength = Math.max(peripheralNames.length, serialCodes.length);
          for (let i = 0; i < maxLength; i++) {
            const peripheral = {};
            if (i < peripheralNames.length && peripheralNames[i]) {
              peripheral.peripheral_name = peripheralNames[i];
            }
            if (i < serialCodes.length && serialCodes[i]) {
              peripheral.serial_code = serialCodes[i];
            }
            if (peripheral.peripheral_name) {
              assetData.peripherals.push(peripheral);
            }
          }
          console.log(`✅ Converted to ${assetData.peripherals.length} peripherals`);
        }

        // Process peripherals - split comma-separated values into individual peripherals
        let processedPeripherals = [];
        if (assetData.peripherals && Array.isArray(assetData.peripherals)) {
            console.log(`Processing ${assetData.peripherals.length} peripheral entries for ${assetData.serial_number}...`);
            console.log(`📦 Original assetData.peripherals:`, JSON.stringify(assetData.peripherals, null, 2));
            
            assetData.peripherals.forEach((peripheral, idx) => {
              // Check if peripheral has comma-separated values
              const peripheralNames = peripheral.peripheral_name ? 
                String(peripheral.peripheral_name).split(',').map(s => s.trim()).filter(s => s) : [];
              const serialCodes = peripheral.serial_code ? 
                String(peripheral.serial_code).split(',').map(s => s.trim()).filter(s => s) : [];
              
              // If single peripheral (no commas), add as-is
              if (peripheralNames.length <= 1 && serialCodes.length <= 1) {
                processedPeripherals.push(peripheral);
                console.log(`  Peripheral ${idx + 1}: ${peripheral.peripheral_name || 'N/A'} (${peripheral.serial_code || 'N/A'})`);
              } else {
                // Split into multiple peripherals
                console.log(`  Splitting peripheral ${idx + 1}: "${peripheral.peripheral_name}" / "${peripheral.serial_code}"`);
                const maxLength = Math.max(peripheralNames.length, serialCodes.length);
                for (let i = 0; i < maxLength; i++) {
                  const newPeripheral = {};
                  
                  if (i < peripheralNames.length && peripheralNames[i]) {
                    newPeripheral.peripheral_name = peripheralNames[i];
                  }
                  
                  if (i < serialCodes.length && serialCodes[i]) {
                    newPeripheral.serial_code = serialCodes[i];
                  }
                  
                  // Copy other fields from original peripheral
                  if (peripheral.condition) newPeripheral.condition = peripheral.condition;
                  if (peripheral.remarks) newPeripheral.remarks = peripheral.remarks;
                  
                  if (Object.keys(newPeripheral).length > 0) {
                    processedPeripherals.push(newPeripheral);
                    console.log(`    → Split to: ${newPeripheral.peripheral_name || 'N/A'} (${newPeripheral.serial_code || 'N/A'})`);
                  }
                }
              }
            });
            
            console.log(`✅ Processed into ${processedPeripherals.length} individual peripherals`);
          }

          // Process software - handle both software name and software with price
          let processedSoftware = null;
          let softwareWithPrice = [];
          
          if (assetData.software_name || assetData.software) {
            // New format: software_name and price as separate fields
            if (assetData.software_name) {
              const softwareNames = String(assetData.software_name).split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'n/a' && s.toLowerCase() !== 'none');
              const softwarePrices = assetData.price ? String(assetData.price).split(',').map(s => s.trim()) : [];
              
              softwareNames.forEach((name, idx) => {
                softwareWithPrice.push({
                  name: name,
                  price: softwarePrices[idx] || null
                });
              });
              
              console.log(`📦 Processed ${softwareWithPrice.length} software items with prices:`, softwareWithPrice);
            } 
            // Legacy format: single software field
            else if (assetData.software) {
              processedSoftware = assetData.software;
              console.log(`📦 Processing legacy software field:`, processedSoftware);
            }
          }

          // Set default values
          const processedAsset = {
            project_reference_num: String(assetData.project_reference_num || assetData.project_ref_num || '').trim(),
            customer_name: assetData.customer_name || '',
            customer_reference_number: assetData.customer_reference_number || '',
            branch: assetData.branch || '',
            serial_number: String(assetData.serial_number).trim(),
            tag_id: String(assetData.tag_id).trim(),
            item_name: String(assetData.item_name).trim(),
            category: assetData.category || 'Uncategorized',
            model: assetData.model || 'Unknown',
            status: normalizeStatus(assetData.status),
            recipient_name: assetData.recipient_name || '',
            department_name: assetData.department_name || assetData.department || '',
            position: assetData.position || '',
            windows: assetData.windows || null,
            microsoft_office: assetData.microsoft_office || null,
            monthly_prices: assetData.monthly_prices || null,
            software: processedSoftware,
            softwareWithPrice: softwareWithPrice.length > 0 ? softwareWithPrice : null,
            peripherals: processedPeripherals
          };

          // Use the existing createAssetWithDetails method for comprehensive asset creation
          console.log(`Creating asset with details for row ${rowNumber}...`);
          console.log(`Peripheral data being passed:`, JSON.stringify(processedPeripherals, null, 2));
          
          // Call the existing detailed asset creation method
          const mockReq = {
            body: processedAsset
          };
          
          let assetCreated = false;
          let assetCreationError = null;
          
          const mockRes = {
            status: (code) => ({
              json: (data) => {
                if (code === 201 && data.success) {
                  assetCreated = true;
                  console.log(`✅ Asset ${rowNumber} created successfully with ${data.data?.peripherals?.length || 0} peripherals`);
                  return data;
                } else if (code >= 400) {
                  assetCreationError = data.error || data.message || 'Unknown error during asset creation';
                  console.error(`❌ Asset creation returned error status ${code}:`, assetCreationError);
                  return data;
                } else {
                  // Unexpected status code
                  console.log(`⚠️  Unexpected status code ${code} during asset creation`);
                  return data;
                }
              }
            })
          };

          // Use the existing createAssetWithDetails function with deduplication cache
          try {
            await createAssetWithDetails(mockReq, mockRes, (error) => {
              if (error) {
                assetCreationError = error.message || 'Unknown error in next middleware';
                console.error('Error passed to next():', assetCreationError);
              }
            }, importCache); // Pass the import cache for deduplication
          } catch (createError) {
            // Catch any unhandled errors from createAssetWithDetails
            assetCreationError = createError.message || 'Unhandled error during asset creation';
            console.error('Unhandled error in createAssetWithDetails:', createError);
          }

          if (assetCreationError) {
            throw new Error(assetCreationError);
          }

          if (!assetCreated) {
            throw new Error('Failed to create asset - no success response received');
          }
          
          // Asset created successfully
          console.log(`✅ Asset ${rowNumber} completed successfully`);
          results.imported++;

      } catch (error) {
        console.error(`❌ Failed to process asset ${rowNumber}:`, error.message);
        console.error(`   Stack trace:`, error.stack);
        results.failed++;
        results.errors.push({
          row: rowNumber,
          serial_number: assetData.serial_number,
          error: error.message
        });
      }
      
      processedCount++;
      
      // Show progress every 10 assets
      if (processedCount % 10 === 0 || processedCount === assets.length) {
        console.log(`📊 Progress: ${processedCount}/${assets.length} assets processed`);
      }
    }

    results.assetsCreated = results.imported - (results.updated || 0);
    
    // Get cache statistics
    const cacheStats = importCache.getStats();
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 DEDUPLICATION CACHE STATISTICS:`);
    console.log(`   🏷️  Unique Models: ${cacheStats.models}`);
    console.log(`   📁 Unique Categories: ${cacheStats.categories}`);
    console.log(`   🪟 Unique Windows Versions: ${cacheStats.windowsVersions}`);
    console.log(`   📄 Unique MS Office Versions: ${cacheStats.msOfficeVersions}`);
    console.log(`   💿 Unique Software: ${cacheStats.software}`);
    console.log(`   ✅ Total Unique Attributes: ${cacheStats.total}`);
    console.log(`${'='.repeat(80)}\n`);
    
    const finalMessage = upsert 
      ? `Bulk import completed: ${results.assetsCreated} created, ${results.updated || 0} updated, ${results.duplicates || 0} duplicates skipped, ${results.failed} failed`
      : `Bulk import completed: ${results.imported} new assets created, ${results.failed} failed`;
    console.log(`\n${finalMessage}`);
    logger.info(finalMessage);

    // Return response
    res.status(200).json({
      success: results.imported > 0,
      message: finalMessage,
      imported: results.imported,
      assetsCreated: results.assetsCreated,
      updated: results.updated || 0,
      duplicates: results.duplicates || 0,
      peripheralsAdded: 0,
      failed: results.failed,
      errors: results.errors.slice(0, 50), // Limit errors to first 50
      total: assets.length,
      mode: detectedMode,
      deduplication: cacheStats // Include cache stats in response
    });

  } catch (error) {
    console.error('Error in bulkImportAssets:', error);
    logger.error('Error in bulkImportAssets:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error during bulk import',
      message: error.message,
      imported: 0,
      failed: 0
    });
  }
};

/**
 * Fix orphaned assets (assets not linked to inventory)
 */
const fixOrphanedAssets = async (req, res, next) => {
  try {
    console.log('Manual trigger: Checking orphaned assets...');
    
    const result = await Asset.fixOrphanedAssets();
    
    res.status(200).json({
      success: true,
      message: `Found ${result.orphaned} orphaned assets - Manual assignment required (no auto-fix to prevent default customer assignment)`,
      orphaned_count: result.orphaned,
      fixed_count: result.fixed,
      note: 'Orphaned assets are no longer auto-assigned to default customers to preserve data integrity'
    });
  } catch (error) {
    console.error('Error in fixOrphanedAssets:', error);
    logger.error('Error in fixOrphanedAssets:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to check orphaned assets'
    });
  }
};

/**
 * Update asset flag status and remarks
 */
const updateAssetFlag = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { Is_Flagged, Flag_Remarks, Flagged_By } = req.body;
    
    const asset = await Asset.findById(id);
    
    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }
    
    // Update flag fields
    asset.Is_Flagged = Is_Flagged !== undefined ? (Is_Flagged ? 1 : 0) : asset.Is_Flagged;
    asset.Flag_Remarks = Flag_Remarks !== undefined ? Flag_Remarks : asset.Flag_Remarks;
    asset.Flag_Date = Is_Flagged ? new Date() : asset.Flag_Date;
    asset.Flagged_By = Flagged_By || asset.Flagged_By;
    
    // If unflagging, clear remarks and related fields
    if (Is_Flagged === 0 || Is_Flagged === false) {
      asset.Flag_Remarks = null;
      asset.Flag_Date = null;
      asset.Flagged_By = null;
    }
    
    await asset.update();
    
    // Log the flag change
    try {
      await logAssetChange({
        Asset_ID: asset.Asset_ID,
        User_ID: req.user?.User_ID,
        Action: Is_Flagged ? 'FLAG_ASSET' : 'UNFLAG_ASSET',
        Changes: {
          Is_Flagged: { old: !Is_Flagged, new: Is_Flagged },
          Flag_Remarks: { old: null, new: Flag_Remarks }
        }
      });
    } catch (logError) {
      console.error('Failed to log asset flag change:', logError);
    }
    
    const updatedAsset = await Asset.findById(id);
    
    res.status(200).json({
      success: true,
      message: Is_Flagged ? 'Asset flagged successfully' : 'Asset unflagged successfully',
      asset: updatedAsset
    });
  } catch (error) {
    logger.error('Error in updateAssetFlag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update asset flag',
      message: error.message
    });
  }
};

module.exports = {
  getAllAssets,
  getAssetById,
  getAssetBySerialNumber,
  getAssetDetail,
  createAsset,
  createAssetWithDetails,
  updateAsset,
  updateAssetById,
  updateAssetFlag,
  deleteAsset,
  deleteAssetById,
  getAssetStatistics,
  validateImportData,
  bulkImportAssets,
  fixOrphanedAssets
};