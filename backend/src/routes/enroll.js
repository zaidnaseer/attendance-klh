const express = require('express');
const { pool } = require('../db/client');
const { enrollmentUpload } = require('../middleware/multerConfig');
const { analyzeImage } = require('../services/mlService');

const router = express.Router();
const POSES = ['front', 'left', 'right', 'up', 'down'];

function vectorLiteral(embedding) {
  return `[${embedding.map((value) => Number(value).toFixed(6)).join(',')}]`;
}

router.post('/:studentCode', enrollmentUpload, async (req, res) => {
  try {
    const { studentCode } = req.params;
    const studentResult = await pool.query('SELECT id, name, enrolled FROM students WHERE student_code = $1', [studentCode]);
    const student = studentResult.rows[0];

    if (!student) {
      return res.status(404).json({ code: 'STUDENT_NOT_FOUND', message: 'Student not found' });
    }
    if (student.enrolled) {
      return res.status(409).json({ code: 'ALREADY_ENROLLED', message: 'Already enrolled. Nothing to do.' });
    }

    for (const pose of POSES) {
      if (!req.files || !req.files[pose] || req.files[pose].length !== 1) {
        return res.status(400).json({ code: 'INVALID_UPLOAD', message: `Missing ${pose} pose file` });
      }
    }

    const analyses = await Promise.all(
      POSES.map((pose) => analyzeImage(req.files[pose][0].buffer, req.files[pose][0].originalname, pose).then((result) => ({ pose, result }))),
    );

    for (const { pose, result } of analyses) {
      if (!result || result.is_real === false) {
        return res.status(400).json({
          code: 'SPOOF_DETECTED',
          pose,
          message: `Spoof detected on ${pose} pose`,
        });
      }
    }

    const frontEmbedding = analyses.find((item) => item.pose === 'front')?.result?.embedding;
    if (!frontEmbedding || frontEmbedding.length !== 512) {
      return res.status(500).json({ code: 'EMBEDDING_ERROR', message: 'Front embedding missing' });
    }

    const duplicateQuery = await pool.query(
      `SELECT s.student_code,
              1 - (fe.embedding <=> $1::vector) AS similarity
       FROM face_embeddings fe
       JOIN students s ON s.id = fe.student_id
       WHERE fe.pose = 'front'
       ORDER BY similarity DESC
       LIMIT 1`,
      [vectorLiteral(frontEmbedding)],
    );

    if (duplicateQuery.rows[0] && Number(duplicateQuery.rows[0].similarity) > 0.75) {
      return res.status(409).json({
        code: 'DUPLICATE_FOUND',
        message: 'Student may already be enrolled',
        matchedStudentCode: duplicateQuery.rows[0].student_code,
        similarity: Number(duplicateQuery.rows[0].similarity),
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const { pose, result } of analyses) {
        await client.query(
          'INSERT INTO face_embeddings (student_id, pose, embedding) VALUES ($1, $2, $3::vector)',
          [student.id, pose, vectorLiteral(result.embedding)],
        );
      }
      await client.query('UPDATE students SET enrolled = true WHERE id = $1', [student.id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(error);
      return res.status(500).json({ code: 'TRANSACTION_FAILED', message: 'Failed to save enrollment transaction' });
    } finally {
      client.release();
    }

    return res.json({ code: 'SUCCESS', studentName: student.name });
  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ code: 'ML_TIMEOUT', message: 'ML service unavailable' });
    }
    if (error.response && error.response.status >= 500) {
      return res.status(503).json({ code: 'ML_TIMEOUT', message: 'ML service unavailable' });
    }
    console.error(error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
  }
});

module.exports = router;
