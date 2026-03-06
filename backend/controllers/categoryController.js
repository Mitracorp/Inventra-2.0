const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get all categories for dropdown/autocomplete
 */
const getAllCategories = async (req, res, next) => {
  try {
    console.log('📋 Fetching all categories from database...');
    const [categories] = await pool.execute(`
      SELECT 
        Category_ID as id,
        Category as name,
        Category_ID,
        Category
      FROM CATEGORY 
      ORDER BY Category ASC
    `);

    console.log(`✅ Successfully fetched ${categories.length} categories from database`);
    console.log('Categories:', categories.map(c => c.Category).join(', '));

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    logger.error('Error in getAllCategories:', error);
    console.error('❌ ERROR fetching categories from database:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    
    // Return fallback categories if database query fails
    const fallbackCategories = [
      { id: 1, name: 'Desktop', Category_ID: 1, Category: 'Desktop' },
      { id: 2, name: 'Printer', Category_ID: 2, Category: 'Printer' },
      { id: 3, name: 'Laptop', Category_ID: 3, Category: 'Laptop' },
      { id: 4, name: 'Server', Category_ID: 4, Category: 'Server' }
    ];
    
    console.log('⚠️ Returning fallback categories due to database error');
    
    res.status(200).json({
      success: true,
      data: fallbackCategories,
      fallback: true
    });
  }
};

/**
 * Get or create category by name (hybrid functionality)
 * This is the core method for supporting free-text + dropdown behavior
 */
const getOrCreateCategory = async (req, res, next) => {
  try {
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Category name is required and must be a non-empty string'
      });
    }

    const categoryName = name.trim();
    console.log(`Getting or creating category: "${categoryName}"`);

    // First try to find existing category (case-insensitive)
    const [existing] = await pool.execute(
      'SELECT Category_ID, Category FROM CATEGORY WHERE LOWER(Category) = LOWER(?)',
      [categoryName]
    );
    
    if (existing.length > 0) {
      console.log(`Found existing category: ID=${existing[0].Category_ID}, Name="${existing[0].Category}"`);
      return res.status(200).json({
        success: true,
        data: {
          id: existing[0].Category_ID,
          name: existing[0].Category,
          Category_ID: existing[0].Category_ID,
          Category: existing[0].Category,
          isNew: false
        }
      });
    }

    // Create new category
    const [result] = await pool.execute(
      'INSERT INTO CATEGORY (Category) VALUES (?)',
      [categoryName]
    );

    const newCategoryId = result.insertId;
    console.log(`✅ Created new category: ID=${newCategoryId}, Name="${categoryName}"`);

    logger.info(`New category created: ${categoryName} (ID: ${newCategoryId}) by user ${req.user?.userId || 'system'}`);

    res.status(201).json({
      success: true,
      data: {
        id: newCategoryId,
        name: categoryName,
        Category_ID: newCategoryId,
        Category: categoryName,
        isNew: true
      },
      message: `New category "${categoryName}" created successfully`
    });
  } catch (error) {
    // Handle duplicate key error (in case of race condition)
    if (error.code === 'ER_DUP_ENTRY') {
      try {
        // Try to get the category that was created by another request
        const [existing] = await pool.execute(
          'SELECT Category_ID, Category FROM CATEGORY WHERE LOWER(Category) = LOWER(?)',
          [req.body.name.trim()]
        );
        
        if (existing.length > 0) {
          return res.status(200).json({
            success: true,
            data: {
              id: existing[0].Category_ID,
              name: existing[0].Category,
              Category_ID: existing[0].Category_ID,
              Category: existing[0].Category,
              isNew: false
            }
          });
        }
      } catch (retryError) {
        console.error('Error in retry after duplicate:', retryError);
      }
    }

    logger.error('Error in getOrCreateCategory:', error);
    console.error('Error getting/creating category:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get or create category',
      message: error.message
    });
  }
};

/**
 * Search categories by partial name match
 */
const searchCategories = async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim() === '') {
      // Return all categories if no search query
      return getAllCategories(req, res, next);
    }

    const searchTerm = `%${q.trim()}%`;
    
    const [categories] = await pool.execute(`
      SELECT 
        Category_ID as id,
        Category as name,
        Category_ID,
        Category
      FROM CATEGORY 
      WHERE Category LIKE ?
      ORDER BY 
        CASE WHEN Category LIKE ? THEN 1 ELSE 2 END,  -- Exact matches first
        Category ASC
      LIMIT 20
    `, [searchTerm, q.trim()]);

    res.status(200).json({
      success: true,
      data: categories,
      query: q.trim()
    });
  } catch (error) {
    logger.error('Error in searchCategories:', error);
    console.error('Error searching categories:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to search categories'
    });
  }
};

/**
 * Create a new category explicitly
 */
const createCategory = async (req, res, next) => {
  try {
    const { name } = req.body;
    
    console.log('🆕 createCategory called with:', { name });
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Category name is required and must be a non-empty string'
      });
    }

    const categoryName = name.trim();
    console.log(`Checking if category "${categoryName}" already exists...`);

    // Check if category already exists
    const [existing] = await pool.execute(
      'SELECT Category_ID, Category FROM CATEGORY WHERE LOWER(Category) = LOWER(?)',
      [categoryName]
    );
    
    if (existing.length > 0) {
      console.log(`❌ Category "${categoryName}" already exists with ID: ${existing[0].Category_ID}`);
      return res.status(409).json({
        success: false,
        error: `Category "${categoryName}" already exists`,
        existingId: existing[0].Category_ID,
        existingName: existing[0].Category
      });
    }

    console.log(`✅ Category "${categoryName}" doesn't exist, creating...`);

    // Create new category
    const [result] = await pool.execute(
      'INSERT INTO CATEGORY (Category) VALUES (?)',
      [categoryName]
    );

    const newCategoryId = result.insertId;
    console.log(`✅ Created new category: ID=${newCategoryId}, Name="${categoryName}"`);
    logger.info(`New category created: ${categoryName} (ID: ${newCategoryId}) by user ${req.user?.userId || 'system'}`);

    res.status(201).json({
      success: true,
      data: {
        id: newCategoryId,
        name: categoryName,
        Category_ID: newCategoryId,
        Category: categoryName
      },
      message: `Category "${categoryName}" created successfully`
    });
  } catch (error) {
    logger.error('Error in createCategory:', error);
    console.error('❌ ERROR in createCategory:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to create category',
      message: error.message
    });
  }
};

/**
 * Update category by ID
 */
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Category name is required and must be a non-empty string'
      });
    }

    const categoryName = name.trim();

    // Check if category exists
    const [existing] = await pool.execute(
      'SELECT Category_ID, Category FROM CATEGORY WHERE Category_ID = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    // Update category
    await pool.execute(
      'UPDATE CATEGORY SET Category = ? WHERE Category_ID = ?',
      [categoryName, id]
    );

    logger.info(`Category updated: ID=${id}, Old="${existing[0].Category}", New="${categoryName}" by user ${req.user?.userId || 'system'}`);

    res.status(200).json({
      success: true,
      data: {
        id: parseInt(id),
        name: categoryName,
        Category_ID: parseInt(id),
        Category: categoryName
      },
      message: `Category updated successfully`
    });
  } catch (error) {
    logger.error('Error in updateCategory:', error);
    console.error('Error updating category:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to update category',
      message: error.message
    });
  }
};

/**
 * Delete category by ID
 */
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if category is in use
    const [assetsUsingCategory] = await pool.execute(
      'SELECT COUNT(*) as count FROM ASSET WHERE Category_ID = ?',
      [id]
    );
    
    if (assetsUsingCategory[0].count > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete category. It is currently used by ${assetsUsingCategory[0].count} asset(s)`,
        assetsCount: assetsUsingCategory[0].count
      });
    }

    // Check if category exists
    const [existing] = await pool.execute(
      'SELECT Category FROM CATEGORY WHERE Category_ID = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    // Delete category
    await pool.execute(
      'DELETE FROM CATEGORY WHERE Category_ID = ?',
      [id]
    );

    logger.info(`Category deleted: ID=${id}, Name="${existing[0].Category}" by user ${req.user?.userId || 'system'}`);

    res.status(200).json({
      success: true,
      message: `Category "${existing[0].Category}" deleted successfully`
    });
  } catch (error) {
    logger.error('Error in deleteCategory:', error);
    console.error('Error deleting category:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete category',
      message: error.message
    });
  }
};

module.exports = {
  getAllCategories,
  getOrCreateCategory,
  searchCategories,
  createCategory,
  updateCategory,
  deleteCategory
};