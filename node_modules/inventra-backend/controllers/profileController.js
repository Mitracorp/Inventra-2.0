const { executeQuery } = require('../config/database');
const bcrypt = require('bcryptjs');

const getUserProfile = async (req, res) => {
    try {
        // Get user profile from database
        const user = await executeQuery(
            'SELECT user_id, full_name, username, email, role FROM users WHERE user_id = ?',
            [req.user.id]
        );

        if (!user || user.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user[0]);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateUserProfile = async (req, res) => {
    const { full_name, email } = req.body;

    try {
        // Update user profile
        await executeQuery(
            'UPDATE users SET full_name = ?, email = ? WHERE user_id = ?',
            [full_name, email, req.user.id]
        );

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updatePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        // Get user's current password hash
        const [user] = await executeQuery(
            'SELECT password_hash FROM users WHERE user_id = ?',
            [req.user.id]
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await executeQuery(
            'UPDATE users SET password_hash = ? WHERE user_id = ?',
            [hashedPassword, req.user.id]
        );

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getUserProfile,
    updateUserProfile,
    updatePassword
};