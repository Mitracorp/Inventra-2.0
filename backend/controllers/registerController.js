const { executeQuery } = require("../config/database");
const bcrypt = require("bcryptjs");

const registerUser = async (req, res) => {
  const { full_name, username, email, password, role } = req.body;

  if (!full_name || !username || !email || !password || !role) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    // Check if email or username already exists
    const existingUsers = await executeQuery(
      "SELECT * FROM users WHERE email = ? OR username = ?",
      [email, username]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: "Email or username already registered." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    await executeQuery(
      "INSERT INTO users (full_name, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)",
      [full_name, username, email, hashedPassword, role]
    );

    res.status(201).json({ message: "User registered successfully!" });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: "Server error." });
  }
};

const getUsers = async (req, res) => {
  try {
    const results = await executeQuery(
      "SELECT id, full_name, username, email, role FROM users"
    );
    res.status(200).json(results);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: "Database fetch error." });
  }
};

module.exports = {
  registerUser,
  getUsers
};

