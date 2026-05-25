const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get all models for dropdown/autocomplete with customer tags
 */
const getAllModels = async (req, res, next) => {
  try {
    const [models] = await pool.execute(`
      SELECT 
        m.Model_ID,
        m.Model_Name,
        m.Category_ID,
        c.Category as Category_Name,
        GROUP_CONCAT(DISTINCT cust.Customer_Name ORDER BY cust.Customer_Name SEPARATOR ', ') as Customer_Tags
      FROM MODEL m
      LEFT JOIN CATEGORY c ON m.Category_ID = c.Category_ID
      LEFT JOIN ASSET a ON m.Model_ID = a.Model_ID
      LEFT JOIN INVENTORY i ON a.Asset_ID = i.Asset_ID
      LEFT JOIN CUSTOMER cust ON i.Customer_ID = cust.Customer_ID
      GROUP BY m.Model_ID, m.Model_Name, m.Category_ID, c.Category
      ORDER BY m.Model_Name ASC
    `);

    res.status(200).json({
      success: true,
      data: models
    });
  } catch (error) {
    logger.error('Error in getAllModels:', error);
    console.error('Error fetching models:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch models'
    });
  }
};

/**
 * Get or create model by name (hybrid functionality)
 * This is the core method for supporting free-text + dropdown behavior
 */
const getOrCreateModel = async (req, res, next) => {
  try {
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Model name is required and must be a non-empty string'
      });
    }

    const modelName = name.trim();
    console.log(`Getting or creating model: "${modelName}"`);

    // First try to find existing model (case-insensitive)
    const [existing] = await pool.execute(
      'SELECT Model_ID, Model_Name FROM MODEL WHERE LOWER(Model_Name) = LOWER(?)',
      [modelName]
    );
    
    if (existing.length > 0) {
      console.log(`Found existing model: ID=${existing[0].Model_ID}, Name="${existing[0].Model_Name}"`);
      return res.status(200).json({
        success: true,
        data: {
          id: existing[0].Model_ID,
          name: existing[0].Model_Name,
          Model_ID: existing[0].Model_ID,
          Model_Name: existing[0].Model_Name,
          isNew: false
        }
      });
    }

    // Create new model
    const [result] = await pool.execute(
      'INSERT INTO MODEL (Model_Name) VALUES (?)',
      [modelName]
    );

    const newModelId = result.insertId;
    console.log(`✅ Created new model: ID=${newModelId}, Name="${modelName}"`);

    logger.info(`New model created: ${modelName} (ID: ${newModelId}) by user ${req.user?.userId || 'system'}`);

    res.status(201).json({
      success: true,
      data: {
        id: newModelId,
        name: modelName,
        Model_ID: newModelId,
        Model_Name: modelName,
        isNew: true
      },
      message: `New model "${modelName}" created successfully`
    });
  } catch (error) {
    // Handle duplicate key error (in case of race condition)
    if (error.code === 'ER_DUP_ENTRY') {
      try {
        // Try to get the model that was created by another request
        const [existing] = await pool.execute(
          'SELECT Model_ID, Model_Name FROM MODEL WHERE LOWER(Model_Name) = LOWER(?)',
          [req.body.name.trim()]
        );
        
        if (existing.length > 0) {
          return res.status(200).json({
            success: true,
            data: {
              id: existing[0].Model_ID,
              name: existing[0].Model_Name,
              Model_ID: existing[0].Model_ID,
              Model_Name: existing[0].Model_Name,
              isNew: false
            }
          });
        }
      } catch (retryError) {
        console.error('Error in retry after duplicate:', retryError);
      }
    }

    logger.error('Error in getOrCreateModel:', error);
    console.error('Error getting/creating model:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get or create model',
      message: error.message
    });
  }
};

/**
 * Search models by partial name match
 */
const searchModels = async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim() === '') {
      // Return all models if no search query
      return getAllModels(req, res, next);
    }

    const searchTerm = `%${q.trim()}%`;
    
    const [models] = await pool.execute(`
      SELECT 
        Model_ID as id,
        Model_Name as name,
        Model_ID,
        Model_Name
      FROM MODEL 
      WHERE Model_Name LIKE ?
      ORDER BY 
        CASE WHEN Model_Name LIKE ? THEN 1 ELSE 2 END,  -- Exact matches first
        Model_Name ASC
      LIMIT 20
    `, [searchTerm, q.trim()]);

    res.status(200).json({
      success: true,
      data: models,
      query: q.trim()
    });
  } catch (error) {
    logger.error('Error in searchModels:', error);
    console.error('Error searching models:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to search models'
    });
  }
};

/**
 * Create a new model explicitly
 */
const createModel = async (req, res, next) => {
  try {
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Model name is required and must be a non-empty string'
      });
    }

    const modelName = name.trim();

    // Check if model already exists
    const [existing] = await pool.execute(
      'SELECT Model_ID FROM MODEL WHERE LOWER(Model_Name) = LOWER(?)',
      [modelName]
    );
    
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Model "${modelName}" already exists`,
        existingId: existing[0].Model_ID
      });
    }

    // Create new model
    const [result] = await pool.execute(
      'INSERT INTO MODEL (Model_Name) VALUES (?)',
      [modelName]
    );

    const newModelId = result.insertId;
    logger.info(`New model created: ${modelName} (ID: ${newModelId}) by user ${req.user?.userId || 'system'}`);

    res.status(201).json({
      success: true,
      data: {
        id: newModelId,
        name: modelName,
        Model_ID: newModelId,
        Model_Name: modelName
      },
      message: `Model "${modelName}" created successfully`
    });
  } catch (error) {
    logger.error('Error in createModel:', error);
    console.error('Error creating model:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to create model',
      message: error.message
    });
  }
};

/**
 * Update model by ID
 */
const updateModel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Model name is required and must be a non-empty string'
      });
    }

    const modelName = name.trim();

    // Check if model exists
    const [existing] = await pool.execute(
      'SELECT Model_ID, Model_Name FROM MODEL WHERE Model_ID = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Model not found'
      });
    }

    // Update model
    await pool.execute(
      'UPDATE MODEL SET Model_Name = ? WHERE Model_ID = ?',
      [modelName, id]
    );

    logger.info(`Model updated: ID=${id}, Old="${existing[0].Model_Name}", New="${modelName}" by user ${req.user?.userId || 'system'}`);

    res.status(200).json({
      success: true,
      data: {
        id: parseInt(id),
        name: modelName,
        Model_ID: parseInt(id),
        Model_Name: modelName
      },
      message: `Model updated successfully`
    });
  } catch (error) {
    logger.error('Error in updateModel:', error);
    console.error('Error updating model:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to update model',
      message: error.message
    });
  }
};

/**
 * Delete model by ID
 */
const deleteModel = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if model is in use
    const [assetsUsingModel] = await pool.execute(
      'SELECT COUNT(*) as count FROM ASSET WHERE Model_ID = ?',
      [id]
    );
    
    if (assetsUsingModel[0].count > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete model. It is currently used by ${assetsUsingModel[0].count} asset(s)`,
        assetsCount: assetsUsingModel[0].count
      });
    }

    // Check if model exists
    const [existing] = await pool.execute(
      'SELECT Model_Name FROM MODEL WHERE Model_ID = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Model not found'
      });
    }

    // Delete model
    await pool.execute(
      'DELETE FROM MODEL WHERE Model_ID = ?',
      [id]
    );

    logger.info(`Model deleted: ID=${id}, Name="${existing[0].Model_Name}" by user ${req.user?.userId || 'system'}`);

    res.status(200).json({
      success: true,
      message: `Model "${existing[0].Model_Name}" deleted successfully`
    });
  } catch (error) {
    logger.error('Error in deleteModel:', error);
    console.error('Error deleting model:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete model',
      message: error.message
    });
  }
};

/**
 * Get specifications for a specific model
 */
const getModelSpecs = async (req, res, next) => {
  try {
    const modelId = req.params.id;
    
    const [specs] = await pool.execute(`
      SELECT 
        msb.Attributes_ID,
        msb.Attributes_Value,
        s.Attribute_Name as Attributes_Name
      FROM MODEL_SPECS_BRIDGE msb
      INNER JOIN SPECS s ON msb.Attributes_ID = s.Attributes_ID
      WHERE msb.Model_ID = ?
      ORDER BY s.Attribute_Name ASC
    `, [modelId]);

    res.status(200).json(specs);
  } catch (error) {
    logger.error('Error in getModelSpecs:', error);
    console.error('Error fetching model specs:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch model specifications'
    });
  }
};

/**
 * Get all models with their specifications and customer tags
 * Optimized to use single query with GROUP_CONCAT to avoid N+1 problem
 */
const getAllModelsWithSpecs = async (req, res, next) => {
  try {
    const { category } = req.query;
    
    // Build WHERE clause if category is provided
    const whereClause = category ? 'WHERE c.Category = ?' : '';
    const queryParams = category ? [category] : [];
    
    const [results] = await pool.execute(`
      SELECT 
        m.Model_ID,
        m.Model_Name,
        m.Category_ID,
        c.Category as Category_Name,
        COUNT(DISTINCT msb.Attributes_ID) as Spec_Count,
        (
          SELECT GROUP_CONCAT(DISTINCT cust.Customer_Name ORDER BY cust.Customer_Name SEPARATOR ', ')
          FROM ASSET a
          INNER JOIN INVENTORY i ON a.Asset_ID = i.Asset_ID
          INNER JOIN CUSTOMER cust ON i.Customer_ID = cust.Customer_ID
          WHERE a.Model_ID = m.Model_ID
        ) as Customer_Tags,
        GROUP_CONCAT(
          DISTINCT CONCAT_WS(':::',
            msb.Attributes_ID,
            s.Attribute_Name,
            COALESCE(msb.Attributes_Value, '')
          )
          ORDER BY s.Attribute_Name
          SEPARATOR '|||'
        ) as Specifications_Data
      FROM MODEL m
      INNER JOIN CATEGORY c ON m.Category_ID = c.Category_ID
      LEFT JOIN MODEL_SPECS_BRIDGE msb ON m.Model_ID = msb.Model_ID
      LEFT JOIN SPECS s ON msb.Attributes_ID = s.Attributes_ID
      ${whereClause}
      GROUP BY m.Model_ID, m.Model_Name, m.Category_ID, c.Category
      ORDER BY m.Model_Name ASC
    `, queryParams);

    // Parse the concatenated specs into array of objects
    const modelsWithSpecs = results.map(model => {
      const specifications = model.Specifications_Data
        ? model.Specifications_Data.split('|||').map(spec => {
            const [Attributes_ID, Attribute_Name, Attributes_Value] = spec.split(':::');
            return {
              Attributes_ID: parseInt(Attributes_ID),
              Attribute_Name,
              Attributes_Value: Attributes_Value || null
            };
          })
        : [];

      return {
        Model_ID: model.Model_ID,
        Model_Name: model.Model_Name,
        Category_ID: model.Category_ID,
        Category_Name: model.Category_Name,
        Spec_Count: model.Spec_Count,
        Customer_Tags: model.Customer_Tags,
        specifications
      };
    });

    res.status(200).json({
      success: true,
      data: modelsWithSpecs
    });
  } catch (error) {
    logger.error('Error in getAllModelsWithSpecs:', error);
    console.error('Error fetching models with specs:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch models with specifications'
    });
  }
};

/**
 * Get a specific model with its specifications
 */
const getModelWithSpecs = async (req, res, next) => {
  try {
    const modelId = req.params.id;

    // Get model details
    const [modelRows] = await pool.execute(`
      SELECT 
        m.Model_ID,
        m.Model_Name,
        m.Category_ID,
        c.Category as Category_Name
      FROM MODEL m
      LEFT JOIN CATEGORY c ON m.Category_ID = c.Category_ID
      WHERE m.Model_ID = ?
    `, [modelId]);

    if (modelRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Model not found'
      });
    }

    const model = modelRows[0];

    // Get specifications
    const [specs] = await pool.execute(`
      SELECT 
        msb.Attributes_ID,
        msb.Attributes_Value,
        s.Attribute_Name
      FROM MODEL_SPECS_BRIDGE msb
      INNER JOIN SPECS s ON msb.Attributes_ID = s.Attributes_ID
      WHERE msb.Model_ID = ?
      ORDER BY s.Attribute_Name ASC
    `, [modelId]);

    res.status(200).json({
      success: true,
      data: {
        ...model,
        specifications: specs
      }
    });
  } catch (error) {
    logger.error('Error in getModelWithSpecs:', error);
    console.error('Error fetching model with specs:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch model with specifications'
    });
  }
};

/**
 * Add specifications to a model
 * Expects body: { specifications: [{ attributeName, attributeValue }] }
 */
const addModelSpecs = async (req, res, next) => {
  const connection = await pool.getConnection();
  
  try {
    const modelId = req.params.id;
    const { specifications } = req.body;

    if (!specifications || !Array.isArray(specifications) || specifications.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Specifications array is required and must not be empty'
      });
    }

    // Validate model exists
    const [modelRows] = await connection.execute(
      'SELECT Model_ID FROM MODEL WHERE Model_ID = ?',
      [modelId]
    );

    if (modelRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Model not found'
      });
    }

    await connection.beginTransaction();

    const addedSpecs = [];

    for (const spec of specifications) {
      const { attributeName, attributeValue } = spec;

      if (!attributeName || !attributeValue) {
        throw new Error('Both attributeName and attributeValue are required for each specification');
      }

      // Check if attribute name exists in SPECS table
      const [existingAttr] = await connection.execute(
        'SELECT Attributes_ID FROM SPECS WHERE Attribute_Name = ?',
        [attributeName.trim()]
      );

      let attributeId;

      if (existingAttr.length > 0) {
        // Use existing attribute ID
        attributeId = existingAttr[0].Attributes_ID;
      } else {
        // Create new attribute in SPECS table
        const [insertResult] = await connection.execute(
          'INSERT INTO SPECS (Attribute_Name) VALUES (?)',
          [attributeName.trim()]
        );
        attributeId = insertResult.insertId;
      }

      // Check if this spec already exists for this model
      const [existingSpec] = await connection.execute(
        'SELECT * FROM MODEL_SPECS_BRIDGE WHERE Model_ID = ? AND Attributes_ID = ?',
        [modelId, attributeId]
      );

      if (existingSpec.length > 0) {
        // Update existing spec
        await connection.execute(
          'UPDATE MODEL_SPECS_BRIDGE SET Attributes_Value = ? WHERE Model_ID = ? AND Attributes_ID = ?',
          [attributeValue.trim(), modelId, attributeId]
        );
      } else {
        // Insert new spec
        await connection.execute(
          'INSERT INTO MODEL_SPECS_BRIDGE (Model_ID, Attributes_ID, Attributes_Value) VALUES (?, ?, ?)',
          [modelId, attributeId, attributeValue.trim()]
        );
      }

      addedSpecs.push({
        attributeId,
        attributeName: attributeName.trim(),
        attributeValue: attributeValue.trim()
      });
    }

    await connection.commit();

    logger.info(`Added ${addedSpecs.length} specifications to model ${modelId}`);

    res.status(201).json({
      success: true,
      message: `Successfully added ${addedSpecs.length} specification(s)`,
      data: addedSpecs
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Error in addModelSpecs:', error);
    console.error('Error adding model specifications:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add model specifications'
    });
  } finally {
    connection.release();
  }
};

/**
 * Update a specific specification for a model
 */
const updateModelSpec = async (req, res, next) => {
  try {
    const { modelId, attributeId } = req.params;
    const { attributeValue } = req.body;

    if (!attributeValue) {
      return res.status(400).json({
        success: false,
        error: 'Attribute value is required'
      });
    }

    const [result] = await pool.execute(
      'UPDATE MODEL_SPECS_BRIDGE SET Attributes_Value = ? WHERE Model_ID = ? AND Attributes_ID = ?',
      [attributeValue.trim(), modelId, attributeId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Specification not found for this model'
      });
    }

    logger.info(`Updated specification ${attributeId} for model ${modelId}`);

    res.status(200).json({
      success: true,
      message: 'Specification updated successfully'
    });
  } catch (error) {
    logger.error('Error in updateModelSpec:', error);
    console.error('Error updating model specification:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to update model specification'
    });
  }
};

/**
 * Delete a specification from a model
 */
const deleteModelSpec = async (req, res, next) => {
  try {
    const { modelId, attributeId } = req.params;

    const [result] = await pool.execute(
      'DELETE FROM MODEL_SPECS_BRIDGE WHERE Model_ID = ? AND Attributes_ID = ?',
      [modelId, attributeId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Specification not found for this model'
      });
    }

    logger.info(`Deleted specification ${attributeId} from model ${modelId}`);

    res.status(200).json({
      success: true,
      message: 'Specification deleted successfully'
    });
  } catch (error) {
    logger.error('Error in deleteModelSpec:', error);
    console.error('Error deleting model specification:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete model specification'
    });
  }
};

module.exports = {
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
};