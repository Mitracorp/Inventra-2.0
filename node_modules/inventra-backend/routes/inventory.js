const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

// GET /api/inventory - Get all inventory records
router.get('/', inventoryController.getAllInventory);

// GET /api/inventory/project/:projectId - Get inventory by project
router.get('/project/:projectId', inventoryController.getInventoryByProject);

// POST /api/inventory/update-asset - Update inventory with asset
router.post('/update-asset', inventoryController.updateInventoryWithAsset);

// DELETE /api/inventory/:id - Delete inventory record
router.delete('/:id', inventoryController.deleteInventory);

module.exports = router;
