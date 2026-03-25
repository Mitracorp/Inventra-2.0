const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticateToken } = require('../middleware/auth');

// GET /api/projects - Get all projects (with role-based filtering)
router.get('/', authenticateToken, projectController.getAllProjects);

// GET /api/projects/statistics - Get project statistics
router.get('/statistics', projectController.getProjectStatistics);

// GET /api/projects/pm-schedules - Get PM schedules for all projects
router.get('/pm-schedules', projectController.getPMSchedules);

// GET /api/projects/reference/:refNum - Get project by reference number
router.get('/reference/:refNum', projectController.getProjectByReference);

// GET /api/projects/branches/:customerName - Get branches by customer name
router.get('/branches/:customerName', projectController.getBranchesByCustomer);

// GET /api/projects/branches-by-ref/:customerRefNumber - Get branches by customer reference number
router.get('/branches-by-ref/:customerRefNumber', projectController.getBranchesByCustomerRef);

// GET /api/projects/branches-by-project/:projectRefNumber - Get branches for a specific project
router.get('/branches-by-project/:projectRefNumber', projectController.getBranchesByProjectRef);

// GET /api/projects/:id/deletion-preview - Get deletion preview with counts (MUST be before /:id)
router.get('/:id/deletion-preview', authenticateToken, projectController.getDeletionPreview);

// GET /api/projects/:id - Get project by ID
router.get('/:id', projectController.getProjectById);

// GET /api/projects/:id/solution-principals - Get solution principals for a project
router.get('/:id/solution-principals', projectController.getProjectSolutionPrincipals);

// POST /api/projects - Create new project
router.post('/', projectController.createProject);

// PUT /api/projects/:id - Update project
router.put('/:id', projectController.updateProject);

// PUT /api/projects/:id/branches - Update project branches
router.put('/:id/branches', projectController.updateProjectBranches);

// PUT /api/projects/:id/solution-principals - Update project solution principals
router.put('/:id/solution-principals', projectController.updateProjectSolutionPrincipals);

// DELETE /api/projects/:id - Delete project (requires authentication)
router.delete('/:id', authenticateToken, projectController.deleteProject);

// Tambah route baru ni untuk fungsi Revert
router.put('/revert/:id', authenticateToken, projectController.revertProjectDelete);

module.exports = router;