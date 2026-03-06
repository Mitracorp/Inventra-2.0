const Inventory = require('../models/Inventory');
const { formatResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

// Get all inventory records
exports.getAllInventory = async (req, res) => {
  try {
    const inventory = await Inventory.findAll();
    res.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ 
      error: 'Failed to fetch inventory',
      message: error.message 
    });
  }
};

// Get inventory by project
exports.getInventoryByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const inventory = await Inventory.findByProject(projectId);
    res.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory by project:', error);
    res.status(500).json({ 
      error: 'Failed to fetch inventory',
      message: error.message 
    });
  }
};

// Update inventory with asset
exports.updateInventoryWithAsset = async (req, res) => {
  try {
    const { projectId, customerId, assetId } = req.body;
    
    // Validate required fields
    if (!projectId || !customerId || !assetId) {
      return res.status(400).json({ 
        error: 'projectId, customerId, and assetId are required' 
      });
    }

    const success = await Inventory.updateWithAsset(projectId, customerId, assetId);
    
    if (success) {
      res.json({
        success: true,
        message: 'Inventory updated successfully with asset'
      });
    } else {
      res.status(404).json({ 
        error: 'Inventory record not found' 
      });
    }
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ 
      error: 'Failed to update inventory',
      message: error.message 
    });
  }
};

// Delete inventory record
exports.deleteInventory = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = await Inventory.delete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Inventory record not found' });
    }
    
    res.json({ message: 'Inventory record deleted successfully' });
  } catch (error) {
    console.error('Error deleting inventory:', error);
    res.status(500).json({ 
      error: 'Failed to delete inventory',
      message: error.message 
    });
  }
};
