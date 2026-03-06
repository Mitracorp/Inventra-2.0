const express = require('express');
const router = express.Router();

const {
  getAllModels,
  getOrCreateModel,
  searchModels,
  createModel,
  updateModel,
  deleteModel,
  getModelSpecs,
  getAllModelsWithSpecs,
  getModelWithSpecs,
  addModelSpecs,
  updateModelSpec,
  deleteModelSpec
} = require('../controllers/modelController');

// Import middleware (if authentication is implemented)
// const { requireAuth } = require('../middleware/auth');

/**
 * @route   GET /api/v1/models
 * @desc    Get all models for dropdown/autocomplete
 * @access  Public (or Private if auth is implemented)
 */
router.get('/', getAllModels);

/**
 * @route   GET /api/v1/models/with-specs
 * @desc    Get all models with their specifications
 * @access  Public
 */
router.get('/with-specs', getAllModelsWithSpecs);

/**
 * @route   GET /api/v1/models/:id/specs
 * @desc    Get specifications for a specific model
 * @access  Public
 */
router.get('/:id/specs', getModelSpecs);

/**
 * @route   GET /api/v1/models/:id/with-specs
 * @desc    Get a specific model with its specifications
 * @access  Public
 */
router.get('/:id/with-specs', getModelWithSpecs);

/**
 * @route   GET /api/v1/models/search
 * @desc    Search models by partial name match
 * @access  Public
 * @query   q - search term
 */
router.get('/search', searchModels);

/**
 * @route   POST /api/v1/models
 * @desc    Create a new model explicitly
 * @access  Private (if auth is implemented)
 */
router.post('/', createModel);

/**
 * @route   POST /api/v1/models/get-or-create
 * @desc    Get existing model or create new one (hybrid functionality)
 * @access  Private (if auth is implemented)
 */
router.post('/get-or-create', getOrCreateModel);

/**
 * @route   POST /api/v1/models/:id/specs
 * @desc    Add specifications to a model
 * @access  Private (if auth is implemented)
 */
router.post('/:id/specs', addModelSpecs);

/**
 * @route   PUT /api/v1/models/:id
 * @desc    Update model by ID
 * @access  Private (if auth is implemented)
 */
router.put('/:id', updateModel);

/**
 * @route   PUT /api/v1/models/:modelId/specs/:attributeId
 * @desc    Update a specific specification for a model
 * @access  Private (if auth is implemented)
 */
router.put('/:modelId/specs/:attributeId', updateModelSpec);

/**
 * @route   DELETE /api/v1/models/:id
 * @desc    Delete model by ID
 * @access  Private (if auth is implemented)
 */
router.delete('/:id', deleteModel);

/**
 * @route   DELETE /api/v1/models/:modelId/specs/:attributeId
 * @desc    Delete a specification from a model
 * @access  Private (if auth is implemented)
 */
router.delete('/:modelId/specs/:attributeId', deleteModelSpec);

module.exports = router;