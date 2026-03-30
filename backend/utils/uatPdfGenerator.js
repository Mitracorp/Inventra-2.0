const pdf = require('html-pdf');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../config/database');

class UATPdfGenerator {
  constructor() {
    this.templatePath = path.join(__dirname, '../templates/uat-report-template.html');
    this.outputDir = path.join(__dirname, '../uploads/uat-reports');
    this.registryPath = path.join(this.outputDir, 'verification-registry.json');
    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      if (!fsSync.existsSync(this.registryPath)) {
        await fs.writeFile(this.registryPath, JSON.stringify([], null, 2), 'utf8');
      }
    } catch (error) {
      console.error('Error creating UAT directory:', error);
    }
  }

  formatTimestamp(dateValue) {
    const date = dateValue ? new Date(dateValue) : new Date();
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  }

  createDocumentId() {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `UAT-${datePart}-${randomPart}`;
  }

  generateVerificationCode(payload = {}) {
    const secret = process.env.UAT_VERIFICATION_SECRET || process.env.JWT_SECRET || 'inventra-uat-secret';
    const source = JSON.stringify({
      documentId: payload.documentId,
      assetId: payload.asset?.Asset_ID,
      serial: payload.asset?.Asset_Serial_Number,
      recipient: payload.recipient?.name,
      submittedBy: payload.submittedBy,
      generatedAtIso: payload.generatedAtIso
    });

    return crypto
      .createHash('sha256')
      .update(`${source}:${secret}`)
      .digest('hex')
      .slice(0, 16)
      .toUpperCase();
  }

  getVerificationBaseUrl() {
    return process.env.UAT_VERIFICATION_BASE_URL || process.env.BACKEND_PUBLIC_URL || 'http://127.0.0.1:5000';
  }

  async loadRegistry() {
    try {
      await this.ensureDirectories();
      if (!fsSync.existsSync(this.registryPath)) return [];
      const content = await fs.readFile(this.registryPath, 'utf8');
      const parsed = JSON.parse(content || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  async saveRegistry(entries) {
    try {
      await fs.writeFile(this.registryPath, JSON.stringify(entries, null, 2), 'utf8');
    } catch (error) {
      // Ignore registry save failure to avoid blocking PDF generation
    }
  }

  async recordDocument(entry) {
    const entries = await this.loadRegistry();
    const nextEntries = [entry, ...entries].slice(0, 5000);
    await this.saveRegistry(nextEntries);
  }

  async verifyDocument(documentId) {
    const entries = await this.loadRegistry();
    return entries.find((entry) => String(entry.documentId) === String(documentId)) || null;
  }

  async getHistorySummary(filters = {}) {
    const entries = await this.loadRegistry();
    const normalizedCustomer = String(filters.customerName || '').trim().toLowerCase();
    const normalizedBranch = String(filters.branch || '').trim().toLowerCase();
    const normalizedType = String(filters.assetType || '').trim().toLowerCase();

    const isMatchingType = (entry) => {
      if (!normalizedType) return true;
      const category = String(entry.category || '').toLowerCase();
      const itemName = String(entry.itemName || '').toLowerCase();
      const model = String(entry.model || '').toLowerCase();
      if (!category && !itemName && !model) return true;
      const haystack = `${category} ${itemName} ${model}`;

      if (normalizedType === 'printer') {
        return haystack.includes('printer') || haystack.includes('laserjet') || haystack.includes('mfp');
      }

      if (normalizedType === 'projector') {
        return haystack.includes('projector') || haystack.includes('epson');
      }

      if (normalizedType === 'tablet') {
        return haystack.includes('tablet') || haystack.includes('2 in 1') || haystack.includes('2in1') || haystack.includes('detachable');
      }

      if (normalizedType === 'notebook/laptop') {
        return haystack.includes('laptop') || haystack.includes('notebook') || haystack.includes('riba');
      }

      if (normalizedType === 'server') {
        return haystack.includes('server');
      }

      if (normalizedType === 'network') {
        return haystack.includes('router') || haystack.includes('switch') || haystack.includes('network');
      }

      if (normalizedType === 'desktop/aio') {
        return !(
          haystack.includes('printer') ||
          haystack.includes('laserjet') ||
          haystack.includes('mfp') ||
          haystack.includes('projector') ||
          haystack.includes('epson') ||
          haystack.includes('tablet') ||
          haystack.includes('2 in 1') ||
          haystack.includes('2in1') ||
          haystack.includes('detachable') ||
          haystack.includes('laptop') ||
          haystack.includes('notebook') ||
          haystack.includes('riba') ||
          haystack.includes('server') ||
          haystack.includes('router') ||
          haystack.includes('switch') ||
          haystack.includes('network')
        );
      }

      return true;
    };

    const filteredEntries = entries.filter((entry) => {
      if (normalizedCustomer && String(entry.customerName || '').trim().toLowerCase() !== normalizedCustomer) {
        return false;
      }

      const entryBranch = String(entry.branch || '').trim().toLowerCase();
      if (normalizedBranch && entryBranch && entryBranch !== normalizedBranch) {
        return false;
      }

      if (!isMatchingType(entry)) {
        return false;
      }

      return true;
    });

    const byAsset = new Map();

    filteredEntries.forEach((entry) => {
      const assetId = String(entry.assetId || '').trim();
      if (!assetId) return;

      const generatedAtIso = entry.generatedAt || null;
      const previous = byAsset.get(assetId) || {
        assetId,
        count: 0,
        latestGeneratedAt: null,
        latestRecipientName: '-',
        latestSubmittedBy: '-',
        latestDocumentId: null,
        latestFileName: null,
        latestAvailableFileName: null,
        latestAvailableGeneratedAt: null,
        latestAvailableDocumentId: null
      };

      const shouldReplaceLatest = !previous.latestGeneratedAt ||
        (generatedAtIso && new Date(generatedAtIso).getTime() > new Date(previous.latestGeneratedAt).getTime());

      byAsset.set(assetId, {
        ...previous,
        count: previous.count + 1,
        latestGeneratedAt: shouldReplaceLatest ? generatedAtIso : previous.latestGeneratedAt,
        latestRecipientName: shouldReplaceLatest ? (entry.recipientName || previous.latestRecipientName || '-') : previous.latestRecipientName,
        latestSubmittedBy: shouldReplaceLatest ? (entry.submittedBy || previous.latestSubmittedBy || '-') : previous.latestSubmittedBy,
        latestDocumentId: shouldReplaceLatest ? (entry.documentId || previous.latestDocumentId || null) : previous.latestDocumentId,
        latestFileName: shouldReplaceLatest ? (entry.fileName || previous.latestFileName || null) : previous.latestFileName
      });

      const fileExists = this.hasStoredReportFile(entry.fileName);
      if (fileExists) {
        const current = byAsset.get(assetId);
        const shouldReplaceAvailable = !current.latestAvailableGeneratedAt ||
          (generatedAtIso && new Date(generatedAtIso).getTime() > new Date(current.latestAvailableGeneratedAt).getTime());

        if (shouldReplaceAvailable) {
          byAsset.set(assetId, {
            ...current,
            latestAvailableFileName: entry.fileName,
            latestAvailableGeneratedAt: generatedAtIso,
            latestAvailableDocumentId: entry.documentId || null
          });
        }
      }
    });

    return Array.from(byAsset.values());
  }

  getStoredReportPath(fileName) {
    const safeName = path.basename(String(fileName || ''));
    if (!safeName) return null;

    const resolved = path.resolve(this.outputDir, safeName);
    const outputDirResolved = path.resolve(this.outputDir);
    if (!resolved.startsWith(outputDirResolved)) return null;

    if (!fsSync.existsSync(resolved)) return null;
    return resolved;
  }

  hasStoredReportFile(fileName) {
    return Boolean(this.getStoredReportPath(fileName));
  }

  sanitizeForFilename(text) {
    if (!text) return 'UNKNOWN';
    return String(text)
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .toUpperCase()
      .substring(0, 50);
  }

  formatDate(dateValue) {
    const date = dateValue ? new Date(dateValue) : new Date();
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  getMitracorpLogoBase64() {
    const candidatePaths = [
      // UAT-only branding override (preferred)
      path.join(__dirname, '../uploads/branding/mitracorp-uat-logo.png'),
      path.join(__dirname, '../../frontend/src/assets/MitracorpLogo_UAT.png'),

      // Legacy fallbacks
      path.join(__dirname, '../../frontend/src/assets/MitracorpLogo_full.png'),
      path.join(__dirname, '../../frontend/public/logo.png')
    ];

    for (const logoPath of candidatePaths) {
      try {
        if (fsSync.existsSync(logoPath)) {
          const logoBuffer = fsSync.readFileSync(logoPath);
          return `data:image/png;base64,${logoBuffer.toString('base64')}`;
        }
      } catch (error) {
        // Try next candidate path
      }
    }

    return '';
  }

  getProjectLogoBase64(logoPath) {
    try {
      if (!logoPath) return '';
      const fullPath = path.join(__dirname, '..', logoPath);

      if (!fsSync.existsSync(fullPath)) return '';

      const logoBuffer = fsSync.readFileSync(fullPath);
      const ext = path.extname(logoPath).toLowerCase();
      let mimeType = 'image/png';

      if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
      if (ext === '.gif') mimeType = 'image/gif';
      if (ext === '.svg') mimeType = 'image/svg+xml';

      return `data:${mimeType};base64,${logoBuffer.toString('base64')}`;
    } catch (error) {
      return '';
    }
  }

  getStaffSignatureBase64(signaturePath) {
    try {
      if (!signaturePath) return '';
      const fullPath = path.join(__dirname, '..', signaturePath);
      if (!fsSync.existsSync(fullPath)) return '';

      const signatureBuffer = fsSync.readFileSync(fullPath);
      return `data:image/png;base64,${signatureBuffer.toString('base64')}`;
    } catch (error) {
      return '';
    }
  }

  async getProjectBrandingByAssetId(assetId) {
    try {
      if (!assetId) {
        return {
          logoPath: null,
          companyFullName: null
        };
      }

      const [rows] = await pool.execute(
        `SELECT p.file_path_logo, p.Company_Full_Name, c.Customer_Name
         FROM INVENTORY i
         LEFT JOIN PROJECT p ON i.Project_ID = p.Project_ID
         LEFT JOIN CUSTOMER c ON i.Customer_ID = c.Customer_ID
         WHERE i.Asset_ID = ?
         LIMIT 1`,
        [assetId]
      );

      if (!rows.length) {
        return {
          logoPath: null,
          companyFullName: null
        };
      }

      return {
        logoPath: rows[0].file_path_logo || null,
        companyFullName: rows[0].Company_Full_Name || rows[0].Customer_Name || null
      };
    } catch (error) {
      return {
        logoPath: null,
        companyFullName: null
      };
    }
  }

  normalizeSections(rawSections = []) {
    return rawSections
      .map((section) => {
        const items = Array.isArray(section.items)
          ? section.items
              .map((item) => ({
                label: item?.label || '-',
                checked: Boolean(item?.checked),
                remarks: item?.remarks || ''
              }))
              .filter((item) => item.label)
          : [];

        return {
          title: section?.title || 'Checklist',
          items
        };
      })
      .filter((section) => section.items.length > 0);
  }

  getChecklistRows(sections = []) {
    const rows = [];

    sections.forEach((section) => {
      rows.push({
        isSection: true,
        label: section.title,
        mark: '',
        remarks: ''
      });

      section.items.forEach((item) => {
        rows.push({
          isSection: false,
          label: item.label,
          mark: item.checked ? '/' : '',
          remarks: item.remarks || ''
        });
      });
    });

    return rows;
  }

  async generate(payload) {
    const sections = this.normalizeSections(payload.checklistSections || []);

    if (!sections.length) {
      throw new Error('Checklist sections are required');
    }

    const hasUnchecked = sections.some((section) => section.items.some((item) => !item.checked));
    if (hasUnchecked) {
      throw new Error('All UAT checklist items must be checked before submission');
    }

    const generatedAtIso = new Date().toISOString();
    const documentId = payload.documentId || this.createDocumentId();
    const verificationCode = this.generateVerificationCode({
      ...payload,
      documentId,
      generatedAtIso
    });
    const verificationUrl = `${this.getVerificationBaseUrl().replace(/\/+$/, '')}/api/v1/uat/verify/${encodeURIComponent(documentId)}`;

    const mitracorpLogoBase64 = this.getMitracorpLogoBase64();
    const projectBranding = await this.getProjectBrandingByAssetId(payload.asset?.Asset_ID);
    const projectLogoBase64 = this.getProjectLogoBase64(projectBranding.logoPath);
    const staffSignatureBase64 = this.getStaffSignatureBase64(payload.submittedBySignPath);

    const templateData = {
      contractNo: payload.contractNo || '-',
      formTitle: payload.formTitle || 'USER ACCEPTANCE TEST (UAT) FORM',
      categoryTitle: payload.categoryTitle || payload.asset?.Category || 'UAT',
      declarationText: 'This is a computer-generated document and does not require a physical signature.',
      documentId,
      generatedTimestamp: this.formatTimestamp(generatedAtIso),
      verificationCode,
      companyFullName: projectBranding.companyFullName || payload.asset?.Customer_Name || '-',
      recipientName: payload.recipient?.name || '-',
      recipientDepartment: payload.recipient?.department || '-',
      recipientContact: payload.recipient?.contact || '-',
      submittedByDepartment: payload.submittedByDepartment || '-',
      hardwareTitle: payload.asset?.Item_Name || '-',
      model: payload.asset?.Model || '-',
      accessories: payload.asset?.accessories || '-',
      assetTag: payload.asset?.Asset_Tag_ID || '-',
      serialNumber: payload.asset?.Asset_Serial_Number || '-',
      signedAt: this.formatDate(payload.signedAt),
      submittedBy: payload.submittedBy || '-',
      checklistRows: this.getChecklistRows(sections),
      signature: payload.signature || '',
      staffSignature: staffSignatureBase64,
      mitracorpLogoBase64,
      projectLogoBase64
    };

    const templateHtml = await fs.readFile(this.templatePath, 'utf8');
    const template = handlebars.compile(templateHtml);
    const html = template(templateData);

    const safeDocumentId = this.sanitizeForFilename(documentId || 'UAT');
    const safeAssetId = this.sanitizeForFilename(payload.asset?.Asset_ID || 'ASSET');
    const filename = `UAT_${safeDocumentId}_ASSET_${safeAssetId}.pdf`;
    const absolutePath = path.join(this.outputDir, filename);

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
      timeout: 30000,
      httpTimeout: 30000,
      base: `file://${path.join(__dirname, '../')}/`,
      phantomArgs: ['--web-security=no', '--local-url-access=true', '--ignore-ssl-errors=yes']
    };

    await new Promise((resolve, reject) => {
      pdf.create(html, options).toFile(absolutePath, (err) => {
        if (err) return reject(err);
        return resolve();
      });
    });

    if (!fsSync.existsSync(absolutePath)) {
      throw new Error('Failed to generate UAT PDF file');
    }

    await this.recordDocument({
      documentId,
      verificationCode,
      generatedAt: generatedAtIso,
      contractNo: payload.contractNo || '-',
      customerName: payload.asset?.Customer_Name || '-',
      branch: payload.asset?.Branch || '-',
      category: payload.asset?.Category || '-',
      itemName: payload.asset?.Item_Name || '-',
      model: payload.asset?.Model || '-',
      assetId: payload.asset?.Asset_ID || null,
      serialNumber: payload.asset?.Asset_Serial_Number || '-',
      tagId: payload.asset?.Asset_Tag_ID || '-',
      submittedBy: payload.submittedBy || '-',
      submittedByDepartment: payload.submittedByDepartment || '-',
      recipientName: payload.recipient?.name || '-',
      recipientDepartment: payload.recipient?.department || '-',
      fileName: filename
    });

    return {
      filename,
      absolutePath,
      documentId,
      generatedTimestamp: this.formatTimestamp(generatedAtIso),
      verificationUrl,
      verificationCode
    };
  }
}

module.exports = new UATPdfGenerator();
