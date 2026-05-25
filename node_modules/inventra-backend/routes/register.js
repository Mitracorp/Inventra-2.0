const express = require('express');
const { registerUser, getUsers } = require('../controllers/registerController');

const router = express.Router();

// Registration routes
router.post("/register", registerUser);
router.get("/users", getUsers);

module.exports = router;
