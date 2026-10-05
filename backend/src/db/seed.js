// Demo seed data. Idempotent; pass --reset to wipe data tables first.
// Usage: npm run seed [-- --reset]
const { pool } = require('./client');

const FACULTIES = [
  ['Dr. Meera Iyer', 'FAC001'],
  ['Prof. Rahul Verma', 'FAC002'],
  ['Dr. Sana Khan', 'FAC003'],
];

// [name, course_code, section] - same name + different section = same subject, different class.
const COURSES = [
  ['Data Structures', 'CS101-A', 'A'],
  ['Data Structures', 'CS101-B', 'B'],
  ['Operating Systems', 'CS201', null],
  ['Linear Algebra', 'MA101-A', 'A'],
  ['Linear Algebra', 'MA101-B', 'B'],
  ['Engineering Physics', 'PH101', null],
  ['Technical English', 'EN101', null],
];

const STUDENT_NAMES = [
  'Aarav Sharma', 'Isha Patel', 'Vihaan Reddy', 'Ananya Nair', 'Kabir Singh',
  'Diya Menon', 'Arjun Gupta', 'Meera Joshi', 'Rohan Das', 'Saanvi Rao',
  'Aditya Kulkarni', 'Navya Pillai', 'Karan Malhotra', 'Riya Bose', 'Dev Chopra',
  'Tara Bhatt', 'Yash Agarwal', 'Pooja Desai', 'Neil Fernandes', 'Zara Ahmed',
  'Harsh Vora', 'Kiara Shah', 'Sameer Qureshi', 'Lakshmi Iyer', 'Omar Siddiqui',
];
const STUDENTS = STUDENT_NAMES.map((n, i) => [n, `STU${String(i + 1).padStart(3, '0')}`]);

// course -> faculty, and course -> student index range [from, to)
const COURSE_FACULTY = {
  'CS101-A': 'FAC001', 'CS101-B': 'FAC001', CS201: 'FAC001',
  'MA101-A': 'FAC002', 'MA101-B': 'FAC002', PH101: 'FAC002', EN101: 'FAC003',
};
const COURSE_STUDENTS = {
  'CS101-A': [0, 12], 'CS101-B': [12, 25], CS201: [5, 20],
  'MA101-A': [0, 10], 'MA101-B': [10, 25], PH101: [10, 25], EN101: [0, 25],
};

const SESSIONS_PER_COURSE = 7;

// Deterministic pseudo-random so reseeding yields the same history.
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (process.argv.includes('--reset')) {
      await client.query(`TRUNCATE qr_attempts, qr_tokens, attendance_records, attendance_sessions,
        course_students, course_faculties, face_embeddings, students, faculties, courses CASCADE`);
      console.log('Existing data cleared.');
    }

    for (const [name, code] of FACULTIES) {
      await client.query(
        'INSERT INTO faculties (name, faculty_code) VALUES ($1,$2) ON CONFLICT (faculty_code) DO NOTHING', [name, code]);
    }
    for (const [name, code, section] of COURSES) {
      await client.query(
        'INSERT INTO courses (name, course_code, section) VALUES ($1,$2,$3) ON CONFLICT (course_code) DO NOTHING',
        [name, code, section]);
    }
    for (const [name, code] of STUDENTS) {
      await client.query(
        'INSERT INTO students (name, student_code) VALUES ($1,$2) ON CONFLICT (student_code) DO NOTHING', [name, code]);
    }

    const idMap = async (table, col) =>
      Object.fromEntries((await client.query(`SELECT id, ${col} AS code FROM ${table}`)).rows.map(r => [r.code, r.id]));
    const fac = await idMap('faculties', 'faculty_code');
    const crs = await idMap('courses', 'course_code');
    const stu = await idMap('students', 'student_code');

    for (const [course, facCode] of Object.entries(COURSE_FACULTY)) {
      await client.query(
        'INSERT INTO course_faculties (course_id, faculty_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [crs[course], fac[facCode]]);
      const [from, to] = COURSE_STUDENTS[course];
      for (const [, code] of STUDENTS.slice(from, to)) {
        await client.query(
          'INSERT INTO course_students (course_id, student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [crs[course], stu[code]]);
      }
    }

    // Past sessions + attendance history, only for courses that have none yet.
    let sessionCount = 0;
    for (const [course, facCode] of Object.entries(COURSE_FACULTY)) {
      const existing = await client.query(
        'SELECT 1 FROM attendance_sessions WHERE course_id=$1 LIMIT 1', [crs[course]]);
      if (existing.rowCount) continue;

      const [from, to] = COURSE_STUDENTS[course];
      const roster = STUDENTS.slice(from, to).map(([, code]) => code);
      const rand = rng(course.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
      // Per-student attendance propensity between 0.55 and 0.98.
      const propensity = Object.fromEntries(roster.map(c => [c, 0.55 + rand() * 0.43]));

      for (let i = 0; i < SESSIONS_PER_COURSE; i++) {
        const daysAgo = (SESSIONS_PER_COURSE - i) * 4;
        const { rows } = await client.query(
          `INSERT INTO attendance_sessions (course_id, started_by_faculty_id, is_active, started_at, ended_at)
           VALUES ($1,$2,false, NOW() - ($3 || ' days')::interval, NOW() - ($3 || ' days')::interval + interval '50 minutes')
           RETURNING id, started_at`,
          [crs[course], fac[facCode], String(daysAgo)]);
        sessionCount++;
        for (const code of roster) {
          if (rand() > propensity[code]) continue;
          await client.query(
            `INSERT INTO attendance_records (session_id, student_id, status, marked_at, ble_passed)
             VALUES ($1,$2,'present',$3,true) ON CONFLICT DO NOTHING`,
            [rows[0].id, stu[code], new Date(new Date(rows[0].started_at).getTime() + Math.floor(rand() * 15) * 60000)]);
        }
      }
    }

    await client.query('COMMIT');
    console.log(`Seeded ${FACULTIES.length} faculty, ${COURSES.length} courses, ${STUDENTS.length} students, ${sessionCount} new past sessions.`);
    console.log('Faculty codes: FAC001-FAC003 | Student codes: STU001-STU025 (not face-enrolled; enroll via /enroll/<code>)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
