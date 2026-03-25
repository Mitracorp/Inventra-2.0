const express = require('express');
const solutionPrincipalController = require('../controllers/solutionPrincipalController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all solution principals
router.get('/', solutionPrincipalController.getAllSolutionPrincipals);

// Get solution principal by ID
router.get('/:id', solutionPrincipalController.getSolutionPrincipalById);

// Create new solution principal
router.post('/', authenticateToken, solutionPrincipalController.createSolutionPrincipal);

// Update solution principal
router.put('/:id', authenticateToken, solutionPrincipalController.updateSolutionPrincipal);

// Delete solution principal
router.delete('/:id', authenticateToken, solutionPrincipalController.deleteSolutionPrincipal);

// Revert soft deleted solution principal
router.put('/revert/:id', authenticateToken, solutionPrincipalController.revertSolutionPrincipalDelete);

module.exports = router;
