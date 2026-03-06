/**
 * HeaderMapper - Flexible header mapping system for Excel/CSV imports
 * 
 * FEATURES:
 * - Automatically maps user headers to standard field names
 * - Supports multiple header variations (case-insensitive, with/without spaces)
 * - Intelligent fuzzy matching using keywords
 * - Validation to ensure all required fields are mapped
 * - Manual mapping correction capability
 * - Duplicate detection
 * 
 * USAGE EXAMPLE:
 * ```javascript
 * // 1. Get user headers from uploaded file
 * const userHeaders = Object.keys(excelData[0]);
 * // Example: ["Serial Number", "Project Ref", "Asset Tag", "Item Name"]
 * 
 * // 2. Map headers automatically
 * const result = HeaderMapper.mapHeaders(userHeaders);
 * // Returns: {
 * //   mapping: { "Serial Number": "serial_number", "Project Ref": "project_reference_num", ... },
 * //   unmapped: [],
 * //   duplicates: [],
 * //   standardFields: ["serial_number", "project_reference_num", ...]
 * // }
 * 
 * // 3. Validate mapping
 * const validation = HeaderMapper.validateMapping(result.mapping);
 * // Returns: { isValid: true, missingRequired: [] }
 * 
 * // 4. Transform data using mapping
 * const transformedData = HeaderMapper.transformData(excelData, result.mapping);
 * // Now data uses standard field names
 * ```
 * 
 * SUPPORTED HEADER VARIATIONS:
 * - serial_number: "Serial Number", "Serial No", "Asset Serial", etc.
 * - project_reference_num: "Project Ref", "Project ID", "Project Number", etc.
 * - tag_id: "Asset Tag", "Tag", "Tag Number", etc.
 * - item_name: "Asset Name", "Item", "Equipment Name", etc.
 * - And many more...
 */

class HeaderMapper {
  static headerMappings = {
    // serial_number variations
    'serial_number': [
      'serial_number', 'serial number', 'serial no', 'serial',
      'serial #', 'asset serial', 'asset serial number',
      'serial_num', 'ser_no', 'sno', 'serialnumber', 'assetserialnumber'
    ],
    
    // project_ref_num variations (matches database field Project_Ref_Number)
    'project_ref_num': [
      'project_ref_num', 'project ref num', 'project ref',
      'project reference', 'project id', 'project no', 'project number',
      'project_ref', 'proj_ref', 'project reference number',
      'projectreferencenumber', 'projectref', 'projectid',
      'project reference num', 'project_reference_num'
    ],
    
    // project_title variations
    'project_title': [
      'project_title', 'project title', 'project name', 'project',
      'title', 'project_name', 'projecttitle', 'projectname',
      'project description', 'project desc'
    ],
    
    // tag_id variations
    'tag_id': [
      'tag_id', 'tag id', 'asset tag', 'tag', 'asset tag id',
      'tag number', 'asset tag number', 'tag_no', 'asset_tag',
      'tagid', 'assettag', 'tagnumber'
    ],
    
    // item_name variations
    'item_name': [
      'item_name', 'item name', 'asset name', 'item',
      'equipment name', 'device name', 'asset_name', 'equipment',
      'itemname', 'assetname', 'equipmentname', 'devicename'
    ],
    
    // category variations
    'category': [
      'category', 'asset category', 'type', 'equipment type',
      'category type', 'asset type', 'equipment category',
      'assetcategory', 'equipmenttype', 'assettype'
    ],
    
    // model variations
    'model': [
      'model', 'model name', 'model number', 'device model',
      'equipment model', 'model_name', 'model_number',
      'modelname', 'modelnumber', 'devicemodel'
    ],
    
    // status variations
    'status': [
      'status', 'asset status', 'condition', 'status type',
      'state', 'asset_status', 'assetstatus', 'assetcondition'
    ],
    
    // recipient_name variations
    'recipient_name': [
      'recipient_name', 'recipient name', 'assigned to', 'user',
      'owner', 'holder', 'assigned user', 'recipient',
      'recipientname', 'assignedto', 'assigneduser', 'username'
    ],
    
    // department variations (maps to Department in RECIPIENTS table)
    'department': [
      'department', 'department_name', 'department name', 'dept',
      'unit', 'division', 'team', 'departmentname', 'dept_name'
    ],
    
    // Alternative department_name mapping (for explicit department_name columns)
    'department_name': [
      'department_name', 'department name', 'dept name', 'deptname'
    ],
    
    // peripheral_name variations
    'peripheral_name': [
      'peripheral_name', 'peripheral name', 'peripheral', 'accessory',
      'component', 'attached device', 'peripheralname',
      'accessories', 'components', 'peripheal' // Common typo
    ],
    
    // serial_code variations (maps to Serial_Code in PERIPHERAL table)
    'serial_code': [
      'serial_code', 'serial code', 'peripheral serial',
      'accessory serial', 'component serial', 'peripheral_serial',
      'serialcode', 'peripheralserial', 'serial_code_name',
      'serial code name', 'serialcodename', 'peripheral serial number',
      'peripheral_serial_number', 'accessory serial number'
    ],
    
    // remarks variations
    'remarks': [
      'remarks', 'notes', 'comments', 'description',
      'additional info', 'remark', 'note', 'comment',
      'additionalinfo', 'desc', 'additional_info'
    ],
    
    // customer_name variations
    'customer_name': [
      'customer_name', 'customer name', 'customer', 'client',
      'client name', 'customername', 'clientname'
    ],
    
    // customer_reference_number variations
    'customer_reference_number': [
      'customer_reference_number', 'customer reference number',
      'customer ref', 'customer reference', 'customer ref no',
      'customer ref num', 'customer ref number', 'cust ref num',
      'cust ref number', 'cust reference number', 'client ref num',
      'client ref number', 'client reference number',
      'customerreferencenumber', 'customerrefnum', 'customerref', 
      'clientref', 'clientrefnum', 'customer_ref_num', 'customer_ref_number',
      'cust_ref_num', 'client_ref_num'
    ],
    
    // branch variations
    'branch': [
      'branch', 'branch name', 'location', 'site',
      'office', 'branchname', 'branchlocation'
    ],
    
    // antivirus variations
    'antivirus': [
      'antivirus', 'anti virus', 'anti-virus', 'av',
      'antivirus software', 'virus protection', 'av software',
      'antivirussoftware', 'virusprotection'
    ],
    
    // windows variations
    'windows': [
      'windows', 'windows os', 'windows version', 'os',
      'operating system', 'windowsos', 'windowsversion',
      'windows operating system', 'microsoft windows'
    ],
    
    // microsoft_office variations
    'microsoft_office': [
      'microsoft_office', 'microsoft office', 'ms office', 'office',
      'office version', 'office suite', 'msoffice', 'officeversion',
      'microsoft_office_version', 'ms_office', 'office_suite'
    ],
    
    // software variations
    'software': [
      'software', 'installed software', 'applications', 'apps',
      'software list', 'installed apps', 'installedsoftware',
      'softwarelist', 'application software'
    ],
    
    // specifications variations
    'specifications': [
      'specifications', 'specs', 'spec', 'technical specs',
      'technical specifications', 'hardware specs', 'system specs',
      'techspecs', 'technicalspecifications', 'hardwarespecs'
    ],
    
    // warranty variations
    'warranty': [
      'warranty', 'warranty info', 'warranty period', 'warranty status',
      'warranty expiry', 'warranty date', 'warrantyinfo',
      'warrantyperiod', 'warranty_expiry', 'warranty_date'
    ],
    
    // preventive_maintenance variations
    'preventive_maintenance': [
      'preventive_maintenance', 'preventive maintenance', 'pm',
      'maintenance', 'pm schedule', 'maintenance schedule',
      'preventivemaintenance', 'pmschedule', 'maintenanceschedule',
      'preventative maintenance', 'preventive_maintenance_schedule'
    ],
    
    // start_date variations
    'start_date': [
      'start_date', 'start date', 'date start', 'start',
      'begin date', 'start_dt', 'startdate', 'datestart',
      'beginning date', 'commencement date'
    ],
    
    // end_date variations
    'end_date': [
      'end_date', 'end date', 'date end', 'end',
      'finish date', 'end_dt', 'enddate', 'dateend',
      'expiry date', 'completion date', 'expiration date'
    ],
    
    // position variations
    'position': [
      'position', 'job position', 'job title', 'title',
      'role', 'designation', 'jobtitle', 'jobposition',
      'employee position', 'employee title'
    ],
    
    // monthly_price variations
    'monthly_prices': [
      'monthly_prices', 'monthly_price', 'monthly price', 'price per month', 'monthly cost',
      'monthly rate', 'monthly fee', 'monthlyprice', 'monthlycost', 'monthlyfee',
      'monthly_cost', 'monthly_rate', 'monthly_fee', 'price/month', 'monthly_pricing'
    ],
    
    // software_prices variations
    'software_prices': [
      'software_prices', 'software prices', 'software price', 'software cost',
      'software costs', 'software pricing', 'softwareprices', 'softwarecost',
      'software_cost', 'software_pricing', 'license cost', 'license price'
    ]
  };

  /**
   * Normalize header string for comparison
   * Removes spaces, special characters, converts to lowercase
   */
  static normalizeHeader(header) {
    if (!header) return '';
    
    return String(header)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Remove all special chars and spaces
      .trim();
  }

  /**
   * Get keywords for a standard field to help with fuzzy matching
   */
  static getKeywords(field) {
    const keywordMap = {
      'serial_number': ['serial', 'sno', 'ser'],
      'project_ref_num': ['project', 'ref', 'reference', 'proj'],
      'project_title': ['project', 'title', 'name'],
      'tag_id': ['tag', 'asset'],
      'item_name': ['item', 'asset', 'name', 'equipment', 'device'],
      'category': ['categor', 'type'],
      'model': ['model'],
      'status': ['status', 'condition', 'state'],
      'recipient_name': ['recipient', 'assign', 'user', 'owner'],
      'department': ['department', 'dept', 'unit'],
      'peripheral_name': ['peripheral', 'accessory', 'component'],
      'serial_code': ['serial', 'code'],
      'remarks': ['remark', 'note', 'comment'],
      'customer_name': ['customer', 'client'],
      'customer_reference_number': ['customer', 'client', 'cust'],
      'branch': ['branch', 'location', 'site'],
      'antivirus': ['antivirus', 'anti', 'virus', 'av'],
      'windows': ['windows', 'os', 'operating'],
      'microsoft_office': ['microsoft', 'office', 'ms'],
      'software': ['software', 'apps', 'applications'],
      'specifications': ['spec', 'technical', 'hardware'],
      'warranty': ['warranty', 'guarantee'],
      'preventive_maintenance': ['maintenance', 'pm', 'preventive'],
      'start_date': ['start', 'begin', 'commence'],
      'end_date': ['end', 'finish', 'expir'],
      'position': ['position', 'title', 'role', 'job'],
      'monthly_prices': ['monthly', 'price', 'cost', 'rate', 'pricing'],
      'software_prices': ['software', 'price', 'cost', 'license']
    };
    
    return keywordMap[field] || [field];
  }

  /**
   * Find matching standard field for a user header
   */
  static findMatchingField(userHeader) {
    if (!userHeader) return null;
    
    const normalized = this.normalizeHeader(userHeader);
    
    // Try exact match first
    for (const [standardField, variations] of Object.entries(this.headerMappings)) {
      const normalizedVariations = variations.map(v => this.normalizeHeader(v));
      
      if (normalizedVariations.includes(normalized)) {
        return standardField;
      }
    }
    
    // Try keyword matching as fallback (only if exact match fails)
    // Score each field based on keyword matches to find best match
    let bestMatch = null;
    let bestScore = 0;
    
    for (const [standardField, variations] of Object.entries(this.headerMappings)) {
      const keywords = this.getKeywords(standardField);
      
      // Count how many keywords match
      const matchCount = keywords.filter(keyword => 
        normalized.includes(keyword)
      ).length;
      
      // Only consider if at least 70% of keywords match (increased from 50%)
      const matchThreshold = keywords.length * 0.7;
      if (matchCount > 0 && matchCount >= matchThreshold) {
        if (matchCount > bestScore) {
          bestScore = matchCount;
          bestMatch = standardField;
        }
      }
    }
    
    return bestMatch; // Return best match or null
  }

  /**
   * Map all user headers to standard field names
   * Returns mapping object and list of unmapped headers
   */
  static mapHeaders(userHeaders) {
    const mapping = {};
    const unmapped = [];
    const duplicates = new Set();
    const duplicateDetails = {}; // Track which headers map to duplicated fields
    const usedStandardFields = new Map(); // Track which user header first used each standard field
    
    userHeaders.forEach(userHeader => {
      const standardField = this.findMatchingField(userHeader);
      
      if (standardField) {
        // Check for duplicate mappings
        if (usedStandardFields.has(standardField)) {
          duplicates.add(standardField);
          // Track the duplicate details for debugging
          if (!duplicateDetails[standardField]) {
            duplicateDetails[standardField] = [usedStandardFields.get(standardField)];
          }
          duplicateDetails[standardField].push(userHeader);
        } else {
          usedStandardFields.set(standardField, userHeader);
        }
        
        mapping[userHeader] = standardField;
      } else {
        unmapped.push(userHeader);
      }
    });
    
    return { 
      mapping, 
      unmapped,
      duplicates: Array.from(duplicates),
      duplicateDetails, // Include details about which user headers caused duplicates
      standardFields: Array.from(usedStandardFields.keys())
    };
  }

  /**
   * Transform data using header mapping
   */
  static transformData(data, headerMapping) {
    return data.map(row => {
      const transformedRow = {};
      
      Object.keys(row).forEach(originalHeader => {
        const standardField = headerMapping[originalHeader];
        
        if (standardField) {
          // Use standard field name
          transformedRow[standardField] = row[originalHeader];
        } else {
          // Keep original header if no mapping found
          transformedRow[originalHeader] = row[originalHeader];
        }
      });
      
      return transformedRow;
    });
  }

  /**
   * Get required fields for validation
   */
  static getRequiredFields() {
    return ['project_ref_num', 'serial_number', 'tag_id', 'item_name'];
  }

  /**
   * Get all supported standard field names
   */
  static getStandardFields() {
    return Object.keys(this.headerMappings);
  }

  /**
   * Check if mapping is valid (all required fields are mapped)
   */
  static validateMapping(mapping) {
    const requiredFields = this.getRequiredFields();
    const mappedStandardFields = Object.values(mapping);
    
    const missingRequired = requiredFields.filter(
      field => !mappedStandardFields.includes(field)
    );
    
    return {
      isValid: missingRequired.length === 0,
      missingRequired
    };
  }

  /**
   * Get mapping suggestions for unmapped headers
   */
  static getSuggestions(unmappedHeader) {
    const normalized = this.normalizeHeader(unmappedHeader);
    const suggestions = [];
    
    // Find fields with partial matches
    for (const [standardField, variations] of Object.entries(this.headerMappings)) {
      const keywords = this.getKeywords(standardField);
      
      // Check if any keyword is contained in the unmapped header
      const hasPartialMatch = keywords.some(keyword => 
        normalized.includes(keyword) || keyword.includes(normalized)
      );
      
      if (hasPartialMatch) {
        suggestions.push(standardField);
      }
    }
    
    return suggestions;
  }
}

export default HeaderMapper;
