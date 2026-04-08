const express = require('express');
const { pool } = require('../db/client');

const router = express.Router();

function isValidCode(value) {
    return typeof value === 'string' && /^[A-Za-z0-9-]{1,50}$/.test(value);
}

router.get('/overview', async (_req, res) => {
    try {
        const [facultiesResult, coursesResult, studentsResult, courseFacultyResult, courseStudentResult] = await Promise.all([
            pool.query('SELECT id, name, faculty_code, created_at FROM faculties ORDER BY created_at DESC'),
            pool.query('SELECT id, name, course_code, created_at FROM courses ORDER BY created_at DESC'),
            pool.query('SELECT id, name, student_code, enrolled, created_at FROM students ORDER BY created_at DESC'),
            pool.query(
                `SELECT cf.id, cf.course_id, cf.faculty_id, c.name AS course_name, c.course_code, f.name AS faculty_name, f.faculty_code
         FROM course_faculties cf
         JOIN courses c ON c.id = cf.course_id
         JOIN faculties f ON f.id = cf.faculty_id
         ORDER BY c.course_code, f.faculty_code`,
            ),
            pool.query(
                `SELECT cs.id, cs.course_id, cs.student_id, c.name AS course_name, c.course_code, s.name AS student_name, s.student_code
         FROM course_students cs
         JOIN courses c ON c.id = cs.course_id
         JOIN students s ON s.id = cs.student_id
         ORDER BY c.course_code, s.student_code`,
            ),
        ]);

        return res.json({
            faculties: facultiesResult.rows,
            courses: coursesResult.rows,
            students: studentsResult.rows,
            courseFaculties: courseFacultyResult.rows,
            courseStudents: courseStudentResult.rows,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
    }
});

router.post('/faculties', async (req, res) => {
    try {
        const { name, facultyCode } = req.body || {};
        if (!name || !facultyCode) {
            return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'name and facultyCode are required' });
        }
        if (!isValidCode(facultyCode)) {
            return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid facultyCode' });
        }

        const result = await pool.query(
            'INSERT INTO faculties (name, faculty_code) VALUES ($1, $2) RETURNING id, name, faculty_code, created_at',
            [name.trim(), facultyCode.trim()],
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ code: 'FACULTY_CODE_EXISTS', message: 'Faculty code already exists' });
        }
        console.error(error);
        return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
    }
});

router.delete('/faculties/:facultyCode', async (req, res) => {
    try {
        const { facultyCode } = req.params;
        const result = await pool.query('DELETE FROM faculties WHERE faculty_code = $1 RETURNING id', [facultyCode]);
        if (!result.rows[0]) {
            return res.status(404).json({ code: 'FACULTY_NOT_FOUND', message: 'Faculty not found' });
        }
        return res.json({ code: 'SUCCESS', message: 'Faculty deleted' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
    }
});

router.post('/courses', async (req, res) => {
    try {
        const { name, courseCode } = req.body || {};
        if (!name || !courseCode) {
            return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'name and courseCode are required' });
        }
        if (!isValidCode(courseCode)) {
            return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid courseCode' });
        }

        const result = await pool.query(
            'INSERT INTO courses (name, course_code) VALUES ($1, $2) RETURNING id, name, course_code, created_at',
            [name.trim(), courseCode.trim()],
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ code: 'COURSE_CODE_EXISTS', message: 'Course code already exists' });
        }
        console.error(error);
        return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
    }
});

router.delete('/courses/:courseCode', async (req, res) => {
    try {
        const { courseCode } = req.params;
        const result = await pool.query('DELETE FROM courses WHERE course_code = $1 RETURNING id', [courseCode]);
        if (!result.rows[0]) {
            return res.status(404).json({ code: 'COURSE_NOT_FOUND', message: 'Course not found' });
        }
        return res.json({ code: 'SUCCESS', message: 'Course deleted' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
    }
});

router.post('/course-faculties', async (req, res) => {
    try {
        const { courseId, facultyId } = req.body || {};
        if (!courseId || !facultyId) {
            return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'courseId and facultyId are required' });
        }

        const result = await pool.query(
            'INSERT INTO course_faculties (course_id, faculty_id) VALUES ($1, $2) RETURNING id, course_id, faculty_id, created_at',
            [courseId, facultyId],
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ code: 'MAPPING_EXISTS', message: 'Faculty is already mapped to this course' });
        }
        if (error.code === '23503') {
            return res.status(404).json({ code: 'NOT_FOUND', message: 'Course or faculty not found' });
        }
        console.error(error);
        return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
    }
});

router.delete('/course-faculties/:mappingId', async (req, res) => {
    try {
        const { mappingId } = req.params;
        const result = await pool.query('DELETE FROM course_faculties WHERE id = $1 RETURNING id', [mappingId]);
        if (!result.rows[0]) {
            return res.status(404).json({ code: 'MAPPING_NOT_FOUND', message: 'Mapping not found' });
        }
        return res.json({ code: 'SUCCESS', message: 'Mapping removed' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
    }
});

router.post('/course-students', async (req, res) => {
    try {
        const { courseId, studentId } = req.body || {};
        if (!courseId || !studentId) {
            return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'courseId and studentId are required' });
        }

        const result = await pool.query(
            'INSERT INTO course_students (course_id, student_id) VALUES ($1, $2) RETURNING id, course_id, student_id, created_at',
            [courseId, studentId],
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ code: 'MAPPING_EXISTS', message: 'Student is already mapped to this course' });
        }
        if (error.code === '23503') {
            return res.status(404).json({ code: 'NOT_FOUND', message: 'Course or student not found' });
        }
        console.error(error);
        return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
    }
});

router.delete('/course-students/:mappingId', async (req, res) => {
    try {
        const { mappingId } = req.params;
        const result = await pool.query('DELETE FROM course_students WHERE id = $1 RETURNING id', [mappingId]);
        if (!result.rows[0]) {
            return res.status(404).json({ code: 'MAPPING_NOT_FOUND', message: 'Mapping not found' });
        }
        return res.json({ code: 'SUCCESS', message: 'Mapping removed' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
    }
});

module.exports = router;
