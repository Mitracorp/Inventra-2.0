const express = require('express');
const { getUserProfile, updateUserProfile, updatePassword } = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Protected routes - require authentication
router.get('/me', authenticateToken, getUserProfile);
router.put('/update', authenticateToken, updateUserProfile);
router.put('/change-password', authenticateToken, updatePassword);

module.exports = router;