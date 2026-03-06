const jwt = require('jsonwebtoken');
const { formatResponse } = require('../utils/helpers');
const { executeQuery } = require('../config/database');
const db = require('../config/database');

/**
 * Middleware to authenticate JWT tokens and set MySQL session user ID
 */
const authenticateToken = async (req, res, next) => {
  try {
    console.log('=== AUTH MIDDLEWARE DEBUG ===');
    console.log('Request URL:', req.url);
    console.log('Request method:', req.method);
    console.log('All headers:', req.headers);
    
    const authHeader = req.headers.authorization;
    console.log('Auth header:', authHeader);
    
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    console.log('Extracted token:', token ? token.substring(0, 20) + '...' + token.substring(token.length - 20) : 'No token');

    if (!token) {
      console.log('No token provided');
      return res.status(401).json(
        formatResponse(false, null, 'Access token required')
      );
    }

    console.log('Attempting to verify token with JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded successfully:', decoded);
    
    // Optional: Verify user still exists in database
    console.log('Checking user in database with ID:', decoded.userId);
    const user = await executeQuery(
      'SELECT User_ID, username, User_Email, User_Role FROM USER WHERE User_ID = ?',
      [decoded.userId]
    );
    console.log('Database user query result:', user);

    if (user.length === 0) {
      console.log('User not found in database');
      return res.status(401).json(
        formatResponse(false, null, 'Invalid token - user not found')
      );
    }

    // Set MySQL session variable for database triggers
    try {
      await db.pool.execute('SET @current_user_id = ?', [decoded.userId]);
      console.log('Set @current_user_id to:', decoded.userId);
    } catch (error) {
      console.error('Error setting @current_user_id:', error);
      // Continue even if this fails - non-critical for authentication
    }

    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role
    };

    console.log('Authentication successful for user:', req.user);
    next();
  } catch (error) {
    console.log('Authentication error:', error.message);
    console.log('Error stack:', error.stack);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json(
        formatResponse(false, null, 'Token expired')
      );
    }
    
    return res.status(401).json(
      formatResponse(false, null, 'Invalid token')
    );
  }
};

/**
 * Middleware to check user roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(
        formatResponse(false, null, 'Authentication required')
      );
    }

    // Case-insensitive role comparison
    const userRole = req.user.role.toLowerCase();
    const allowedRoles = roles.map(role => role.toLowerCase());
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json(
        formatResponse(false, null, 'Insufficient permissions')
      );
    }

    next();
  };
};

/**
 * Optional authentication - sets user if token is valid but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = {
        userId: decoded.userId,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role
      };
    }

    next();
  } catch (error) {
    // Token invalid, but continue without user
    next();
  }
};

/**
 * Middleware to require admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(
      formatResponse(false, null, 'Authentication required')
    );
  }

  if (req.user.role.toLowerCase() !== 'admin') {
    return res.status(403).json(
      formatResponse(false, null, 'Admin access required')
    );
  }

  next();
};

module.exports = {
  authenticateToken,
  authorize,
  optionalAuth,
  requireAdmin
};