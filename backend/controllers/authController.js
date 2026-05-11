const User = require('../models/User');
const { formatResponse, generateToken } = require('../utils/helpers');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const fs = require('fs');
const path = require('path');

const azureJwksClient = jwksClient({
  jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
  cache: true,
  cacheMaxEntries: 10,
  cacheMaxAge: 10 * 60 * 1000,
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

const getAzureSigningKey = (header, callback) => {
  if (!header || !header.kid) {
    return callback(new Error('Missing token key id'));
  }

  azureJwksClient.getSigningKey(header.kid, (error, key) => {
    if (error) {
      return callback(error);
    }

    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
};

/**
 * User registration
 */
const register = async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName, department, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json(
        formatResponse(false, null, 'User with this email already exists')
      );
    }

    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res.status(400).json(
        formatResponse(false, null, 'Username already taken')
      );
    }

    // Create user
    const userId = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      department: department || '',
      role: role || 'user'
    });

    const newUser = await User.findById(userId);
    
    // Generate JWT token
    const token = generateToken({
      userId: newUser.userId,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role
    });

    logger.info(`User registered: ${email}`);

    res.status(201).json(
      formatResponse(true, {
        user: newUser,
        token
      }, 'User registered successfully')
    );
  } catch (error) {
    logger.error('Error in register:', error);
    next(error);
  }
};

/**
 * User login
 */
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Verify user credentials
    const user = await User.verifyPasswordByUsername(username, password);
    if (!user) {
      return res.status(401).json(
        formatResponse(false, null, 'Invalid username or password')
      );
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: user.role
    });

    logger.info(`User logged in: ${username}`);

    res.status(200).json(
      formatResponse(true, {
        user,
        token
      }, 'Login successful')
    );
  } catch (error) {
    logger.error('Error in login:', error);
    next(error);
  }
};

/**
 * Microsoft Azure login (OIDC ID token exchange)
 */
const microsoftLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    const azureClientId = process.env.AZURE_CLIENT_ID;

    if (!azureClientId) {
      return res.status(500).json(
        formatResponse(false, null, 'Azure login is not configured on the server')
      );
    }

    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json(
        formatResponse(false, null, 'Microsoft ID token is required')
      );
    }

    const verifiedPayload = await new Promise((resolve, reject) => {
      jwt.verify(
        idToken,
        getAzureSigningKey,
        {
          algorithms: ['RS256'],
          audience: azureClientId,
          clockTolerance: 5
        },
        (error, payload) => {
          if (error) {
            return reject(error);
          }
          resolve(payload);
        }
      );
    });

    const issuer = verifiedPayload.iss || '';
    const issuerIsAllowed = /^https:\/\/login\.microsoftonline\.com\/[a-zA-Z0-9-]+\/v2\.0$/.test(issuer);
    if (!issuerIsAllowed) {
      return res.status(401).json(
        formatResponse(false, null, 'Invalid Microsoft token issuer')
      );
    }

    const email = (verifiedPayload.preferred_username || verifiedPayload.email || verifiedPayload.upn || '').toLowerCase();
    if (!email) {
      return res.status(400).json(
        formatResponse(false, null, 'Microsoft account email is missing from token')
      );
    }

    let user = await User.findByEmail(email);
    const autoProvisionEnabled = String(process.env.AZURE_AUTO_PROVISION_USERS || 'false').toLowerCase() === 'true';

    if (!user && autoProvisionEnabled) {
      const firstName = verifiedPayload.given_name || 'Microsoft';
      const lastName = verifiedPayload.family_name || 'User';
      const usernameBase = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32) || 'msuser';

      let username = usernameBase;
      let suffix = 1;
      while (await User.findByUsername(username)) {
        username = `${usernameBase}_${suffix}`;
        suffix += 1;
      }

      const randomPassword = `${Math.random().toString(36).slice(-10)}Aa1!`;
      const userId = await User.create({
        username,
        email,
        password: randomPassword,
        firstName,
        lastName,
        department: 'Azure AD',
        role: 'user'
      });

      user = await User.findById(userId);
      logger.info(`Auto-provisioned Azure user: ${email}`);
    }

    if (!user) {
      return res.status(403).json(
        formatResponse(false, null, 'No local account found for this Microsoft email')
      );
    }

    const token = generateToken({
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: user.role
    });

    logger.info(`User logged in with Microsoft: ${email}`);

    return res.status(200).json(
      formatResponse(true, { user, token }, 'Microsoft login successful')
    );
  } catch (error) {
    logger.error('Error in microsoftLogin:', error);
    return res.status(401).json(
      formatResponse(false, null, 'Microsoft authentication failed')
    );
  }
};

/**
 * Get current user profile
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json(
        formatResponse(false, null, 'User not found')
      );
    }

    res.status(200).json(
      formatResponse(true, user, 'Profile retrieved successfully')
    );
  } catch (error) {
    logger.error('Error in getProfile:', error);
    next(error);
  }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, email, department, signature } = req.body;
    const userId = req.user.userId;

    // Check if email is being changed and if it's already taken
    if (email && email !== req.user.email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser && existingUser.userId !== userId) {
        return res.status(400).json(
          formatResponse(false, null, 'Email already in use')
        );
      }
    }

    const profileFields = { firstName, lastName, email, department };
    const hasProfileFieldChanges = Object.values(profileFields).some((value) => value !== undefined);

    if (hasProfileFieldChanges) {
      const success = await User.update(userId, profileFields);

      if (!success) {
        return res.status(400).json(
          formatResponse(false, null, 'Failed to update profile')
        );
      }
    }

    if (signature) {
      try {
        const relativePath = await saveStaffSignature(userId, signature);
        logger.info(`Staff signature updated for user #${userId}: ${relativePath}`);
      } catch (sigErr) {
        return res.status(400).json(
          formatResponse(false, null, sigErr.message || 'Failed to save staff signature')
        );
      }
    }

    const updatedUser = await User.findById(userId);

    logger.info(`Profile updated: ${req.user.email}`);

    res.status(200).json(
      formatResponse(true, updatedUser, 'Profile updated successfully')
    );
  } catch (error) {
    logger.error('Error in updateProfile:', error);
    next(error);
  }
};

/**
 * Change password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Verify current password
    const user = await User.verifyPassword(req.user.email, currentPassword);
    if (!user) {
      return res.status(400).json(
        formatResponse(false, null, 'Current password is incorrect')
      );
    }

    // Update password
    const success = await User.update(userId, {
      password: newPassword
    });

    if (!success) {
      return res.status(400).json(
        formatResponse(false, null, 'Failed to change password')
      );
    }

    logger.info(`Password changed: ${req.user.email}`);

    res.status(200).json(
      formatResponse(true, null, 'Password changed successfully')
    );
  } catch (error) {
    logger.error('Error in changePassword:', error);
    next(error);
  }
};

/**
 * Get all users (admin only)
 */
const getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await User.findAll(page, limit);

    res.status(200).json(
      formatResponse(true, result.users, 'Users retrieved successfully', {
        pagination: result.pagination
      })
    );
  } catch (error) {
    logger.error('Error in getAllUsers:', error);
    next(error);
  }
};

/**
 * Delete user (admin only)
 */
const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { adminPassword } = req.body;

    // Verify admin password
    if (!adminPassword) {
      return res.status(400).json(
        formatResponse(false, null, 'Admin password is required')
      );
    }

    const admin = await User.verifyPassword(req.user.email, adminPassword);
    if (!admin) {
      return res.status(401).json(
        formatResponse(false, null, 'Admin password is incorrect')
      );
    }

    // Prevent self-deletion
    if (parseInt(userId) === req.user.userId) {
      return res.status(400).json(
        formatResponse(false, null, 'Cannot delete your own account')
      );
    }

    const success = await User.delete(userId);
    if (!success) {
      return res.status(404).json(
        formatResponse(false, null, 'User not found')
      );
    }

    logger.info(`User deleted: ${userId} by admin ${req.user.userId}`);

    res.status(200).json(
      formatResponse(true, null, 'User deleted successfully')
    );
  } catch (error) {
    logger.error('Error in deleteUser:', error);
    next(error);
  }
};

/**
 * Create user (admin only)
 */
const createUser = async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName, department, role, signature } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json(
        formatResponse(false, null, 'User with this email already exists')
      );
    }

    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res.status(400).json(
        formatResponse(false, null, 'Username already taken')
      );
    }

    // Validate role is provided
    if (!role) {
      return res.status(400).json(
        formatResponse(false, null, 'Role is required')
      );
    }

    // Create user (use role as-is to support customer names)
    const userId = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      department: department || '',
      role: role
    });

    const newUser = await User.findById(userId);

    // Handle staff signature storage
    try {
      const relativePath = await saveStaffSignature(userId, signature);
      logger.info(`Staff signature saved for user #${userId}: ${relativePath}`);
    } catch (sigErr) {
      logger.error('Error saving staff signature:', sigErr);
      return res.status(400).json(
        formatResponse(false, null, sigErr.message || 'Failed to save staff signature')
      );
    }

    logger.info(`User created by admin ${req.user.userId}: ${email}`);

    res.status(201).json(
      formatResponse(true, newUser, 'User created successfully')
    );
  } catch (error) {
    logger.error('Error in createUser:', error);
    next(error);
  }
};

/**
 * Update user (admin only)
 */
const updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { username, email, firstName, lastName, department, role, adminPassword } = req.body;

    // Verify admin password
    const admin = await User.verifyPassword(req.user.email, adminPassword);
    if (!admin) {
      return res.status(401).json(
        formatResponse(false, null, 'Admin password is incorrect')
      );
    }

    // Prevent self-modification of role
    if (parseInt(userId) === req.user.userId && role && role.toLowerCase() !== req.user.role.toLowerCase()) {
      return res.status(400).json(
        formatResponse(false, null, 'Cannot modify your own role')
      );
    }

    // Get current user data
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json(
        formatResponse(false, null, 'User not found')
      );
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== currentUser.email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser && existingUser.userId !== parseInt(userId)) {
        return res.status(400).json(
          formatResponse(false, null, 'Email already in use')
        );
      }
    }

    // Check if username is being changed and if it's already taken
    if (username && username !== currentUser.username) {
      const existingUsername = await User.findByUsername(username);
      if (existingUsername && existingUsername.userId !== parseInt(userId)) {
        return res.status(400).json(
          formatResponse(false, null, 'Username already taken')
        );
      }
    }

    // Validate role if provided - accept any string to support customer names
    let userRole = currentUser.role;
    if (role) {
      userRole = role; // Use role as-is to support customer names like 'NADMA', 'ILIM', etc.
    }

    // Update user
    const updateData = {
      firstName: firstName || currentUser.firstName,
      lastName: lastName || currentUser.lastName,
      email: email || currentUser.email,
      department: department !== undefined ? department : currentUser.department,
      role: userRole
    };

    // Only update username if provided and different
    if (username && username !== currentUser.username) {
      updateData.username = username;
    }

    const success = await User.update(userId, updateData);

    if (!success) {
      return res.status(400).json(
        formatResponse(false, null, 'Failed to update user')
      );
    }

    const updatedUser = await User.findById(userId);

    logger.info(`User ${userId} updated by admin ${req.user.userId}`);

    res.status(200).json(
      formatResponse(true, updatedUser, 'User updated successfully')
    );
  } catch (error) {
    logger.error('Error in updateUser:', error);
    next(error);
  }
};

/**
 * Verify user password (for critical operations)
 */
const verifyPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    const userId = req.user.userId;
    let username = req.user.username;

    console.log('=== VERIFY PASSWORD DEBUG ===');
    console.log('User ID:', userId);
    console.log('Username from token:', username);
    console.log('Password provided:', password ? 'Yes' : 'No');

    if (!password) {
      return res.status(400).json(
        formatResponse(false, null, 'Password is required')
      );
    }

    // If username not in token, fetch from database using userId
    if (!username) {
      console.log('Username not in token, fetching from database...');
      const user = await User.findById(userId);
      if (!user) {
        console.log('User not found in database');
        return res.status(401).json(
          formatResponse(false, null, 'User not found')
        );
      }
      username = user.username;
      console.log('Username fetched from database:', username);
    }

    // Verify password using username
    console.log('Verifying password for username:', username);
    const user = await User.verifyPasswordByUsername(username, password);
    
    if (!user) {
      console.log('Password verification failed');
      return res.status(401).json(
        formatResponse(false, null, 'Incorrect password')
      );
    }

    console.log('Password verified successfully for user:', username);
    logger.info(`Password verified for user: ${username}`);

    res.status(200).json(
      formatResponse(true, { verified: true }, 'Password verified successfully')
    );
  } catch (error) {
    console.error('Error in verifyPassword:', error);
    logger.error('Error in verifyPassword:', error);
    next(error);
  }
};

module.exports = {
  register,
  login,
  microsoftLogin,
  getProfile,
  updateProfile,
  changePassword,
  getAllUsers,
  deleteUser,
  createUser,
  updateUser,
  verifyPassword
};

const saveStaffSignature = async (userId, signature) => {
  if (!signature || typeof signature !== 'string' || !signature.startsWith('data:image/png;base64,')) {
    throw new Error('Signature must be a Base64 PNG data URL');
  }

  const base64Data = signature.replace(/^data:image\/png;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  const uploadDir = path.join(__dirname, '../uploads/signature-staff');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filename = `signature_staff_${userId}.png`;
  const fullPath = path.join(uploadDir, filename);
  fs.writeFileSync(fullPath, buffer);

  const relativePath = `uploads/signature-staff/${filename}`;
  await User.updateSignPath(userId, relativePath);
  return relativePath;
};