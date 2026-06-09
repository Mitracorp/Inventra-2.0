const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  try {
    logger.error('Unhandled error:', err && err.stack ? err.stack : err);
  } catch (e) {
    console.error('Logger failed in errorHandler:', e);
  }

  const status = err && err.status ? err.status : 500;
  const message = err && err.message ? err.message : 'Internal Server Error';

  if (res.headersSent) return next(err);

  res.status(status).json({
    success: false,
    error: message,
    details: process.env.NODE_ENV === 'production' ? undefined : (err && err.stack ? err.stack : undefined)
  });
};
