

const { pool } = require('../config/database');

class Project {
  constructor(project) {
    this.Project_ID = project.Project_ID;
    this.Project_Ref_Number = project.Project_Ref_Number;
    this.Project_Title = project.Project_Title;
    this.Company_Full_Name = project.Company_Full_Name;
    this.Warranty = project.Warranty;
    this.Preventive_Maintenance = project.Preventive_Maintenance;
    this.PM_Frequency = project.PM_Frequency;
    this.Start_Date = project.Start_Date;
    this.End_Date = project.End_Date;
    this.Antivirus = project.Antivirus;
    this.file_path_logo = project.file_path_logo;
  }

  // Get all projects with customer information from INVENTORY table
  static async findAll() {
    try {
      const [rows] = await pool.execute(`
        SELECT DISTINCT
          p.Project_ID,
          p.Project_Ref_Number,
          p.Project_Title,
          p.Company_Full_Name,
          p.Warranty,
          p.Preventive_Maintenance,
          p.PM_Frequency,
          p.Start_Date,
          p.End_Date,
          p.Antivirus,
          p.file_path_logo,
          c.Customer_Name,
          c.Customer_Ref_Number
        FROM PROJECT p
        LEFT JOIN INVENTORY i ON p.Project_ID = i.Project_ID
        LEFT JOIN CUSTOMER c ON i.Customer_ID = c.Customer_ID
        WHERE p.deleted_at IS NULL
        GROUP BY p.Project_ID
        ORDER BY p.Project_ID DESC
      `);
      
      // For each project, fetch solution principals separately
      for (let project of rows) {
        const [spRows] = await pool.execute(`
          SELECT sp.SP_Name, psb.\`Support Type\`
          FROM PROJECT_SP_BRIDGE psb
          JOIN SOLUTION_PRINCIPAL sp ON psb.SP_ID = sp.SP_ID
          WHERE psb.Project_ID = ?
        `, [project.Project_ID]);
        
        // Format as "SP_Name1|Support_Type1||SP_Name2|Support_Type2"
        // If Support Type is empty/null, don't add the pipe
        project.Solution_Principals = spRows
          .map(sp => sp['Support Type'] ? `${sp.SP_Name}|${sp['Support Type']}` : sp.SP_Name)
          .join('||');
      }
      
      return rows;
    } catch (error) {
      console.error('Error in Project.findAll:', error);
      throw error;
    }
  }

  // Get project by ID (with customer + solution principals)
  static async findById(id) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          p.Project_ID,
          p.Project_Ref_Number,
          p.Project_Title,
          p.Company_Full_Name,
          p.Warranty,
          p.Preventive_Maintenance,
          p.PM_Frequency,
          p.Start_Date,
          p.End_Date,
          p.Antivirus,
          p.file_path_logo,
          c.Customer_Name,
          c.Customer_Ref_Number
        FROM PROJECT p
        LEFT JOIN INVENTORY i ON p.Project_ID = i.Project_ID
        LEFT JOIN CUSTOMER c ON i.Customer_ID = c.Customer_ID
        WHERE p.Project_ID = ?
        GROUP BY p.Project_ID
        LIMIT 1
      `, [id]);

      if (!rows.length) {
        return null;
      }

      const project = rows[0];

      // Fetch solution principals for this project
      const [spRows] = await pool.execute(`
        SELECT sp.SP_Name, psb.\`Support Type\`
        FROM PROJECT_SP_BRIDGE psb
        JOIN SOLUTION_PRINCIPAL sp ON psb.SP_ID = sp.SP_ID
        WHERE psb.Project_ID = ?
      `, [id]);

      // If Support Type is empty/null, don't add the pipe
      project.Solution_Principals = spRows
        .map(sp => sp['Support Type'] ? `${sp.SP_Name}|${sp['Support Type']}` : sp.SP_Name)
        .join('||');

      return project;
    } catch (error) {
      console.error('Error in Project.findById:', error);
      throw error;
    }
  }

  // Get project by reference number with customer data from INVENTORY
  static async findByReferenceWithCustomer(refNum) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          p.Project_ID,
          p.Project_Ref_Number,
          p.Project_Title,
          p.Company_Full_Name,
          p.Warranty,
          p.Preventive_Maintenance,
          p.PM_Frequency,
          p.Start_Date,
          p.End_Date,
          p.Antivirus,
          p.file_path_logo,
          c.Customer_Name,
          c.Customer_Ref_Number
        FROM PROJECT p
        LEFT JOIN INVENTORY i ON p.Project_ID = i.Project_ID
        LEFT JOIN CUSTOMER c ON i.Customer_ID = c.Customer_ID
        WHERE p.Project_Ref_Number = ?
        GROUP BY p.Project_ID
        LIMIT 1
      `, [refNum]);
      
      if (rows.length > 0) {
        return rows[0];
      }
      return null;
    } catch (error) {
      console.error('Error in Project.findByReferenceWithCustomer:', error);
      throw error;
    }
  }

  // Create new project
  static async create(projectData) {
    try {
      // Convert empty End_Date to null, or set default to 1 year from now if not provided
      let endDate = projectData.End_Date;
      if (!endDate || endDate === '') {
        // Set default End_Date to 1 year from Start_Date (or today if no Start_Date)
        const baseDate = projectData.Start_Date ? new Date(projectData.Start_Date) : new Date();
        const defaultEndDate = new Date(baseDate);
        defaultEndDate.setFullYear(defaultEndDate.getFullYear() + 1);
        endDate = defaultEndDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        console.log('Setting default End_Date to 1 year from start:', endDate);
      }
      
      const [result] = await pool.execute(
        `INSERT INTO PROJECT (Project_Ref_Number, Project_Title, Company_Full_Name, Warranty, Preventive_Maintenance, PM_Frequency, Start_Date, End_Date, Antivirus) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectData.Project_Ref_Number,
          projectData.Project_Title,
          projectData.Company_Full_Name || null,
          projectData.Warranty,
          projectData.Preventive_Maintenance,
          projectData.PM_Frequency || 2,
          projectData.Start_Date,
          endDate,
          projectData.Antivirus || null
        ]
      );
      
      return await this.findById(result.insertId);
    } catch (error) {
      console.error('Error in Project.create:', error);
      throw error;
    }
  }

  // Update project
  async update() {
    try {
      await pool.execute(
        `UPDATE PROJECT SET 
         Project_Ref_Number = ?, 
         Project_Title = ?, 
         Company_Full_Name = ?,
         Warranty = ?, 
         Preventive_Maintenance = ?, 
         PM_Frequency = ?,
         Start_Date = ?, 
         End_Date = ?,
         Antivirus = ?
         WHERE Project_ID = ?`,
        [
          this.Project_Ref_Number,
          this.Project_Title,
          this.Company_Full_Name || null,
          this.Warranty,
          this.Preventive_Maintenance,
          this.PM_Frequency,
          this.Start_Date,
          this.End_Date,
          this.Antivirus,
          this.Project_ID
        ]
      );
      return this;
    } catch (error) {
      console.error('Error in Project.update:', error);
      throw error;
    }
  }

  // Soft Delete project (Instead of hard delete)
  static async delete(id) {
    try {
      // Kita update deleted_at dengan tarikh dan masa sekarang
      const [result] = await pool.execute(
        'UPDATE PROJECT SET deleted_at = CURRENT_TIMESTAMP WHERE Project_ID = ?', 
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in Project.delete:', error);
      throw error;
    }
  }

  static async updateLogoPath(id, filePathLogo) {
    try {
      const [result] = await pool.execute(
        'UPDATE PROJECT SET file_path_logo = ? WHERE Project_ID = ?',
        [filePathLogo, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in Project.updateLogoPath:', error);
      throw error;
    }
  }

  // Get project statistics
  static async getStatistics() {
    try {
      const [totalResult] = await pool.execute('SELECT COUNT(*) as total FROM PROJECT WHERE deleted_at IS NULL');
      const [activeResult] = await pool.execute('SELECT COUNT(*) as active FROM PROJECT WHERE End_Date >= CURDATE() AND deleted_at IS NULL');

      return {
        total: totalResult[0].total,
        active: activeResult[0].active,
        completed: totalResult[0].total - activeResult[0].active
      };
    } catch (error) {
      console.error('Error in Project.getStatistics:', error);
      // Return fallback data if database query fails
      return {
        total: 0,
        active: 0,
        completed: 0
      };
    }
  }

  // Get PM schedules for all projects
  static async getPMSchedules(year = null) {
    try {
      const currentYear = year || new Date().getFullYear();
      
      const [projects] = await pool.execute(`
        SELECT 
          p.Project_ID,
          p.Project_Ref_Number,
          p.Project_Title,
          p.Preventive_Maintenance,
          p.PM_Frequency,
          p.Start_Date,
          p.End_Date,
          c.Customer_Name,
          c.Customer_Ref_Number,
          COUNT(DISTINCT i.Asset_ID) as total_assets
        FROM PROJECT p
        LEFT JOIN INVENTORY i ON p.Project_ID = i.Project_ID
        LEFT JOIN CUSTOMER c ON i.Customer_ID = c.Customer_ID
        WHERE p.PM_Frequency IS NOT NULL
        AND p.PM_Frequency > 0
        AND (p.End_Date IS NULL OR p.End_Date >= CURDATE())
        AND p.deleted_at IS NULL
        GROUP BY p.Project_ID
        ORDER BY p.Start_Date, p.Project_Title
      `);

      // Get count of PM records per project per month/year (overall)
      const [pmRecords] = await pool.execute(`
        SELECT 
          p.Project_ID,
          YEAR(pm.PM_Date) as PM_Year,
          MONTH(pm.PM_Date) as PM_Month,
          COUNT(DISTINCT pm.PM_ID) as pm_count
        FROM PMAINTENANCE pm
        INNER JOIN ASSET a ON pm.Asset_ID = a.Asset_ID
        INNER JOIN INVENTORY i ON a.Asset_ID = i.Asset_ID
        INNER JOIN PROJECT p ON i.Project_ID = p.Project_ID
        WHERE YEAR(pm.PM_Date) = ?
        GROUP BY p.Project_ID, PM_Year, PM_Month
      `, [currentYear]);

      // Get count of PM records per project per month/year per branch
      const [pmRecordsByBranch] = await pool.execute(`
        SELECT 
          p.Project_ID,
          c.Branch,
          YEAR(pm.PM_Date) as PM_Year,
          MONTH(pm.PM_Date) as PM_Month,
          COUNT(DISTINCT pm.PM_ID) as pm_count,
          COUNT(DISTINCT a.Asset_ID) as branch_total_assets
        FROM PMAINTENANCE pm
        INNER JOIN ASSET a ON pm.Asset_ID = a.Asset_ID
        INNER JOIN INVENTORY i ON a.Asset_ID = i.Asset_ID
        INNER JOIN PROJECT p ON i.Project_ID = p.Project_ID
        INNER JOIN CUSTOMER c ON i.Customer_ID = c.Customer_ID
        WHERE YEAR(pm.PM_Date) = ?
        GROUP BY p.Project_ID, c.Branch, PM_Year, PM_Month
      `, [currentYear]);

      // Get total assets per project per branch
      const [branchAssets] = await pool.execute(`
        SELECT 
          p.Project_ID,
          c.Branch,
          COUNT(DISTINCT i.Asset_ID) as branch_total_assets
        FROM PROJECT p
        INNER JOIN INVENTORY i ON p.Project_ID = i.Project_ID
        INNER JOIN CUSTOMER c ON i.Customer_ID = c.Customer_ID
        WHERE p.PM_Frequency IS NOT NULL
        AND p.PM_Frequency > 0
        GROUP BY p.Project_ID, c.Branch
      `);

      // Get custom schedules from PM_SCHEDULE table for the current year
      const [customSchedules] = await pool.execute(`
        SELECT 
          Project_ID,
          Scheduled_Date,
          Is_Custom,
          Notes,
          Schedule_ID
        FROM PM_SCHEDULE
        WHERE YEAR(Scheduled_Date) = ?
        ORDER BY Scheduled_Date
      `, [currentYear]);

      // Group custom schedules by project
      const customSchedulesByProject = {};
      customSchedules.forEach(schedule => {
        if (!customSchedulesByProject[schedule.Project_ID]) {
          customSchedulesByProject[schedule.Project_ID] = [];
        }
        customSchedulesByProject[schedule.Project_ID].push({
          date: schedule.Scheduled_Date.toISOString().split('T')[0],
          isCustom: Boolean(schedule.Is_Custom),
          notes: schedule.Notes,
          scheduleId: schedule.Schedule_ID
        });
      });

      // Calculate PM schedules for each project
      const schedules = projects.map(project => {
        const startDate = new Date(project.Start_Date);
        const endDate = project.End_Date ? new Date(project.End_Date) : null;
        const frequency = project.PM_Frequency || 2;
        const monthInterval = Math.floor(12 / frequency);
        
        // Check if this project has custom schedules
        const projectCustomSchedules = customSchedulesByProject[project.Project_ID] || [];
        
        let pmDates = [];
        
        // If custom schedules exist, use them instead of auto-calculated
        if (projectCustomSchedules.length > 0) {
          // Use custom schedules
          pmDates = projectCustomSchedules.map(customSchedule => {
            const dateStr = customSchedule.date;
            const date = new Date(dateStr);
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            
            // Find matching PM records for this project and month
            const matchingPM = pmRecords.find(pm => 
              pm.Project_ID === project.Project_ID && 
              pm.PM_Month === month && 
              pm.PM_Year === year
            );

            // Find branch-level PM records for this project and month
            const branchPMData = pmRecordsByBranch.filter(pm =>
              pm.Project_ID === project.Project_ID &&
              pm.PM_Month === month &&
              pm.PM_Year === year
            );

            // Get branch asset counts for this project
            const projectBranchAssets = branchAssets.filter(ba =>
              ba.Project_ID === project.Project_ID
            );
            
            let pmInfo = null;
            if (matchingPM && matchingPM.pm_count > 0) {
              const totalAssets = project.total_assets || 1;
              const pmCount = matchingPM.pm_count || 0;
              const completionPercentage = Math.round((pmCount / totalAssets) * 100);
              const status = pmCount >= totalAssets ? 'Completed' : 'In-Process';

              const branchStats = projectBranchAssets.map(branchAsset => {
                const branchPM = branchPMData.find(bpm => bpm.Branch === branchAsset.Branch);
                const branchPMCount = branchPM ? branchPM.pm_count : 0;
                const branchTotalAssets = branchAsset.branch_total_assets || 1;
                const branchCompletionPercentage = Math.round((branchPMCount / branchTotalAssets) * 100);
                
                return {
                  branch: branchAsset.Branch,
                  pmCount: branchPMCount,
                  totalAssets: branchTotalAssets,
                  completionPercentage: branchCompletionPercentage,
                  status: branchPMCount >= branchTotalAssets ? 'Completed' : 'In-Process'
                };
              });
              
              pmInfo = {
                Status: status,
                completionPercentage: completionPercentage,
                pmCount: pmCount,
                totalAssets: totalAssets,
                branchStats: branchStats
              };
            }
            
            return {
              date: dateStr,
              pmInfo,
              isCustom: customSchedule.isCustom,
              notes: customSchedule.notes,
              scheduleId: customSchedule.scheduleId
            };
          });
        } else {
          // Calculate PM dates automatically
          // First PM is scheduled at monthInterval after start date (not on start date)
          let pmIndex = 1;
          let keepCalculating = true;
          
          while (keepCalculating) {
          const pmDate = new Date(startDate);
          pmDate.setMonth(startDate.getMonth() + (pmIndex * monthInterval));
          
          // Stop if we've gone past the end date
          if (endDate && pmDate > endDate) {
            break;
          }
          
          // Stop if we've gone too far into the future (e.g., 10 years ahead)
          const maxDate = new Date();
          maxDate.setFullYear(maxDate.getFullYear() + 10);
          if (pmDate > maxDate) {
            break;
          }
          
          // Only include dates that fall in the current year being viewed
          if (pmDate.getFullYear() === currentYear) {
            const dateStr = pmDate.toISOString().split('T')[0];
            const month = pmDate.getMonth() + 1; // JavaScript months are 0-indexed, SQL is 1-indexed
            const year = pmDate.getFullYear();
            
            // Find matching PM records for this project and month
            const matchingPM = pmRecords.find(pm => 
              pm.Project_ID === project.Project_ID && 
              pm.PM_Month === month && 
              pm.PM_Year === year
            );

            // Find branch-level PM records for this project and month
            const branchPMData = pmRecordsByBranch.filter(pm =>
              pm.Project_ID === project.Project_ID &&
              pm.PM_Month === month &&
              pm.PM_Year === year
            );

            // Get branch asset counts for this project
            const projectBranchAssets = branchAssets.filter(ba =>
              ba.Project_ID === project.Project_ID
            );
            
            let pmInfo = null;
            if (matchingPM && matchingPM.pm_count > 0) {
              const totalAssets = project.total_assets || 1;
              const pmCount = matchingPM.pm_count || 0;
              
              // Calculate completion percentage: (PM count / total assets) * 100
              const completionPercentage = Math.round((pmCount / totalAssets) * 100);
              
              // Status is "Completed" only when PM count equals total assets
              const status = pmCount >= totalAssets ? 'Completed' : 'In-Process';

              // Calculate branch-level statistics
              const branchStats = projectBranchAssets.map(branchAsset => {
                const branchPM = branchPMData.find(bpm => bpm.Branch === branchAsset.Branch);
                const branchPMCount = branchPM ? branchPM.pm_count : 0;
                const branchTotalAssets = branchAsset.branch_total_assets || 1;
                const branchCompletionPercentage = Math.round((branchPMCount / branchTotalAssets) * 100);
                
                return {
                  branch: branchAsset.Branch,
                  pmCount: branchPMCount,
                  totalAssets: branchTotalAssets,
                  completionPercentage: branchCompletionPercentage,
                  status: branchPMCount >= branchTotalAssets ? 'Completed' : 'In-Process'
                };
              });
              
              pmInfo = {
                Status: status,
                completionPercentage: completionPercentage,
                pmCount: pmCount,
                totalAssets: totalAssets,
                branchStats: branchStats
              };
            }
            
            pmDates.push({
              date: dateStr,
              pmInfo,
              isCustom: false
            });
          }
          
          pmIndex++;
        }
        } // End of else block for auto-calculated schedules

        return {
          ...project,
          pmDates,
          monthInterval
        };
      });

      return schedules;
    } catch (error) {
      console.error('Error in Project.getPMSchedules:', error);
      throw error;
    }
  }
}

module.exports = Project;