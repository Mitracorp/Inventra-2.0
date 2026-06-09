const express = require('express');
const router = express.Router();

// Basic root route for API
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Inventra API root' });
});

// Attempt to mount other route modules if they exist
try {
  const fs = require('fs');
  const path = require('path');
  const files = fs.readdirSync(__dirname);
  files.forEach((file) => {
    if (file === 'index.js') return;
    const modPath = path.join(__dirname, file);
    try {
      const mod = require(modPath);
      // Mount the module by filename (without extension). Many route files
      // export an express Router (callable) or an object — just attempt to mount
      const name = path.basename(file, path.extname(file));
      router.use(`/${name}`, mod);
    } catch (e) {
      // ignore individual route load errors
    }
  });
} catch (e) {
  // ignore
}

module.exports = router;
