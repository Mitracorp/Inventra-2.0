const { executeQuery, getConnection } = require('../config/database');
const bcrypt = require('bcryptjs');

const table = 'USER';

const normalizeUser = (row) => {
  if (!row) return null;
  return {
    ...row,
    userId: row.User_ID,
    email: row.User_Email,
    role: row.User_Role,
    firstName: row.First_Name,
    lastName: row.Last_Name,
    department: row.User_Department
  };
};

const findByEmail = async (email) => {
  if (!email) return null;
  const rows = await executeQuery(`SELECT * FROM ${table} WHERE User_Email = ? LIMIT 1`, [email]);
  return normalizeUser(rows[0] || null);
};

const findByUsername = async (username) => {
  if (!username) return null;
  const rows = await executeQuery(`SELECT * FROM ${table} WHERE username = ? LIMIT 1`, [username]);
  return normalizeUser(rows[0] || null);
};

const findById = async (id) => {
  if (!id) return null;
  const rows = await executeQuery(`SELECT * FROM ${table} WHERE User_ID = ? LIMIT 1`, [id]);
  return normalizeUser(rows[0] || null);
};

const create = async ({ username, email, password, firstName, lastName, department, role, auditUserId = 1 }) => {
  const hash = await bcrypt.hash(password || Math.random().toString(36), 10);
  const conn = await getConnection();
  try {
    // Ensure DB audit triggers always have a valid existing user id in this same session.
    // Some databases do not have User_ID=1, so we must resolve a real FK-safe id.
    let safeAuditUserId = null;
    const [actorRows] = await conn.execute('SELECT User_ID FROM USER WHERE User_ID = ? LIMIT 1', [auditUserId || 0]);
    if (actorRows.length > 0) {
      safeAuditUserId = actorRows[0].User_ID;
    } else {
      const [fallbackRows] = await conn.execute('SELECT User_ID FROM USER ORDER BY User_ID ASC LIMIT 1');
      if (fallbackRows.length > 0) {
        safeAuditUserId = fallbackRows[0].User_ID;
      }
    }

    if (!safeAuditUserId) {
      throw new Error('Cannot create user because no valid audit user exists for HISTORY_LOG trigger');
    }

    await conn.execute('SET @current_user_id = ?', [safeAuditUserId]);
    const [result] = await conn.execute(
      `INSERT INTO ${table} (username, User_Email, User_Password, First_Name, Last_Name, User_Department, User_Role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, email, hash, firstName || null, lastName || null, department || null, role || 'user']
    );
    return result.insertId;
  } finally {
    conn.release();
  }
};

const verifyPasswordByUsername = async (username, password) => {
  const user = await findByUsername(username);
  if (!user) return null;
  const match = await bcrypt.compare(password, user.User_Password);
  if (!match) return null;
  return normalizeUser(user);
};

const verifyPassword = async (email, password) => {
  const user = await findByEmail(email);
  if (!user) return null;
  const match = await bcrypt.compare(password, user.User_Password);
  if (!match) return null;
  return normalizeUser(user);
};

const update = async (userId, fields) => {
  const sets = [];
  const params = [];
  Object.keys(fields).forEach((key) => {
    sets.push(`${key} = ?`);
    params.push(fields[key]);
  });
  if (sets.length === 0) return false;
  params.push(userId);
  const query = `UPDATE ${table} SET ${sets.join(', ')} WHERE User_ID = ?`;
  const res = await executeQuery(query, params);
  return res.affectedRows > 0;
};

const deleteUser = async (userId) => {
  const res = await executeQuery(`DELETE FROM ${table} WHERE User_ID = ?`, [userId]);
  return res.affectedRows > 0;
};

const findAll = async (page = 1, limit = 10) => {
  const offset = (page - 1) * limit;
  const rows = await executeQuery(`SELECT * FROM ${table} LIMIT ? OFFSET ?`, [parseInt(limit), parseInt(offset)]);
  const users = rows.map(normalizeUser);
  const total = await executeQuery(`SELECT COUNT(*) as cnt FROM ${table}`);
  return { users, pagination: { page, limit, total: total[0].cnt } };
};

const updateSignPath = async (userId, path) => {
  const res = await executeQuery(`UPDATE ${table} SET sign_path = ? WHERE User_ID = ?`, [path, userId]);
  return res.affectedRows > 0;
};

module.exports = {
  findByEmail,
  findByUsername,
  findById,
  create,
  verifyPasswordByUsername,
  verifyPassword,
  update,
  delete: deleteUser,
  findAll,
  updateSignPath
};
