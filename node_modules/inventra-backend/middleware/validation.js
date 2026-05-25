const { validationResult } = require('express-validator');
const { formatResponse } = require('../utils/helpers');

/**
 * Middleware to handle validation results
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json(
      formatResponse(false, null, 'Validation failed', {
        errors: errorMessages
      })
    );
  }

  next();
};

module.exports = {
  handleValidationErrors
};