const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT SP_ID, SP_Name FROM SOLUTION_PRINCIPAL ORDER BY SP_Name ASC'
    );
    return res.status(200).json(rows);
  } catch (error) {
    logger.error('Failed to fetch solution principals:', error);
    return res.status(500).json({ error: 'Failed to load solution principals' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const name = (req.body?.SP_Name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'SP_Name is required' });
    }

    const [existing] = await pool.execute(
      'SELECT SP_ID FROM SOLUTION_PRINCIPAL WHERE SP_Name = ? LIMIT 1',
      [name]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Solution principal already exists' });
    }

    const [result] = await pool.execute(
      'INSERT INTO SOLUTION_PRINCIPAL (SP_Name) VALUES (?)',
      [name]
    );

    return res.status(201).json({ SP_ID: result.insertId, SP_Name: name });
  } catch (error) {
    logger.error('Failed to create solution principal:', error);
    return res.status(500).json({ error: 'Failed to create solution principal' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const spId = Number(req.params.id);
    const name = (req.body?.SP_Name || '').trim();

    if (!spId) {
      return res.status(400).json({ error: 'Invalid solution principal id' });
    }
    if (!name) {
      return res.status(400).json({ error: 'SP_Name is required' });
    }

    const [result] = await pool.execute(
      'UPDATE SOLUTION_PRINCIPAL SET SP_Name = ? WHERE SP_ID = ?',
      [name, spId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Solution principal not found' });
    }

    return res.status(200).json({ success: true, SP_ID: spId, SP_Name: name });
  } catch (error) {
    logger.error('Failed to update solution principal:', error);
    return res.status(500).json({ error: 'Failed to update solution principal' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const spId = Number(req.params.id);
    if (!spId) {
      return res.status(400).json({ error: 'Invalid solution principal id' });
    }

    const [result] = await pool.execute('DELETE FROM SOLUTION_PRINCIPAL WHERE SP_ID = ?', [spId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Solution principal not found' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Failed to delete solution principal:', error);
    if (String(error.message || '').includes('foreign key constraint')) {
      return res.status(409).json({ error: 'Solution principal is in use by projects and cannot be deleted' });
    }
    return res.status(500).json({ error: 'Failed to delete solution principal' });
  }
});

module.exports = router;
