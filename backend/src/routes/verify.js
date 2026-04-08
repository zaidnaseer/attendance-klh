const express = require('express');
const { pool } = require('../db/client');
const { verifyUpload } = require('../middleware/multerConfig');
const { verifyImage } = require('../services/mlService');

const router = express.Router();
const DEFAULT_MATCH_THRESHOLD = 0.62;

function vectorLiteral(embedding) {
    return `[${embedding.map((value) => Number(value).toFixed(6)).join(',')}]`;
}

function getThreshold() {
    const parsed = Number(process.env.VERIFY_MATCH_THRESHOLD);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) {
        return DEFAULT_MATCH_THRESHOLD;
    }
    return parsed;
}

router.post('/:studentCode', verifyUpload, async (req, res) => {
    try {
        const { studentCode } = req.params;
        if (!req.file) {
            return res.status(400).json({ code: 'INVALID_UPLOAD', message: 'Missing verification image' });
        }

        const studentResult = await pool.query('SELECT id, name, student_code, enrolled FROM students WHERE student_code = $1', [studentCode]);
        const student = studentResult.rows[0];

        if (!student) {
            return res.status(404).json({ code: 'STUDENT_NOT_FOUND', message: 'Student not found' });
        }
        if (!student.enrolled) {
            return res.status(409).json({ code: 'NOT_ENROLLED', message: 'Student is not enrolled yet' });
        }

        const modelResult = await verifyImage(req.file.buffer, req.file.originalname);

        if (!modelResult.face_detected) {
            return res.status(400).json({
                code: 'FACE_NOT_DETECTED',
                message: 'No face detected. Please align your face and try again.',
                detector: modelResult.detector,
            });
        }

        if (Number(modelResult.face_count) > 1) {
            return res.status(400).json({
                code: 'MULTIPLE_FACES',
                message: 'Multiple faces detected. Only one person should be visible.',
                detector: modelResult.detector,
            });
        }

        if (!modelResult.is_real) {
            return res.status(400).json({
                code: 'SPOOF_DETECTED',
                message: 'Liveness check failed. Please try again with a real face.',
                spoofScore: Number(modelResult.spoof_score || 1),
            });
        }

        if (!Array.isArray(modelResult.embedding) || modelResult.embedding.length !== 512) {
            return res.status(500).json({ code: 'EMBEDDING_ERROR', message: 'Failed to generate face embedding' });
        }

        const probe = vectorLiteral(modelResult.embedding);
        const threshold = getThreshold();

        const expectedSimilarityResult = await pool.query(
            `SELECT MAX(1 - (embedding <=> $2::vector)) AS similarity
       FROM face_embeddings
       WHERE student_id = $1`,
            [student.id, probe],
        );

        const expectedSimilarity = Number(expectedSimilarityResult.rows[0]?.similarity || 0);

        const bestOverallResult = await pool.query(
            `SELECT s.student_code,
              s.name,
              1 - (fe.embedding <=> $1::vector) AS similarity
       FROM face_embeddings fe
       JOIN students s ON s.id = fe.student_id
       ORDER BY similarity DESC
       LIMIT 1`,
            [probe],
        );

        const bestOverall = bestOverallResult.rows[0] || null;
        const bestOverallSimilarity = Number(bestOverall?.similarity || 0);

        if (expectedSimilarity >= threshold) {
            return res.json({
                code: 'VERIFIED',
                message: 'Verification successful. Identity confirmed.',
                matched: true,
                studentCode: student.student_code,
                studentName: student.name,
                similarity: expectedSimilarity,
                threshold,
                detector: modelResult.detector,
                recognizer: modelResult.recognizer,
            });
        }

        if (bestOverall && bestOverall.student_code !== student.student_code && bestOverallSimilarity >= threshold) {
            return res.status(401).json({
                code: 'FACE_MISMATCH',
                message: 'Face does not match the selected student.',
                matched: false,
                expectedStudentCode: student.student_code,
                matchedStudentCode: bestOverall.student_code,
                matchedStudentName: bestOverall.name,
                similarity: bestOverallSimilarity,
                threshold,
            });
        }

        return res.status(401).json({
            code: 'FACE_NOT_RECOGNIZED',
            message: 'Face not recognized for this student.',
            matched: false,
            similarity: expectedSimilarity,
            threshold,
        });
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
