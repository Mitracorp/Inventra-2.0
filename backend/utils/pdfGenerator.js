const pdf = require('html-pdf');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const PMaintenance = require('../models/PMaintenance');
const { pool } = require('../config/database');

class PDFGenerator {
    constructor() {
        this.templatePath = path.join(__dirname, '../templates/pm-report-template.html');
        this.outputDir = path.join(__dirname, '../uploads/pm-reports');
        this.bulkOutputDir = path.join(__dirname, '../uploads/bulkpm-reports');
        this.ensureDirectories();
    }

    async ensureDirectories() {
        try {
            await fs.mkdir(this.outputDir, { recursive: true });
            await fs.mkdir(this.bulkOutputDir, { recursive: true });
            console.log('📁 PM reports directories ready');
        } catch (error) {
            console.error('Error creating directories:', error);
        }
    }

    /**
     * Sanitize text for use in filenames
     * @param {string} text - Text to sanitize
     * @returns {string} - Sanitized text safe for filenames
     */
    sanitizeForFilename(text) {
        if (!text) return 'UNKNOWN';
        return text
            .replace(/\s+/g, '_')        // Replace spaces with underscores
            .replace(/[^a-zA-Z0-9_-]/g, '') // Remove special characters
            .toUpperCase()               // Convert to uppercase
            .substring(0, 50);           // Limit length to 50 characters
    }

    /**
     * Convert logo to base64 for embedding in PDF
     * @returns {string} - Base64 encoded logo or empty string if logo not found
     */
    getLogoBase64() {
        try {
            const logoPath = path.join(__dirname, '../../frontend/public/logo.png');
            if (fsSync.existsSync(logoPath)) {
                const logoBuffer = fsSync.readFileSync(logoPath);
                const logoBase64 = logoBuffer.toString('base64');
                return `data:image/png;base64,${logoBase64}`;
            } else {
                console.warn('Logo file not found at:', logoPath);
                return '';
            }
        } catch (error) {
            console.error('Error reading logo file:', error);
            return '';
        }
    }

    /**
     * Convert project logo to base64 for embedding in PDF
     * @param {string} logoPath - The file path from PROJECT.file_path_logo
     * @returns {string} - Base64 encoded project logo or empty string if not found
     */
    getProjectLogoBase64(logoPath) {
        try {
            if (!logoPath) {
                console.log('⚠️  No project logo path provided');
                return '';
            }
            
            // The logoPath from database is like: uploads/project-logo/ILIM.png
            // We need to construct the full path from backend directory
            const fullPath = path.join(__dirname, '..', logoPath);
            
            console.log('🔍 Looking for project logo at:', fullPath);
            console.log('🔍 __dirname is:', __dirname);
            console.log('🔍 Constructed path:', path.join(__dirname, '..'));
            
            if (fsSync.existsSync(fullPath)) {
                const logoBuffer = fsSync.readFileSync(fullPath);
                const logoBase64 = logoBuffer.toString('base64');
                
                // Detect image type from file extension
                const ext = path.extname(logoPath).toLowerCase();
                let mimeType = 'image/png';
                if (ext === '.jpg' || ext === '.jpeg') {
                    mimeType = 'image/jpeg';
                } else if (ext === '.gif') {
                    mimeType = 'image/gif';
                } else if (ext === '.svg') {
                    mimeType = 'image/svg+xml';
                }
                
                const dataUri = `data:${mimeType};base64,${logoBase64}`;
                console.log('✅ Project logo loaded successfully');
                console.log('✅ Logo data URI length:', dataUri.length);
                console.log('✅ First 100 chars of data URI:', dataUri.substring(0, 100));
                return dataUri;
            } else {
                console.warn('❌ Project logo file not found at:', fullPath);
                console.warn('📂 Current directory:', __dirname);
                console.warn('📂 Checking if uploads folder exists:', fsSync.existsSync(path.join(__dirname, '..', 'uploads')));
                console.warn('📂 Checking if project-logo folder exists:', fsSync.existsSync(path.join(__dirname, '..', 'uploads', 'project-logo')));
                
                // List files in project-logo directory
                try {
                    const projectLogoDir = path.join(__dirname, '..', 'uploads', 'project-logo');
                    if (fsSync.existsSync(projectLogoDir)) {
                        const files = fsSync.readdirSync(projectLogoDir);
                        console.warn('📂 Files in project-logo directory:', files);
                    }
                } catch (dirError) {
                    console.warn('❌ Could not list project-logo directory:', dirError.message);
                }
                
                return '';
            }
        } catch (error) {
            console.error('❌ Error reading project logo file:', error);
            return '';
        }
    }

    /**
     * Generate PDF report for a specific PM record
     * @param {number} pmId - The PM_ID from PMAINTENANCE table
     * @returns {Promise<Object>} - { success, filepath, filename, error }
     */
    async generatePMReport(pmId) {
        try {
            // 1. Fetch PM data with all details
            console.log(`Fetching PM data for PM_ID: ${pmId}`);
            const pmData = await PMaintenance.getDetailedPM(pmId);
            
            if (!pmData) {
                throw new Error(`PM record not found for PM_ID: ${pmId}`);
            }

            // 2. Get PM sequence number for this asset
            const pmSequenceNumber = await this.getPMSequenceNumber(pmId, pmData.Asset_ID);
            console.log(`This is PM #${pmSequenceNumber} for Asset_ID ${pmData.Asset_ID}`);

            // 3. Fetch checklist results
            const checklistResults = await this.getChecklistResults(pmId);
            
            // 4. Format data for template
            const templateData = this.formatDataForTemplate(pmData, checklistResults, pmSequenceNumber);

            // 4. Load and compile HTML template
            console.log('Loading HTML template...');
            const templateHtml = await fs.readFile(this.templatePath, 'utf8');
            const template = handlebars.compile(templateHtml);
            const html = template(templateData);

            // 5. Generate filename using PM sequence number (deterministic, no timestamp)
            // Use Customer_Name if available, otherwise use 'UNKNOWN'
            const customerName = pmData.Customer_Name ? this.sanitizeForFilename(pmData.Customer_Name) : 'UNKNOWN';
            const pmNumber = pmSequenceNumber || pmData.PM_ID || 'UNKNOWN';
            const filename = `PM_Report_${customerName}_${pmData.Asset_Serial_Number}_${pmNumber}.pdf`;
            const filepath = path.join(this.outputDir, filename);
            
            console.log('Customer_Name from DB:', pmData.Customer_Name);
            console.log('Sanitized customer name:', customerName);
            console.log('Generated filename:', filename);

            // 5. Generate PDF using html-pdf
            console.log('Generating PM PDF with html-pdf...');
            const options = {
                format: 'A4',
                orientation: 'portrait',
                border: {
                    top: '8mm',
                    right: '8mm',
                    bottom: '8mm',
                    left: '8mm'
                },
                type: 'pdf',
                quality: '100',
                dpi: 96,
                zoomFactor: '1',
                timeout: 30000,         // 30 seconds for PhantomJS
                httpTimeout: 30000,     // 30 seconds for HTTP requests
                height: '297mm',        // A4 height
                width: '210mm',         // A4 width
                base: `file://${__dirname}/../`,  // Base path for relative resources
                phantomArgs: ['--web-security=no', '--local-url-access=true', '--ignore-ssl-errors=yes']
            };

            await new Promise((resolve, reject) => {
                pdf.create(html, options).toFile(filepath, (err, res) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(res);
                    }
                });
            });

            console.log(`PDF generated successfully: ${filename}`);

            // 7. Update database with RELATIVE file path (not absolute)
            // Store relative path so it works across different developer machines
            const relativePath = path.join('uploads', 'pm-reports', filename);
            await this.updatePMFilePath(pmId, relativePath);

            return {
                success: true,
                filepath: relativePath,  // Return relative path
                filename: filename
            };

        } catch (error) {
            console.error('Error generating PDF:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check if PDF file exists at the given path
     * @param {string} filePath - Relative or absolute file path
     * @returns {Promise<boolean>} - True if file exists
     */
    async checkFileExists(filePath) {
        try {
            // If relative path, make it absolute
            const absolutePath = path.isAbsolute(filePath) 
                ? filePath 
                : path.join(__dirname, '..', filePath);
            
            await fs.access(absolutePath);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Update PMAINTENANCE.file_path in database
     * @param {number} pmId - PM_ID
     * @param {string} filePath - Relative file path to store
     * @returns {Promise<boolean>} - True if updated successfully
     */
    async updateFilePath(pmId, filePath) {
        try {
            await pool.execute(
                'UPDATE PMAINTENANCE SET file_path = ? WHERE PM_ID = ?',
                [filePath, pmId]
            );
            console.log(`✅ Updated file_path for PM_ID ${pmId}`);
            return true;
        } catch (error) {
            console.error('❌ Error updating file_path:', error);
            return false;
        }
    }

    /**
     * Convert signature to base64 for embedding in PDF
     * @param {string} signaturePath - The file path from PMAINTENANCE.signature_path
     * @returns {string} - Base64 encoded signature or empty string if not found
     */
    getSignatureBase64(signaturePath) {
        try {
            if (!signaturePath) {
                console.log('⚠️  No signature path provided');
                return '';
            }
            
            // The signaturePath from database is like: uploads/signature/signature_123.png
            // We need to construct the full path from backend directory
            const fullPath = path.join(__dirname, '..', signaturePath);
            
            console.log('🔍 Looking for signature at:', fullPath);
            
            if (fsSync.existsSync(fullPath)) {
                const signatureBuffer = fsSync.readFileSync(fullPath);
                const signatureBase64 = signatureBuffer.toString('base64');
                const dataUri = `data:image/png;base64,${signatureBase64}`;
                console.log('✅ Signature loaded successfully');
                return dataUri;
            } else {
                console.warn('❌ Signature file not found at:', fullPath);
                return '';
            }
        } catch (error) {
            console.error('❌ Error reading signature file:', error);
            return '';
        }
    }

    /**
     * Get PM sequence number for an asset (e.g., if this is the 3rd PM done on this asset, return 3)
     */
    async getPMSequenceNumber(pmId, assetId) {
        try {
            const query = `
                SELECT COUNT(*) + 1 as pm_count
                FROM PMAINTENANCE
                WHERE Asset_ID = ?
                AND (PM_Date < (SELECT PM_Date FROM PMAINTENANCE WHERE PM_ID = ?)
                     OR (PM_Date = (SELECT PM_Date FROM PMAINTENANCE WHERE PM_ID = ?) 
                         AND PM_ID < ?))
            `;
            
            const [result] = await pool.execute(query, [assetId, pmId, pmId, pmId]);
            
            return result[0].pm_count || 1;
        } catch (error) {
            console.error('Error getting PM sequence number:', error);
            return 1;
        }
    }

    /**
     * Get checklist results for a PM record
     */
    async getChecklistResults(pmId) {
        try {
            const query = `
                SELECT 
                    pmr.PM_Result_ID,
                    pmr.Is_OK_bool,
                    pmr.Remarks,
                    pmc.Check_item_Long
                FROM PM_RESULT pmr
                LEFT JOIN PM_CHECKLIST pmc ON pmr.Checklist_ID = pmc.Checklist_ID
                WHERE pmr.PM_ID = ?
                ORDER BY pmr.Checklist_ID
            `;
            
            const [results] = await pool.execute(query, [pmId]);
            
            console.log(`Found ${results.length} checklist items for PM_ID ${pmId}`);
            
            // Add index and ensure Is_OK_bool is boolean
            return results.map((item, index) => ({
                Check_item_Long: item.Check_item_Long || 'N/A',
                Is_OK_bool: item.Is_OK_bool === 1 || item.Is_OK_bool === true,
                Remarks: item.Remarks || null,
                index: index + 1
            }));
        } catch (error) {
            console.error('Error fetching checklist results:', error);
            return [];
        }
    }

    /**
     * Format data for Handlebars template
     */
    formatDataForTemplate(pmData, checklistResults, pmSequenceNumber = 1) {
        // Format date
        const pmDate = new Date(pmData.PM_Date);
        const formattedDate = pmDate.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        // Current date for footer
        const generatedDate = new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Format status for CSS class
        let statusClass = 'in-process';
        if (pmData.Status) {
            statusClass = pmData.Status.toLowerCase().replace(/\s+/g, '-');
        }

        // Convert logo to base64 for embedding in PDF
        const logoBase64 = this.getLogoBase64();
        
        // Convert project logo to base64 if available
        console.log('📋 Project_Logo_Path from database:', pmData.Project_Logo_Path);
        const projectLogoBase64 = this.getProjectLogoBase64(pmData.Project_Logo_Path);
        console.log('📋 Project_Logo_Base64 length:', projectLogoBase64 ? projectLogoBase64.length : 0);
        console.log('📋 Project logo will be included:', !!projectLogoBase64);

        // Convert recipient signature to base64 if available
        console.log('✍️  Recipient Signature_Path from database:', pmData.signature_path);
        let signatureBase64 = null;
        
        // Only include recipient signature if Status is "Completed" (with actual signature)
        // For "Marked as Completed" (without signature), keep it null for blank signature line
        if (pmData.Status === 'Completed' && pmData.signature_path) {
            signatureBase64 = this.getSignatureBase64(pmData.signature_path);
            console.log('✍️  Recipient Signature_Base64 length:', signatureBase64 ? signatureBase64.length : 0);
            console.log('✍️  Recipient signature will be included:', !!signatureBase64);
        } else if (pmData.Status === 'Marked as Completed') {
            console.log('✍️  Status is "Marked as Completed" - recipient signature will be blank for manual signing');
        } else {
            console.log('✍️  No recipient signature available');
        }

        // Convert technician (staff) signature to base64 if available
        console.log('🧑‍🔧 Technician Sign_Path from database:', pmData.Created_By_Sign_Path);
        const technicianSignatureBase64 = this.getSignatureBase64(pmData.Created_By_Sign_Path);
        console.log('🧑‍🔧 Technician Signature_Base64 length:', technicianSignatureBase64 ? technicianSignatureBase64.length : 0);
        console.log('🧑‍🔧 Technician signature will be included:', !!technicianSignatureBase64);

        // Format signed_at date if available
        let signedAtFormatted = null;
        if (pmData.signed_at) {
            const signedDate = new Date(pmData.signed_at);
            signedAtFormatted = signedDate.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
        }

        // Recipient for Maintenance & Agency Details (always from Recipients table)
        const recipientNameDetails = pmData.Recipient_Name || '-';
        const recipientDeptDetails = pmData.Department || '-';

        // Recipient for Acknowledgment section (can be overridden by Signed on Behalf)
        let recipientNameFinal = recipientNameDetails;
        let recipientDeptFinal = recipientDeptDetails;
        let bagiPihakUsed = false;
        
        // For "Marked as Completed", leave acknowledgement fields empty for manual signing
        if (pmData.Status === 'Marked as Completed') {
            recipientNameFinal = '';
            recipientDeptFinal = '';
            signedAtFormatted = null; // No date for manual signing
            console.log('✅ Status is "Marked as Completed" - recipient acknowledgement fields will be empty for manual signing');
        } else if (pmData.BagiPihak && typeof pmData.BagiPihak === 'string' && pmData.BagiPihak.trim().length > 0) {
            try {
                const parts = pmData.BagiPihak.split('\\');
                if (parts.length >= 2) {
                    recipientNameFinal = parts[0].trim();
                    // In case Department itself contains backslashes, join remaining parts back
                    recipientDeptFinal = parts.slice(1).join('\\').trim();
                    bagiPihakUsed = true;
                } else {
                    // If only one part, treat as Name and set Department to '-'
                    recipientNameFinal = pmData.BagiPihak.trim();
                    recipientDeptFinal = '-';
                    bagiPihakUsed = true;
                }
                console.log('🧾 Using BagiPihak override → Name:', recipientNameFinal, '| Dept:', recipientDeptFinal);
            } catch (e) {
                console.warn('⚠️  Failed to parse BagiPihak value:', pmData.BagiPihak, e.message);
            }
        }

        return {
            // PM Information
            PM_ID: pmData.PM_ID,
            PM_Sequence_Number: pmSequenceNumber,
            PM_Date_Formatted: formattedDate,
            Status: pmData.Status || 'In Process',
            Remarks: pmData.Remarks,

            // Asset Information
            Asset_Serial_Number: pmData.Asset_Serial_Number,
            Asset_Tag_ID: pmData.Asset_Tag_ID,
            Item_Name: pmData.Item_Name,
            Category: pmData.Category,
            Model: pmData.Model || '-',
            Asset_Status: pmData.Asset_Status || 'Active',
            Customer_Name: pmData.Customer_Name || 'N/A',
            Project_Title: pmData.Project_Title || '-',

            // Recipient Information
            Recipient_Name: recipientNameFinal,
            Department: recipientDeptFinal,
            Position: pmData.Position || '-',

            // Maintenance & Agency Details (original values)
            Recipient_Name_Details: recipientNameDetails,
            Department_Details: recipientDeptDetails,

            // Bagi Pihak indicator
            BagiPihak_Used: bagiPihakUsed,
            
            // Marked as Completed indicator (for larger signature space in template)
            Is_Marked_Completed: pmData.Status === 'Marked as Completed',

            // Created By (Technician) Information
            Created_By_Name: pmData.Created_By_Name || '-',

            // Logo as Base64
            Logo_Base64: logoBase64,
            Project_Logo_Base64: projectLogoBase64,

            // Signature as Base64
            Signature_Base64: signatureBase64,
            Technician_Signature_Base64: technicianSignatureBase64,
            Signed_At_Formatted: signedAtFormatted,

            // Checklist Results
            checklist_results: checklistResults,
            
            // Peripherals/Accessories
            peripherals: pmData.peripherals || [],

            // Footer
            Generated_Date: generatedDate
        };
    }

    /**
     * Generate blank PM report for an asset (no PM data, empty form)
     * @param {number} assetId - The Asset_ID
     * @returns {Promise<Object>} - { success, filepath, filename, error }
     */
    async generateBlankPMReport(assetId) {
        try {
            // 1. Fetch asset data
            console.log(`Fetching asset data for Asset_ID: ${assetId}`);
            const assetData = await PMaintenance.getAssetForBlankPM(assetId);
            
            if (!assetData) {
                throw new Error(`Asset not found for Asset_ID: ${assetId}`);
            }

            // 2. Format data for blank template
            const templateData = this.formatBlankFormData(assetData);

            // 3. Load and compile HTML template
            console.log('Loading HTML template...');
            const templateHtml = await fs.readFile(this.templatePath, 'utf8');
            const template = handlebars.compile(templateHtml);
            const html = template(templateData);

            // 4. Generate filename
            const customerName = assetData.Customer_Name ? this.sanitizeForFilename(assetData.Customer_Name) : 'UNKNOWN';
            const timestamp = Date.now();
            const filename = `PM_Blank_Asset${assetId}_${customerName}_${assetData.Asset_Serial_Number}_${timestamp}.pdf`;
            const filepath = path.join(this.outputDir, filename);
            
            console.log('Generated blank form filename:', filename);

            // 5. Generate PDF using html-pdf
            console.log('Generating PM PDF with html-pdf...');
            const options = {
                format: 'A4',
                orientation: 'portrait',
                border: {
                    top: '8mm',
                    right: '8mm',
                    bottom: '8mm',
                    left: '8mm'
                },
                type: 'pdf',
                quality: '100',
                dpi: 96,
                zoomFactor: '1',
                timeout: 30000,         // 30 seconds for PhantomJS
                httpTimeout: 30000,     // 30 seconds for HTTP requests
                height: '297mm',        // A4 height
                width: '210mm',         // A4 width
                base: `file://${__dirname}/../`,  // Base path for relative resources
                phantomArgs: ['--web-security=no', '--local-url-access=true', '--ignore-ssl-errors=yes']
            };

            await new Promise((resolve, reject) => {
                pdf.create(html, options).toFile(filepath, (err, res) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(res);
                    }
                });
            });

            console.log(`Blank PDF generated successfully: ${filename}`);

            const relativePath = path.join('uploads', 'pm-reports', filename);

            return {
                success: true,
                filepath: relativePath,
                filename: filename
            };

        } catch (error) {
            console.error('Error generating blank PDF:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Format asset data for blank PM template
     */
    formatBlankFormData(assetData) {
        // Current date for footer
        const generatedDate = new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Convert logos to base64
        const logoBase64 = this.getLogoBase64();
        const projectLogoBase64 = this.getProjectLogoBase64(assetData.Project_Logo_Path);

        return {
            // Mark as blank form
            isBlankForm: true,
            
            // PM Information - all empty/blank
            PM_ID: null,
            PM_Sequence_Number: null, // This will show as empty box in template
            PM_Date_Formatted: null,  // Empty date
            Status: null,
            Remarks: null,

            // Asset Information
            Asset_Serial_Number: assetData.Asset_Serial_Number,
            Asset_Tag_ID: assetData.Asset_Tag_ID,
            Item_Name: assetData.Item_Name,
            Category: assetData.Category,
            Model: assetData.Model || '-',
            Customer_Name: assetData.Customer_Name || 'N/A',
            Project_Title: assetData.Project_Title || '-',

            // Recipient Information (for acknowledgement section)
            Recipient_Name: assetData.Recipient_Name || '-',
            Department: assetData.Department || '-',
            Position: assetData.Position || '-',

            // Maintenance & Agency Details (same as above for blank forms)
            Recipient_Name_Details: assetData.Recipient_Name || '-',
            Department_Details: assetData.Department || '-',

            // No technician info for blank form
            Created_By_Name: null,

            // Logos
            Logo_Base64: logoBase64,
            Project_Logo_Base64: projectLogoBase64,

            // Checklist Results - all empty
            checklist_results: assetData.checklist_results,
            
            // Peripherals/Accessories
            peripherals: assetData.peripherals || [],

            // Footer
            Generated_Date: generatedDate
        };
    }

    /**
     * Update PMAINTENANCE table with generated PDF file path
     */
    async updatePMFilePath(pmId, filepath) {
        try {
            const query = `
                UPDATE PMAINTENANCE 
                SET file_path = ?
                WHERE PM_ID = ?
            `;
            
            await pool.execute(query, [filepath, pmId]);
            console.log(`Updated PM_ID ${pmId} with file path: ${filepath}`);
        } catch (error) {
            console.error('Error updating PM file path:', error);
            throw error;
        }
    }

    /**
     * Check if PDF exists for a PM record
     */
    async checkPDFExists(pmId) {
        try {
            const query = `SELECT file_path FROM PMAINTENANCE WHERE PM_ID = ?`;
            const [rows] = await pool.execute(query, [pmId]);
            
            if (rows.length > 0 && rows[0].file_path) {
                const filepath = rows[0].file_path;
                
                // Build absolute path from relative path stored in database
                const absolutePath = path.join(__dirname, '../', filepath);
                
                // Check if file actually exists on disk
                try {
                    await fs.access(absolutePath);
                    console.log(`✅ PDF exists locally: ${absolutePath}`);
                    return { exists: true, filepath };
                } catch {
                    console.log(`❌ PDF path in DB but file missing locally: ${absolutePath}`);
                    return { exists: false, filepath: null };
                }
            }
            
            return { exists: false, filepath: null };
        } catch (error) {
            console.error('Error checking PDF existence:', error);
            return { exists: false, filepath: null };
        }
    }

    /**
     * Generate bulk PDF report for multiple PM records
     * Uses caching strategy: checks file_path, reuses existing PDFs, compiles them together
     * @param {Array} pmRecords - Array of PM records with full details
     * @returns {Promise<Object>} - { success, filepath, filename, absolutePath, error }
     */
    async generateBulkPM(pmRecords, blankAssets = []) {
        try {
            console.log(`📦 Generating bulk PDF for ${pmRecords.length} PM records and ${blankAssets.length} blank forms with caching`);

            // Step 1: Ensure all individual PM PDFs exist (check cache, regenerate if needed)
            const individualPDFs = [];
            
            for (let i = 0; i < pmRecords.length; i++) {
                const pmData = pmRecords[i];
                console.log(`  Processing PM ${i + 1}/${pmRecords.length}: PM_ID ${pmData.PM_ID}`);

                let pdfPath = null;

                // Check if file_path exists in database
                if (pmData.file_path) {
                    console.log(`    🔍 Checking cached PDF: ${pmData.file_path}`);
                    const fileExists = await this.checkFileExists(pmData.file_path);
                    
                    if (fileExists) {
                        console.log(`    ✅ Using existing cached PDF`);
                        pdfPath = pmData.file_path;
                    } else {
                        console.log(`    ⚠️  Cached file missing, regenerating...`);
                    }
                }

                // If no cached PDF or file missing, generate new one
                if (!pdfPath) {
                    console.log(`    🔨 Generating new PDF...`);
                    const result = await this.generatePMReport(pmData.PM_ID);
                    
                    if (result.success) {
                        pdfPath = result.filepath;
                        // Update database with new file path
                        await this.updateFilePath(pmData.PM_ID, pdfPath);
                        console.log(`    ✅ New PDF generated and cached`);
                    } else {
                        console.error(`    ❌ Failed to generate PDF for PM_ID ${pmData.PM_ID}`);
                        continue; // Skip this PM if generation failed
                    }
                }

                // Add to individual PDFs list
                individualPDFs.push({
                    pmId: pmData.PM_ID,
                    path: pdfPath,
                    customer: pmData.Customer_Name,
                    branch: pmData.Branch,
                    data: pmData,
                    isBlank: false
                });
            }

            // Add blank forms to the list
            for (let i = 0; i < blankAssets.length; i++) {
                const assetData = blankAssets[i];
                console.log(`  Processing blank form ${i + 1}/${blankAssets.length}: Asset_ID ${assetData.Asset_ID}`);
                
                individualPDFs.push({
                    assetId: assetData.Asset_ID,
                    customer: assetData.Customer_Name,
                    branch: assetData.Branch,
                    data: assetData,
                    isBlank: true
                });
            }

            if (individualPDFs.length === 0) {
                throw new Error('No valid PDFs generated');
            }

            console.log(`  ✅ All records ready (${pmRecords.length} PM records + ${blankAssets.length} blank forms)`);

            // Step 2: Compile individual records into bulk PDF
            // Load template and generate combined HTML from all records
            const templateHtml = await fs.readFile(this.templatePath, 'utf8');
            const template = handlebars.compile(templateHtml);
            const htmlPages = [];

            for (let i = 0; i < individualPDFs.length; i++) {
                const pdfInfo = individualPDFs[i];
                let templateData;

                if (pdfInfo.isBlank) {
                    // Format blank form data
                    templateData = this.formatBlankFormData(pdfInfo.data);
                } else {
                    // Format regular PM data
                    const pmData = pdfInfo.data;
                    const pmSequenceNumber = await this.getPMSequenceNumber(pmData.PM_ID, pmData.Asset_ID);
                    const checklistResults = await this.getChecklistResults(pmData.PM_ID);
                    templateData = this.formatDataForTemplate(pmData, checklistResults, pmSequenceNumber);
                }

                const html = template(templateData);
                
                // Add page break after each record (except the last one)
                if (i < individualPDFs.length - 1) {
                    htmlPages.push(html + '<div style="page-break-after: always;"></div>');
                } else {
                    htmlPages.push(html);
                }
            }

            // Combine all HTML
            const combinedHtml = htmlPages.join('');

            // Step 3: Generate bulk PDF filename (with timestamp for uniqueness)
            const now = new Date();
            const timestamp = now.getTime();
            
            // Use first record's customer and branch for bulk filename
            const firstRecord = individualPDFs[0];
            const customerName = this.sanitizeForFilename(firstRecord.customer || 'UNKNOWN');
            const branchName = this.sanitizeForFilename(firstRecord.branch || 'UNKNOWN');
            const filename = `${customerName}_${branchName}_${timestamp}.pdf`;
            const filepath = path.join(this.bulkOutputDir, filename);

            // Step 4: Generate bulk PDF with html-pdf
            console.log('  🖨️  Compiling bulk PDF...');
            const options = {
                format: 'A4',
                border: {
                    top: '10mm',
                    right: '10mm',
                    bottom: '10mm',
                    left: '10mm'
                },
                type: 'pdf',
                quality: '75',
                dpi: 96,
                zoomFactor: '1'
            };

            await new Promise((resolve, reject) => {
                pdf.create(combinedHtml, options).toFile(filepath, (err, res) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(res);
                    }
                });
            });

            console.log(`✅ Bulk PDF compiled: ${filename}`);

            // Return relative path and absolute path
            const relativePath = path.relative(path.join(__dirname, '../'), filepath).replace(/\\\\/g, '/');

            return {
                success: true,
                filepath: relativePath,
                filename: filename,
                absolutePath: filepath, // Include absolute path for immediate download
                error: null
            };

        } catch (error) {
            console.error('❌ Error generating bulk PDF:', error);
            return {
                success: false,
                filepath: null,
                filename: null,
                absolutePath: null,
                error: error.message
            };
        }
    }
}

module.exports = new PDFGenerator();
