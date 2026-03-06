const express = require('express');
const solutionPrincipalController = require('../controllers/solutionPrincipalController');

const router = express.Router();

// Get all solution principals
router.get('/', solutionPrincipalController.getAllSolutionPrincipals);

// Get solution principal by ID
router.get('/:id', solutionPrincipalController.getSolutionPrincipalById);

// Create new solution principal
router.post('/', solutionPrincipalController.createSolutionPrincipal);

// Update solution principal
router.put('/:id', solutionPrincipalController.updateSolutionPrincipal);

// Delete solution principal
router.delete('/:id', solutionPrincipalController.deleteSolutionPrincipal);

module.exports = router;
