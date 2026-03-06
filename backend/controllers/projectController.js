const Project = require('../models/Project');
const Customer = require('../models/Customer');
const Inventory = require('../models/Inventory');
const { logProjectChange, detectChanges } = require('../utils/auditLogger');
const { pool } = require('../config/database');

// Get all projects
exports.getAllProjects = async (req, res) => {
  try {
    const userRole = req.user?.role;
    console.log('🔍 getAllProjects - User Role:', userRole);
    
    // Check if user is customer-type role (not Admin or Staff)
    const isCustomerRole = userRole && 
      userRole.toLowerCase() !== 'admin' && 
      userRole.toLowerCase() !== 'staff';
    
    console.log('🔍 Is Customer Role:', isCustomerRole);
    
    let projects;
    
    if (isCustomerRole) {
      console.log('🔍 Filtering projects for customer:', userRole);
      // Filter projects for customer-type users based on their role matching Customer_Name
      // 1. Find Customer_IDs where Customer_Name matches user's role
      // 2. Get projects from INVENTORY where Customer_ID matches
      
      try {
        const [customerRows] = await pool.execute(
          'SELECT DISTINCT Customer_ID FROM CUSTOMER WHERE Customer_Name = ?',
          [userRole]
        );
        
        console.log('🔍 Found customer IDs:', customerRows);
        
        if (customerRows.length === 0) {
          // No matching customer found
          return res.json({
            success: true,
            data: [],
            message: 'No projects found for your account'
          });
        }
        
        const customerIds = customerRows.map(row => row.Customer_ID);
        
        // Get project IDs from INVENTORY for these customers
        const placeholders = customerIds.map(() => '?').join(',');
        const query = `SELECT DISTINCT i.Project_ID 
                       FROM INVENTORY i 
                       WHERE i.Customer_ID IN (${placeholders})`;
        console.log('🔍 Executing query:', query);
        console.log('🔍 With parameters:', customerIds);
        
        const [inventoryRows] = await pool.execute(query, customerIds);
        
        console.log('🔍 Found project IDs from inventory:', inventoryRows);
        
        if (inventoryRows.length === 0) {
          return res.json({
            success: true,
            data: [],
            message: 'No projects found for your account'
          });
        }
        
        const projectIds = inventoryRows.map(row => row.Project_ID).filter(id => id !== null);
        console.log('🔍 Project IDs:', projectIds);
        
        if (projectIds.length === 0) {
          return res.json({
            success: true,
            data: [],
            message: 'No projects found for your account'
          });
        }
        
        // Get all projects and filter by Project_ID
        const allProjects = await Project.findAll();
        console.log('🔍 Total projects in system:', allProjects.length);
        
        projects = allProjects.filter(project => {
          const match = projectIds.includes(project.Project_ID);
          if (match) {
            console.log('🔍 Matched project ID:', project.Project_ID, '-', project.Project_Title);
          }
          return match;
        });
        
        console.log('🔍 Filtered projects count:', projects.length);
      } catch (dbError) {
        console.error('❌ Database error during filtering:', dbError);
        throw dbError;
      }
    } else {
      // Admin and Staff see all projects
      console.log('🔍 User is Admin/Staff - showing all projects');
      projects = await Project.findAll();
    }
    
    res.json({
      success: true,
      data: projects || [],
      message: projects && projects.length > 0 ? 'Projects fetched successfully' : 'No projects found'
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch projects',
      message: error.message 
    });
  }
};

// Get project by ID
exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project);
  } catch (error) {
    console.error('Error fetching project by ID:', error);
    res.status(500).json({ 
      error: 'Failed to fetch project',
      message: error.message 
    });
  }
};

// Get solution principals for a project
exports.getProjectSolutionPrincipals = async (req, res) => {
  try {
    const { id } = req.params;
    const { pool } = require('../config/database');
    
    const [rows] = await pool.execute(`
      SELECT sp.SP_ID, sp.SP_Name, psb.\`Support Type\`
      FROM PROJECT_SP_BRIDGE psb
      JOIN SOLUTION_PRINCIPAL sp ON psb.SP_ID = sp.SP_ID
      WHERE psb.Project_ID = ?
    `, [id]);
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching project solution principals:', error);
    res.status(500).json({ 
      error: 'Failed to fetch solution principals',
      message: error.message 
    });
  }
};

// Get project by reference number with customer data
exports.getProjectByReference = async (req, res) => {
  try {
    const { refNum } = req.params;
    console.log('Looking up project by reference number:', refNum);
    
    const projectData = await Project.findByReferenceWithCustomer(refNum);
    
    if (!projectData) {
      return res.status(404).json({ 
        success: false,
        error: 'Project not found with the given reference number' 
      });
    }
    
    res.json({
      success: true,
      data: {
        project_reference_num: projectData.Project_Ref_Number,
        customer_name: projectData.Customer_Name,
        customer_reference_number: projectData.Customer_Ref_Number,
        project_title: projectData.Project_Title,
        project_id: projectData.Project_ID,
        antivirus: projectData.Antivirus
      }
    });
  } catch (error) {
    console.error('Error fetching project by reference:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch project by reference',
      message: error.message 
    });
  }
};

// Get branches by customer name
exports.getBranchesByCustomer = async (req, res) => {
  try {
    const { customerName } = req.params;
    console.log('Looking up branches for customer:', customerName);
    
    const branches = await Customer.findBranchesByCustomerName(customerName);
    
    res.json({
      success: true,
      data: branches || []
    });
  } catch (error) {
    console.error('Error fetching branches by customer:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch branches',
      message: error.message 
    });
  }
};

// Get branches by customer reference number
exports.getBranchesByCustomerRef = async (req, res) => {
  try {
    const { customerRefNumber } = req.params;
    console.log('Looking up branches for customer ref:', customerRefNumber);
    
    const branches = await Customer.findBranchesByCustomerRef(customerRefNumber);
    
    res.json({
      success: true,
      data: branches || []
    });
  } catch (error) {
    console.error('Error fetching branches by customer ref:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch branches for customer reference',
      message: error.message 
    });
  }
};

// Get branches for a specific project by project reference number
exports.getBranchesByProjectRef = async (req, res) => {
  try {
    const { projectRefNumber } = req.params;
    console.log('Looking up branches for project:', projectRefNumber);
    
    const branches = await Customer.findBranchesByProjectRef(projectRefNumber);
    
    res.json({
      success: true,
      data: branches || []
    });
  } catch (error) {
    console.error('Error fetching branches by project:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch branches for project',
      message: error.message 
    });
  }
};

// Create new project
exports.createProject = async (req, res) => {
  try {
    const { project, customer, solution_principals } = req.body;
    
    // Validate required fields
    const requiredProjectFields = ['Project_Title'];
    for (const field of requiredProjectFields) {
      if (!project || !project[field]) {
        return res.status(400).json({ 
          error: `${field} is required` 
        });
      }
    }

    // Validate customer fields
    if (!customer || !customer.Customer_Ref_Number || !customer.Customer_Name) {
      return res.status(400).json({ 
        error: 'Customer information (Customer_Ref_Number and Customer_Name) is required' 
      });
    }

    // Validate branches
    if (!customer.branches || !Array.isArray(customer.branches) || customer.branches.length === 0) {
      return res.status(400).json({ 
        error: 'At least one branch is required' 
      });
    }

    console.log('Creating project with customer data:', { project, customer, solution_principals });

    // Step 1: Create the project
    const newProject = await Project.create(project);
    console.log('Project created:', newProject);

    // Step 2: Create solution principal associations if provided
    if (solution_principals && Array.isArray(solution_principals) && solution_principals.length > 0) {
      for (const sp of solution_principals) {
        const spId = typeof sp === 'object' ? sp.SP_ID : sp;
        const supportType = typeof sp === 'object' ? sp.supportType : null;
        
        await pool.execute(
          `INSERT INTO PROJECT_SP_BRIDGE (Project_ID, SP_ID, \`Support Type\`) VALUES (?, ?, ?)`,
          [newProject.Project_ID, spId, supportType]
        );
      }
      console.log('Solution principal associations created');
    }

    // Step 3: Create customer records (one for each branch)
    // NOTE: Customer table no longer has Project_ID in new database
    const customerIds = await Customer.createMultipleBranches(
      customer.Customer_Ref_Number,
      customer.Customer_Name,
      customer.branches
    );
    console.log('Customer records created with IDs:', customerIds);

    // Step 4: Create INVENTORY records linking project to customers
    // Asset_ID will be NULL initially, filled when assets are added
    const inventoryIds = await Inventory.createForProject(
      newProject.Project_ID,
      customerIds
    );
    console.log('Inventory records created with IDs:', inventoryIds);

    // Step 5: Fetch the complete project with solution principals to return
    const completeProject = await Project.findById(newProject.Project_ID);

    // Step 6: Log the creation in audit log
    const userId = req.user?.User_ID || req.user?.userId || 1; // Get from auth token
    const username = req.user?.Username || req.user?.username || 'System';
    await logProjectChange(
      userId,
      newProject.Project_ID,
      'INSERT',
      `${username} created new Project for ${customer.Customer_Name}`,
      []
    );

    // Return success with project, customer, and inventory info
    res.status(201).json({
      success: true,
      project: completeProject,
      customer: {
        Customer_Ref_Number: customer.Customer_Ref_Number,
        Customer_Name: customer.Customer_Name,
        branches: customer.branches,
        customerIds: customerIds
      },
      inventory: {
        inventoryIds: inventoryIds,
        count: inventoryIds.length
      },
      message: `Project created successfully with ${customerIds.length} customer branch(es) and ${inventoryIds.length} inventory record(s)`
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ 
      error: 'Failed to create project',
      message: error.message 
    });
  }
};

// Update project
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    console.log('🔄 UPDATE PROJECT - ID:', id);
    console.log('📝 Updates received:', updates);
    
    // Get current project data for comparison
    const projectData = await Project.findById(id);
    if (!projectData) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    console.log('📋 Current project data:', projectData);
    
    // Store old values for audit logging
    const oldData = { ...projectData };
    
    // Create a Project instance with updated data
    const project = new Project({
      Project_ID: id,
      Project_Ref_Number: updates.Project_Ref_Number || projectData.Project_Ref_Number,
      Project_Title: updates.Project_Title || projectData.Project_Title,
      Warranty: updates.Warranty !== undefined ? updates.Warranty : projectData.Warranty,
      Preventive_Maintenance: updates.Preventive_Maintenance !== undefined ? updates.Preventive_Maintenance : projectData.Preventive_Maintenance,
      PM_Frequency: updates.PM_Frequency !== undefined ? updates.PM_Frequency : projectData.PM_Frequency,
      Start_Date: updates.Start_Date !== undefined ? updates.Start_Date : projectData.Start_Date,
      End_Date: updates.End_Date !== undefined ? updates.End_Date : projectData.End_Date,
      Antivirus: updates.Antivirus !== undefined ? updates.Antivirus : projectData.Antivirus
    });
    
    await project.update();
    
    console.log('✅ Project updated in database');
    
    // Detect changes for audit log
    const changes = detectChanges(oldData, project);
    
    console.log('🔍 Detected changes:', changes);
    
    // Log the update if there are changes
    if (changes.length > 0) {
      const userId = req.user?.User_ID || req.user?.userId || 1;
      const username = req.user?.Username || req.user?.username || 'System';
      
      console.log('👤 User info - ID:', userId, 'Username:', username);
      
      // Get customer name for this project
      const inventoryRecords = await Inventory.findByProject(id);
      const customerName = inventoryRecords.length > 0 ? inventoryRecords[0].Customer_Name : 'Unknown';
      
      console.log('🏢 Customer name:', customerName);
      
      // Create description for each change
      const descriptions = changes.map(change => 
        `${username} change ${change.fieldName} for ${customerName} from ${change.oldValue} to ${change.newValue}`
      );
      
      console.log('📄 Descriptions to log:', descriptions);
      
      // Log each change separately
      for (let i = 0; i < changes.length; i++) {
        console.log(`📝 Logging change ${i + 1}/${changes.length}:`, descriptions[i]);
        await logProjectChange(
          userId,
          id,
          'UPDATE',
          descriptions[i],
          [changes[i]]
        );
      }
      
      console.log('✅ All changes logged to audit log');
    } else {
      console.log('⚠️ No changes detected - skipping audit log');
    }
    
    res.json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ 
      error: 'Failed to update project',
      message: error.message 
    });
  }
};

// Get deletion preview - show what will be deleted
exports.getDeletionPreview = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Getting deletion preview for project ID: ${id}`);
    
    // Get project data
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get all inventory records for this project
    const inventoryRecords = await Inventory.findByProject(id);
    console.log(`Found ${inventoryRecords.length} inventory records`);
    
    // Get all unique asset IDs from inventory
    const assetIds = [...new Set(inventoryRecords.map(inv => inv.Asset_ID).filter(id => id))];
    console.log(`Found ${assetIds.length} unique assets`);
    
    let pmCount = 0;
    let peripheralCount = 0;
    let softwareLinkCount = 0;
    
    // Count related data for each asset
    for (const assetId of assetIds) {
      if (!assetId) continue;
      
      // Count PM records
      const [pmRecords] = await pool.execute(
        'SELECT COUNT(*) as count FROM PMAINTENANCE WHERE Asset_ID = ?',
        [assetId]
      );
      pmCount += pmRecords[0].count || 0;
      
      // Count peripherals
      const [peripherals] = await pool.execute(
        'SELECT COUNT(*) as count FROM PERIPHERAL WHERE Asset_ID = ?',
        [assetId]
      );
      peripheralCount += peripherals[0].count || 0;
      
      // Count software links
      const [softwareLinks] = await pool.execute(
        'SELECT COUNT(*) as count FROM ASSET_SOFTWARE_BRIDGE WHERE Asset_ID = ?',
        [assetId]
      );
      softwareLinkCount += softwareLinks[0].count || 0;
    }
    
    // Get unique customer IDs
    const customerIds = [...new Set(inventoryRecords.map(inv => inv.Customer_ID).filter(id => id))];
    
    const preview = {
      projectName: project.Project_Title,
      projectRefNumber: project.Project_Ref_Number,
      counts: {
        assets: assetIds.length,
        pmRecords: pmCount,
        peripherals: peripheralCount,
        softwareLinks: softwareLinkCount,
        inventory: inventoryRecords.length,
        customers: customerIds.length
      }
    };
    
    console.log('Deletion preview:', preview);
    
    res.json(preview);
  } catch (error) {
    console.error('Error getting deletion preview:', error);
    res.status(500).json({ 
      error: 'Failed to get deletion preview',
      message: error.message 
    });
  }
};

// Delete project
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('=== DELETE PROJECT DEBUG ===');
    console.log(`Attempting to delete project with ID: ${id}`);
    console.log('User info:', req.user);
    
    // Get project data before deletion for audit log
    const project = await Project.findById(id);
    if (!project) {
      console.log('Project not found');
      return res.status(404).json({ error: 'Project not found' });
    }
    console.log('Project found:', project.Project_Title);
    
    // Step 1: Get all inventory records for this project to find related assets and customers
    console.log('Step 1: Getting inventory records...');
    const inventoryRecords = await Inventory.findByProject(id);
    console.log(`Found ${inventoryRecords.length} inventory records for project ${id}`);
    
    // Step 2: Get all unique asset IDs from inventory
    console.log('Step 2: Getting asset IDs...');
    const assetIds = [...new Set(inventoryRecords.map(inv => inv.Asset_ID).filter(id => id))];
    console.log(`Found ${assetIds.length} unique assets to delete`);
    
    let deletedPMCount = 0;
    let deletedPeripheralCount = 0;
    let deletedSoftwareLinks = 0;
    
    // Step 3: Delete all related data for each asset
    console.log('Step 3: Deleting related data for assets...');
    for (const assetId of assetIds) {
      if (!assetId) continue;
      
      console.log(`Processing asset ${assetId}...`);
      
      // 3a. Delete all PM records for this asset
      try {
        const [pmRecords] = await pool.execute(
          'SELECT PM_ID FROM PMAINTENANCE WHERE Asset_ID = ?',
          [assetId]
        );
        
        for (const pm of pmRecords) {
          // Delete PM results first (foreign key constraint)
          await pool.execute(
            'DELETE FROM PM_RESULT WHERE PM_ID = ?',
            [pm.PM_ID]
          );
          // Delete PM record
          await pool.execute(
            'DELETE FROM PMAINTENANCE WHERE PM_ID = ?',
            [pm.PM_ID]
          );
          deletedPMCount++;
        }
        console.log(`  ✓ Deleted ${pmRecords.length} PM records for asset ${assetId}`);
      } catch (error) {
        console.error(`  ✗ Error deleting PM records for asset ${assetId}:`, error.message);
        throw error;
      }
      
      // 3b. Delete all peripherals for this asset
      try {
        const [peripherals] = await pool.execute(
          'DELETE FROM PERIPHERAL WHERE Asset_ID = ?',
          [assetId]
        );
        deletedPeripheralCount += peripherals.affectedRows || 0;
        console.log(`  ✓ Deleted ${peripherals.affectedRows || 0} peripherals for asset ${assetId}`);
      } catch (error) {
        console.error(`  ✗ Error deleting peripherals for asset ${assetId}:`, error.message);
        throw error;
      }
      
      // 3c. Delete software associations (bridge table)
      try {
        const [softwareLinks] = await pool.execute(
          'DELETE FROM ASSET_SOFTWARE_BRIDGE WHERE Asset_ID = ?',
          [assetId]
        );
        deletedSoftwareLinks += softwareLinks.affectedRows || 0;
        console.log(`  ✓ Deleted ${softwareLinks.affectedRows || 0} software links for asset ${assetId}`);
      } catch (error) {
        console.error(`  ✗ Error deleting software links for asset ${assetId}:`, error.message);
        throw error;
      }
    }
    
    // Step 4: Delete all assets
    console.log('Step 4: Deleting assets...');
    for (const assetId of assetIds) {
      if (!assetId) continue;
      try {
        await pool.execute(
          'DELETE FROM ASSET WHERE Asset_ID = ?',
          [assetId]
        );
        console.log(`  ✓ Deleted asset: ${assetId}`);
      } catch (error) {
        console.error(`  ✗ Error deleting asset ${assetId}:`, error.message);
        throw error;
      }
    }
    
    // Step 5: Delete all inventory records for this project
    console.log('Step 5: Deleting inventory records...');
    for (const inv of inventoryRecords) {
      try {
        await Inventory.delete(inv.Inventory_ID);
        console.log(`  ✓ Deleted inventory record: ${inv.Inventory_ID}`);
      } catch (error) {
        console.error(`  ✗ Error deleting inventory ${inv.Inventory_ID}:`, error.message);
        throw error;
      }
    }
    
    // Step 6: Delete all customer records associated with this project
    console.log('Step 6: Deleting customer records...');
    const customerIds = [...new Set(inventoryRecords.map(inv => inv.Customer_ID).filter(id => id))];
    console.log(`Found ${customerIds.length} unique customers to delete`);
    
    for (const customerId of customerIds) {
      if (customerId) {
        try {
          await Customer.delete(customerId);
          console.log(`  ✓ Deleted customer record: ${customerId}`);
        } catch (error) {
          console.error(`  ✗ Error deleting customer ${customerId}:`, error.message);
          throw error;
        }
      }
    }
    
    // Step 7: Delete solution principal associations for this project
    console.log('Step 7: Deleting solution principal associations...');
    try {
      await pool.execute(
        `DELETE FROM PROJECT_SP_BRIDGE WHERE Project_ID = ?`,
        [id]
      );
      console.log(`  ✓ Deleted solution principal associations for project ${id}`);
    } catch (error) {
      console.error(`  ✗ Error deleting SP associations:`, error.message);
      throw error;
    }
    
    // Step 8: Delete the project
    console.log('Step 8: Deleting project...');
    try {
      const deleted = await Project.delete(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Project not found' });
      }
      console.log(`  ✓ Deleted project ${id}`);
    } catch (error) {
      console.error(`  ✗ Error deleting project:`, error.message);
      throw error;
    }
    
    // Step 9: Log the deletion
    console.log('Step 9: Creating audit log...');
    const userId = req.user?.User_ID || req.user?.userId || 1;
    const username = req.user?.Username || req.user?.username || 'System';
    const customerName = inventoryRecords.length > 0 ? inventoryRecords[0].Customer_Name : 'Unknown';
    
    try {
      await logProjectChange(
        userId,
        id,
        'DELETE',
        `${username} deleted Project for ${customerName} - Cascade deleted ${assetIds.length} assets, ${deletedPMCount} PM records, ${deletedPeripheralCount} peripherals`,
        []
      );
      console.log(`  ✓ Audit log created`);
    } catch (error) {
      console.error(`  ✗ Error creating audit log:`, error.message);
      // Don't throw - audit log failure should not prevent deletion success
    }
    
    console.log(`✅ Successfully deleted project ${id} and all related records`);
    
    res.json({ 
      message: 'Project and all related records deleted successfully',
      deletedAssets: assetIds.length,
      deletedPMRecords: deletedPMCount,
      deletedPeripherals: deletedPeripheralCount,
      deletedSoftwareLinks: deletedSoftwareLinks,
      deletedInventory: inventoryRecords.length,
      deletedCustomers: customerIds.length
    });
  } catch (error) {
    console.error('❌ Error deleting project:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to delete project',
      message: error.message,
      details: error.stack
    });
  }
};

// Get project statistics
exports.getProjectStatistics = async (req, res) => {
  try {
    const stats = await Project.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching project statistics:', error);
    
    // Return fallback statistics
    res.json({
      total: 0,
      active: 0,
      inactive: 0
    });
  }
};

// Update branches for a project
exports.updateProjectBranches = async (req, res) => {
  try {
    const { id } = req.params;
    const { branches } = req.body;

    if (!branches || !Array.isArray(branches)) {
      return res.status(400).json({ error: 'Branches array is required' });
    }

    console.log(`Updating branches for project ${id}:`, branches);

    // Get existing inventory records to find current customers
    const existingInventory = await Inventory.findByProject(id);
    
    if (existingInventory.length === 0) {
      return res.status(404).json({ error: 'No inventory records found for this project' });
    }
    
    // Get customer info from existing inventory (all records should have same customer info)
    const customerRefNumber = existingInventory[0].Customer_Ref_Number;
    const customerName = existingInventory[0].Customer_Name;
    
    if (!customerRefNumber || !customerName) {
      return res.status(400).json({ error: 'Customer information not found in inventory records' });
    }
    
    console.log('Using customer info:', { customerRefNumber, customerName });
    
    const existingCustomerIds = [...new Set(existingInventory.map(inv => inv.Customer_ID))];
    
    // Get existing branches
    const existingBranches = [...new Set(existingInventory.map(inv => inv.Branch))];
    console.log('Existing branches:', existingBranches);
    console.log('New branches:', branches);

    // Find branches to add and remove
    const branchesToAdd = branches.filter(b => !existingBranches.includes(b));
    const branchesToKeep = branches.filter(b => existingBranches.includes(b));
    const branchesToRemove = existingBranches.filter(b => !branches.includes(b));

    console.log('Branches to add:', branchesToAdd);
    console.log('Branches to keep:', branchesToKeep);
    console.log('Branches to remove:', branchesToRemove);

    // Delete customers and inventory for removed branches
    for (const branch of branchesToRemove) {
      const inventoryToDelete = existingInventory.filter(inv => inv.Branch === branch);
      for (const inv of inventoryToDelete) {
        await Inventory.delete(inv.Inventory_ID);
        if (inv.Customer_ID) {
          await Customer.delete(inv.Customer_ID);
        }
        console.log(`Deleted inventory ${inv.Inventory_ID} and customer ${inv.Customer_ID} for branch: ${branch}`);
      }
    }

    // Add new branches
    if (branchesToAdd.length > 0) {
      // Create new customer records for new branches
      const newCustomerIds = await Customer.createMultipleBranches(
        customerRefNumber,
        customerName,
        branchesToAdd
      );
      console.log('Created new customer IDs:', newCustomerIds);

      // Create inventory records for new branches
      const newInventoryIds = await Inventory.createForProject(id, newCustomerIds);
      console.log('Created new inventory IDs:', newInventoryIds);
    }

    res.json({
      success: true,
      message: 'Branches updated successfully',
      added: branchesToAdd.length,
      removed: branchesToRemove.length,
      total: branches.length
    });
  } catch (error) {
    console.error('Error updating project branches:', error);
    res.status(500).json({ 
      error: 'Failed to update branches',
      message: error.message 
    });
  }
};

// Update project solution principals
exports.updateProjectSolutionPrincipals = async (req, res) => {
  try {
    const { id } = req.params;
    const { solution_principals } = req.body;

    if (!solution_principals || !Array.isArray(solution_principals)) {
      return res.status(400).json({ error: 'solution_principals array is required' });
    }

    console.log(`Updating solution principals for project ${id}:`, solution_principals);

    const { pool } = require('../config/database');
    
    // Delete existing solution principal associations
    await pool.execute(`DELETE FROM PROJECT_SP_BRIDGE WHERE Project_ID = ?`, [id]);
    
    // Insert new solution principal associations
    if (solution_principals.length > 0) {
      // Use parameterized query for safety
      const placeholders = solution_principals.map(() => '(?, ?, NULL)').join(', ');
      const values = [];
      solution_principals.forEach(spId => {
        values.push(id, spId);
      });
      
      await pool.execute(`
        INSERT INTO PROJECT_SP_BRIDGE (Project_ID, SP_ID, \`Support Type\`)
        VALUES ${placeholders}
      `, values);
    }

    res.json({
      success: true,
      message: 'Solution principals updated successfully',
      count: solution_principals.length
    });
  } catch (error) {
    console.error('Error updating project solution principals:', error);
    res.status(500).json({ 
      error: 'Failed to update solution principals',
      message: error.message 
    });
  }
};

// Get PM schedules for all projects
exports.getPMSchedules = async (req, res) => {
  try {
    const { year } = req.query;
    const schedules = await Project.getPMSchedules(year ? parseInt(year) : null);
    
    res.json({
      success: true,
      data: schedules,
      message: 'PM schedules fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching PM schedules:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch PM schedules',
      message: error.message 
    });
  }
};