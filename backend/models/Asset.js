const { pool } = require('../config/database');

class Asset {
  constructor(data) {
    this.Asset_ID = data.Asset_ID;
    this.Asset_Serial_Number = data.Asset_Serial_Number;
    this.Asset_Tag_ID = data.Asset_Tag_ID;
    this.Item_Name = data.Item_Name;
    this.Recipients_ID = data.Recipients_ID;
    this.Category_ID = data.Category_ID;
    this.Model_ID = data.Model_ID;
    this.Status = data.Status;
    this.Windows = data.Windows;
    this.Microsoft_Office = data.Microsoft_Office;
    this.Software = data.Software;
    this.Monthly_Prices = data.Monthly_Prices;
    this.Is_Flagged = data.Is_Flagged;
    this.Flag_Remarks = data.Flag_Remarks;
    this.Flag_Date = data.Flag_Date;
    this.Flagged_By = data.Flagged_By;
    
    // Related data from JOINs
    this.Category = data.Category;
    this.Model = data.Model;
    this.Recipient_Name = data.Recipient_Name;
    this.Department = data.Department;
  }

  // Get all assets with complete inventory information (Project, Customer, Recipients, Category, Model)
  static async findAll(options = {}) {
    try {
      const { limit, offset = 0, search = '', sortField = 'Asset_ID', sortDirection = 'DESC', flagged = false, columnFilters = {}, allowedProjectIds = null } = options;
      
      // Build WHERE clause for search
      let whereClause = 'WHERE a.deleted_at IS NULL';
      let searchParams = [];
      
      // Add Project_ID filter for customer-type users
      if (allowedProjectIds && Array.isArray(allowedProjectIds) && allowedProjectIds.length > 0) {
        const placeholders = allowedProjectIds.map(() => '?').join(',');
        // Tukar WHERE jadi AND sebab kita dah mula dengan WHERE kat atas
        whereClause += ` AND i.Project_ID IN (${placeholders})`; 
        searchParams.push(...allowedProjectIds);
        console.log('🔍 Asset filtering - Allowed Project IDs:', allowedProjectIds);
      }
      
      // Add flagged filter
      if (flagged) {
        whereClause += ' AND a.Is_Flagged = 1';
      }
      
      if (search) {
        whereClause += ` AND (
          a.Asset_Serial_Number LIKE ? OR
          a.Asset_Tag_ID LIKE ? OR
          a.Item_Name LIKE ? OR
          cust.Customer_Name LIKE ? OR
          cust.Branch LIKE ? OR
          m.Model_Name LIKE ?
        )`;
        const searchPattern = `%${search}%`;
        searchParams = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];
      }
      
      // Add column-specific filters
      if (columnFilters && Object.keys(columnFilters).length > 0) {
        // Map frontend column names to actual database fields/aliases
        const columnMapping = {
          'Asset_Serial_Number': 'a.Asset_Serial_Number',
          'Asset_Tag_ID': 'a.Asset_Tag_ID',
          'Item_Name': 'a.Item_Name',
          'Status': 'a.Status',
          'Customer_Name': 'cust.Customer_Name',
          'Branch': 'cust.Branch',
          'Model': 'm.Model_Name',
          'Category': 'c.Category',
          'Antivirus': 'p.Antivirus',
          'Windows': 'a.Windows',
          'Microsoft_Office': 'a.Microsoft_Office',
          'Recipient_Name': 'r.Recipient_Name',
          'Department': 'r.Department',
          'Position': 'r.Position',
          'Project_Title': 'p.Project_Title',
          'Project_Ref_Number': 'p.Project_Ref_Number',
          'Customer_Ref_Number': 'cust.Customer_Ref_Number',
          'Warranty': 'p.Warranty',
          'Preventive_Maintenance': 'p.Preventive_Maintenance',
          'Start_Date': 'p.Start_Date',
          'End_Date': 'p.End_Date',
          'AV': 'a.AV',
          'Monthly_Prices': 'a.Monthly_Prices'
        };
        
        // Build column filters efficiently
        const filterConditions = [];
        for (const [columnKey, filterValue] of Object.entries(columnFilters)) {
          const trimmedValue = filterValue?.trim();
          if (!trimmedValue) continue;
          
          if (columnMapping[columnKey]) {
            filterConditions.push(`${columnMapping[columnKey]} LIKE ?`);
            searchParams.push(`%${trimmedValue}%`);
          } else if (columnKey === 'Software' || columnKey === 'Software_Name') {
            // Filter by software using a subquery
            filterConditions.push(`a.Asset_ID IN (
              SELECT asb.Asset_ID 
              FROM ASSET_SOFTWARE_BRIDGE asb
              LEFT JOIN SOFTWARE s ON asb.Software_ID = s.Software_ID
              WHERE s.Software_Name LIKE ?
            )`);
            searchParams.push(`%${trimmedValue}%`);
          } else if (columnKey === 'Peripheral_Type') {
            // Filter by peripheral type using a subquery
            filterConditions.push(`a.Asset_ID IN (
              SELECT per.Asset_ID 
              FROM PERIPHERAL per
              LEFT JOIN PERIPHERAL_TYPE pt ON per.Peripheral_Type_ID = pt.Peripheral_Type_ID
              WHERE pt.Peripheral_Type_Name LIKE ?
            )`);
            searchParams.push(`%${trimmedValue}%`);
          } else if (columnKey === 'Peripheral_Serial') {
            // Filter by peripheral serial code
            filterConditions.push(`a.Asset_ID IN (
              SELECT per.Asset_ID 
              FROM PERIPHERAL per
              WHERE per.Serial_Code LIKE ?
            )`);
            searchParams.push(`%${trimmedValue}%`);
          } else if (columnKey === 'Peripheral_Condition') {
            // Filter by peripheral condition
            filterConditions.push(`a.Asset_ID IN (
              SELECT per.Asset_ID 
              FROM PERIPHERAL per
              WHERE per.Condition LIKE ?
            )`);
            searchParams.push(`%${trimmedValue}%`);
          }
        }
        
        if (filterConditions.length > 0) {
          whereClause = whereClause ? `${whereClause} AND (${filterConditions.join(' AND ')})` : `WHERE (${filterConditions.join(' AND ')})`;
        }
      }
      
      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(DISTINCT a.Asset_ID) as total
        FROM ASSET a
        LEFT JOIN INVENTORY i ON i.Asset_ID = a.Asset_ID
        LEFT JOIN CATEGORY c ON a.Category_ID = c.Category_ID
        LEFT JOIN MODEL m ON a.Model_ID = m.Model_ID
        LEFT JOIN RECIPIENTS r ON a.Recipients_ID = r.Recipients_ID
        LEFT JOIN PROJECT p ON i.Project_ID = p.Project_ID
        LEFT JOIN CUSTOMER cust ON i.Customer_ID = cust.Customer_ID
        ${whereClause}
      `;
      
      const [countResult] = await pool.execute(countQuery, searchParams);
      const total = countResult[0].total;
      
      // Build ORDER BY clause
      const validSortFields = ['Asset_ID', 'Asset_Serial_Number', 'Asset_Tag_ID', 'Item_Name', 'Status', 'Customer_Name', 'Model'];
      const orderField = validSortFields.includes(sortField) ? sortField : 'Asset_ID';
      const orderDir = sortDirection.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      const orderBy = `ORDER BY ${orderField} ${orderDir}`;
      
      // Build LIMIT clause
      const limitClause = limit ? `LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}` : '';
      
      // Optimized query with minimal JOINs - fetch only essential data
      const [rows] = await pool.execute(`
        SELECT 
          i.Inventory_ID,
          a.Asset_ID,
          a.Asset_Serial_Number,
          a.Asset_Tag_ID,
          a.Item_Name,
          a.Status,
          a.Windows,
          a.Microsoft_Office,
          a.Monthly_Prices,
          a.AV,
          a.Model_ID,
          a.Is_Flagged,
          a.Flag_Remarks,
          a.Flag_Date,
          a.Flagged_By,
          c.Category,
          m.Model_Name as Model,
          r.Recipient_Name,
          r.Department,
          r.Position,
          p.Project_ID,
          p.Project_Ref_Number,
          p.Project_Title,
          CASE 
            WHEN LOWER(TRIM(c.Category)) IN ('scanner', 'printer', 'projector') THEN 'None'
            ELSE COALESCE(p.Antivirus, 'None')
           END AS Antivirus,
           p.Antivirus AS Project_Antivirus,
          p.Warranty,
          p.Preventive_Maintenance,
          p.Start_Date,
          p.End_Date,
          cust.Customer_ID,
          cust.Customer_Ref_Number,
          cust.Customer_Name,
          cust.Branch
        FROM ASSET a
        LEFT JOIN INVENTORY i ON i.Asset_ID = a.Asset_ID
        LEFT JOIN CATEGORY c ON a.Category_ID = c.Category_ID
        LEFT JOIN MODEL m ON a.Model_ID = m.Model_ID
        LEFT JOIN RECIPIENTS r ON a.Recipients_ID = r.Recipients_ID
        LEFT JOIN PROJECT p ON i.Project_ID = p.Project_ID
        LEFT JOIN CUSTOMER cust ON i.Customer_ID = cust.Customer_ID
        ${whereClause}
        ${orderBy}
        ${limitClause}
      `, searchParams);
      
      // Get asset IDs for fetching related data
      const assetIds = rows.map(r => r.Asset_ID);
      
      // Fetch software data in a single query if we have assets
      let softwareMap = new Map();
      if (assetIds.length > 0) {
        const placeholders = assetIds.map(() => '?').join(',');
        const [softwareRows] = await pool.execute(`
          SELECT asb.Asset_ID, s.Software_Name, s.Price
          FROM ASSET_SOFTWARE_BRIDGE asb
          LEFT JOIN SOFTWARE s ON asb.Software_ID = s.Software_ID
          WHERE asb.Asset_ID IN (${placeholders})
        `, assetIds);
        
        softwareRows.forEach(sw => {
          if (!softwareMap.has(sw.Asset_ID)) {
            softwareMap.set(sw.Asset_ID, []);
          }
          softwareMap.get(sw.Asset_ID).push(sw);
        });
      }
      
      // Fetch peripheral data in a single query
      let peripheralMap = new Map();
      if (assetIds.length > 0) {
        const placeholders = assetIds.map(() => '?').join(',');
        const [peripheralRows] = await pool.execute(`
          SELECT per.Asset_ID, pt.Peripheral_Type_Name,
                 per.Serial_Code, per.Condition, per.Remarks, per.Peripheral_ID
          FROM PERIPHERAL per
          LEFT JOIN PERIPHERAL_TYPE pt ON per.Peripheral_Type_ID = pt.Peripheral_Type_ID
          WHERE per.Asset_ID IN (${placeholders})
          ORDER BY per.Peripheral_ID
        `, assetIds);
        
        peripheralRows.forEach(p => {
          if (!peripheralMap.has(p.Asset_ID)) {
            peripheralMap.set(p.Asset_ID, []);
          }
          peripheralMap.get(p.Asset_ID).push(p);
        });
      }
      
      // Process rows with fetched data
      const processedRows = rows.map(row => {
        const processed = { ...row };
        
        // Add software data
        const softwareList = softwareMap.get(row.Asset_ID) || [];
        processed.Software = softwareList.map(s => s.Software_Name).join(', ') || null;
        processed.Software_Name = softwareList.map(s => s.Software_Name).join(', ') || null;
        processed.Software_Prices = softwareList.map(s => s.Price).join(', ') || null;
        
        // Add peripheral data
        const peripheralList = peripheralMap.get(row.Asset_ID) || [];
        if (peripheralList.length > 0) {
          processed.Peripheral_Type = peripheralList.map(p => p.Peripheral_Type_Name).join(', ');
          processed.Peripheral_Serial = peripheralList.map(p => p.Serial_Code || 'N/A').join(', ');
          processed.Peripheral_Condition = peripheralList.map(p => p.Condition || 'N/A').join(', ');
          processed.Peripheral_Remarks = peripheralList.map(p => p.Remarks || 'N/A').join(', ');
          processed.Peripheral_Details = peripheralList.map(p => {
            const parts = [p.Peripheral_Type_Name];
            const details = [];
            if (p.Serial_Code) details.push(p.Serial_Code);
            if (p.Condition) details.push(p.Condition);
            return details.length > 0 ? `${parts[0]} (${details.join(', ')})` : parts[0];
          }).join('; ');
        } else {
          processed.Peripheral_Type = null;
          processed.Peripheral_Serial = null;
          processed.Peripheral_Condition = null;
          processed.Peripheral_Remarks = null;
          processed.Peripheral_Details = null;
        }
        
        return processed;
      });
      
      // Return pagination metadata if limit was specified
      if (limit) {
        return {
          data: processedRows,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            page: Math.floor(offset / limit) + 1,
            totalPages: Math.ceil(total / limit)
          }
        };
      }

      return processedRows;
    } catch (error) {
      console.error('❌ Error in Asset.findAll:', error.message);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ SQL Error code:', error.code);
      console.error('❌ SQL Error errno:', error.errno);
      console.error('❌ SQL Error sqlMessage:', error.sqlMessage);
      throw error;
    }
  }

  // Get asset by ID
  static async findById(id) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          a.Asset_ID,
          a.Asset_Serial_Number,
          a.Asset_Tag_ID,
          a.Item_Name,
          a.Recipients_ID,
          a.Category_ID,
          a.Model_ID,
          a.Status,
          a.Windows,
          a.Microsoft_Office,
          a.Monthly_Prices,
          a.Is_Flagged,
          a.Flag_Remarks,
          a.Flag_Date,
          a.Flagged_By,
          c.Category,
          m.Model_Name as Model,
          r.Recipient_Name,
          r.Department,
          r.Position
        FROM ASSET a
        LEFT JOIN CATEGORY c ON a.Category_ID = c.Category_ID
        LEFT JOIN MODEL m ON a.Model_ID = m.Model_ID
        LEFT JOIN RECIPIENTS r ON a.Recipients_ID = r.Recipients_ID
        WHERE a.Asset_ID = ?
      `, [id]);
      
      if (rows.length > 0) {
        return new Asset(rows[0]);
      }
      return null;
    } catch (error) {
      console.error('Error in Asset.findById:', error);
      throw error;
    }
  }

  // Get asset by serial number
  static async findBySerialNumber(serialNumber) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          a.Asset_ID,
          a.Asset_Serial_Number,
          a.Asset_Tag_ID,
          a.Item_Name,
          a.Recipients_ID,
          a.Category_ID,
          a.Model_ID,
          a.Status,
          c.Category,
          m.Model_Name as Model,
          r.Recipient_Name,
          r.Department,
          r.Position
        FROM ASSET a
        LEFT JOIN CATEGORY c ON a.Category_ID = c.Category_ID
        LEFT JOIN MODEL m ON a.Model_ID = m.Model_ID
        LEFT JOIN RECIPIENTS r ON a.Recipients_ID = r.Recipients_ID
        WHERE a.Asset_Serial_Number = ?
      `, [serialNumber]);
      
      if (rows.length > 0) {
        return new Asset(rows[0]);
      }
      return null;
    } catch (error) {
      console.error('Error in Asset.findBySerialNumber:', error);
      throw error;
    }
  }

  // Create new asset
  static async create(assetData) {
    try {
      const [result] = await pool.execute(
        `INSERT INTO ASSET (Asset_Serial_Number, Asset_Tag_ID, Item_Name, Recipients_ID, Category_ID, Model_ID, Status, Windows, Microsoft_Office, Monthly_Prices, AV, Is_Flagged, Flag_Remarks, Flag_Date, Flagged_By) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          assetData.Asset_Serial_Number,
          assetData.Asset_Tag_ID,
          assetData.Item_Name,
          assetData.Recipients_ID,
          assetData.Category_ID,
          assetData.Model_ID,
          assetData.Status || 'Active',
          assetData.Windows || null,
          assetData.Microsoft_Office || null,
          assetData.Monthly_Prices || null,
          assetData.AV !== undefined ? assetData.AV : null,
          assetData.Is_Flagged || 0,
          assetData.Flag_Remarks || null,
          assetData.Flag_Date || null,
          assetData.Flagged_By || null
        ]
      );
      
      return await this.findById(result.insertId);
    } catch (error) {
      console.error('Error in Asset.create:', error);
      throw error;
    }
  }

  // Update asset
  async update(userId = null) {
    // Get a dedicated connection to ensure @current_user_id and UPDATE use same connection
    const connection = await pool.getConnection();
    try {
      // Set user ID for audit triggers on this specific connection
      if (userId) {
        await connection.execute('SET @current_user_id = ?', [userId]);
        console.log('✅ Set @current_user_id to:', userId, 'for update operation');
      }
      
      await connection.execute(
        `UPDATE ASSET SET 
         Asset_Serial_Number = ?, 
         Asset_Tag_ID = ?, 
         Item_Name = ?, 
         Recipients_ID = ?, 
         Category_ID = ?, 
         Model_ID = ?, 
         Status = ?,
         Windows = ?,
         Microsoft_Office = ?,
         Monthly_Prices = ?,
         Is_Flagged = ?,
         Flag_Remarks = ?,
         Flag_Date = ?,
         Flagged_By = ?
         WHERE Asset_ID = ?`,
        [
          this.Asset_Serial_Number,
          this.Asset_Tag_ID,
          this.Item_Name,
          this.Recipients_ID,
          this.Category_ID,
          this.Model_ID,
          this.Status,
          this.Windows,
          this.Microsoft_Office,
          this.Monthly_Prices,
          this.Is_Flagged,
          this.Flag_Remarks,
          this.Flag_Date,
          this.Flagged_By,
          this.Asset_ID
        ]
      );
      return this;
    } catch (error) {
      console.error('Error in Asset.update:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Helper method to update recipient information properly
  static async updateRecipientInfo(recipientName, department, position, currentRecipientId) {
    try {
      if (!recipientName && !department && !position) return currentRecipientId;

      // If we have a current recipient ID, update that recipient's information
      if (currentRecipientId) {
        const updateFields = [];
        const updateValues = [];

        if (recipientName) {
          updateFields.push('Recipient_Name = ?');
          updateValues.push(recipientName);
        }

        if (department) {
          updateFields.push('Department = ?');
          updateValues.push(department);
        }

        if (position !== undefined) {
          updateFields.push('Position = ?');
          updateValues.push(position || null);
        }

        if (updateFields.length > 0) {
          updateValues.push(currentRecipientId);
          
          const updateQuery = `UPDATE RECIPIENTS SET ${updateFields.join(', ')} WHERE Recipients_ID = ?`;
          console.log('Updating existing recipient:', { recipientName, department, position, currentRecipientId });
          
          await pool.execute(updateQuery, updateValues);
          return currentRecipientId;
        }
      }

      // If no current recipient ID, create new recipient
      if (recipientName) {
        console.log('Creating new recipient:', { recipientName, department, position });
        const [result] = await pool.execute(
          'INSERT INTO RECIPIENTS (Recipient_Name, Department, Position) VALUES (?, ?, ?)',
          [recipientName, department || '', position || null]
        );
        return result.insertId;
      }

      return currentRecipientId;
    } catch (error) {
      console.error('Error in updateRecipientInfo:', error);
      return currentRecipientId; // Return original ID on error
    }
  }

  // Helper method to update category information properly
  static async updateCategoryInfo(categoryName, currentCategoryId) {
    try {
      if (!categoryName) return currentCategoryId;

      // Find existing category by name - DO NOT UPDATE THE CATEGORY TABLE
      console.log('Looking up category ID for:', categoryName);
      const [rows] = await pool.execute(
        'SELECT Category_ID FROM CATEGORY WHERE Category = ?',
        [categoryName]
      );

      if (rows.length > 0) {
        // Category exists - return its ID to link the asset to it
        console.log('Found existing category ID:', rows[0].Category_ID);
        return rows[0].Category_ID;
      }

      // If category doesn't exist, create new category
      console.log('Creating new category:', { categoryName });
      const [result] = await pool.execute(
        'INSERT INTO CATEGORY (Category) VALUES (?)',
        [categoryName]
      );
      return result.insertId;
    } catch (error) {
      console.error('Error in updateCategoryInfo:', error);
      return currentCategoryId; // Return original ID on error
    }
  }

  // Helper method to update model information properly
  static async updateModelInfo(modelName, currentModelId, categoryId = null) {
    try {
      if (!modelName) return currentModelId;

      // Don't update the existing model's name - instead find or create the model by name
      // This ensures we don't modify shared model records
      const cleanModelName = modelName.trim();
      console.log('Finding or creating model for asset:', { modelName: cleanModelName, categoryId });

      // Find existing model with this name (case-insensitive)
      const [existing] = await pool.execute(
        'SELECT Model_ID, Category_ID FROM MODEL WHERE LOWER(Model_Name) = LOWER(?)',
        [cleanModelName]
      );
      
      if (existing.length > 0) {
        console.log('Found existing model ID:', existing[0].Model_ID, 'with Category_ID:', existing[0].Category_ID);
        return existing[0].Model_ID;
      }

      // If model doesn't exist, create new one with category link
      console.log('Creating new model:', { modelName: cleanModelName, categoryId });
      const [result] = await pool.execute(
        'INSERT INTO MODEL (Model_Name, Category_ID) VALUES (?, ?)',
        [cleanModelName, categoryId]
      );
      console.log('Created new model ID:', result.insertId, 'linked to Category_ID:', categoryId);
      return result.insertId;
    } catch (error) {
      console.error('Error in updateModelInfo:', error);
      return currentModelId; // Return original ID on error
    }
  }

  // Soft Delete asset
  static async delete(id) {
    try {
      console.log(`Starting soft deletion for Asset_ID: ${id}`);
      
      // Kita update deleted_at dengan tarikh dan masa sekarang
      const [result] = await pool.execute(
        'UPDATE ASSET SET deleted_at = CURRENT_TIMESTAMP WHERE Asset_ID = ?', 
        [id]
      );
      
      const success = result.affectedRows > 0;
      
      if (success) {
        console.log(`✅ Successfully soft deleted Asset_ID: ${id}`);
      } else {
        console.log(`❌ Failed to soft delete Asset_ID: ${id} (Not found)`);
      }
      
      return success;
    } catch (error) {
      console.error('Error in Asset.delete:', error);
      throw error;
    }
  }

  // Biarkan deleteById panggil fungsi delete (untuk keserasian dengan kod controller lama)
  static async deleteById(assetId) {
    try {
      const success = await this.delete(assetId);
      
      // Return format yang controller lama kau expect
      return {
        success: success,
        // Kita letak 0 untuk benda lain sebab soft delete tak padam rekod anak-beranak
        peripheralsDeleted: 0,
        pmRecordsDeleted: 0,
        pmResultsDeleted: 0,
        softwareLinksDeleted: 0,
        inventoryDeleted: 0,
        inventoryNulled: 0,
        inventoryUpdated: 0
      };
    } catch (error) {
      console.error('Error in Asset.deleteById:', error);
      return { success: false, error: error.message };
    }
  }

  // Get complete asset detail with all related information (Project, Customer, Peripherals, etc.)
  static async findDetailById(id) {
    try {
      console.log('🔄 Fetching complete asset details for ID:', id);
      
      // Get main asset information with project, customer, recipients, and all attributes
      const [assetRows] = await pool.execute(`
        SELECT 
          i.Inventory_ID,
          a.Asset_ID,
          a.Asset_Serial_Number,
          a.Asset_Tag_ID,
          a.Item_Name,
          a.Status,
          a.Windows,
          a.Microsoft_Office,
          a.Monthly_Prices,
          a.Model_ID,
          a.AV AS AV,
          a.Is_Flagged,
          a.Flag_Remarks,
          a.Flag_Date,
          a.Flagged_By,
          c.Category,
          m.Model_Name as Model,
          r.Recipient_Name,
          r.Department,
          r.Position,
          p.Project_ID,
          p.Project_Ref_Number,
          p.Project_Title,
          CASE 
            WHEN LOWER(TRIM(c.Category)) IN ('scanner', 'printer', 'projector') THEN 'None'
            ELSE COALESCE(p.Antivirus, 'None')
          END AS Antivirus,
          p.Antivirus AS Project_Antivirus,
          p.Warranty,
          p.Preventive_Maintenance,
          p.Start_Date,
          p.End_Date,
          cust.Customer_ID,
          cust.Customer_Ref_Number,
          cust.Customer_Name,
          cust.Branch,
          GROUP_CONCAT(DISTINCT s.Software_Name SEPARATOR ', ') AS Software,
          GROUP_CONCAT(DISTINCT s.Price SEPARATOR ', ') AS Software_Prices
        FROM ASSET a
        LEFT JOIN CATEGORY c ON a.Category_ID = c.Category_ID
        LEFT JOIN MODEL m ON a.Model_ID = m.Model_ID
        LEFT JOIN RECIPIENTS r ON a.Recipients_ID = r.Recipients_ID
        LEFT JOIN INVENTORY i ON a.Asset_ID = i.Asset_ID
        LEFT JOIN PROJECT p ON i.Project_ID = p.Project_ID
        LEFT JOIN CUSTOMER cust ON i.Customer_ID = cust.Customer_ID
        LEFT JOIN ASSET_SOFTWARE_BRIDGE asb ON a.Asset_ID = asb.Asset_ID
        LEFT JOIN SOFTWARE s ON asb.Software_ID = s.Software_ID
        WHERE a.Asset_ID = ?
        GROUP BY a.Asset_ID
        LIMIT 1
      `, [id]);
      
      if (assetRows.length === 0) {
        console.log('❌ Asset not found with ID:', id);
        return null;
      }

      const assetData = assetRows[0];
      console.log('✅ Asset found:', {
        serial: assetData.Asset_Serial_Number,
        tag: assetData.Asset_Tag_ID,
        customer: assetData.Customer_Name,
        model_id: assetData.Model_ID
      });

      // Get linked software rows for this asset
      const [softwareRows] = await pool.execute(`
        SELECT 
          s.Software_ID,
          s.Software_Name,
          s.Price
        FROM ASSET_SOFTWARE_BRIDGE asb
        JOIN SOFTWARE s ON asb.Software_ID = s.Software_ID
        WHERE asb.Asset_ID = ?
        ORDER BY s.Software_Name
      `, [id]);

      // Get peripherals for this asset
      const [peripheralRows] = await pool.execute(`
        SELECT 
          per.Peripheral_ID,
          per.Serial_Code,
          per.Condition,
          per.Remarks,
          pt.Peripheral_Type_Name
        FROM PERIPHERAL per
        LEFT JOIN PERIPHERAL_TYPE pt ON per.Peripheral_Type_ID = pt.Peripheral_Type_ID
        WHERE per.Asset_ID = ?
        ORDER BY pt.Peripheral_Type_Name
      `, [id]);

      console.log(`✅ Found ${peripheralRows.length} peripherals for asset`);

      // Get model specifications if Model_ID exists
      let modelSpecs = [];
      if (assetData.Model_ID) {
        const [specsRows] = await pool.execute(`
          SELECT 
            s.Attribute_Name,
            msb.Attributes_Value,
            msb.Attributes_ID
          FROM MODEL_SPECS_BRIDGE msb
          INNER JOIN SPECS s ON msb.Attributes_ID = s.Attributes_ID
          WHERE msb.Model_ID = ?
          ORDER BY s.Attribute_Name
        `, [assetData.Model_ID]);
        
        modelSpecs = specsRows;
        console.log(`✅ Found ${specsRows.length} specifications for model`);
      }

      // Combine asset data with peripherals and specs
      return {
        ...assetData,
        SoftwareList: softwareRows,
        Peripherals: peripheralRows,
        ModelSpecifications: modelSpecs
      };
    } catch (error) {
      console.error('Error in Asset.findDetailById:', error);
      throw error;
    }
  }

  // Get asset statistics
  static async getStatistics() {
    try {
      console.log('=== Asset.getStatistics() CALLED ===');
      
      const [totalResult] = await pool.execute('SELECT COUNT(*) as total FROM ASSET');
      console.log('Total query result:', totalResult);
      
      // Calculate total asset value
      const [valueResult] = await pool.execute('SELECT SUM(Monthly_Prices) as totalValue FROM ASSET WHERE Monthly_Prices IS NOT NULL');
      console.log('Total value query result:', valueResult);
      
      // Calculate total peripheral count for all assets
      const [peripheralResult] = await pool.execute('SELECT COUNT(*) as totalPeripherals FROM PERIPHERAL WHERE Asset_ID IS NOT NULL');
      console.log('Total peripheral query result:', peripheralResult);
      
      const [statusResult] = await pool.execute('SELECT Status, COUNT(*) as count FROM ASSET GROUP BY Status');
      console.log('Status query result:', statusResult);
      
      const [categoryResult] = await pool.execute(`
        SELECT c.Category, COUNT(*) as count 
        FROM ASSET a 
        LEFT JOIN CATEGORY c ON a.Category_ID = c.Category_ID 
        GROUP BY c.Category
      `);
      console.log('Category query result:', categoryResult);
      
      // Get model distribution (assets per model)
      const [modelResult] = await pool.execute(`
        SELECT 
          m.Model_Name,
          COUNT(a.Asset_ID) as asset_count
        FROM MODEL m
        LEFT JOIN ASSET a ON m.Model_ID = a.Model_ID
        WHERE a.Asset_ID IS NOT NULL
        GROUP BY m.Model_Name
        HAVING asset_count > 0
        ORDER BY asset_count DESC
      `);
      console.log('Model distribution query result:', modelResult);
      
      // Get revenue by category
      const [revenueByCategoryResult] = await pool.execute(`
        SELECT 
          c.Category,
          SUM(a.Monthly_Prices) as total_revenue,
          COUNT(a.Asset_ID) as asset_count
        FROM CATEGORY c
        LEFT JOIN ASSET a ON c.Category_ID = a.Category_ID
        WHERE a.Monthly_Prices IS NOT NULL
        GROUP BY c.Category
        HAVING total_revenue > 0
        ORDER BY total_revenue DESC
      `);
      console.log('Revenue by category query result:', revenueByCategoryResult);
      
      // Get warranty timeline per project
      const [warrantyByProjectResult] = await pool.execute(`
        SELECT 
          p.Project_Title,
          p.Project_Ref_Number,
          p.Warranty,
          p.Start_Date,
          p.End_Date,
          c.Customer_Name,
          DATEDIFF(p.End_Date, CURDATE()) as days_remaining,
          DATEDIFF(p.End_Date, p.Start_Date) as total_days,
          DATEDIFF(CURDATE(), p.Start_Date) as days_elapsed,
          CASE 
            WHEN CURDATE() > p.End_Date THEN 100
            WHEN CURDATE() < p.Start_Date THEN 0
            ELSE ROUND((DATEDIFF(CURDATE(), p.Start_Date) / DATEDIFF(p.End_Date, p.Start_Date)) * 100, 2)
          END as warranty_progress,
          CASE 
            WHEN CURDATE() > p.End_Date THEN 0
            WHEN CURDATE() < p.Start_Date THEN 100
            ELSE ROUND((DATEDIFF(p.End_Date, CURDATE()) / DATEDIFF(p.End_Date, p.Start_Date)) * 100, 2)
          END as warranty_remaining_percentage,
          COUNT(DISTINCT a.Asset_ID) as asset_count
        FROM PROJECT p
        LEFT JOIN INVENTORY i ON p.Project_ID = i.Project_ID
        LEFT JOIN CUSTOMER c ON i.Customer_ID = c.Customer_ID
        LEFT JOIN ASSET a ON i.Asset_ID = a.Asset_ID
        WHERE p.End_Date IS NOT NULL AND a.Asset_ID IS NOT NULL
        GROUP BY p.Project_ID
        ORDER BY warranty_progress DESC
      `);
      console.log('Warranty by project query result:', warrantyByProjectResult);
      
      // Get peripheral type distribution
      const [peripheralTypeResult] = await pool.execute(`
        SELECT 
          pt.Peripheral_Type_Name,
          COUNT(p.Peripheral_ID) as peripheral_count,
          COUNT(DISTINCT p.Asset_ID) as asset_count
        FROM PERIPHERAL_TYPE pt
        LEFT JOIN PERIPHERAL p ON pt.Peripheral_Type_ID = p.Peripheral_Type_ID
        WHERE p.Asset_ID IS NOT NULL
        GROUP BY pt.Peripheral_Type_Name
        HAVING peripheral_count > 0
        ORDER BY peripheral_count DESC
      `);
      console.log('Peripheral type distribution query result:', peripheralTypeResult);
      
      // Get customer distribution (assets per customer)
      const [customerResult] = await pool.execute(`
        SELECT 
          c.Customer_Name,
          COUNT(DISTINCT a.Asset_ID) as asset_count
        FROM CUSTOMER c
        LEFT JOIN INVENTORY i ON c.Customer_ID = i.Customer_ID
        LEFT JOIN ASSET a ON i.Asset_ID = a.Asset_ID
        WHERE a.Asset_ID IS NOT NULL
        GROUP BY c.Customer_Name
        HAVING asset_count > 0
        ORDER BY asset_count DESC
      `);
      console.log('Customer distribution query result:', customerResult);
      
      // Get customer distribution by category (for stacked bar chart)
      const [customerByCategoryResult] = await pool.execute(`
        SELECT 
          c.Customer_Name,
          cat.Category,
          COUNT(DISTINCT a.Asset_ID) as asset_count
        FROM CUSTOMER c
        LEFT JOIN INVENTORY i ON c.Customer_ID = i.Customer_ID
        LEFT JOIN ASSET a ON i.Asset_ID = a.Asset_ID
        LEFT JOIN CATEGORY cat ON a.Category_ID = cat.Category_ID
        WHERE a.Asset_ID IS NOT NULL
        GROUP BY c.Customer_Name, cat.Category
        ORDER BY c.Customer_Name, asset_count DESC
      `);
      console.log('Customer by category query result:', customerByCategoryResult);
      
      // Group customer data by category for stacked bars
      const customersByCategory = {};
      customerByCategoryResult.forEach(item => {
        const customerName = item.Customer_Name || 'Unknown';
        if (!customersByCategory[customerName]) {
          customersByCategory[customerName] = {
            total: 0,
            categories: []
          };
        }
        customersByCategory[customerName].categories.push({
          category: item.Category || 'Unknown',
          count: item.asset_count
        });
        customersByCategory[customerName].total += item.asset_count;
      });
      console.log('Grouped customers by category:', customersByCategory);
      
      const result = {
        total: totalResult[0].total,
        totalValue: valueResult[0].totalValue || 0,
        totalPeripherals: peripheralResult[0].totalPeripherals || 0,
        byStatus: statusResult.map(item => ({
          status: item.Status || 'Unknown',
          count: item.count
        })),
        byCategory: categoryResult.map(item => ({
          category: item.Category || 'Unknown',
          count: item.count
        })),
        byModel: modelResult.map(item => ({
          model: item.Model_Name || 'Unknown',
          count: item.asset_count
        })),
        revenueByCategory: revenueByCategoryResult.map(item => ({
          category: item.Category || 'Unknown',
          revenue: item.total_revenue || 0,
          count: item.asset_count || 0
        })),
        warrantyByProject: warrantyByProjectResult.map(item => ({
          project: item.Project_Title || 'Unknown',
          customer: item.Customer_Name || 'Unknown',
          refNumber: item.Project_Ref_Number || 'N/A',
          warranty: item.Warranty || 'N/A',
          startDate: item.Start_Date,
          endDate: item.End_Date,
          totalDays: item.total_days || 0,
          daysElapsed: item.days_elapsed || 0,
          daysRemaining: item.days_remaining || 0,
          warrantyProgress: item.warranty_progress || 0,
          warrantyRemainingPercentage: item.warranty_remaining_percentage || 0,
          assetCount: item.asset_count || 0
        })),
        peripheralTypeDistribution: peripheralTypeResult.map(item => ({
          peripheralType: item.Peripheral_Type_Name || 'Unknown',
          count: item.peripheral_count || 0,
          assetCount: item.asset_count || 0
        })),
        byCustomer: customerResult.map(item => ({
          customer: item.Customer_Name || 'Unknown',
          count: item.asset_count
        })),
        customersByCategory: customersByCategory
      };
      
      console.log('Final statistics result:', result);
      console.log('====================================');
      
      return result;
    } catch (error) {
      console.error('Error in Asset.getStatistics:', error);
      // Return fallback data if database query fails
      return {
        total: 0,
        totalValue: 0,
        totalPeripherals: 0,
        byStatus: [],
        byCategory: [],
        byModel: [],
        byCustomer: [],
        customersByCategory: {}
      };
    }
  }

  // Helper method to create or get recipient
  static async createRecipient(recipientName, department, position = null) {
    try {
      // Ensure we have valid values
      const cleanName = recipientName ? recipientName.trim() : null;
      const cleanDept = (department && department.trim() !== '') ? department.trim() : 'N/A';
      const cleanPos = (position && position.trim() !== '' && position !== 'null') ? position.trim() : 'N/A';
      
      if (!cleanName) {
        throw new Error('Recipient name is required');
      }
      
      console.log(`🔍 Creating/finding recipient: Name="${cleanName}", Dept="${cleanDept}", Position="${cleanPos}"`);
      
      // First try to find existing recipient with same name and department
      const [existing] = await pool.execute(
        'SELECT Recipients_ID, Recipient_Name, Department, Position FROM RECIPIENTS WHERE Recipient_Name = ? AND Department = ?',
        [cleanName, cleanDept]
      );
      
      if (existing.length > 0) {
        console.log(`✅ Found existing recipient: ID=${existing[0].Recipients_ID}, Name="${existing[0].Recipient_Name}", Dept="${existing[0].Department}"`);
        return existing[0].Recipients_ID;
      }
      
      // Create new recipient
      console.log(`📝 Inserting new recipient into database...`);
      const [result] = await pool.execute(
        'INSERT INTO RECIPIENTS (Recipient_Name, Department, Position) VALUES (?, ?, ?)',
        [cleanName, cleanDept, cleanPos]
      );
      
      console.log(`✅ Created new recipient: ID=${result.insertId}, Name="${cleanName}", Dept="${cleanDept}", Position="${cleanPos}"`);
      
      // Verify insertion
      const [verification] = await pool.execute(
        'SELECT Recipients_ID FROM RECIPIENTS WHERE Recipients_ID = ?',
        [result.insertId]
      );
      
      if (verification.length === 0) {
        throw new Error(`Failed to verify recipient creation: ID ${result.insertId} not found`);
      }
      
      return result.insertId;
    } catch (error) {
      // Handle duplicate key error
      if (error.code === 'ER_DUP_ENTRY') {
        console.log('⚠️  Duplicate recipient detected, fetching existing...');
        const [existing] = await pool.execute(
          'SELECT Recipients_ID FROM RECIPIENTS WHERE Recipient_Name = ?',
          [recipientName]
        );
        if (existing.length > 0) {
          console.log(`✅ Retrieved existing recipient: ID=${existing[0].Recipients_ID}`);
          return existing[0].Recipients_ID;
        }
      }
      console.error('❌ Error in createRecipient:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      throw error;
    }
  }

  // Helper method to get or create category - ENHANCED with hybrid functionality
  static async getOrCreateCategory(categoryName, cache = null) {
    try {
      if (!categoryName || typeof categoryName !== 'string' || categoryName.trim() === '') {
        throw new Error('Category name is required and must be a non-empty string');
      }

      const cleanCategoryName = categoryName.trim();
      
      // Check cache first if provided
      if (cache) {
        const cached = cache.hasCategory(cleanCategoryName);
        if (cached.exists) {
          console.log(`✓ Found category in cache: "${cached.originalName}" (ID: ${cached.id})`);
          return cached.id;
        }
      }
      
      console.log(`Getting or creating category: "${cleanCategoryName}"`);

      // First try to find existing category (case-insensitive)
      const [existing] = await pool.execute(
        'SELECT Category_ID, Category FROM CATEGORY WHERE LOWER(Category) = LOWER(?)',
        [cleanCategoryName]
      );
      
      if (existing.length > 0) {
        const categoryId = existing[0].Category_ID;
        console.log(`Found existing category: ID=${categoryId}, Name="${existing[0].Category}"`);
        
        // Add to cache if provided
        if (cache) {
          cache.addCategory(existing[0].Category, categoryId);
        }
        
        return categoryId;
      }
      
      // Category doesn't exist in database - check if we should create it
      if (cache) {
        // Double-check cache in case another asset in this import already created it
        const cacheRecheck = cache.hasCategory(cleanCategoryName);
        if (cacheRecheck.exists) {
          console.log(`⚠️  Category was just created by another asset in this import, reusing: "${cacheRecheck.originalName}" (ID: ${cacheRecheck.id})`);
          return cacheRecheck.id;
        }
      }
      
      // Create new category
      const [result] = await pool.execute(
        'INSERT INTO CATEGORY (Category) VALUES (?)',
        [cleanCategoryName]
      );
      
      const newCategoryId = result.insertId;
      console.log(`✅ Created new category: ID=${newCategoryId}, Name="${cleanCategoryName}"`);
      
      // Add to cache
      if (cache) {
        const wasAdded = cache.addCategory(cleanCategoryName, newCategoryId);
        if (wasAdded) {
          console.log(`✅ Category added to cache as first occurrence`);
        }
      }
      
      return newCategoryId;
    } catch (error) {
      // Handle duplicate key error (race condition)
      if (error.code === 'ER_DUP_ENTRY') {
        try {
          const [existing] = await pool.execute(
            'SELECT Category_ID FROM CATEGORY WHERE LOWER(Category) = LOWER(?)',
            [categoryName.trim()]
          );
          if (existing.length > 0) {
            const categoryId = existing[0].Category_ID;
            if (cache) {
              cache.addCategory(categoryName.trim(), categoryId);
            }
            return categoryId;
          }
        } catch (retryError) {
          console.error('Error in retry after duplicate:', retryError);
        }
      }
      console.error('Error in getOrCreateCategory:', error);
      throw error;
    }
  }

  // Helper method to get or create Windows version with cache support
  static async getOrCreateWindows(version, cache = null) {
    try {
      if (!version || typeof version !== 'string' || version.trim() === '') {
        return null; // Windows is optional
      }

      const cleanVersion = version.trim();
      
      // Check cache first if provided
      if (cache) {
        const cached = cache.hasWindows(cleanVersion);
        if (cached.exists) {
          console.log(`✓ Found Windows version in cache: "${cached.originalName}"`);
          return cached.originalName;
        }
      }

      console.log(`Getting or creating Windows version: "${cleanVersion}"`);

      // Check if this Windows version exists in database
      const [existing] = await pool.execute(
        'SELECT DISTINCT Windows FROM ASSET WHERE LOWER(Windows) = LOWER(?) AND Windows IS NOT NULL LIMIT 1',
        [cleanVersion]
      );
      
      if (existing.length > 0) {
        const existingVersion = existing[0].Windows;
        console.log(`Found existing Windows version: "${existingVersion}"`);
        
        // Add to cache if provided
        if (cache) {
          cache.addWindows(existingVersion);
        }
        
        return existingVersion;
      }
      
      // New Windows version - add to cache if this is first occurrence
      console.log(`✅ New Windows version will be created on first asset: "${cleanVersion}"`);
      
      if (cache) {
        const isFirst = cache.addWindows(cleanVersion);
        if (!isFirst) {
          console.log(`⚠️  Duplicate Windows version in import ignored: "${cleanVersion}"`);
        }
      }
      
      return cleanVersion;
    } catch (error) {
      console.error('Error in getOrCreateWindows:', error);
      throw error;
    }
  }

  // Helper method to get or create Microsoft Office version with cache support
  static async getOrCreateMicrosoftOffice(version, cache = null) {
    try {
      if (!version || typeof version !== 'string' || version.trim() === '') {
        return null; // MS Office is optional
      }

      const cleanVersion = version.trim();
      
      // Check cache first if provided
      if (cache) {
        const cached = cache.hasMsOffice(cleanVersion);
        if (cached.exists) {
          console.log(`✓ Found MS Office version in cache: "${cached.originalName}"`);
          return cached.originalName;
        }
      }

      console.log(`Getting or creating MS Office version: "${cleanVersion}"`);

      // Check if this MS Office version exists in database
      const [existing] = await pool.execute(
        'SELECT DISTINCT Microsoft_Office FROM ASSET WHERE LOWER(Microsoft_Office) = LOWER(?) AND Microsoft_Office IS NOT NULL LIMIT 1',
        [cleanVersion]
      );
      
      if (existing.length > 0) {
        const existingVersion = existing[0].Microsoft_Office;
        console.log(`Found existing MS Office version: "${existingVersion}"`);
        
        // Add to cache if provided
        if (cache) {
          cache.addMsOffice(existingVersion);
        }
        
        return existingVersion;
      }
      
      // New MS Office version - add to cache if this is first occurrence
      console.log(`✅ New MS Office version will be created on first asset: "${cleanVersion}"`);
      
      if (cache) {
        const isFirst = cache.addMsOffice(cleanVersion);
        if (!isFirst) {
          console.log(`⚠️  Duplicate MS Office version in import ignored: "${cleanVersion}"`);
        }
      }
      
      return cleanVersion;
    } catch (error) {
      console.error('Error in getOrCreateMicrosoftOffice:', error);
      throw error;
    }
  }

  // Helper method to get or create software with cache support
  static async getOrCreateSoftware(softwareName, cache = null) {
    try {
      if (!softwareName || typeof softwareName !== 'string' || softwareName.trim() === '') {
        return null;
      }

      const cleanSoftwareName = softwareName.trim();
      
      // Check cache first if provided
      if (cache) {
        const cached = cache.hasSoftware(cleanSoftwareName);
        if (cached.exists) {
          console.log(`✓ Found software in cache: "${cached.originalName}" (ID: ${cached.id})`);
          return cached.id;
        }
      }

      console.log(`Getting or creating software: "${cleanSoftwareName}"`);

      // Check if software exists in database (case-insensitive)
      const [existing] = await pool.execute(
        'SELECT Software_ID, Software_Name FROM SOFTWARE WHERE LOWER(Software_Name) = LOWER(?)',
        [cleanSoftwareName]
      );
      
      if (existing.length > 0) {
        const softwareId = existing[0].Software_ID;
        console.log(`Found existing software: ID=${softwareId}, Name="${existing[0].Software_Name}"`);
        
        // Add to cache if provided
        if (cache) {
          cache.addSoftware(existing[0].Software_Name, softwareId);
        }
        
        return softwareId;
      }
      
      // Create new software only if this is the first occurrence in import
      if (cache) {
        // Check if we've already seen this software in the import
        const cacheCheck = cache.hasSoftware(cleanSoftwareName);
        if (cacheCheck.exists) {
          console.log(`⚠️  Duplicate software in import, reusing: "${cacheCheck.originalName}" (ID: ${cacheCheck.id})`);
          return cacheCheck.id;
        }
      }
      
      // Create new software
      const [result] = await pool.execute(
        'INSERT INTO SOFTWARE (Software_Name) VALUES (?)',
        [cleanSoftwareName]
      );
      
      const newSoftwareId = result.insertId;
      console.log(`✅ Created new software: ID=${newSoftwareId}, Name="${cleanSoftwareName}"`);
      
      // Add to cache
      if (cache) {
        cache.addSoftware(cleanSoftwareName, newSoftwareId);
      }
      
      return newSoftwareId;
    } catch (error) {
      // Handle duplicate key error (race condition)
      if (error.code === 'ER_DUP_ENTRY') {
        try {
          const [existing] = await pool.execute(
            'SELECT Software_ID FROM SOFTWARE WHERE LOWER(Software_Name) = LOWER(?)',
            [softwareName.trim()]
          );
          if (existing.length > 0) {
            const softwareId = existing[0].Software_ID;
            if (cache) {
              cache.addSoftware(softwareName.trim(), softwareId);
            }
            return softwareId;
          }
        } catch (retryError) {
          console.error('Error in retry after duplicate:', retryError);
        }
      }
      console.error('Error in getOrCreateSoftware:', error);
      throw error;
    }
  }

  // Helper method to get or create software with price and cache support
  static async getOrCreateSoftwareWithPrice(softwareName, price = null, cache = null) {
    try {
      if (!softwareName || typeof softwareName !== 'string' || softwareName.trim() === '') {
        return null;
      }

      const cleanSoftwareName = softwareName.trim();
      const cleanPrice = price && !isNaN(parseFloat(price)) ? parseFloat(price) : null;
      
      // Check cache first if provided
      if (cache) {
        const cached = cache.hasSoftware(cleanSoftwareName);
        if (cached.exists) {
          console.log(`✓ Found software in cache: "${cached.originalName}" (ID: ${cached.id})`);
          // Update price if provided and different
          if (cleanPrice !== null) {
            await pool.execute(
              'UPDATE SOFTWARE SET Price = ? WHERE Software_ID = ? AND (Price IS NULL OR Price != ?)',
              [cleanPrice, cached.id, cleanPrice]
            );
          }
          return cached.id;
        }
      }

      console.log(`Getting or creating software with price: "${cleanSoftwareName}", Price: ${cleanPrice}`);

      // Check if software exists in database (case-insensitive)
      const [existing] = await pool.execute(
        'SELECT Software_ID, Software_Name, Price FROM SOFTWARE WHERE LOWER(Software_Name) = LOWER(?)',
        [cleanSoftwareName]
      );
      
      if (existing.length > 0) {
        const softwareId = existing[0].Software_ID;
        console.log(`Found existing software: ID=${softwareId}, Name="${existing[0].Software_Name}", Current Price="${existing[0].Price}"`);
        
        // Update price if provided and different from existing
        if (cleanPrice !== null && existing[0].Price !== cleanPrice) {
          await pool.execute(
            'UPDATE SOFTWARE SET Price = ? WHERE Software_ID = ?',
            [cleanPrice, softwareId]
          );
          console.log(`✅ Updated software price: ${existing[0].Price} → ${cleanPrice}`);
        }
        
        // Add to cache if provided
        if (cache) {
          cache.addSoftware(existing[0].Software_Name, softwareId);
        }
        
        return softwareId;
      }
      
      // Create new software with price
      if (cache) {
        const cacheCheck = cache.hasSoftware(cleanSoftwareName);
        if (cacheCheck.exists) {
          console.log(`⚠️  Duplicate software in import, reusing: "${cacheCheck.originalName}" (ID: ${cacheCheck.id})`);
          return cacheCheck.id;
        }
      }
      
      // Create new software with price
      const [result] = await pool.execute(
        'INSERT INTO SOFTWARE (Software_Name, Price) VALUES (?, ?)',
        [cleanSoftwareName, cleanPrice]
      );
      
      const newSoftwareId = result.insertId;
      console.log(`✅ Created new software: ID=${newSoftwareId}, Name="${cleanSoftwareName}", Price=${cleanPrice}`);
      
      // Add to cache
      if (cache) {
        cache.addSoftware(cleanSoftwareName, newSoftwareId);
      }
      
      return newSoftwareId;
    } catch (error) {
      // Handle duplicate key error (race condition)
      if (error.code === 'ER_DUP_ENTRY') {
        try {
          const [existing] = await pool.execute(
            'SELECT Software_ID FROM SOFTWARE WHERE LOWER(Software_Name) = LOWER(?)',
            [softwareName.trim()]
          );
          if (existing.length > 0) {
            const softwareId = existing[0].Software_ID;
            if (cache) {
              cache.addSoftware(softwareName.trim(), softwareId);
            }
            return softwareId;
          }
        } catch (retryError) {
          console.error('Error in retry after duplicate:', retryError);
        }
      }
      console.error('Error in getOrCreateSoftwareWithPrice:', error);
      throw error;
    }
  }

  // Helper method to get or create model - ENHANCED with hybrid functionality, category linking, and cache support
  static async getOrCreateModel(modelName, categoryId = null, cache = null) {
    try {
      if (!modelName || typeof modelName !== 'string' || modelName.trim() === '') {
        throw new Error('Model name is required and must be a non-empty string');
      }

      const cleanModelName = modelName.trim();
      
      // Check cache first if provided
      if (cache) {
        const cached = cache.hasModel(cleanModelName);
        if (cached.exists) {
          console.log(`✓ Found model in cache: "${cached.originalName}" (ID: ${cached.id})`);
          return cached.id;
        }
      }
      
      console.log(`Getting or creating model: "${cleanModelName}" with Category_ID: ${categoryId}`);

      // First try to find existing model (case-insensitive)
      const [existing] = await pool.execute(
        'SELECT Model_ID, Model_Name, Category_ID FROM MODEL WHERE LOWER(Model_Name) = LOWER(?)',
        [cleanModelName]
      );
      
      if (existing.length > 0) {
        const modelId = existing[0].Model_ID;
        console.log(`Found existing model: ID=${modelId}, Name="${existing[0].Model_Name}", Category_ID=${existing[0].Category_ID}`);
        
        // If category is provided and existing model has no category, update it
        if (categoryId && !existing[0].Category_ID) {
          await pool.execute(
            'UPDATE MODEL SET Category_ID = ? WHERE Model_ID = ?',
            [categoryId, modelId]
          );
          console.log(`✅ Updated model ${modelId} with Category_ID: ${categoryId}`);
        }
        
        // Add to cache if provided
        if (cache) {
          cache.addModel(existing[0].Model_Name, modelId);
        }
        
        return modelId;
      }
      
      // Model doesn't exist in database - check if we should create it
      if (cache) {
        // Double-check cache in case another asset in this import already created it
        const cacheRecheck = cache.hasModel(cleanModelName);
        if (cacheRecheck.exists) {
          console.log(`⚠️  Model was just created by another asset in this import, reusing: "${cacheRecheck.originalName}" (ID: ${cacheRecheck.id})`);
          return cacheRecheck.id;
        }
      }
      
      // Create new model with category link
      const [result] = await pool.execute(
        'INSERT INTO MODEL (Model_Name, Category_ID) VALUES (?, ?)',
        [cleanModelName, categoryId]
      );
      
      const newModelId = result.insertId;
      console.log(`✅ Created new model: ID=${newModelId}, Name="${cleanModelName}", Category_ID=${categoryId}`);
      
      // Add to cache
      if (cache) {
        const wasAdded = cache.addModel(cleanModelName, newModelId);
        if (wasAdded) {
          console.log(`✅ Model added to cache as first occurrence`);
        }
      }
      
      // Verify the category was saved
      const [verification] = await pool.execute(
        'SELECT Model_ID, Model_Name, Category_ID FROM MODEL WHERE Model_ID = ?',
        [newModelId]
      );
      if (verification.length > 0) {
        console.log(`✅ Verification: Model ${newModelId} has Category_ID=${verification[0].Category_ID} in database`);
      }
      
      return newModelId;
    } catch (error) {
      // Handle duplicate key error (race condition)
      if (error.code === 'ER_DUP_ENTRY') {
        try {
          const [existing] = await pool.execute(
            'SELECT Model_ID FROM MODEL WHERE LOWER(Model_Name) = LOWER(?)',
            [modelName.trim()]
          );
          if (existing.length > 0) {
            return existing[0].Model_ID;
          }
        } catch (retryError) {
          console.error('Error in retry after duplicate:', retryError);
        }
      }
      console.error('Error in getOrCreateModel:', error);
      throw error;
    }
  }

  // Helper method to create peripheral - ENHANCED with hybrid functionality
  static async createPeripheral(assetId, peripheralTypeName, serialCode, condition, remarks) {
    try {
      console.log(`🔄 createPeripheral called with:`, {
        assetId,
        peripheralTypeName,
        serialCode,
        condition,
        remarks
      });
      
      if (!peripheralTypeName || typeof peripheralTypeName !== 'string' || peripheralTypeName.trim() === '') {
        throw new Error('Peripheral type name is required and must be a non-empty string');
      }

      const cleanPeripheralTypeName = peripheralTypeName.trim();
      console.log(`Creating peripheral: "${cleanPeripheralTypeName}" for Asset_ID: ${assetId} with serial: ${serialCode || 'NULL'}`);

      // Get or create peripheral type (case-insensitive)
      let peripheralTypeId;
      const [existingType] = await pool.execute(
        'SELECT Peripheral_Type_ID FROM PERIPHERAL_TYPE WHERE LOWER(Peripheral_Type_Name) = LOWER(?)',
        [cleanPeripheralTypeName]
      );
      
      if (existingType.length > 0) {
        peripheralTypeId = existingType[0].Peripheral_Type_ID;
        console.log(`Found existing peripheral type: ID=${peripheralTypeId}, Name="${cleanPeripheralTypeName}"`);
      } else {
        // Create new peripheral type
        const [typeResult] = await pool.execute(
          'INSERT INTO PERIPHERAL_TYPE (Peripheral_Type_Name) VALUES (?)',
          [cleanPeripheralTypeName]
        );
        peripheralTypeId = typeResult.insertId;
        console.log(`✅ Created new peripheral type: ID=${peripheralTypeId}, Name="${cleanPeripheralTypeName}"`);
      }
      
      // Create peripheral record
      const [result] = await pool.execute(
        'INSERT INTO PERIPHERAL (Peripheral_Type_ID, Asset_ID, Serial_Code, `Condition`, Remarks) VALUES (?, ?, ?, ?, ?)',
        [peripheralTypeId, assetId, serialCode || null, condition || 'Good', remarks || '']
      );
      
      const peripheralId = result.insertId;
      console.log(`✅ Created peripheral: ID=${peripheralId}, Asset_ID=${assetId}, Type="${cleanPeripheralTypeName}"`);
      return peripheralId;
    } catch (error) {
      // Handle duplicate key error for peripheral type (race condition)
      if (error.code === 'ER_DUP_ENTRY' && error.message.includes('PERIPHERAL_TYPE')) {
        try {
          const [existingType] = await pool.execute(
            'SELECT Peripheral_Type_ID FROM PERIPHERAL_TYPE WHERE LOWER(Peripheral_Type_Name) = LOWER(?)',
            [peripheralTypeName.trim()]
          );
          if (existingType.length > 0) {
            // Retry creating the peripheral with the existing type
            const [result] = await pool.execute(
              'INSERT INTO PERIPHERAL (Peripheral_Type_ID, Asset_ID, Serial_Code, `Condition`, Remarks) VALUES (?, ?, ?, ?, ?)',
              [existingType[0].Peripheral_Type_ID, assetId, serialCode || null, condition || 'Good', remarks || '']
            );
            return result.insertId;
          }
        } catch (retryError) {
          console.error('Error in retry after duplicate peripheral type:', retryError);
        }
      }
      console.error('Error in createPeripheral:', error);
      throw error;
    }
  }

  // Helper method to link asset to project via inventory
  static async linkToProject(assetId, projectRefNum, customerName, branch) {
    try {
      // Find project ID first
      const [projectResult] = await pool.execute(
        'SELECT Project_ID FROM PROJECT WHERE Project_Ref_Number = ?',
        [projectRefNum]
      );
      
      if (projectResult.length === 0) {
        throw new Error(`Project with reference number '${projectRefNum}' not found`);
      }
      
      const projectId = projectResult[0].Project_ID;
      
      // Try to find exact customer/branch match
      let [customerResult] = await pool.execute(
        'SELECT Customer_ID, Customer_Ref_Number FROM CUSTOMER WHERE Customer_Name = ? AND Branch = ?',
        [customerName, branch]
      );
      
      let customerId;
      let customerRefNumber;
      
      if (customerResult.length === 0) {
        console.log(`⚠️ Customer '${customerName}' with branch '${branch}' not found - looking for alternatives`);
        
        // Strategy 1: Try to find customer with same name but different branch
        const [altCustomerResult] = await pool.execute(
          'SELECT Customer_ID, Customer_Ref_Number, Branch FROM CUSTOMER WHERE Customer_Name = ? LIMIT 1',
          [customerName]
        );
        
        if (altCustomerResult.length > 0) {
          // Found customer with same name but different branch - use it
          customerId = altCustomerResult[0].Customer_ID;
          customerRefNumber = altCustomerResult[0].Customer_Ref_Number;
          console.log(`✅ Using existing customer with different branch: '${altCustomerResult[0].Branch}' → '${branch}'`);
        } else {
          // Strategy 2: Create new customer record
          console.log(`📝 Creating new customer record for '${customerName}' in branch '${branch}'`);
          
          // Generate a customer reference number (you can modify this logic as needed)
          const [maxCustomerRef] = await pool.execute(
            'SELECT MAX(CAST(SUBSTRING(Customer_Ref_Number, 2) AS UNSIGNED)) as max_ref FROM CUSTOMER WHERE Customer_Ref_Number REGEXP "^M[0-9]+$"'
          );
          
          const nextRefNum = maxCustomerRef[0]?.max_ref ? `M${String(maxCustomerRef[0].max_ref + 1).padStart(5, '0')}` : 'M24001';
          
          const [insertResult] = await pool.execute(
            'INSERT INTO CUSTOMER (Project_ID, Customer_Ref_Number, Customer_Name, Branch) VALUES (?, ?, ?, ?)',
            [projectId, nextRefNum, customerName, branch]
          );
          
          customerId = insertResult.insertId;
          customerRefNumber = nextRefNum;
          console.log(`✅ Created new customer: ID=${customerId}, Ref=${nextRefNum}, Name='${customerName}', Branch='${branch}'`);
        }
      } else {
        customerId = customerResult[0].Customer_ID;
        customerRefNumber = customerResult[0].Customer_Ref_Number;
        console.log(`✅ Found exact customer match: ID=${customerId}, Ref=${customerRefNumber}`);
      }
      
      // Update existing inventory record or create new one
      const [existingInventory] = await pool.execute(
        'SELECT Inventory_ID FROM INVENTORY WHERE Project_ID = ? AND Customer_ID = ? AND Asset_ID IS NULL LIMIT 1',
        [projectId, customerId]
      );
      
      if (existingInventory.length > 0) {
        // Update existing inventory record
        await pool.execute(
          'UPDATE INVENTORY SET Asset_ID = ? WHERE Inventory_ID = ?',
          [assetId, existingInventory[0].Inventory_ID]
        );
        console.log(`✅ LINKED TO PROJECT: Asset_ID ${assetId} → Inventory_ID ${existingInventory[0].Inventory_ID} (Customer_Ref: ${customerRefNumber})`);
        return existingInventory[0].Inventory_ID;
      } else {
        // Create new inventory record
        const [result] = await pool.execute(
          'INSERT INTO INVENTORY (Project_ID, Customer_ID, Asset_ID) VALUES (?, ?, ?)',
          [projectId, customerId, assetId]
        );
        console.log(`✅ LINKED TO PROJECT: Asset_ID ${assetId} → Inventory_ID ${result.insertId} (Customer_Ref: ${customerRefNumber})`);
        return result.insertId;
      }
    } catch (error) {
      console.error('Error in linkToProject:', error);
      throw error;
    }
  }

  // Link software to asset via ASSET_SOFTWARE_BRIDGE table with cache support
  static async linkSoftwareToAsset(assetId, softwareName, cache = null) {
    try {
      // Use the getOrCreateSoftware method which handles caching
      const softwareId = await this.getOrCreateSoftware(softwareName, cache);
      
      if (!softwareId) {
        console.log('⚠️  No software ID returned, skipping link');
        return null;
      }
      
      // Check if link already exists
      const [existingLink] = await pool.execute(
        'SELECT * FROM ASSET_SOFTWARE_BRIDGE WHERE Asset_ID = ? AND Software_ID = ?',
        [assetId, softwareId]
      );
      
      if (existingLink.length === 0) {
        // Create the link
        await pool.execute(
          'INSERT INTO ASSET_SOFTWARE_BRIDGE (Asset_ID, Software_ID) VALUES (?, ?)',
          [assetId, softwareId]
        );
        console.log(`✅ Linked software ID ${softwareId} to asset ID ${assetId}`);
      } else {
        console.log(`✓ Software ID ${softwareId} already linked to asset ID ${assetId}`);
      }
      
      return softwareId;
    } catch (error) {
      console.error('Error in linkSoftwareToAsset:', error);
      throw error;
    }
  }

  // Helper method to create preventive maintenance record
  // NOTE: This should only be called manually through the PM system, not automatically
  static async createPreventiveMaintenance(assetId) {
    try {
      const [result] = await pool.execute(
        'INSERT INTO PMAINTENANCE (Asset_ID, PM_Date, Status) VALUES (?, CURDATE(), ?)',
        [assetId, 'Scheduled']
      );
      return result.insertId;
    } catch (error) {
      console.error('Error in createPreventiveMaintenance:', error);
      throw error;
    }
  }

  // Helper method to fix orphaned assets by creating inventory links
  // NOTE: This method should NOT automatically assign default customers
  // Orphaned assets should be manually assigned to proper customers/projects
  static async fixOrphanedAssets() {
    try {
      console.log('=== Checking for orphaned assets ===');
      
      // Find assets without inventory links
      const [orphanAssets] = await pool.execute(`
        SELECT a.Asset_ID, a.Asset_Serial_Number, a.Asset_Tag_ID, a.Item_Name 
        FROM ASSET a 
        WHERE a.Asset_ID NOT IN (SELECT DISTINCT Asset_ID FROM INVENTORY WHERE Asset_ID IS NOT NULL)
      `);
      
      if (orphanAssets.length === 0) {
        console.log('No orphaned assets found');
        return { fixed: 0, orphaned: 0 };
      }
      
      console.log(`Found ${orphanAssets.length} orphaned assets:`);
      orphanAssets.forEach(asset => {
        console.log(`  - Asset_ID: ${asset.Asset_ID}, Serial: ${asset.Asset_Serial_Number}, Tag: ${asset.Asset_Tag_ID}`);
      });
      
      console.log('⚠️  ORPHANED ASSETS DETECTED - Manual assignment required');
      console.log('⚠️  These assets were not assigned to default customers to preserve data integrity');
      console.log('⚠️  Please manually assign these assets to correct customers/projects through the UI');
      
      // Do NOT auto-fix with default values - this was causing the NADMA/Putrajaya problem
      // Assets should be manually assigned to correct customers based on their actual source
      
      return { fixed: 0, orphaned: orphanAssets.length };
    } catch (error) {
      console.error('Error in fixOrphanedAssets:', error);
      throw error;
    }
  }
}

module.exports = Asset;