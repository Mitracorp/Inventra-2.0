const express = require('express');
const router = express.Router();

// Simple maintenance endpoints
router.get('/status', (req, res) => {
  res.json({ success: true, message: 'Maintenance OK' });
});

module.exports = router;
