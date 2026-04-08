const express = require('express');
const { pool } = require('../db/client');

const router = express.Router();

router.get('/:facultyCode/dashboard', async (req, res) => {
    try {
        const { facultyCode } = req.params;
        const facultyResult = await pool.query('SELECT id, name, faculty_code FROM faculties WHERE faculty_code = $1', [facultyCode]);
        const faculty = facultyResult.rows[0];

        if (!faculty) {
            return res.status(404).json({ code: 'FACULTY_NOT_FOUND', message: 'Faculty not found' });
        }

        const [coursesResult, allStudentsResult] = await Promise.all([
            pool.query(
                `SELECT c.id, c.name, c.course_code
         FROM course_faculties cf
         JOIN courses c ON c.id = cf.course_id
         WHERE cf.faculty_id = $1
         ORDER BY c.course_code`,
                [faculty.id],
            ),
            pool.query('SELECT id, name, student_code, enrolled FROM students ORDER BY student_code'),
        ]);

        const courses = [];
        for (const course of coursesResult.rows) {
            const [studentsResult, activeSessionResult, attendanceResult] = await Promise.all([
                pool.query(
                    `SELECT s.id, s.name, s.student_code, s.enrolled
           FROM course_students cs
           JOIN students s ON s.id = cs.student_id
           WHERE cs.course_id = $1
           ORDER BY s.student_code`,
                    [course.id],
                ),
                pool.query(
                    `SELECT id, started_at
           FROM attendance_sessions
           WHERE course_id = $1 AND is_active = TRUE
           ORDER BY started_at DESC
           LIMIT 1`,
                    [course.id],
                ),
                pool.query(
                    `SELECT ar.id, ar.student_id, ar.marked_at, s.student_code, s.name
           FROM attendance_records ar
           JOIN students s ON s.id = ar.student_id
           WHERE ar.session_id = (
             SELECT id
             FROM attendance_sessions
             WHERE course_id = $1 AND is_active = TRUE
             ORDER BY started_at DESC
             LIMIT 1
           )
           ORDER BY ar.marked_at DESC`,
                    [course.id],
                ),
            ]);

            courses.push({
                ...course,
                students: studentsResult.rows,
                activeSession: activeSessionResult.rows[0] || null,
                attendance: attendanceResult.rows,
            });
        }

        return res.json({
            faculty,
            courses,
            allStudents: allStudentsResult.rows,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
    }
});

router.post('/:facultyCode/courses/:courseId/students', async (req, res) => {
    try {
        const { facultyCode, courseId } = req.params;
        const { studentId } = req.body || {};

        if (!studentId) {
            return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'studentId is required' });
        }

        const allowedResult = await pool.query(
            `SELECT cf.id
       FROM course_faculties cf
       JOIN faculties f ON f.id = cf.faculty_id
       WHERE f.faculty_code = $1 AND cf.course_id = $2`,
            [facultyCode, courseId],
        );

        if (!allowedResult.rows[0]) {
            return res.status(403).json({ code: 'FORBIDDEN', message: 'Faculty is not mapped to this course' });
        }

        const result = await pool.query(
            'INSERT INTO course_students (course_id, student_id) VALUES ($1, $2) RETURNING id, course_id, student_id',
            [courseId, studentId],
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ code: 'MAPPING_EXISTS', message: 'Student already in this course' });
        }
        if (error.code === '23503') {
            return res.status(404).json({ code: 'NOT_FOUND', message: 'Course or student not found' });
        }
        console.error(error);
        return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
    }
});

router.delete('/:facultyCode/courses/:courseId/students/:studentId', async (req, res) => {
    try {
        const { facultyCode, courseId, studentId } = req.params;

        const allowedResult = await pool.query(
            `SELECT cf.id
       FROM course_faculties cf
       JOIN faculties f ON f.id = cf.faculty_id
       WHERE f.faculty_code = $1 AND cf.course_id = $2`,
            [facultyCode, courseId],
        );

        if (!allowedResult.rows[0]) {
            return res.status(403).json({ code: 'FORBIDDEN', message: 'Faculty is not mapped to this course' });
        }

        const result = await pool.query(
            'DELETE FROM course_students WHERE course_id = $1 AND student_id = $2 RETURNING id',
            [courseId, studentId],
        );

        if (!result.rows[0]) {
            return res.status(404).json({ code: 'MAPPING_NOT_FOUND', message: 'Student is not mapped to this course' });
        }

        return res.json({ code: 'SUCCESS', message: 'Student removed from course' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
    }
});

router.post('/:facultyCode/courses/:courseId/sessions/start', async (req, res) => {
    const client = await pool.connect();
    try {
        const { facultyCode, courseId } = req.params;

        const allowedResult = await client.query(
            `SELECT f.id AS faculty_id
       FROM course_faculties cf
       JOIN faculties f ON f.id = cf.faculty_id
       WHERE f.faculty_code = $1 AND cf.course_id = $2`,
            [facultyCode, courseId],
        );

        const allowed = allowedResult.rows[0];
        if (!allowed) {
            return res.status(403).json({ code: 'FORBIDDEN', message: 'Faculty is not mapped to this course' });
        }

        await client.query('BEGIN');
        await client.query(
            `UPDATE attendance_sessions
       SET is_active = FALSE, ended_at = NOW()
       WHERE course_id = $1 AND is_active = TRUE`,
            [courseId],
        );

        const startedResult = await client.query(
            `INSERT INTO attendance_sessions (course_id, started_by_faculty_id, is_active)
       VALUES ($1, $2, TRUE)
       RETURNING id, course_id, started_by_faculty_id, started_at, is_active`,
            [courseId, allowed.faculty_id],
        );

        await client.query('COMMIT');
        return res.status(201).json(startedResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
    } finally {
        client.release();
    }
});

module.exports = router;
