/**
 * AssetGrouper - Groups multiple CSV rows representing the same asset with different peripherals
 * 
 * PROBLEM: CSV files often have one row per peripheral, causing duplicate assets
 * SOLUTION: Group rows by asset identifiers and consolidate peripherals
 * 
 * EXAMPLE INPUT:
 * [
 *   { serial_number: "COW7B74", tag_id: "IKU109", peripheral_name: "mouse", serial_code: "M09909" },
 *   { serial_number: "COW7B74", tag_id: "IKU109", peripheral_name: "keyboard", serial_code: "K09092" }
 * ]
 * 
 * EXAMPLE OUTPUT:
 * [
 *   {
 *     serial_number: "COW7B74",
 *     tag_id: "IKU109",
 *     peripherals: [
 *       { peripheral_name: "mouse", serial_code: "M09909" },
 *       { peripheral_name: "keyboard", serial_code: "K09092" }
 *     ]
 *   }
 * ]
 */

class AssetGrouper {
  /**
   * Core asset fields (fields that define a unique asset)
   * If these match, rows represent the same asset
   */
  static CORE_ASSET_FIELDS = [
    'serial_number',
    'tag_id',
    'project_reference_num',
    'item_name',
    'category',
    'model',
    'status',
    'recipient_name',
    'department_name',
    'customer_name',
    'customer_reference_number',
    'branch',
    'remarks'
  ];

  /**
   * Peripheral-specific fields (maps to PERIPHERAL table in database)
   * DB Schema: PERIPHERAL (Peripheral_ID, Peripheral_Type_ID, Asset_ID, Serial_Code, Condition, Remarks)
   * DB Schema: PERIPHERAL_TYPE (Peripheral_Type_ID, Peripheral_Type_Name)
   */
  static PERIPHERAL_FIELDS = [
    'peripheral_name',  // Maps to Peripheral_Type_Name (lookup/create in PERIPHERAL_TYPE table)
    'serial_code'       // Maps to Serial_Code in PERIPHERAL table
  ];

  /**
   * Generate unique key for asset based on identifiers
   */
  static generateAssetKey(row) {
    // Primary key: serial_number
    if (row.serial_number && row.serial_number.trim()) {
      return `serial:${String(row.serial_number).trim().toLowerCase()}`;
    }
    
    // Secondary key: tag_id
    if (row.tag_id && row.tag_id.trim()) {
      return `tag:${String(row.tag_id).trim().toLowerCase()}`;
    }
    
    // Tertiary key: combination of project + item_name
    if (row.project_reference_num && row.item_name) {
      return `combo:${String(row.project_reference_num).trim().toLowerCase()}:${String(row.item_name).trim().toLowerCase()}`;
    }
    
    // Fallback: generate hash from all core fields
    const coreValues = this.CORE_ASSET_FIELDS
      .map(field => String(row[field] || '').trim().toLowerCase())
      .filter(val => val)
      .join('|');
    
    return `hash:${coreValues}`;
  }

  /**
   * Check if row has peripheral data
   * DB expects peripheral_name (Peripheral_Type_Name) and/or serial_code (Serial_Code)
   */
  static hasPeripheralData(row) {
    return (row.peripheral_name && row.peripheral_name.trim()) ||
           (row.serial_code && row.serial_code.trim());
  }

  /**
   * Extract peripheral data from row
   * Handles comma-separated peripherals: "Mouse, Keyboard" with "M001, K002"
   * Returns array of peripheral objects
   */
  static extractPeripheral(row) {
    console.log('🔍 extractPeripheral called with row:', {
      peripheral_name: row.peripheral_name,
      serial_code: row.serial_code,
      serial_code_name: row.serial_code_name,
      all_keys: Object.keys(row).filter(k => k.toLowerCase().includes('serial') || k.toLowerCase().includes('peripheral'))
    });
    
    if (!this.hasPeripheralData(row)) {
      console.log('❌ No peripheral data found in row');
      return [];
    }

    // Handle comma-separated peripherals
    const peripheralNames = row.peripheral_name ? 
      String(row.peripheral_name).split(',').map(s => s.trim()).filter(s => s) : [];
    const serialCodes = row.serial_code ? 
      String(row.serial_code).split(',').map(s => s.trim()).filter(s => s) : [];
    
    console.log('📊 Extracted arrays:', {
      peripheralNames,
      serialCodes
    });
    
    // If no peripheral names or serial codes, return empty array
    if (peripheralNames.length === 0 && serialCodes.length === 0) {
      return [];
    }

    // Create peripheral objects - match by index
    const peripherals = [];
    const maxLength = Math.max(peripheralNames.length, serialCodes.length);
    
    for (let i = 0; i < maxLength; i++) {
      const peripheral = {};
      
      if (i < peripheralNames.length && peripheralNames[i]) {
        peripheral.peripheral_name = peripheralNames[i];
      }
      
      if (i < serialCodes.length && serialCodes[i]) {
        peripheral.serial_code = serialCodes[i];
      }
      
      // Only add if at least one field exists
      if (Object.keys(peripheral).length > 0) {
        peripherals.push(peripheral);
      }
    }

    console.log('✅ Extracted peripherals:', peripherals);
    return peripherals;
  }

  /**
   * Extract core asset data (excluding peripheral fields)
   */
  static extractCoreAssetData(row) {
    const assetData = {};
    
    // Copy all non-peripheral fields
    Object.keys(row).forEach(field => {
      if (!this.PERIPHERAL_FIELDS.includes(field)) {
        assetData[field] = row[field];
      }
    });

    return assetData;
  }

  /**
   * Group rows by asset, consolidating peripherals
   */
  static groupAssets(data) {
    const assetGroups = new Map();
    const groupingInfo = {
      totalRows: data.length,
      uniqueAssets: 0,
      assetsWithMultiplePeripherals: 0,
      totalPeripherals: 0,
      rowsGrouped: 0,
      conflicts: []
    };

    data.forEach((row, rowIndex) => {
      const assetKey = this.generateAssetKey(row);
      
      if (!assetGroups.has(assetKey)) {
        // First occurrence of this asset
        const coreData = this.extractCoreAssetData(row);
        const peripherals = this.extractPeripheral(row); // Now returns array
        
        assetGroups.set(assetKey, {
          ...coreData,
          peripherals: peripherals.map(p => ({ ...p, _sourceRow: rowIndex + 1 })),
          _sourceRows: [rowIndex + 1],
          _assetKey: assetKey
        });
        
        groupingInfo.totalPeripherals += peripherals.length;
      } else {
        // Duplicate asset - add peripherals if exist
        const existingAsset = assetGroups.get(assetKey);
        const peripherals = this.extractPeripheral(row); // Now returns array
        
        // Check for conflicts in core data
        const conflicts = this.detectConflicts(existingAsset, row, rowIndex + 1);
        if (conflicts.length > 0) {
          groupingInfo.conflicts.push(...conflicts);
        }
        
        // Add all peripherals from this row
        peripherals.forEach(peripheral => {
          existingAsset.peripherals.push({
            ...peripheral,
            _sourceRow: rowIndex + 1
          });
          groupingInfo.totalPeripherals++;
        });
        
        existingAsset._sourceRows.push(rowIndex + 1);
        groupingInfo.rowsGrouped++;
      }
    });

    // Calculate statistics
    groupingInfo.uniqueAssets = assetGroups.size;
    groupingInfo.assetsWithMultiplePeripherals = Array.from(assetGroups.values())
      .filter(asset => asset.peripherals.length > 1).length;
    groupingInfo.totalPeripherals = Array.from(assetGroups.values())
      .reduce((sum, asset) => sum + asset.peripherals.length, 0);

    const groupedAssets = Array.from(assetGroups.values());

    return {
      groupedAssets,
      groupingInfo,
      hasConflicts: groupingInfo.conflicts.length > 0
    };
  }

  /**
   * Detect conflicts in core asset data between rows
   */
  static detectConflicts(existingAsset, newRow, rowNumber) {
    const conflicts = [];
    
    this.CORE_ASSET_FIELDS.forEach(field => {
      const existingValue = String(existingAsset[field] || '').trim().toLowerCase();
      const newValue = String(newRow[field] || '').trim().toLowerCase();
      
      // Only check conflict if both values exist and are different
      if (existingValue && newValue && existingValue !== newValue) {
        conflicts.push({
          assetKey: existingAsset._assetKey,
          field,
          existingValue: existingAsset[field],
          newValue: newRow[field],
          existingRows: existingAsset._sourceRows,
          conflictRow: rowNumber
        });
      }
    });

    return conflicts;
  }

  /**
   * Transform grouped data back to flat structure for backend
   * (Backend expects one row per asset with peripherals in separate table)
   */
  static transformForBackend(groupedAssets) {
    return groupedAssets.map(asset => {
      const assetData = { ...asset };
      
      // Remove metadata fields
      delete assetData._sourceRows;
      delete assetData._assetKey;
      
      // Keep peripherals array for backend to process
      // Backend will handle creating peripheral records
      if (assetData.peripherals) {
        // Remove metadata from peripherals
        assetData.peripherals = assetData.peripherals.map(p => {
          const peripheral = { ...p };
          delete peripheral._sourceRow;
          return peripheral;
        });
      }
      
      return assetData;
    });
  }

  /**
   * Get grouping summary for display
   */
  static getGroupingSummary(groupingResult) {
    const { groupingInfo, groupedAssets } = groupingResult;
    
    return {
      totalInputRows: groupingInfo.totalRows,
      uniqueAssets: groupingInfo.uniqueAssets,
      rowsGrouped: groupingInfo.rowsGrouped,
      assetsWithPeripherals: groupedAssets.filter(a => a.peripherals.length > 0).length,
      assetsWithMultiplePeripherals: groupingInfo.assetsWithMultiplePeripherals,
      totalPeripherals: groupingInfo.totalPeripherals,
      conflicts: groupingInfo.conflicts,
      reductionPercentage: groupingInfo.totalRows > 0 
        ? Math.round(((groupingInfo.totalRows - groupingInfo.uniqueAssets) / groupingInfo.totalRows) * 100)
        : 0
    };
  }

  /**
   * Detect if data likely has grouped assets
   * (Quick check to determine if grouping is needed)
   */
  static needsGrouping(data) {
    if (data.length < 2) return false;
    
    const serialCounts = new Map();
    const tagCounts = new Map();
    let hasPeripherals = false;

    data.forEach(row => {
      const serial = String(row.serial_number || '').trim().toLowerCase();
      const tag = String(row.tag_id || '').trim().toLowerCase();
      
      // Count occurrences of each serial number
      if (serial) {
        serialCounts.set(serial, (serialCounts.get(serial) || 0) + 1);
      }
      
      // Count occurrences of each tag ID
      if (tag) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
      
      // Check if row has peripheral data
      if (this.hasPeripheralData(row)) {
        hasPeripherals = true;
      }
    });

    // Count how many duplicates exist
    let duplicateSerials = 0;
    let duplicateTags = 0;
    
    serialCounts.forEach(count => {
      if (count > 1) duplicateSerials += count;
    });
    
    tagCounts.forEach(count => {
      if (count > 1) duplicateTags += count;
    });

    // If ANY duplicates exist AND data has peripheral fields, suggest grouping
    const hasDuplicates = duplicateSerials > 0 || duplicateTags > 0;
    
    // Lower threshold: if more than 5% of rows are duplicates OR any duplicates with peripherals
    const duplicateRate = Math.max(duplicateSerials, duplicateTags) / data.length;
    const shouldGroup = (duplicateRate > 0.05) || (hasDuplicates && hasPeripherals);
    
    // Debug logging
    console.log('🔍 Asset Grouping Detection:', {
      totalRows: data.length,
      uniqueSerials: serialCounts.size,
      uniqueTags: tagCounts.size,
      duplicateSerialRows: duplicateSerials,
      duplicateTagRows: duplicateTags,
      hasPeripheralData: hasPeripherals,
      duplicateRate: `${(duplicateRate * 100).toFixed(2)}%`,
      threshold: '5%',
      needsGrouping: shouldGroup
    });
    
    return shouldGroup;
  }

  /**
   * Preview grouping results (for display before import)
   */
  static previewGrouping(data, maxPreviewItems = 5) {
    const { groupedAssets, groupingInfo } = this.groupAssets(data);
    
    // Get assets with multiple rows/peripherals for preview
    const multiRowAssets = groupedAssets
      .filter(asset => asset._sourceRows.length > 1 || asset.peripherals.length > 1)
      .slice(0, maxPreviewItems)
      .map(asset => ({
        serial_number: asset.serial_number,
        tag_id: asset.tag_id,
        item_name: asset.item_name,
        sourceRows: asset._sourceRows,
        peripheralCount: asset.peripherals.length,
        peripherals: asset.peripherals.map(p => ({
          name: p.peripheral_name,
          serial: p.serial_code, // Aligned with DB schema (PERIPHERAL.Serial_Code)
          sourceRow: p._sourceRow
        }))
      }));

    return {
      summary: this.getGroupingSummary({ groupedAssets, groupingInfo }),
      preview: multiRowAssets,
      hasMore: multiRowAssets.length < groupedAssets.filter(a => a._sourceRows.length > 1).length
    };
  }
}

export default AssetGrouper;
