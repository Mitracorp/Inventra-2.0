const SolutionPrincipal = require('../models/SolutionPrincipal');
const { logSolutionPrincipalChange } = require('../utils/auditLogger');

// Get all solution principals
exports.getAllSolutionPrincipals = async (req, res) => {
  try {
    const solutionPrincipals = await SolutionPrincipal.findAll();
    res.status(200).json(solutionPrincipals);
  } catch (error) {
    console.error('Error fetching solution principals:', error);
    res.status(500).json({ 
      error: 'Failed to fetch solution principals',
      message: error.message 
    });
  }
};

// Get solution principal by ID
exports.getSolutionPrincipalById = async (req, res) => {
  try {
    const { id } = req.params;
    const solutionPrincipal = await SolutionPrincipal.findById(id);
    
    if (!solutionPrincipal) {
      return res.status(404).json({ error: 'Solution Principal not found' });
    }
    
    res.status(200).json(solutionPrincipal);
  } catch (error) {
    console.error('Error fetching solution principal:', error);
    res.status(500).json({ 
      error: 'Failed to fetch solution principal',
      message: error.message 
    });
  }
};

// Create new solution principal
exports.createSolutionPrincipal = async (req, res) => {
  try {
    const { SP_Name } = req.body;
    
    // Validation
    if (!SP_Name || !SP_Name.trim()) {
      return res.status(400).json({ error: 'Solution Principal Name is required' });
    }

    const newSolutionPrincipal = await SolutionPrincipal.create({
      SP_Name: SP_Name.trim()
    });

    res.status(201).json({
      success: true,
      data: newSolutionPrincipal,
      message: 'Solution Principal created successfully'
    });
  } catch (error) {
    console.error('Error creating solution principal:', error);
    res.status(500).json({ 
      error: 'Failed to create solution principal',
      message: error.message 
    });
  }
};

// Update solution principal
exports.updateSolutionPrincipal = async (req, res) => {
  try {
    const { id } = req.params;
    const { SP_Name } = req.body;

    // Validation
    if (!SP_Name || !SP_Name.trim()) {
      return res.status(400).json({ error: 'Solution Principal Name is required' });
    }

    const updatedSolutionPrincipal = await SolutionPrincipal.update(id, {
      SP_Name: SP_Name.trim()
    });

    res.status(200).json({
      success: true,
      data: updatedSolutionPrincipal,
      message: 'Solution Principal updated successfully'
    });
  } catch (error) {
    if (error.message === 'Solution Principal not found') {
      return res.status(404).json({ error: 'Solution Principal not found' });
    }
    console.error('Error updating solution principal:', error);
    res.status(500).json({ 
      error: 'Failed to update solution principal',
      message: error.message 
    });
  }
};

// Delete solution principal
exports.deleteSolutionPrincipal = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await SolutionPrincipal.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Solution Principal not found' });
    }
    
    const result = await SolutionPrincipal.delete(id);

    const userId = req.user?.User_ID || req.user?.userId || 1;
    const username = req.user?.Username || req.user?.username || 'System';
    await logSolutionPrincipalChange(
      userId,
      id,
      'DELETE',
      `${username} moved Solution Principal "${existing.SP_Name}" to trash`,
      []
    );
    
    res.status(200).json({
      success: true,
      data: result,
      message: 'Solution Principal moved to trash successfully'
    });
  } catch (error) {
    if (error.message === 'Solution Principal not found') {
      return res.status(404).json({ error: 'Solution Principal not found' });
    }
    console.error('Error deleting solution principal:', error);
    res.status(500).json({ 
      error: 'Failed to delete solution principal',
      message: error.message 
    });
  }
};

// Revert soft deleted solution principal
exports.revertSolutionPrincipalDelete = async (req, res) => {
  try {
    const { id } = req.params;

    const restored = await SolutionPrincipal.restore(id);
    if (!restored) {
      return res.status(404).json({ error: 'Solution Principal not found or already restored' });
    }

    const userId = req.user?.User_ID || req.user?.userId || 1;
    const username = req.user?.Username || req.user?.username || 'System';
    await logSolutionPrincipalChange(
      userId,
      id,
      'RESTORE',
      `${username} restored Solution Principal ID: ${id} from trash`,
      []
    );

    res.status(200).json({
      success: true,
      message: 'Solution Principal successfully restored'
    });
  } catch (error) {
    console.error('Error restoring solution principal:', error);
    res.status(500).json({
      error: 'Failed to restore solution principal',
      message: error.message
    });
  }
};
