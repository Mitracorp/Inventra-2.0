/**
 * Import Session Cache for Deduplication
 * 
 * This utility manages a session-based cache to track first occurrences of
 * models, categories, Windows versions, MS Office versions, and software
 * during bulk imports. This ensures that only the first occurrence of each
 * new attribute is accepted and subsequent duplicates reuse the existing entry.
 */

class ImportCache {
  constructor() {
    this.models = new Map(); // Map<lowercaseName, {id, originalName}>
    this.categories = new Map(); // Map<lowercaseName, {id, originalName}>
    this.windowsVersions = new Map(); // Map<lowercaseName, originalName>
    this.msOfficeVersions = new Map(); // Map<lowercaseName, originalName>
    this.software = new Map(); // Map<lowercaseName, {id, originalName}>
  }

  /**
   * Add a model to the cache
   * @param {string} modelName - The model name
   * @param {number} modelId - The database ID
   * @returns {boolean} - True if this is the first occurrence
   */
  addModel(modelName, modelId) {
    const key = modelName.toLowerCase().trim();
    if (this.models.has(key)) {
      return false; // Already exists
    }
    this.models.set(key, { id: modelId, originalName: modelName.trim() });
    return true;
  }

  /**
   * Check if a model exists in cache
   * @param {string} modelName - The model name to check
   * @returns {{exists: boolean, id?: number, originalName?: string}}
   */
  hasModel(modelName) {
    const key = modelName.toLowerCase().trim();
    const cached = this.models.get(key);
    if (cached) {
      return { exists: true, id: cached.id, originalName: cached.originalName };
    }
    return { exists: false };
  }

  /**
   * Add a category to the cache
   * @param {string} categoryName - The category name
   * @param {number} categoryId - The database ID
   * @returns {boolean} - True if this is the first occurrence
   */
  addCategory(categoryName, categoryId) {
    const key = categoryName.toLowerCase().trim();
    if (this.categories.has(key)) {
      return false;
    }
    this.categories.set(key, { id: categoryId, originalName: categoryName.trim() });
    return true;
  }

  /**
   * Check if a category exists in cache
   * @param {string} categoryName - The category name to check
   * @returns {{exists: boolean, id?: number, originalName?: string}}
   */
  hasCategory(categoryName) {
    const key = categoryName.toLowerCase().trim();
    const cached = this.categories.get(key);
    if (cached) {
      return { exists: true, id: cached.id, originalName: cached.originalName };
    }
    return { exists: false };
  }

  /**
   * Add a Windows version to the cache
   * @param {string} version - The Windows version
   * @returns {boolean} - True if this is the first occurrence
   */
  addWindows(version) {
    const key = version.toLowerCase().trim();
    if (this.windowsVersions.has(key)) {
      return false;
    }
    this.windowsVersions.set(key, version.trim());
    return true;
  }

  /**
   * Check if a Windows version exists in cache
   * @param {string} version - The Windows version to check
   * @returns {{exists: boolean, originalName?: string}}
   */
  hasWindows(version) {
    const key = version.toLowerCase().trim();
    const cached = this.windowsVersions.get(key);
    if (cached) {
      return { exists: true, originalName: cached };
    }
    return { exists: false };
  }

  /**
   * Add a Microsoft Office version to the cache
   * @param {string} version - The MS Office version
   * @returns {boolean} - True if this is the first occurrence
   */
  addMsOffice(version) {
    const key = version.toLowerCase().trim();
    if (this.msOfficeVersions.has(key)) {
      return false;
    }
    this.msOfficeVersions.set(key, version.trim());
    return true;
  }

  /**
   * Check if a MS Office version exists in cache
   * @param {string} version - The MS Office version to check
   * @returns {{exists: boolean, originalName?: string}}
   */
  hasMsOffice(version) {
    const key = version.toLowerCase().trim();
    const cached = this.msOfficeVersions.get(key);
    if (cached) {
      return { exists: true, originalName: cached };
    }
    return { exists: false };
  }

  /**
   * Add software to the cache
   * @param {string} softwareName - The software name
   * @param {number} softwareId - The database ID
   * @returns {boolean} - True if this is the first occurrence
   */
  addSoftware(softwareName, softwareId) {
    const key = softwareName.toLowerCase().trim();
    if (this.software.has(key)) {
      return false;
    }
    this.software.set(key, { id: softwareId, originalName: softwareName.trim() });
    return true;
  }

  /**
   * Check if software exists in cache
   * @param {string} softwareName - The software name to check
   * @returns {{exists: boolean, id?: number, originalName?: string}}
   */
  hasSoftware(softwareName) {
    const key = softwareName.toLowerCase().trim();
    const cached = this.software.get(key);
    if (cached) {
      return { exists: true, id: cached.id, originalName: cached.originalName };
    }
    return { exists: false };
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.models.clear();
    this.categories.clear();
    this.windowsVersions.clear();
    this.msOfficeVersions.clear();
    this.software.clear();
  }

  /**
   * Get cache statistics
   * @returns {object} - Statistics about cached items
   */
  getStats() {
    return {
      models: this.models.size,
      categories: this.categories.size,
      windowsVersions: this.windowsVersions.size,
      msOfficeVersions: this.msOfficeVersions.size,
      software: this.software.size,
      total: this.models.size + this.categories.size + 
             this.windowsVersions.size + this.msOfficeVersions.size + 
             this.software.size
    };
  }
}

module.exports = ImportCache;
