const express = require('express');
const router = express.Router();

const {
  getAllCategories,
  getOrCreateCategory,
  searchCategories,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');

// Import middleware (if authentication is implemented)
// const { requireAuth } = require('../middleware/auth');

/**
 * @route   GET /api/v1/categories
 * @desc    Get all categories for dropdown/autocomplete
 * @access  Public (or Private if auth is implemented)
 */
router.get('/', getAllCategories);

/**
 * @route   GET /api/v1/categories/search
 * @desc    Search categories by partial name match
 * @access  Public
 * @query   q - search term
 */
router.get('/search', searchCategories);

/**
 * @route   POST /api/v1/categories
 * @desc    Create a new category explicitly
 * @access  Private (if auth is implemented)
 */
router.post('/', createCategory);

/**
 * @route   POST /api/v1/categories/get-or-create
 * @desc    Get existing category or create new one (hybrid functionality)
 * @access  Private (if auth is implemented)
 */
router.post('/get-or-create', getOrCreateCategory);

/**
 * @route   PUT /api/v1/categories/:id
 * @desc    Update category by ID
 * @access  Private (if auth is implemented)
 */
router.put('/:id', updateCategory);

/**
 * @route   DELETE /api/v1/categories/:id
 * @desc    Delete category by ID
 * @access  Private (if auth is implemented)
 */
router.delete('/:id', deleteCategory);

module.exports = router;