const express = require('express');
const router = express.Router();

const {
  getAllPeripheralTypes,
  getOrCreatePeripheralType,
  searchPeripheralTypes,
  createPeripheral,
  getPeripheralsByAsset,
  createPeripheralType
} = require('../controllers/peripheralController');

// Import middleware (if authentication is implemented)
// const { requireAuth } = require('../middleware/auth');

/**
 * @route   GET /api/v1/peripherals/types
 * @desc    Get all peripheral types for dropdown/autocomplete
 * @access  Public (or Private if auth is implemented)
 */
router.get('/types', getAllPeripheralTypes);

/**
 * @route   GET /api/v1/peripherals/types/search
 * @desc    Search peripheral types by partial name match
 * @access  Public
 * @query   q - search term
 */
router.get('/types/search', searchPeripheralTypes);

/**
 * @route   POST /api/v1/peripherals/types
 * @desc    Create a new peripheral type explicitly
 * @access  Private (if auth is implemented)
 */
router.post('/types', createPeripheralType);

/**
 * @route   POST /api/v1/peripherals/types/get-or-create
 * @desc    Get existing peripheral type or create new one (hybrid functionality)
 * @access  Private (if auth is implemented)
 */
router.post('/types/get-or-create', getOrCreatePeripheralType);

/**
 * @route   POST /api/v1/peripherals
 * @desc    Create a peripheral record for an asset
 * @access  Private (if auth is implemented)
 */
router.post('/', createPeripheral);

/**
 * @route   GET /api/v1/peripherals/asset/:assetId
 * @desc    Get peripherals for a specific asset
 * @access  Public
 */
router.get('/asset/:assetId', getPeripheralsByAsset);

module.exports = router;