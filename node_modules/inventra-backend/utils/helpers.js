const jwt = require('jsonwebtoken');
const logger = require('./logger');

const formatResponse = (success, data = null, message = '', meta = undefined) => {
  const payload = { success };
  if (data !== undefined) payload.data = data;
  if (message) payload.message = message;
  if (meta !== undefined) payload.meta = meta;
  return payload;
};

const generateToken = (payload, expiresIn = '8h') => {
  const secret = process.env.JWT_SECRET || 'dev_secret';
  try {
    return jwt.sign(payload, secret, { expiresIn });
  } catch (e) {
    logger.error('Failed to generate JWT:', e);
    throw e;
  }
};

module.exports = {
  formatResponse,
  generateToken
};
