const express = require('express');
const { pool } = require('../db/client');

const router = express.Router();

function isValidStudentCode(studentCode) {
  return typeof studentCode === 'string' && /^[A-Za-z0-9-]{1,50}$/.test(studentCode);
}

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, student_code, enrolled, created_at FROM students ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, studentCode } = req.body || {};
    if (!name || !studentCode) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'name and studentCode are required' });
    }
    if (!isValidStudentCode(studentCode)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid studentCode' });
    }

    const result = await pool.query(
      'INSERT INTO students (name, student_code) VALUES ($1, $2) RETURNING id, name, student_code, enrolled, created_at',
      [name.trim(), studentCode.trim()],
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ code: 'STUDENT_CODE_EXISTS', message: 'Student code already exists' });
    }
    console.error(error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
  }
});

router.get('/:studentCode', async (req, res) => {
  try {
    const { studentCode } = req.params;
    const { rows } = await pool.query('SELECT id, name, student_code, enrolled, created_at FROM students WHERE student_code = $1', [studentCode]);
    if (!rows[0]) {
      return res.status(404).json({ code: 'STUDENT_NOT_FOUND', message: 'Student not found' });
    }
    return res.json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
  }
});

router.delete('/:studentCode', async (req, res) => {
  try {
    const { studentCode } = req.params;
    const result = await pool.query('DELETE FROM students WHERE student_code = $1 RETURNING id', [studentCode]);
    if (!result.rows[0]) {
      return res.status(404).json({ code: 'STUDENT_NOT_FOUND', message: 'Student not found' });
    }
    return res.json({ code: 'SUCCESS', message: 'Student deleted' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
  }
});

module.exports = router;
