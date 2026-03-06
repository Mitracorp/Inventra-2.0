const logger = require('../utils/logger');
const { formatResponse } = require('../utils/helpers');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(`Error ${err.message}`, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Invalid resource ID';
    error = { message, statusCode: 400 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // MySQL errors
  if (err.code) {
    switch (err.code) {
      case 'ER_DUP_ENTRY':
        error = { message: 'Duplicate entry', statusCode: 400 };
        break;
      case 'ER_BAD_FIELD_ERROR':
        error = { message: 'Invalid field', statusCode: 400 };
        break;
      case 'ER_NO_SUCH_TABLE':
        error = { message: 'Table not found', statusCode: 500 };
        break;
      case 'ER_ACCESS_DENIED_ERROR':
        error = { message: 'Database access denied', statusCode: 500 };
        break;
      default:
        error = { message: 'Database error', statusCode: 500 };
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = { message: 'Invalid token', statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    error = { message: 'Token expired', statusCode: 401 };
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  res.status(statusCode).json(
    formatResponse(false, null, message, {
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    })
  );
};

module.exports = errorHandler;