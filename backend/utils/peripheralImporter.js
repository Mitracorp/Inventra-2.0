/**
 * Peripheral-Only Import Handler
 * 
 * Handles adding peripherals to existing assets without creating duplicates
 */

const Asset = require('../models/Asset');
const logger = require('./logger');

class PeripheralImporter {
  /**
   * Add peripherals to existing assets
   * @param {Array} peripheralRows - Rows containing peripheral data for existing assets
   * @returns {Object} Import results
   */
  static async addPeripheralsToExistingAssets(peripheralRows) {
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      duplicates: 0,
      errors: [],
      warnings: [],
      details: []
    };
    
    console.log(`\n🔧 Adding peripherals to ${peripheralRows.length} existing assets...`);
    
    for (const row of peripheralRows) {
      try {
        const assetSerial = row.serial_number;
        const assetId = row.existingAssetId;
        
        console.log(`\n📍 Processing asset: ${assetSerial} (ID: ${assetId})`);
        
        // Extract peripheral data from row
        const peripherals = this.extractPeripheralData(row);
        
        if (peripherals.length === 0) {
          console.log(`   ⏭️  No peripherals to add for ${assetSerial}`);
          results.skipped++;
          results.details.push({
            assetSerial,
            assetId,
            action: 'skipped',
            reason: 'No peripheral data found'
          });
          continue;
        }
        
        console.log(`   Found ${peripherals.length} peripheral(s) to add`);
        
        // Add each peripheral
        const peripheralIds = [];
        for (const peripheral of peripherals) {
          try {
            console.log(`   Creating peripheral: ${peripheral.peripheral_name} (${peripheral.serial_code || 'No serial'})`);
            
            // Check for duplicate peripheral
            const isDuplicate = await this.checkDuplicatePeripheral(
              assetId,
              peripheral.peripheral_name,
              peripheral.serial_code
            );
            
            if (isDuplicate) {
              console.log(`   ⚠️  Duplicate peripheral detected: ${peripheral.peripheral_name} with serial ${peripheral.serial_code || 'N/A'} - Skipping`);
              results.duplicates++;
              results.warnings.push({
                assetSerial,
                assetId,
                peripheral: peripheral.peripheral_name,
                serialCode: peripheral.serial_code || 'N/A',
                message: `Peripheral '${peripheral.peripheral_name}' with serial code '${peripheral.serial_code || 'N/A'}' already exists for this asset`
              });
              continue; // Skip this peripheral and continue with others
            }
            
            const peripheralId = await Asset.createPeripheral(
              assetId,
              peripheral.peripheral_name,
              peripheral.serial_code,
              peripheral.condition || 'Good',
              peripheral.remarks || ''
            );
            
            peripheralIds.push(peripheralId);
            console.log(`   ✅ Peripheral created with ID: ${peripheralId}`);
          } catch (peripheralError) {
            console.error(`   ❌ Failed to create peripheral: ${peripheralError.message}`);
            results.errors.push({
              assetSerial,
              peripheral: peripheral.peripheral_name,
              error: peripheralError.message
            });
          }
        }
        
        if (peripheralIds.length > 0) {
          results.success++;
          results.details.push({
            assetSerial,
            assetId,
            action: 'peripherals_added',
            peripheralIds,
            count: peripheralIds.length
          });
          
          logger.info(`Added ${peripheralIds.length} peripheral(s) to asset ${assetSerial}`);
        } else {
          results.failed++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing asset ${row.serial_number}:`, error.message);
        results.failed++;
        results.errors.push({
          assetSerial: row.serial_number,
          error: error.message
        });
      }
    }
    
    console.log(`\n📊 Peripheral Import Summary:`);
    console.log(`   ✅ Success: ${results.success}`);
    console.log(`   ❌ Failed: ${results.failed}`);
    console.log(`   ⏭️  Skipped: ${results.skipped}`);
    console.log(`   ⚠️  Duplicates: ${results.duplicates}`);
    
    return results;
  }
  
  /**
   * Extract peripheral data from a CSV row
   * Handles both single peripheral and multiple peripherals (from grouping)
   * Also splits comma-separated peripheral names and serial codes
   * @param {Object} row - CSV row data
   * @returns {Array} Array of peripheral objects
   */
  static extractPeripheralData(row) {
    const peripherals = [];
    
    // Check if row has grouped peripherals array
    if (row.peripherals && Array.isArray(row.peripherals)) {
      // Process each peripheral, splitting comma-separated values
      row.peripherals.forEach(p => {
        // Split comma-separated peripheral names and serial codes
        const peripheralNames = p.peripheral_name ? 
          String(p.peripheral_name).split(',').map(s => s.trim()).filter(s => s) : [];
        const serialCodes = p.serial_code || p.serial_code_name ? 
          String(p.serial_code || p.serial_code_name).split(',').map(s => s.trim()).filter(s => s) : [];
        
        // If single peripheral (no commas), add as-is
        if (peripheralNames.length <= 1 && serialCodes.length <= 1) {
          peripherals.push({
            peripheral_name: p.peripheral_name,
            serial_code: p.serial_code || p.serial_code_name,
            condition: p.condition || 'Good',
            remarks: p.remarks || ''
          });
        } else {
          // Split into multiple peripherals
          const maxLength = Math.max(peripheralNames.length, serialCodes.length);
          for (let i = 0; i < maxLength; i++) {
            const peripheral = {
              condition: p.condition || 'Good',
              remarks: p.remarks || ''
            };
            
            if (i < peripheralNames.length && peripheralNames[i]) {
              peripheral.peripheral_name = peripheralNames[i];
            }
            
            if (i < serialCodes.length && serialCodes[i]) {
              peripheral.serial_code = serialCodes[i];
            }
            
            if (peripheral.peripheral_name) {
              peripherals.push(peripheral);
            }
          }
        }
      });
      
      return peripherals;
    }
    
    // Check for single peripheral in row - also handle comma-separated values
    if (row.peripheral_name) {
      const peripheralNames = String(row.peripheral_name).split(',').map(s => s.trim()).filter(s => s);
      const serialCodes = row.serial_code || row.serial_code_name ? 
        String(row.serial_code || row.serial_code_name).split(',').map(s => s.trim()).filter(s => s) : [];
      
      const maxLength = Math.max(peripheralNames.length, serialCodes.length);
      for (let i = 0; i < maxLength; i++) {
        const peripheral = {
          condition: row.condition || row.peripheral_condition || 'Good',
          remarks: row.remarks || row.peripheral_remarks || ''
        };
        
        if (i < peripheralNames.length && peripheralNames[i]) {
          peripheral.peripheral_name = peripheralNames[i];
        }
        
        if (i < serialCodes.length && serialCodes[i]) {
          peripheral.serial_code = serialCodes[i];
        }
        
        if (peripheral.peripheral_name) {
          peripherals.push(peripheral);
        }
      }
    }
    
    return peripherals;
  }
  
  /**
   * Check for duplicate peripherals before adding
   * @param {Number} assetId - Asset ID
   * @param {String} peripheralTypeName - Peripheral type name
   * @param {String} serialCode - Peripheral serial code
   * @returns {Boolean} True if duplicate exists
   */
  static async checkDuplicatePeripheral(assetId, peripheralTypeName, serialCode) {
    try {
      const { pool } = require('../config/database');
      
      // Check if peripheral with same type and serial code already exists for this asset
      // Match by peripheral type name (case-insensitive) and serial code
      const [existing] = await pool.execute(
        `SELECT p.Peripheral_ID 
         FROM PERIPHERAL p
         JOIN PERIPHERAL_TYPE pt ON p.Peripheral_Type_ID = pt.Peripheral_Type_ID
         WHERE p.Asset_ID = ? 
         AND LOWER(pt.Peripheral_Type_Name) = LOWER(?)
         AND (
           (p.Serial_Code IS NULL AND ? IS NULL) OR
           (p.Serial_Code = ?)
         )
         LIMIT 1`,
        [assetId, peripheralTypeName, serialCode || null, serialCode || null]
      );
      
      return existing.length > 0;
    } catch (error) {
      console.error('Error checking duplicate peripheral:', error.message);
      return false; // On error, allow the insert attempt (will be caught by error handler)
    }
  }
  
  /**
   * Preview what will be added without actually adding
   * @param {Array} peripheralRows - Rows to preview
   * @returns {Object} Preview information
   */
  static async previewPeripheralImport(peripheralRows) {
    const preview = {
      totalAssets: peripheralRows.length,
      totalPeripherals: 0,
      assetDetails: []
    };
    
    for (const row of peripheralRows) {
      const peripherals = this.extractPeripheralData(row);
      preview.totalPeripherals += peripherals.length;
      
      preview.assetDetails.push({
        assetSerial: row.serial_number,
        assetId: row.existingAssetId,
        peripheralCount: peripherals.length,
        peripherals: peripherals.map(p => ({
          name: p.peripheral_name,
          serial: p.serial_code || 'N/A'
        }))
      });
    }
    
    return preview;
  }
}

module.exports = PeripheralImporter;
