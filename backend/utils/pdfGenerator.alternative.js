// Alternative PDF Generator using html-pdf-node (no Chrome dependencies)
// Use this if Puppeteer fails due to missing system libraries on cPanel

const htmlPdf = require('html-pdf-node');
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
            .replace(/\\s+/g, '_')        // Replace spaces with underscores
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
            const candidatePaths = [
                process.env.MITRACORP_LOGO_PATH,
                path.join(__dirname, '../../frontend/src/assets/MitracorpLogo_full.png'),
                path.join(__dirname, '../../frontend/public/logo.png')
            ].filter(Boolean);

            for (const logoPath of candidatePaths) {
                if (fsSync.existsSync(logoPath)) {
                    const logoBuffer = fsSync.readFileSync(logoPath);
                    return `data:image/png;base64,${logoBuffer.toString('base64')}`;
                }
            }

            return '';
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
                return '';
            }
            
            const fullPath = path.join(__dirname, '..', logoPath);
            
            if (fsSync.existsSync(fullPath)) {
                const logoBuffer = fsSync.readFileSync(fullPath);
                const logoBase64 = logoBuffer.toString('base64');
                
                const ext = path.extname(logoPath).toLowerCase();
                let mimeType = 'image/png';
                if (ext === '.jpg' || ext === '.jpeg') {
                    mimeType = 'image/jpeg';
                } else if (ext === '.gif') {
                    mimeType = 'image/gif';
                } else if (ext === '.svg') {
                    mimeType = 'image/svg+xml';
                }
                
                return `data:${mimeType};base64,${logoBase64}`;
            } else {
                console.warn('Project logo file not found at:', fullPath);
                return '';
            }
        } catch (error) {
            console.error('Error reading project logo file:', error);
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

            // 5. Load and compile HTML template
            console.log('Loading HTML template...');
            const templateHtml = await fs.readFile(this.templatePath, 'utf8');
            const template = handlebars.compile(templateHtml);
            const html = template(templateData);

            // 6. Generate filename
            const customerName = pmData.Customer_Name ? this.sanitizeForFilename(pmData.Customer_Name) : 'UNKNOWN';
            const filename = `PM_Report_PM${pmData.PM_ID}_${customerName}_${pmData.Asset_Serial_Number}.pdf`;
            const filepath = path.join(this.outputDir, filename);
            
            console.log('Customer_Name from DB:', pmData.Customer_Name);
            console.log('Sanitized customer name:', customerName);
            console.log('Generated filename:', filename);

            // 7. Generate PDF using html-pdf-node
            console.log('Generating PDF with html-pdf-node...');
            const options = { 
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '10mm',
                    right: '10mm',
                    bottom: '10mm',
                    left: '10mm'
                }
            };
            
            const file = { content: html };
            const pdfBuffer = await htmlPdf.generatePdf(file, options);
            
            // Write PDF to file
            await fs.writeFile(filepath, pdfBuffer);
            console.log(`PDF generated successfully: ${filename}`);

            // 8. Update database with RELATIVE file path
            const relativePath = path.join('uploads', 'pm-reports', filename);
            await this.updatePMFilePath(pmId, relativePath);

            return {
                success: true,
                filepath: relativePath,
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
     * Get PM sequence number for an asset
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
        const pmDate = new Date(pmData.PM_Date);
        const formattedDate = pmDate.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        const generatedDate = new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        let statusClass = 'in-process';
        if (pmData.Status) {
            statusClass = pmData.Status.toLowerCase().replace(/\\s+/g, '-');
        }

        const logoBase64 = this.getLogoBase64();
        const projectLogoBase64 = this.getProjectLogoBase64(pmData.Project_Logo_Path);

        return {
            PM_ID: pmData.PM_ID,
            PM_Sequence_Number: pmSequenceNumber,
            PM_Date_Formatted: formattedDate,
            Status: pmData.Status || 'In Process',
            Remarks: pmData.Remarks,
            Asset_Serial_Number: pmData.Asset_Serial_Number,
            Asset_Tag_ID: pmData.Asset_Tag_ID,
            Item_Name: pmData.Item_Name,
            Category: pmData.Category,
            Model: pmData.Model || '-',
            Asset_Status: pmData.Asset_Status || 'Active',
            Customer_Name: pmData.Customer_Name || 'N/A',
            Project_Title: pmData.Project_Title || '-',
            Recipient_Name: pmData.Recipient_Name || '-',
            Department: pmData.Department || '-',
            Position: pmData.Position || '-',
            Created_By_Name: pmData.Created_By_Name || '-',
            Logo_Base64: logoBase64,
            Project_Logo_Base64: projectLogoBase64,
            checklist_results: checklistResults,
            peripherals: pmData.peripherals || [],
            Generated_Date: generatedDate
        };
    }

    /**
     * Generate blank PM report for an asset
     */
    async generateBlankPMReport(assetId) {
        try {
            console.log(`Fetching asset data for Asset_ID: ${assetId}`);
            const assetData = await PMaintenance.getAssetForBlankPM(assetId);
            
            if (!assetData) {
                throw new Error(`Asset not found for Asset_ID: ${assetId}`);
            }

            const templateData = this.formatBlankFormData(assetData);

            console.log('Loading HTML template...');
            const templateHtml = await fs.readFile(this.templatePath, 'utf8');
            const template = handlebars.compile(templateHtml);
            const html = template(templateData);

            const customerName = assetData.Customer_Name ? this.sanitizeForFilename(assetData.Customer_Name) : 'UNKNOWN';
            const timestamp = Date.now();
            const filename = `PM_Blank_Asset${assetId}_${customerName}_${assetData.Asset_Serial_Number}_${timestamp}.pdf`;
            const filepath = path.join(this.outputDir, filename);
            
            console.log('Generated blank form filename:', filename);

            console.log('Generating PDF with html-pdf-node...');
            const options = { 
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '10mm',
                    right: '10mm',
                    bottom: '10mm',
                    left: '10mm'
                }
            };
            
            const file = { content: html };
            const pdfBuffer = await htmlPdf.generatePdf(file, options);
            
            await fs.writeFile(filepath, pdfBuffer);
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
        const generatedDate = new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const logoBase64 = this.getLogoBase64();
        const projectLogoBase64 = this.getProjectLogoBase64(assetData.Project_Logo_Path);

        return {
            isBlankForm: true,
            PM_ID: null,
            PM_Sequence_Number: null,
            PM_Date_Formatted: null,
            Status: null,
            Remarks: null,
            Asset_Serial_Number: assetData.Asset_Serial_Number,
            Asset_Tag_ID: assetData.Asset_Tag_ID,
            Item_Name: assetData.Item_Name,
            Category: assetData.Category,
            Model: assetData.Model || '-',
            Customer_Name: assetData.Customer_Name || 'N/A',
            Project_Title: assetData.Project_Title || '-',
            Recipient_Name: assetData.Recipient_Name || '-',
            Department: assetData.Department || '-',
            Position: assetData.Position || '-',
            Recipient_Name_Details: assetData.Recipient_Name || '-',
            Department_Details: assetData.Department || '-',
            Created_By_Name: null,
            Logo_Base64: logoBase64,
            Project_Logo_Base64: projectLogoBase64,
            checklist_results: assetData.checklist_results,
            peripherals: assetData.peripherals || [],
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
                const absolutePath = path.join(__dirname, '../', filepath);
                
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
     */
    async generateBulkPM(pmRecords, blankAssets = []) {
        try {
            console.log(`📦 Generating bulk PDF for ${pmRecords.length} PM records and ${blankAssets.length} blank forms`);

            // Ensure all individual PM PDFs exist
            const individualPDFs = [];
            
            for (let i = 0; i < pmRecords.length; i++) {
                const pmData = pmRecords[i];
                console.log(`  Processing PM ${i + 1}/${pmRecords.length}: PM_ID ${pmData.PM_ID}`);

                let pdfPath = null;

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

                if (!pdfPath) {
                    console.log(`    🔨 Generating new PDF...`);
                    const result = await this.generatePMReport(pmData.PM_ID);
                    
                    if (result.success) {
                        pdfPath = result.filepath;
                        await this.updateFilePath(pmData.PM_ID, pdfPath);
                        console.log(`    ✅ New PDF generated and cached`);
                    } else {
                        console.error(`    ❌ Failed to generate PDF for PM_ID ${pmData.PM_ID}`);
                        continue;
                    }
                }

                individualPDFs.push({
                    pmId: pmData.PM_ID,
                    path: pdfPath,
                    customer: pmData.Customer_Name,
                    branch: pmData.Branch,
                    data: pmData,
                    isBlank: false
                });
            }

            // Add blank forms
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

            // Compile individual records into bulk PDF
            const templateHtml = await fs.readFile(this.templatePath, 'utf8');
            const template = handlebars.compile(templateHtml);
            const htmlPages = [];

            for (let i = 0; i < individualPDFs.length; i++) {
                const pdfInfo = individualPDFs[i];
                let templateData;

                if (pdfInfo.isBlank) {
                    templateData = this.formatBlankFormData(pdfInfo.data);
                } else {
                    const pmData = pdfInfo.data;
                    const pmSequenceNumber = await this.getPMSequenceNumber(pmData.PM_ID, pmData.Asset_ID);
                    const checklistResults = await this.getChecklistResults(pmData.PM_ID);
                    templateData = this.formatDataForTemplate(pmData, checklistResults, pmSequenceNumber);
                }

                const html = template(templateData);
                
                if (i < individualPDFs.length - 1) {
                    htmlPages.push(html + '<div style="page-break-after: always;"></div>');
                } else {
                    htmlPages.push(html);
                }
            }

            const combinedHtml = htmlPages.join('');

            // Generate bulk PDF filename
            const now = new Date();
            const timestamp = now.getTime();
            
            const firstRecord = individualPDFs[0];
            const customerName = this.sanitizeForFilename(firstRecord.customer || 'UNKNOWN');
            const branchName = this.sanitizeForFilename(firstRecord.branch || 'UNKNOWN');
            const filename = `${customerName}_${branchName}_${timestamp}.pdf`;
            const filepath = path.join(this.bulkOutputDir, filename);

            // Generate bulk PDF
            console.log('  🖨️  Compiling bulk PDF...');
            const options = { 
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '10mm',
                    right: '10mm',
                    bottom: '10mm',
                    left: '10mm'
                }
            };
            
            const file = { content: combinedHtml };
            const pdfBuffer = await htmlPdf.generatePdf(file, options);
            
            await fs.writeFile(filepath, pdfBuffer);
            console.log(`✅ Bulk PDF compiled: ${filename}`);

            const relativePath = path.relative(path.join(__dirname, '../'), filepath).replace(/\\\\/g, '/');

            return {
                success: true,
                filepath: relativePath,
                filename: filename,
                absolutePath: filepath,
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
