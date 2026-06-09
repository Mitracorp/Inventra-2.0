const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/microsoft', authController.microsoftLogin);

router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile', authenticateToken, authController.updateProfile);
router.post('/change-password', authenticateToken, authController.changePassword);

// Admin user management
router.get('/users', authenticateToken, authController.getAllUsers);
router.post('/users', authenticateToken, authController.createUser);
router.put('/users/:userId', authenticateToken, authController.updateUser);
router.delete('/users/:userId', authenticateToken, authController.deleteUser);

module.exports = router;
