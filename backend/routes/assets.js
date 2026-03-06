const express = require('express');
const { body } = require('express-validator');
const {
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
} = require('../controllers/assetController');
const { authenticateToken, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// Validation rules
const assetValidationRules = [
  body('serialNumber')
    .notEmpty()
    .withMessage('Serial number is required')
    .isLength({ max: 100 })
    .withMessage('Serial number must be less than 100 characters'),
  body('assetModelName')
    .notEmpty()
    .withMessage('Asset model name is required')
    .isLength({ max: 255 })
    .withMessage('Asset model name must be less than 255 characters'),
  body('assetManufacturer')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Manufacturer must be less than 255 characters'),
  body('assetStatus')
    .optional()
    .isIn(['Available', 'In Use', 'Maintenance', 'Retired', 'Lost', 'Damaged'])
    .withMessage('Invalid asset status'),
  body('purchasePrice')
    .optional()
    .isNumeric()
    .withMessage('Purchase price must be a number'),
  body('purchaseDate')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Invalid purchase date format'),
  body('warrantyDate')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Invalid warranty date format')
];

const updateAssetValidationRules = [
  body('assetModelName')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Asset model name must be less than 255 characters'),
  body('assetManufacturer')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Manufacturer must be less than 255 characters'),
  body('assetStatus')
    .optional()
    .isIn(['Available', 'In Use', 'Maintenance', 'Retired', 'Lost', 'Damaged'])
    .withMessage('Invalid asset status'),
  body('purchasePrice')
    .optional()
    .isNumeric()
    .withMessage('Purchase price must be a number'),
  body('purchaseDate')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Invalid purchase date format'),
  body('warrantyDate')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Invalid warranty date format')
];

// Routes
router.get('/', authenticateToken, getAllAssets);
router.get('/statistics', getAssetStatistics);
router.get('/detail/:id', getAssetDetail);
router.get('/id/:id', getAssetById); // Get asset by ID
router.get('/:serialNumber', getAssetBySerialNumber);

// Protected routes (require authentication)
router.post('/', 
  authenticateToken, 
  assetValidationRules, 
  handleValidationErrors, 
  createAsset
);

// New route for creating assets with complete details
router.post('/create-with-details',
  authenticateToken,
  createAssetWithDetails
);

router.put('/id/:id', 
  authenticateToken,
  updateAssetValidationRules, 
  handleValidationErrors, 
  updateAssetById
);

// Update asset flag status and remarks
router.patch('/id/:id/flag',
  authenticateToken,
  updateAssetFlag
);

router.put('/:serialNumber', 
  authenticateToken, 
  updateAssetValidationRules, 
  handleValidationErrors, 
  updateAsset
);

router.delete('/:serialNumber', 
  authenticateToken, 
  authorize('admin', 'manager'), 
  deleteAsset
);

// Delete asset by ID
router.delete('/id/:id', 
  authenticateToken,
  authorize('admin', 'manager'), 
  deleteAssetById
);

router.post('/validate-import',
  body('assets').isArray().withMessage('Assets must be an array'),
  handleValidationErrors,
  validateImportData
);

router.post('/bulk-import', 
  body('assets').isArray().withMessage('Assets must be an array'),
  handleValidationErrors,
  bulkImportAssets
);

// Fix orphaned assets route (development/admin only)
router.post('/fix-orphaned', fixOrphanedAssets);

module.exports = router;