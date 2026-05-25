/**
 * Import Mode Detector
 * 
 * Analyzes CSV import data to determine whether to:
 * - Create new assets
 * - Add peripherals to existing assets
 * - Handle mixed scenarios
 */

const Asset = require('../models/Asset');

class ImportModeDetector {
  /**
   * Analyze CSV data to detect import mode
   * @param {Array} csvRows - Parsed CSV rows with standardized field names
   * @returns {Object} Analysis result with mode and details
   */
  static async detectImportMode(csvRows) {
    const analysis = {
      mode: 'mixed', // 'new_assets', 'add_peripherals', 'mixed'
      existingAssets: 0,
      newAssets: 0,
      assetsWithPeripherals: 0,
      totalRows: csvRows.length,
      details: []
    };
    
    console.log(`🔍 Analyzing ${csvRows.length} rows for import mode detection...`);
    
    for (const row of csvRows) {
      const assetSerial = row.serial_number;
      const hasPeripheral = !!(row.peripheral_name || row.peripherals);
      
      if (!assetSerial) {
        console.warn('⚠️  Row without serial number found, skipping...');
        continue;
      }
      
      // Check if asset exists in database
      const existingAsset = await this.checkAssetExists(assetSerial);
      
      if (existingAsset) {
        analysis.existingAssets++;
        analysis.details.push({
          serial: assetSerial,
          assetId: existingAsset.Asset_ID,
          exists: true,
          hasPeripheral: hasPeripheral,
          action: hasPeripheral ? 'add_peripheral' : 'skip',
          existingData: {
            tag_id: existingAsset.Asset_Tag_ID,
            item_name: existingAsset.Item_Name,
            status: existingAsset.Status
          }
        });
      } else {
        analysis.newAssets++;
        analysis.details.push({
          serial: assetSerial,
          assetId: null,
          exists: false,
          hasPeripheral: hasPeripheral,
          action: 'create_asset'
        });
      }
      
      if (hasPeripheral) {
        analysis.assetsWithPeripherals++;
      }
    }
    
    // Determine overall mode
    if (analysis.existingAssets > 0 && analysis.newAssets === 0) {
      analysis.mode = 'add_peripherals';
      console.log('📌 Import Mode: ADD PERIPHERALS ONLY');
    } else if (analysis.existingAssets === 0 && analysis.newAssets > 0) {
      analysis.mode = 'new_assets';
      console.log('📌 Import Mode: CREATE NEW ASSETS');
    } else if (analysis.existingAssets > 0 && analysis.newAssets > 0) {
      analysis.mode = 'mixed';
      console.log('📌 Import Mode: MIXED (New Assets + Add Peripherals)');
    }
    
    console.log(`   Existing Assets: ${analysis.existingAssets}`);
    console.log(`   New Assets: ${analysis.newAssets}`);
    console.log(`   Assets with Peripherals: ${analysis.assetsWithPeripherals}`);
    
    return analysis;
  }
  
  /**
   * Check if asset exists in database
   * @param {String} assetSerial - Asset serial number
   * @returns {Object|null} Asset object if exists, null otherwise
   */
  static async checkAssetExists(assetSerial) {
    try {
      const asset = await Asset.findBySerialNumber(assetSerial);
      return asset;
    } catch (error) {
      console.error(`Error checking asset existence for ${assetSerial}:`, error.message);
      return null;
    }
  }
  
  /**
   * Get import recommendations based on analysis
   * @param {Object} analysis - Analysis result from detectImportMode
   * @returns {Object} Recommendations object
   */
  static getImportRecommendations(analysis) {
    const recommendations = {
      canProceed: true,
      warnings: [],
      suggestions: [],
      requiredActions: []
    };
    
    if (analysis.mode === 'add_peripherals') {
      recommendations.suggestions.push(
        'All assets already exist in the system. Only peripherals will be added.'
      );
      
      if (analysis.assetsWithPeripherals === 0) {
        recommendations.warnings.push(
          'No peripheral data found in the import file. Nothing will be imported.'
        );
        recommendations.canProceed = false;
      }
    } else if (analysis.mode === 'new_assets') {
      recommendations.suggestions.push(
        'All assets will be created as new entries.'
      );
    } else if (analysis.mode === 'mixed') {
      recommendations.warnings.push(
        `Mixed import detected: ${analysis.existingAssets} existing assets and ${analysis.newAssets} new assets.`
      );
      recommendations.requiredActions.push(
        'Review the import preview carefully before proceeding.'
      );
    }
    
    return recommendations;
  }
  
  /**
   * Filter rows for peripheral-only import
   * @param {Array} csvRows - All CSV rows
   * @param {Object} analysis - Analysis result
   * @returns {Object} Separated rows for different actions
   */
  static separateRowsByAction(csvRows, analysis) {
    const separated = {
      createAssets: [],
      addPeripherals: [],
      skip: []
    };
    
    csvRows.forEach((row, index) => {
      const detail = analysis.details[index];
      
      if (!detail) return;
      
      if (detail.action === 'create_asset') {
        separated.createAssets.push(row);
      } else if (detail.action === 'add_peripheral') {
        separated.addPeripherals.push({
          ...row,
          existingAssetId: detail.assetId
        });
      } else {
        separated.skip.push(row);
      }
    });
    
    return separated;
  }
}

module.exports = ImportModeDetector;
