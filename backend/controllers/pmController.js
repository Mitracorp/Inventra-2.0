const PMaintenance = require('../models/PMaintenance');
const { formatResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const pdfGenerator = require('../utils/pdfGenerator');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { pool } = require('../config/database');
const { logPMChange } = require('../utils/auditLogger');

/**
 * Get all PM records
 */
const getAllPM = async (req, res, next) => {
  try {
    const userRole = req.user?.role;
    console.log('🔍 getAllPM - User Role:', userRole);
    
    // Check if user is customer-type role (not Admin or Staff)
    const isCustomerRole = userRole && 
      userRole.toLowerCase() !== 'admin' && 
      userRole.toLowerCase() !== 'staff';
    
    console.log('🔍 Is Customer Role:', isCustomerRole);
    
    let allowedProjectIds = null;
    
    if (isCustomerRole) {
      console.log('🔍 Filtering PM for customer:', userRole);
      try {
        // 1. Find Customer_IDs where Customer_Name matches user's role
        const [customerRows] = await pool.execute(
          'SELECT DISTINCT Customer_ID FROM CUSTOMER WHERE Customer_Name = ?',
          [userRole]
        );
        
        console.log('🔍 Found customer IDs:', customerRows);
        
        if (customerRows.length === 0) {
          return res.status(200).json({ data: [] });
        }
        
        const customerIds = customerRows.map(row => row.Customer_ID);
        
        // 2. Get Project_IDs from INVENTORY for these customers
        const placeholders = customerIds.map(() => '?').join(',');
        const [inventoryRows] = await pool.execute(
          `SELECT DISTINCT i.Project_ID 
           FROM INVENTORY i 
           WHERE i.Customer_ID IN (${placeholders}) AND i.Project_ID IS NOT NULL`,
          customerIds
        );
        
        console.log('🔍 Found project IDs from inventory:', inventoryRows);
        
        if (inventoryRows.length === 0) {
          return res.status(200).json({ data: [] });
        }
        
        allowedProjectIds = inventoryRows.map(row => row.Project_ID);
        console.log('🔍 Allowed Project IDs for PM:', allowedProjectIds);
      } catch (dbError) {
        console.error('❌ Database error during PM filtering:', dbError);
        throw dbError;
      }
    }
    
    const pmRecords = await PMaintenance.findAll(allowedProjectIds);
    res.status(200).json({ data: pmRecords });
  } catch (error) {
    logger.error('Error in getAllPM:', error);
    res.status(500).json({
      error: 'Failed to fetch PM records',
      message: error.message
    });
  }
};

/**
 * Get PM statistics
 */
const getPMStatistics = async (req, res, next) => {
  try {
    const userRole = req.user?.role;
    console.log('🔍 getPMStatistics - User Role:', userRole);
    
    // Check if user is customer-type role (not Admin or Staff)
    const isCustomerRole = userRole && 
      userRole.toLowerCase() !== 'admin' && 
      userRole.toLowerCase() !== 'staff';
    
    let allowedProjectIds = null;
    
    if (isCustomerRole) {
      console.log('🔍 Filtering PM statistics for customer:', userRole);
      try {
        // 1. Find Customer_IDs where Customer_Name matches user's role
        const [customerRows] = await pool.execute(
          'SELECT DISTINCT Customer_ID FROM CUSTOMER WHERE Customer_Name = ?',
          [userRole]
        );
        
        if (customerRows.length === 0) {
          return res.status(200).json(formatResponse(true, {
            total: 0,
            thisYear: 0,
            thisMonth: 0
          }, 'PM statistics retrieved successfully'));
        }
        
        const customerIds = customerRows.map(row => row.Customer_ID);
        
        // 2. Get Project_IDs from INVENTORY for these customers
        const placeholders = customerIds.map(() => '?').join(',');
        const [inventoryRows] = await pool.execute(
          `SELECT DISTINCT i.Project_ID 
           FROM INVENTORY i 
           WHERE i.Customer_ID IN (${placeholders}) AND i.Project_ID IS NOT NULL`,
          customerIds
        );
        
        if (inventoryRows.length === 0) {
          return res.status(200).json(formatResponse(true, {
            total: 0,
            thisYear: 0,
            thisMonth: 0
          }, 'PM statistics retrieved successfully'));
        }
        
        allowedProjectIds = inventoryRows.map(row => row.Project_ID);
        console.log('🔍 Allowed Project IDs for statistics:', allowedProjectIds);
      } catch (dbError) {
        console.error('❌ Database error during statistics filtering:', dbError);
        throw dbError;
      }
    }
    
    const statistics = await PMaintenance.getStatistics(allowedProjectIds);
    res.status(200).json(formatResponse(true, statistics, 'PM statistics retrieved successfully'));
  } catch (error) {
    logger.error('Error in getPMStatistics:', error);
    res.status(500).json({
      error: 'Failed to fetch PM statistics',
      message: error.message
    });
  }
};

/**
 * Get unique customers
 */
const getCustomers = async (req, res, next) => {
  try {
    const userRole = req.user?.role;
    console.log('🔍 getCustomers - User Role:', userRole);
    
    // Check if user is customer-type role (not Admin or Staff)
    const isCustomerRole = userRole && 
      userRole.toLowerCase() !== 'admin' && 
      userRole.toLowerCase() !== 'staff';
    
    let allowedProjectIds = null;
    
    if (isCustomerRole) {
      console.log('🔍 Filtering customers for PM - customer:', userRole);
      try {
        // 1. Find Customer_IDs where Customer_Name matches user's role
        const [customerRows] = await pool.execute(
          'SELECT DISTINCT Customer_ID FROM CUSTOMER WHERE Customer_Name = ?',
          [userRole]
        );
        
        if (customerRows.length === 0) {
          return res.status(200).json([]);
        }
        
        const customerIds = customerRows.map(row => row.Customer_ID);
        
        // 2. Get Project_IDs from INVENTORY for these customers
        const placeholders = customerIds.map(() => '?').join(',');
        const [inventoryRows] = await pool.execute(
          `SELECT DISTINCT i.Project_ID 
           FROM INVENTORY i 
           WHERE i.Customer_ID IN (${placeholders}) AND i.Project_ID IS NOT NULL`,
          customerIds
        );
        
        if (inventoryRows.length === 0) {
          return res.status(200).json([]);
        }
        
        allowedProjectIds = inventoryRows.map(row => row.Project_ID);
        console.log('🔍 Allowed Project IDs for customer dropdown:', allowedProjectIds);
      } catch (dbError) {
        console.error('❌ Database error during customer filtering:', dbError);
        throw dbError;
      }
    }
    
    const customers = await PMaintenance.getCustomers(allowedProjectIds);
    res.status(200).json(customers);
  } catch (error) {
    logger.error('Error in getCustomers:', error);
    res.status(500).json({
      error: 'Failed to fetch customers',
      message: error.message
    });
  }
};

/**
 * Get branches by customer
 */
const getBranchesByCustomer = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const branches = await PMaintenance.getBranchesByCustomer(customerId);
    res.status(200).json(branches);
  } catch (error) {
    logger.error('Error in getBranchesByCustomer:', error);
    res.status(500).json({
      error: 'Failed to fetch branches',
      message: error.message
    });
  }
};

/**
 * Get PM records filtered by customer and branch
 */
const getPMByCustomerAndBranch = async (req, res, next) => {
  try {
    const { customerId, branch } = req.query;

    if (!customerId || !branch) {
      return res.status(400).json({
        error: 'Customer ID and Branch are required'
      });
    }

    const pmRecords = await PMaintenance.getPMWithChecklistByCustomerAndBranch(customerId, branch);
    res.status(200).json(pmRecords);
  } catch (error) {
    logger.error('Error in getPMByCustomerAndBranch:', error);
    res.status(500).json({
      error: 'Failed to fetch PM records',
      message: error.message
    });
  }
};

/**
 * Get all checklist items by category
 */
const getAllChecklistByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const checklist = await PMaintenance.getAllChecklistItemsByCategory(categoryId);
    res.status(200).json(checklist);
  } catch (error) {
    logger.error('Error in getAllChecklistByCategory:', error);
    res.status(500).json({
      error: 'Failed to fetch checklist items',
      message: error.message
    });
  }
};

/**
 * Get checklist by category
 */
const getChecklistByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const checklist = await PMaintenance.getChecklistByCategory(categoryId);
    res.status(200).json(checklist);
  } catch (error) {
    logger.error('Error in getChecklistByCategory:', error);
    res.status(500).json({
      error: 'Failed to fetch checklist',
      message: error.message
    });
  }
};

/**
 * Get PM results by PM ID
 */
const getResultsByPMId = async (req, res, next) => {
  try {
    const { pmId } = req.params;
    const results = await PMaintenance.getResultsByPMId(pmId);
    res.status(200).json(results);
  } catch (error) {
    logger.error('Error in getResultsByPMId:', error);
    res.status(500).json({
      error: 'Failed to fetch PM results',
      message: error.message
    });
  }
};

/**
 * Get detailed PM with checklist results
 */
const getDetailedPM = async (req, res, next) => {
  try {
    const { pmId } = req.params;
    const pmDetail = await PMaintenance.getDetailedPM(pmId);

    if (!pmDetail) {
      return res.status(404).json({
        error: 'PM record not found'
      });
    }

    res.status(200).json(pmDetail);
  } catch (error) {
    logger.error('Error in getDetailedPM:', error);
    res.status(500).json({
      error: 'Failed to fetch PM details',
      message: error.message
    });
  }
};

/**
 * Get PM records by asset ID
 */
const getPMByAssetId = async (req, res, next) => {
  try {
    const { assetId } = req.params;
    const pmRecords = await PMaintenance.findByAssetId(assetId);
    res.status(200).json(pmRecords);
  } catch (error) {
    logger.error('Error in getPMByAssetId:', error);
    res.status(500).json({
      error: 'Failed to fetch PM records for asset',
      message: error.message
    });
  }
};

/**
 * Create new PM record with checklist results
 */
const createPM = async (req, res, next) => {
  try {
    const { assetId, pmDate, remarks, checklistResults, status } = req.body;

    // Validate required fields
    if (!assetId || !pmDate || !checklistResults || !Array.isArray(checklistResults)) {
      return res.status(400).json({
        error: 'Asset ID, PM Date, and checklist results are required'
      });
    }

    // Get user ID from authenticated user (from JWT token)
    const createdBy = req.user.userId;

    // Create PM with results
    const pmId = await PMaintenance.createWithResults(
      assetId, 
      pmDate, 
      remarks || null, 
      checklistResults,
      status || 'In-Process',
      createdBy
    );

    res.status(201).json({
      success: true,
      message: 'PM record created successfully',
      pmId: pmId,
      data: { pmId }
    });
  } catch (error) {
    logger.error('Error in createPM:', error);
    res.status(500).json({
      error: 'Failed to create PM record',
      message: error.message
    });
  }
};

/**
 * Get all categories
 */
const getAllCategories = async (req, res, next) => {
  try {
    const categories = await PMaintenance.getAllCategories();
    res.json(categories);
  } catch (error) {
    logger.error('Error in getAllCategories:', error);
    res.status(500).json({
      error: 'Failed to fetch categories',
      message: error.message
    });
  }
};

/**
 * Create new checklist item
 */
const createChecklistItem = async (req, res, next) => {
  try {
    const { categoryId, checkItemLong } = req.body;

    if (!categoryId || !checkItemLong) {
      return res.status(400).json({
        error: 'Category ID and check item are required'
      });
    }

    const checklistId = await PMaintenance.createChecklistItem(categoryId, checkItemLong);

    res.status(201).json({
      success: true,
      message: 'Checklist item created successfully',
      data: { checklistId }
    });
  } catch (error) {
    logger.error('Error in createChecklistItem:', error);
    res.status(500).json({
      error: 'Failed to create checklist item',
      message: error.message
    });
  }
};

/**
 * Update checklist item
 */
const updateChecklistItem = async (req, res, next) => {
  try {
    const { checklistId } = req.params;
    const { checkItemLong } = req.body;

    if (!checkItemLong) {
      return res.status(400).json({
        error: 'Check item is required'
      });
    }

    const success = await PMaintenance.updateChecklistItem(checklistId, checkItemLong);

    if (!success) {
      return res.status(404).json({
        error: 'Checklist item not found'
      });
    }

    res.json({
      success: true,
      message: 'Checklist item updated successfully'
    });
  } catch (error) {
    logger.error('Error in updateChecklistItem:', error);
    res.status(500).json({
      error: 'Failed to update checklist item',
      message: error.message
    });
  }
};

/**
 * Delete checklist item
 */
const deleteChecklistItem = async (req, res, next) => {
  try {
    const { checklistId } = req.params;

    const success = await PMaintenance.deleteChecklistItem(checklistId);

    if (!success) {
      return res.status(404).json({
        error: 'Checklist item not found'
      });
    }

    res.json({
      success: true,
      message: 'Checklist item deleted successfully'
    });
  } catch (error) {
    logger.error('Error in deleteChecklistItem:', error);
    
    // If error message indicates item is in use, return 409 Conflict
    if (error.message.includes('Cannot delete checklist item')) {
      return res.status(409).json({
        error: error.message,
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to delete checklist item',
      message: error.message
    });
  }
};

/**
 * Create new category
 */
const createCategory = async (req, res, next) => {
  try {
    const { categoryName } = req.body;

    if (!categoryName) {
      return res.status(400).json({
        error: 'Category name is required'
      });
    }

    const categoryId = await PMaintenance.createCategory(categoryName);

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { categoryId }
    });
  } catch (error) {
    logger.error('Error in createCategory:', error);
    res.status(500).json({
      error: 'Failed to create category',
      message: error.message
    });
  }
};

/**
 * Generate and download PM report PDF
 */
const getPMReport = async (req, res, next) => {
  try {
    const { pmId } = req.params;

    // Check if PM exists
    const pmDetail = await PMaintenance.getDetailedPM(pmId);
    if (!pmDetail) {
      return res.status(404).json({
        error: 'PM record not found'
      });
    }

    // Check if PDF already exists in database
    const pdfCheck = await pdfGenerator.checkPDFExists(pmId);
    
    let filepath;
    let filename;
    const fs = require('fs');

    if (pdfCheck.exists && pdfCheck.filepath) {
      // Database has file_path, check if file actually exists
      const absolutePath = path.join(__dirname, '../', pdfCheck.filepath);
      
      if (fs.existsSync(absolutePath)) {
        // File exists in directory, use it
        filepath = pdfCheck.filepath;
        filename = path.basename(filepath);
        logger.info(`✅ Using existing PDF for PM_ID ${pmId}: ${filename}`);
      } else {
        // File path in DB but file missing, regenerate
        logger.info(`⚠️  PDF record exists but file missing, regenerating for PM_ID ${pmId}`);
        const result = await pdfGenerator.generatePMReport(pmId);

        if (!result.success) {
          return res.status(500).json({
            error: 'Failed to generate PDF report',
            message: result.error
          });
        }

        filepath = result.filepath;
        filename = result.filename;
        
        // Update database with new file path
        await pdfGenerator.updateFilePath(pmId, filepath);
        
        logger.info(`✅ PDF regenerated successfully: ${filename}`);
      }
    } else {
      // No PDF record, generate new one
      logger.info(`⚙️ Generating new PDF for PM_ID ${pmId}`);
      const result = await pdfGenerator.generatePMReport(pmId);

      if (!result.success) {
        return res.status(500).json({
          error: 'Failed to generate PDF report',
          message: result.error
        });
      }

      filepath = result.filepath;
      filename = result.filename;
      
      // Update database with new file path
      await pdfGenerator.updateFilePath(pmId, filepath);
      
      logger.info(`✅ PDF generated successfully: ${filename}`);
    }

    // Convert relative path to absolute path
    const absolutePath = path.join(__dirname, '../', filepath);

    // Final check before download
    if (!fs.existsSync(absolutePath)) {
      logger.error(`❌ PDF file not found: ${absolutePath}`);
      return res.status(404).json({
        error: 'PDF file not found',
        message: 'The PDF file could not be located on the server'
      });
    }

    // Verify file is not empty (0 bytes)
    const stats = fs.statSync(absolutePath);
    if (stats.size === 0) {
      logger.error(`❌ PDF file is empty (0 bytes): ${absolutePath}`);
      return res.status(500).json({
        error: 'PDF file is corrupted',
        message: 'The PDF file was generated but is empty'
      });
    }

    // Log filename for debugging
    // Normalize filename to guarantee .pdf extension
    const downloadName = filename && filename.toLowerCase().endsWith('.pdf')
      ? filename
      : `${filename || 'pm_report'}.pdf`;

    logger.info(`📥 Downloading PM report: ${downloadName} (${stats.size} bytes)`);
    logger.info(`📂 File path: ${absolutePath}`);

    // Use res.download to handle headers/filenames consistently across environments
    res.download(absolutePath, downloadName, (err) => {
      if (err) {
        logger.error('❌ Error downloading PDF file:', err);
        if (!res.headersSent) {
          return res.status(500).json({
            error: 'Failed to download PDF',
            message: err.message
          });
        }
      } else {
        logger.info(`📥 PDF downloaded successfully: ${filename}`);
      }
    });

  } catch (error) {
    logger.error('Error in getPMReport:', error);
    res.status(500).json({
      error: 'Failed to retrieve PM report',
      message: error.message
    });
  }
};

/**
 * Bulk download PM reports as single PDF (including blank forms)
 */
const bulkDownloadPM = async (req, res, next) => {
  try {
    const { pmIds = [], blankAssetIds = [] } = req.body;

    // Validate at least one type of ID is provided
    if ((!pmIds || !Array.isArray(pmIds)) && (!blankAssetIds || !Array.isArray(blankAssetIds))) {
      logger.error('Invalid request in bulk download');
      return res.status(400).json({
        error: 'Invalid request',
        message: 'pmIds or blankAssetIds array is required'
      });
    }

    if (pmIds.length === 0 && blankAssetIds.length === 0) {
      logger.error('No IDs provided in bulk download request');
      return res.status(400).json({
        error: 'Invalid request',
        message: 'At least one PM ID or blank asset ID must be provided'
      });
    }

    logger.info(`📦 Bulk download requested - PM records: ${pmIds.length}, Blank forms: ${blankAssetIds.length}`);

    // Fetch all PM records with details
    const pmRecordsPromises = pmIds.map(pmId => PMaintenance.getDetailedPM(pmId));
    const pmRecords = await Promise.all(pmRecordsPromises);

    // Fetch all blank asset data
    const blankAssetsPromises = blankAssetIds.map(assetId => PMaintenance.getAssetForBlankPM(assetId));
    const blankAssets = await Promise.all(blankAssetsPromises);

    // Filter out any null results
    const validPMRecords = pmRecords.filter(record => record !== null);
    const validBlankAssets = blankAssets.filter(asset => asset !== null);

    if (validPMRecords.length === 0 && validBlankAssets.length === 0) {
      logger.error('No valid records found for provided IDs');
      return res.status(404).json({
        error: 'No valid records found',
        message: 'None of the provided IDs exist'
      });
    }

    logger.info(`✅ Found ${validPMRecords.length} PM records and ${validBlankAssets.length} blank forms`);

    // Generate combined PDF using pdfGenerator
    logger.info('Starting bulk PDF generation...');
    const result = await pdfGenerator.generateBulkPM(validPMRecords, validBlankAssets);
    
    if (!result || !result.success || !result.absolutePath) {
      logger.error('PDF generation failed:', result?.error);
      throw new Error(result?.error || 'Failed to generate bulk PDF');
    }

    const absolutePath = result.absolutePath;
    const filename = result.filename;

    logger.info(`✅ Bulk PDF generated successfully: ${filename}`);
    logger.info(`📥 Downloading bulk PDF: ${filename}`);
    logger.info(`📂 File path: ${absolutePath}`);

    // Use simple download method
    res.download(absolutePath, filename, (err) => {
      if (err) {
        logger.error('❌ Error sending bulk PDF file:', err);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Failed to download bulk PDF',
            message: err.message
          });
        }
      } else {
        logger.info(`📥 Bulk PDF downloaded successfully: ${filename}`);
        
        // Delete bulk PDF file after successful download
        const fs = require('fs').promises;
        fs.unlink(absolutePath)
          .then(() => logger.info(`🗑️  Cleaned up bulk PDF: ${filename}`))
          .catch(unlinkErr => logger.error('Error deleting bulk PDF:', unlinkErr));
      }
    });

  } catch (error) {
    logger.error('Error in bulkDownloadPM:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to generate bulk PM report',
        message: error.message
      });
    }
  }
};

/**
 * Delete a PM record and all related PM_RESULT entries
 */
const deletePM = async (req, res, next) => {
  try {
    const { pmId } = req.params;
    
    if (!pmId) {
      return res.status(400).json({
        error: 'PM ID is required'
      });
    }
    
    const deleted = await PMaintenance.deletePM(pmId);
    
    if (!deleted) {
      return res.status(404).json({
        error: 'PM record not found'
      });
    }

    const userId = req.user?.User_ID || req.user?.userId || 1;
    const username = req.user?.Username || req.user?.username || 'System';
    await logPMChange(
      userId,
      pmId,
      'DELETE',
      `${username} moved PM record ID: ${pmId} to trash`,
      []
    );
    
    logger.info(`PM record soft deleted: PM_ID ${pmId}`);
    res.status(200).json({
      success: true,
      message: 'PM record moved to trash successfully'
    });
  } catch (error) {
    logger.error('Error in deletePM:', error);
    res.status(500).json({
      error: 'Failed to delete PM record',
      message: error.message
    });
  }
};

/**
 * Update checklist items order
 */
const updateChecklistOrder = async (req, res, next) => {
  try {
    const { orderUpdates } = req.body;

    // Validate input
    if (!Array.isArray(orderUpdates) || orderUpdates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'orderUpdates must be a non-empty array'
      });
    }

    // Validate each update has required fields
    for (const update of orderUpdates) {
      if (!update.Checklist_ID || update.Display_Order === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Each update must have Checklist_ID and Display_Order'
        });
      }
    }

    await PMaintenance.updateChecklistOrder(orderUpdates);

    logger.info(`Checklist order updated: ${orderUpdates.length} items`);
    res.status(200).json({
      success: true,
      message: 'Checklist order updated successfully'
    });
  } catch (error) {
    logger.error('Error in updateChecklistOrder:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update checklist order',
      message: error.message
    });
  }
};

/**
 * Get blank PM report for an asset
 */
const getBlankPMReport = async (req, res, next) => {
  try {
    const { assetId } = req.params;

    logger.info(`📄 Generating blank PM report for Asset_ID: ${assetId}`);

    // Generate blank PDF report
    const result = await pdfGenerator.generateBlankPMReport(assetId);

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to generate blank PDF report',
        message: result.error
      });
    }

    // Convert relative path to absolute path
    const absolutePath = path.join(__dirname, '../', result.filepath);

    // Log filename for debugging
    logger.info(`📥 Downloading blank PM form: ${result.filename}`);
    logger.info(`📂 File path: ${absolutePath}`);

    // Use simple download method
    res.download(absolutePath, result.filename, (err) => {
      if (err) {
        logger.error('❌ Error sending blank PDF file:', err);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Failed to download blank PDF',
            message: err.message
          });
        }
      } else {
        logger.info(`📥 Blank PDF downloaded successfully: ${result.filename}`);
        
        // Delete blank PDF file after successful download
        const fs = require('fs').promises;
        fs.unlink(absolutePath)
          .then(() => logger.info(`🗑️  Cleaned up blank PDF: ${result.filename}`))
          .catch(unlinkErr => logger.error('Error deleting blank PDF:', unlinkErr));
      }
    });

  } catch (error) {
    logger.error('Error in getBlankPMReport:', error);
    res.status(500).json({
      error: 'Failed to generate blank PM report',
      message: error.message
    });
  }
};

// Configure multer for acknowledgement PDF uploads
const acknowledgeStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/signed-pm-reports';
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: async function (req, file, cb) {
    try {
      const pmId = req.params.pmId;
      
      // Fetch Asset Serial Number from database
      const pmData = await PMaintenance.getDetailedPM(pmId);
      
      if (!pmData || !pmData.Asset_Serial_Number) {
        return cb(new Error('PM record or Asset Serial Number not found'));
      }
      
      const serialNumber = pmData.Asset_Serial_Number;
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      
      const filename = `PM${pmId}_Acknowledgement_${serialNumber}_${timestamp}${ext}`;
      cb(null, filename);
    } catch (error) {
      cb(error);
    }
  }
});

const acknowledgeUpload = multer({
  storage: acknowledgeStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Only accept PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

/**
 * Upload recipient acknowledgement PDF
 */
const uploadAcknowledgement = [
  acknowledgeUpload.single('acknowledgement'),
  async (req, res) => {
    try {
      const pmId = parseInt(req.params.pmId);

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      // Update database with file path
      const filePath = req.file.path.replace(/\\/g, '/');
      const updated = await PMaintenance.updateAcknowledgementPath(pmId, filePath);

      if (!updated) {
        // Delete uploaded file if database update fails
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          error: 'PM record not found'
        });
      }

      logger.info(`Acknowledgement uploaded for PM #${pmId}: ${filePath}`);

      res.status(200).json({
        success: true,
        message: 'Acknowledgement uploaded successfully',
        filePath: filePath
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          logger.error('Error deleting file after upload failure:', unlinkError);
        }
      }

      logger.error('Error in uploadAcknowledgement:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload acknowledgement',
        message: error.message
      });
    }
  }
];

/**
 * Delete recipient acknowledgement PDF
 */
const deleteAcknowledgement = async (req, res) => {
  try {
    const pmId = parseInt(req.params.pmId);

    // Get current file path from database
    const pmData = await PMaintenance.getDetailedPM(pmId);
    
    if (!pmData) {
      return res.status(404).json({
        success: false,
        error: 'PM record not found'
      });
    }

    // Delete file from disk if it exists
    if (pmData.file_path_acknowledgement) {
      const filePath = pmData.file_path_acknowledgement;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`Deleted acknowledgement file: ${filePath}`);
      }
    }

    // Set database field to NULL
    const updated = await PMaintenance.updateAcknowledgementPath(pmId, null);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Failed to update database'
      });
    }

    logger.info(`Acknowledgement deleted for PM #${pmId}`);

    res.status(200).json({
      success: true,
      message: 'Acknowledgement deleted successfully'
    });
  } catch (error) {
    logger.error('Error in deleteAcknowledgement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete acknowledgement',
      message: error.message
    });
  }
};

/**
 * Upload user signature (Base64 image)
 */
const uploadSignature = async (req, res, next) => {
  try {
    const { pmId } = req.params;
    const { signature, bagiPihak } = req.body;

    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Signature data is required'
      });
    }

    // Validate Base64 format
    if (!signature.startsWith('data:image/png;base64,')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid signature format. Must be Base64 PNG image'
      });
    }

    // Extract Base64 data (remove "data:image/png;base64," prefix)
    const base64Data = signature.replace(/^data:image\/png;base64,/, '');
    
    // Create uploads/signature directory if it doesn't exist
    const uploadDir = path.join(__dirname, '../uploads/signature');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate filename: signature_{pmId}.png
    const filename = `signature_${pmId}.png`;
    const filePath = path.join(uploadDir, filename);
    
    // Convert Base64 to PNG file
    fs.writeFileSync(filePath, base64Data, 'base64');
    
    // Store relative path in database
    const dbFilePath = `uploads/signature/${filename}`;
    const signedAt = new Date();
    
    // Update PM record with signature path and signed timestamp
    const updated = await PMaintenance.updateSignature(pmId, dbFilePath, signedAt, bagiPihak);
    
    if (!updated) {
      // Delete uploaded file if database update fails
      fs.unlinkSync(filePath);
      return res.status(404).json({
        success: false,
        error: 'PM record not found'
      });
    }

    logger.info(`Signature uploaded for PM #${pmId}: ${dbFilePath}`);

    res.status(200).json({
      success: true,
      message: 'Signature uploaded successfully',
      data: {
        signature_path: dbFilePath,
        signed_at: signedAt
      }
    });
  } catch (error) {
    logger.error('Error in uploadSignature:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload signature',
      message: error.message
    });
  }
};

/**
 * Bulk delete PM records with password verification
 */
const bulkDeletePM = async (req, res, next) => {
  try {
    const { pmIds, password } = req.body;

    // Validate input
    if (!pmIds || !Array.isArray(pmIds) || pmIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'pmIds array is required and cannot be empty'
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Password is required'
      });
    }

// Verify user is authenticated (JWT middleware should set req.user)
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    // Verify password
    const bcrypt = require('bcrypt');
    const { executeQuery } = require('../config/database');

    const users = await executeQuery(
      'SELECT User_Password FROM USER WHERE User_ID = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not found'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, users[0].User_Password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Incorrect password'
      });
    }

    // Soft delete PM records
    let deletedCount = 0;
    const errors = [];
    const userId = req.user?.User_ID || req.user?.userId || 1;
    const username = req.user?.Username || req.user?.username || 'System';

    for (const pmId of pmIds) {
      try {
        const result = await executeQuery(
          'UPDATE PMAINTENANCE SET deleted_at = CURRENT_TIMESTAMP WHERE PM_ID = ? AND deleted_at IS NULL',
          [pmId]
        );
        
        if (result.affectedRows > 0) {
          deletedCount++;
          await logPMChange(
            userId,
            pmId,
            'DELETE',
            `${username} moved PM record ID: ${pmId} to trash`,
            []
          );
        }
      } catch (error) {
        logger.error(`Error deleting PM_ID ${pmId}:`, error);
        errors.push({ pmId, error: error.message });
      }
    }

    // Log the deletion
    logger.info(`User ${req.user.userId} soft deleted ${deletedCount} PM records`);

    res.status(200).json({
      success: true,
      deletedCount,
      failedCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully moved ${deletedCount} PM record(s) to trash`
    });
  } catch (error) {
    logger.error('Error in bulkDeletePM:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete PM records',
      message: error.message
    });
  }
};

/**
 * Revert soft deleted PM record
 */
const revertPMDelete = async (req, res, next) => {
  try {
    const { pmId } = req.params;

    const restored = await PMaintenance.restorePM(pmId);
    if (!restored) {
      return res.status(404).json({
        success: false,
        error: 'PM record not found or already restored'
      });
    }

    const userId = req.user?.User_ID || req.user?.userId || 1;
    const username = req.user?.Username || req.user?.username || 'System';
    await logPMChange(
      userId,
      pmId,
      'RESTORE',
      `${username} restored PM record ID: ${pmId} from trash`,
      []
    );

    res.status(200).json({
      success: true,
      message: 'PM record successfully restored'
    });
  } catch (error) {
    logger.error('Error in revertPMDelete:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore PM record',
      message: error.message
    });
  }
};

/**
 * Mark PM as Completed (without signature)
 */
const markAsCompleted = async (req, res, next) => {
  try {
    const { pmId } = req.params;

    // Update PM status to "Marked as Completed"
    const updated = await PMaintenance.markAsCompleted(pmId);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'PM record not found'
      });
    }

    logger.info(`PM #${pmId} marked as completed without signature`);

    res.status(200).json({
      success: true,
      message: 'PM marked as completed successfully'
    });
  } catch (error) {
    logger.error('Error in markAsCompleted:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark PM as completed',
      message: error.message
    });
  }
};

module.exports = {
  getAllPM,
  getPMStatistics,
  getCustomers,
  getBranchesByCustomer,
  getPMByCustomerAndBranch,
  getChecklistByCategory,
  getAllChecklistByCategory,
  getResultsByPMId,
  getDetailedPM,
  getPMByAssetId,
  createPM,
  deletePM,
  getAllCategories,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  updateChecklistOrder,
  createCategory,
  getPMReport,
  getBlankPMReport,
  bulkDownloadPM,
  uploadAcknowledgement,
  deleteAcknowledgement,
  uploadSignature,
  bulkDeletePM,
  markAsCompleted,
  revertPMDelete
};
