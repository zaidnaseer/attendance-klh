const express = require('express');
const { pool } = require('../db/client');
const qrService = require('../services/qrService');
const { requiresGps, requiresQr } = require('../services/gpsService');

const router = express.Router();

router.get('/:studentCode/dashboard', async (req, res) => {
    try {
        const { studentCode } = req.params;
        const studentResult = await pool.query(
            'SELECT id, name, student_code, enrolled FROM students WHERE student_code = $1',
            [studentCode],
        );

        const student = studentResult.rows[0];
        if (!student) {
            return res.status(404).json({ code: 'STUDENT_NOT_FOUND', message: 'Student not found' });
        }

        const coursesResult = await pool.query(
            `SELECT c.id, c.name, c.course_code,
              session.id AS active_session_id,
              session.started_at AS active_session_started_at,
              session.verification_mode AS active_session_verification_mode,
              CASE WHEN ar.id IS NULL OR ar.status != 'present' THEN FALSE ELSE TRUE END AS is_present    
       FROM course_students cs
       JOIN courses c ON c.id = cs.course_id
       LEFT JOIN LATERAL (
         SELECT id, started_at, verification_mode
         FROM attendance_sessions
         WHERE course_id = c.id AND is_active = TRUE
         ORDER BY started_at DESC
         LIMIT 1
       ) session ON TRUE
       LEFT JOIN attendance_records ar
         ON ar.session_id = session.id AND ar.student_id = cs.student_id
       WHERE cs.student_id = $1
       ORDER BY c.course_code`,
            [student.id],
        );

        return res.json({
            student,
            courses: coursesResult.rows,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
    }
});

router.post('/:studentCode/attendance/mark', async (req, res) => {
    try {
        const { studentCode } = req.params;
        const { sessionId } = req.body || {};

        if (!sessionId) {
            return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'sessionId is required' });
        }

        const studentResult = await pool.query(
            'SELECT id, enrolled FROM students WHERE student_code = $1',
            [studentCode],
        );
        const student = studentResult.rows[0];

        if (!student) {
            return res.status(404).json({ code: 'STUDENT_NOT_FOUND', message: 'Student not found' });
        }

        if (!student.enrolled) {
            return res.status(409).json({ code: 'NOT_ENROLLED', message: 'Student is not enrolled yet' });
        }

        const sessionResult = await pool.query(
            `SELECT s.id, s.course_id, s.is_active, s.verification_mode
       FROM attendance_sessions s
       WHERE s.id = $1`,
            [sessionId],
        );
        const session = sessionResult.rows[0];

        if (!session) {
            return res.status(404).json({ code: 'SESSION_NOT_FOUND', message: 'Attendance session not found' });
        }

        if (!session.is_active) {
            return res.status(409).json({ code: 'SESSION_NOT_ACTIVE', message: 'Attendance session is not active' });
        }

        const inCourseResult = await pool.query(
            'SELECT id FROM course_students WHERE course_id = $1 AND student_id = $2',
            [session.course_id, student.id],
        );

        if (!inCourseResult.rows[0]) {
            return res.status(403).json({ code: 'NOT_IN_COURSE', message: 'Student is not assigned to this course' });
        }

        // Enforce the faculty-selected presence checks server-side
        const gatesResult = await pool.query(
            'SELECT ble_passed, gps_passed FROM attendance_records WHERE session_id = $1 AND student_id = $2',
            [sessionId, student.id],
        );
        const gates = gatesResult.rows[0] || {};
        if (requiresQr(session.verification_mode) && !gates.ble_passed) {
            return res.status(403).json({ code: 'QR_NOT_VERIFIED', message: 'QR code verification is required before marking attendance' });
        }
        if (requiresGps(session.verification_mode) && !gates.gps_passed) {
            return res.status(403).json({ code: 'GPS_NOT_VERIFIED', message: 'Location verification is required before marking attendance' });
        }

        const result = await pool.query(
            `INSERT INTO attendance_records (session_id, student_id, status)
       VALUES ($1, $2, 'present')
       ON CONFLICT (session_id, student_id) DO UPDATE SET status = 'present', marked_at = NOW()
       RETURNING id, session_id, student_id, status, marked_at`,
            [sessionId, student.id],
        );
        
        // Notify faculty instantly
        qrService.emitToFaculty(sessionId, 'attendance-marked', { studentId: student.id });

        return res.status(201).json({ code: 'SUCCESS', attendance: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
    }
});

module.exports = router;
