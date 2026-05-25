const { executeQuery } = require('../config/database');
const { hashPassword, comparePassword, toCamelCase } = require('../utils/helpers');

class User {
  constructor(data) {
    this.userId = data.User_ID || data.userId;
    this.username = data.username;
    this.email = data.User_Email || data.email;
    this.firstName = data.First_Name || data.firstName;
    this.lastName = data.Last_Name || data.lastName;
    this.department = data.User_Department || data.department;
    this.role = data.User_Role || data.role || 'user';
    this.signPath = data.sign_path || data.signPath || null;
    this.createdAt = data.Created_at || data.createdAt;
  }

  // Create new user
  static async create(userData) {
    const hashedPassword = await hashPassword(userData.password);
    
    const query = `
      INSERT INTO USER (
        username, User_Email, User_Password, First_Name, Last_Name, User_Department, User_Role, Created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const values = [
      userData.username,
      userData.email,
      hashedPassword,
      userData.firstName,
      userData.lastName,
      userData.department || '',
      userData.role || 'user'
    ];

    const result = await executeQuery(query, values);
    return result.insertId;
  }

  // Find user by email
  static async findByEmail(email) {
    const query = 'SELECT * FROM USER WHERE User_Email = ?';
    const result = await executeQuery(query, [email]);
    if (result.length === 0) return null;
    const user = result[0];
    return {
      userId: user.User_ID,
      username: user.username,
      email: user.User_Email,
      firstName: user.First_Name,
      lastName: user.Last_Name,
      department: user.User_Department,
      role: user.User_Role,
      signPath: user.sign_path,
      createdAt: user.Created_at
    };
  }

  // Find user by username
  static async findByUsername(username) {
    const query = 'SELECT * FROM USER WHERE username = ?';
    const result = await executeQuery(query, [username]);
    if (result.length === 0) return null;
    const user = result[0];
    return {
      userId: user.User_ID,
      username: user.username,
      email: user.User_Email,
      firstName: user.First_Name,
      lastName: user.Last_Name,
      department: user.User_Department,
      role: user.User_Role,
      signPath: user.sign_path,
      createdAt: user.Created_at
    };
  }

  // Find user by ID
  static async findById(userId) {
    const query = 'SELECT * FROM USER WHERE User_ID = ?';
    const result = await executeQuery(query, [userId]);
    if (result.length === 0) return null;
    const user = result[0];
    return {
      userId: user.User_ID,
      username: user.username,
      email: user.User_Email,
      firstName: user.First_Name,
      lastName: user.Last_Name,
      department: user.User_Department,
      role: user.User_Role,
      signPath: user.sign_path,
      createdAt: user.Created_at
    };
  }

  // Verify user password by email
  static async verifyPassword(email, password) {
    const query = 'SELECT * FROM USER WHERE User_Email = ?';
    const result = await executeQuery(query, [email]);
    
    if (result.length === 0) {
      return null;
    }

    const user = result[0];
    const isPasswordValid = await comparePassword(password, user.User_Password);
    
    if (!isPasswordValid) {
      return null;
    }

    // Return user without password hash
    return {
      userId: user.User_ID,
      username: user.username,
      email: user.User_Email,
      firstName: user.First_Name,
      lastName: user.Last_Name,
      department: user.User_Department,
      role: user.User_Role,
      signPath: user.sign_path,
      createdAt: user.Created_at
    };
  }

  // Verify user password by username
  static async verifyPasswordByUsername(username, password) {
    const query = 'SELECT * FROM USER WHERE username = ?';
    const result = await executeQuery(query, [username]);
    
    if (result.length === 0) {
      return null;
    }

    const user = result[0];
    const isPasswordValid = await comparePassword(password, user.User_Password);
    
    if (!isPasswordValid) {
      return null;
    }

    // Return user without password hash
    return {
      userId: user.User_ID,
      username: user.username,
      email: user.User_Email,
      firstName: user.First_Name,
      lastName: user.Last_Name,
      department: user.User_Department,
      role: user.User_Role,
      signPath: user.sign_path,
      createdAt: user.Created_at
    };
  }

  // Update user
  static async update(userId, updateData) {
    const fields = [];
    const values = [];

    // Map camelCase to database column names
    const fieldMapping = {
      username: 'username',
      firstName: 'First_Name',
      lastName: 'Last_Name',
      email: 'User_Email',
      department: 'User_Department',
      password: 'User_Password',
      role: 'User_Role',
      signPath: 'sign_path'
    };

    // Handle password update separately
    if (updateData.password) {
      const hashedPassword = await hashPassword(updateData.password);
      fields.push('User_Password = ?');
      values.push(hashedPassword);
      delete updateData.password;
    }

    // Build dynamic update query
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'userId' && key !== 'password') {
        const dbField = fieldMapping[key];
        if (dbField) {
          fields.push(`${dbField} = ?`);
          values.push(updateData[key]);
        }
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(userId);
    const query = `UPDATE USER SET ${fields.join(', ')} WHERE User_ID = ?`;
    
    const result = await executeQuery(query, values);
    return result.affectedRows > 0;
  }

  // Delete user
  static async delete(userId) {
    const query = 'DELETE FROM USER WHERE User_ID = ?';
    const result = await executeQuery(query, [userId]);
    return result.affectedRows > 0;
  }

  // Get all users
  static async findAll(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    // Get total count
    const countQuery = 'SELECT COUNT(*) as total FROM USER';
    const countResult = await executeQuery(countQuery);
    const totalCount = countResult[0].total;

    // Get paginated results without password hashes
    const dataQuery = `
      SELECT User_ID, username, User_Email, First_Name, Last_Name, User_Department, User_Role, Created_at
      FROM USER 
      ORDER BY Created_at DESC 
      LIMIT ? OFFSET ?
    `;

    const rawUsers = await executeQuery(dataQuery, [limit, offset]);
    const users = rawUsers.map(user => ({
      userId: user.User_ID,
      username: user.username,
      email: user.User_Email,
      firstName: user.First_Name,
      lastName: user.Last_Name,
      department: user.User_Department,
      role: user.User_Role,
      signPath: user.sign_path,
      createdAt: user.Created_at
    }));
    
    return {
      users,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalCount / limit),
        totalCount
      }
    };
  }

  // Update user's signature path only
  static async updateSignPath(userId, signPath) {
    const query = 'UPDATE USER SET sign_path = ? WHERE User_ID = ?';
    const result = await executeQuery(query, [signPath, userId]);
    return result.affectedRows > 0;
  }
}

module.exports = User;